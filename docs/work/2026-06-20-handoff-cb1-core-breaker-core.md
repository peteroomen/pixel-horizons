# Handoff — CB.1 Deterministic Core Breaker physics core (`surface/core-breaker.ts`)

**For:** the next session (assume you start cold)
**Date written:** 2026-06-20
**Roadmap item:** Phase CB — CB.1 (deterministic physics core, sim-only)
**Suggested branch:** `feature/cb1-core-breaker-core`

---

## TL;DR

The CB.0 spike proved the carom direction; **the pivot is the direction now.** CB.1 makes the
physics **real**: port the throwaway solver into a **seeded, fixed-timestep, deterministic,
React/Pixi/DOM-free** sim module at `src/game/surface/core-breaker.ts`, backed by Vitest proving
**same field + same shot inputs ⇒ identical peg-break + drop streams**. This is the first slice
of the surface rebuild that is held to the same bar as the rest of `src/game/sim/` — it's sacred
sim code, not a spike.

**No rendering, no React, no input handling, no module wiring.** Just a pure, testable solver.

---

## Context — read these first (~10 min)

1. `src/app/core-breaker-spike/core-breaker-spike.ts` — **the spike solver you are porting.** It
   already has the right shape: `stepPhysics(ball, pegs, knobs, dt)`, restitution reflect +
   positional correction, pierce drag, homing steer, bouncy on-rest AoE, per-peg hit cooldown,
   settle detection. CB.1 is "this, but deterministic, pure, and tested." (Throwaway — delete at
   CB.4; do **not** import from `src/app/` into the sim.)
2. `docs/work/2026-06-20-cb0-core-breaker-spike.md` — what the spike decided + the start numbers
   it landed on (G≈900, e≈0.72, ballR=6, pegR=7, ~46 pegs, 9 shots).
3. `docs/decisions/011-core-breaker-surface-loop.md` — the pivot ADR (esp. "Determinism is
   preserved (ADR 003)").
4. `docs/game-design.md` §6.2 (Playfield), §6.4 (Ball roles), §6.7 (Peg types) — the design the
   solver serves. §6.7 peg set for Sector 1: Mineral Node (1-hit), Ore Vein (3-hit), Hardrock
   (2-hit), Bloom Growth (consumes the ball), Crystal Peg (armoured).
5. `src/game/sim/rng.ts` — the seeded PRNG (`createRng` / `deriveRng`). **All randomness flows
   through this; `Math.random()` is banned in `src/game/`.**
6. `src/game/sim/planet.test.ts` — the determinism-test style to mirror.

**Mental model:** the spike, re-housed in `src/game/surface/` under the sim's determinism +
purity contract, with tests that lock the behaviour in.

---

## ⚠️ Before writing any code (CLAUDE.md gate)

1. Write a plan file `docs/work/2026-06-20-cb1-core-breaker-core.md` (CLAUDE.md plan format, incl.
   Manual test steps — for a sim slice these are mostly Vitest assertions). Present it and **get
   explicit confirmation** before coding.
2. `git checkout -b feature/cb1-core-breaker-core`.
3. **Node 22 first:** `nvm use 22` before `pnpm install` / `pnpm test` / any commit.

---

## Goal & explicit non-goals

**Done =** `src/game/surface/core-breaker.ts` exists as a pure, deterministic, fixed-timestep
circle-vs-peg simulation with a clean public API, and `core-breaker.test.ts` proves determinism +
the core behaviours (multi-hit pegs, ball-consumed-by-hazard, settle/rest, pierce/bounce/homing).
`pnpm test` green, `pnpm type-check` + `eslint src` clean.

**NOT in scope (resist — these are later CB slices):**
- ❌ **Field generation** — CB.1 takes a field (`Peg[]`) as **input**. Seeded layout from the
  planet descriptor is **CB.2** (`surface/field-gen.ts`). CB.1's tests use small hand-authored
  fields. (This keeps the solver and the layout independently testable.)
- ❌ **Rendering** — no Pixi, no `renderer/`. CB.4 builds `core-breaker-renderer.ts`.
- ❌ **Module → ball projection / the bag / reactor-as-shots** — CB.3. CB.1 takes a ball *type*
  and a *shot input*, nothing about where the ball came from.
- ❌ **Input handling** — the sim takes a resolved shot (angle + power, or aim vector), not
  pointer events.
- ❌ **Bloom spread / hopper-clog soft-fail** — CB.6. CB.1 models "Bloom peg consumes the ball"
  (ends the shot) but not field-fouling-over-time.
- ❌ **RunState persistence / save-version bump** — a drop resolves within a screen; don't store
  mid-flight physics in `RunState`. (`RUN_STATE_VERSION` is currently 4; leave it.)

---

## Recommended API shape

Design the solver as a **pure function over an explicit world**, driven entirely by a fixed
sub-step — no wall-clock, no `performance.now`, no frame-time math. The renderer (CB.4) will own
the accumulator that turns real frame time into fixed steps; the sim only ever advances by the
fixed `STEP`.

```ts
// src/game/surface/core-breaker.ts  (sim — no React/Pixi/DOM imports)

export type BallType = 'pierce' | 'bouncy' | 'homing' | 'phase';
export interface Peg { id: number; x: number; y: number; r: number; kind: PegKind;
                       hits: number; maxHits: number; }
export type PegKind = 'mineral' | 'ore' | 'hardrock' | 'bloom' | 'crystal';
export interface Ball { x; y; vx; vy; r; type: BallType; live: boolean; /* +settle, cooldowns */ }
export interface ShotInput { type: BallType; angleRad: number; power: number; } // resolved, deterministic
export interface CoreBreakerConfig { gravity; restitution; floorY; width; height; step; /* … */ }

/** Advance the world by exactly one fixed sub-step. Pure-ish: mutates the passed world, returns events. */
export function step(world: CoreBreakerWorld, cfg: CoreBreakerConfig): StepEvents;

/** Run a whole shot to completion (settle or fall-out or consumed), returning the ordered
 *  peg-break + drop stream. THIS is what the determinism test pins. */
export function simulateShot(world: CoreBreakerWorld, shot: ShotInput, cfg: CoreBreakerConfig): ShotResult;
```

- `simulateShot` loops `step` at the fixed `cfg.step` until the ball settles / falls past
  `floorY` / is consumed by a Bloom peg, with a **hard max-iteration cap** (e.g. 10 000 steps) so
  a pathological shot can't infinite-loop. Returns `{ brokenPegIds: number[], drops: Drop[],
  steps: number, end: 'settled' | 'fellOut' | 'consumed' }` — the *ordered* streams are the thing
  determinism locks.
- **Does the solver need the RNG at all?** Pure circle-vs-peg is fully deterministic **without**
  randomness — the seed enters at field-gen (CB.2), not here. So `simulateShot(sameWorld, sameShot,
  sameCfg)` is deterministic by construction. If you *do* introduce any randomness (e.g. a
  jittered bounce), it **must** come from a passed-in seeded `Rng` (`deriveRng(seed,
  'core-breaker')`), never `Math.random()` — but prefer keeping the core RNG-free.

### Determinism rules (ADR 003) — the whole point of CB.1

- **Drive by fixed `STEP` only.** No `dt` from frame time inside the sim. (The spike's 240 Hz
  accumulator lives in the *renderer*; the sim just takes `STEP`.)
- **Deterministic iteration order.** Iterate pegs in a stable order (array order / by id), not by
  `Map`/`Set` insertion you can't guarantee. Per-peg cooldowns keyed by id, decremented each step.
- **No `Date`, no `performance.now`, no `Math.random`.** Same inputs ⇒ identical output, forever
  — that's what powers shareable seeds + daily runs.
- Float math (`Math.sqrt`/`hypot`) is IEEE-754-deterministic for identical inputs — fine. Just
  don't let ordering or wall-clock leak in.

---

## Peg kinds for CB.1 (from §6.7)

Model the **behaviour** (CB.2 places them): `mineral` 1-hit→1 scrap · `ore` 3-hit→2 biominerals ·
`hardrock` 2-hit→1 scrap · `bloom` **consumes the ball** (shot ends; pierce/`phase` survives) →
clearing drops 1 scrap · `crystal` armoured (multi-hit)→core crystal. Drops are emitted as a
deterministic stream in break order; the *resource → RunState* banking is wired in CB.4 — CB.1
just returns the `Drop[]`.

Add `phase` as a fourth ball type now (cheap): passes through **one** Bloom peg without being
consumed (§6.4 Phase Shifter). Keeps CB.3's projection table from needing a solver change later.

---

## Tests to write (`core-breaker.test.ts`) — this IS the deliverable's proof

- **Determinism:** a hand-authored field + a fixed `ShotInput` → `simulateShot` twice →
  `expect(a).toEqual(b)` on the full `ShotResult` (broken ids + drops + steps + end). The
  headline test.
- **Determinism across a sequence:** fire 9 scripted shots at a field, snapshot the cumulative
  break/drop stream, assert it reproduces.
- **Multi-hit pegs:** an `ore` peg takes exactly 3 distinct hits to break (per-peg cooldown stops
  one overlap counting 3×); breaks on the 3rd.
- **Ball consumed by Bloom:** a `bouncy`/`pierce` ball into a lone `bloom` peg → `end:
  'consumed'` for non-pierce, survives for `pierce`/`phase`.
- **Settle / fall-out:** a ball that loses energy ends within the rest window; a ball aimed
  straight down ends as `fellOut`; neither exceeds the max-step cap.
- **No tunneling:** a very fast shot fired through a peg still registers the hit (the fixed
  sub-step is small enough) — port the spike's anti-tunneling guarantee as an assertion.
- **Pierce vs. bounce vs. homing** each produce distinguishable trajectories/results on the same
  field (sanity, not pixel-exact).

---

## ⚠️ Reconcile with the roadmap: do NOT delete `surface/physics.ts` in CB.1

The roadmap CB.1 line says "Retire `surface/physics.ts` (AABB)." **Heads-up:** `physics.ts` is
still imported by the entire live platformer surface — `clone.ts`, `pod.ts`, `hazards.ts`,
`enemies.ts`, `drops.ts` (verified 2026-06-20) — plus `tilemap.ts` and a large test suite hang
off it. Deleting it in CB.1 cascades into removing the whole platformer loop, which is
**explicitly CB.7's job** ("Remove retired platformer code paths… once Core Breaker is the live
surface loop"). That can't happen until CB.4 makes Core Breaker live.

**Recommendation (raise with the user in your plan):** keep CB.1 **additive** — add
`core-breaker.ts` + tests, leave `physics.ts` and the platformer intact until CB.7. One small,
green, reviewable slice (CLAUDE.md: "ship small slices"). If the user instead wants the old
platformer torn out now, that's a separate, larger cleanup slice — flag the blast radius
(clone/pod/hazards/enemies/tilemap + their tests) before doing it.

---

## Gotchas (from CLAUDE.md)

- **Node 22** (`nvm use 22`) before install/test/commit (Husky breaks on 20).
- TS strict — no `any`/`@ts-ignore` without a why-comment; the pre-commit hook enforces it.
- **Sim purity is sacred:** `core-breaker.ts` imports **nothing** from React, Pixi, the DOM, or
  `src/app/`. If it can't run in a Vitest test, it doesn't belong there.
- `Math.random()` is banned in `src/game/` — seeded `Rng` only (and prefer an RNG-free core).
- Lint is `eslint src` (`next lint` removed in Next 16). Don't reformat `docs/` (it's in
  `.prettierignore`).
- Don't bump `RUN_STATE_VERSION` — CB.1 stores nothing in `RunState`.

---

## What to hand to CB.2 (next slice after this)

If CB.1 lands green: **CB.2 field generation** — `surface/field-gen.ts` builds a deterministic
`Peg[]` from the run seed + `PlanetDescriptor` (`planetForNode(seed, nodeId)` → `{ seed, type }`;
ADR 010), with §6.7 peg-type weighting (Bloom weighted to guard ore/crystal), density/richness by
difficulty, and a reachability check (every peg hit by at least one trajectory class — uses CB.1's
`simulateShot`). Replaces `tilemap.ts`/chunk grammar. CB.1's `simulateShot` is the tool CB.2's
reachability test calls.

---

## Manual test steps (for your plan file)

Mostly Vitest (sim slice), plus the build sanity:

- [ ] `nvm use 22 && pnpm test` — `core-breaker.test.ts` green; determinism headline passes.
- [ ] `pnpm type-check` + `eslint src` clean.
- [ ] Determinism: run the headline test twice / with `--repeat` — identical.
- [ ] Edge: max-step cap holds — a ball aimed into a tight pocket settles or caps, never hangs
      the test runner.
- [ ] Edge: `bloom` peg consumes a `bouncy` ball but not a `pierce`/`phase` ball.
- [ ] `pnpm build` still green (nothing in `src/app` broke).
