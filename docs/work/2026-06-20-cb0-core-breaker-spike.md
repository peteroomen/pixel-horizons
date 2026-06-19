# CB.0 — Core Breaker feel prototype (`/core-breaker-spike`)

**Date:** 2026-06-20
**Branch:** feature/core-breaker-spike
**Roadmap item:** Phase CB — CB.0 (throwaway feel prototype)

## Goal

A throwaway `/core-breaker-spike` browser harness that proves the Core Breaker carom is
**fun** — drag-to-aim, release-to-fire a ball into a peg field, watch it bounce/ricochet and
shatter pegs, with a shots counter. The single deliverable is a **yes/no on feel, verified on
desktop and a phone (375px)**. If the aim-and-shatter doesn't feel good, **stop and re-judge
the pivot** before any CB.1+ work. (Per the handoff, this is the gate for the whole surface
pivot.)

## Approach

**Clone the existing throwaway-harness pattern** — `src/app/planet-spike/page.tsx` is the
template: a `'use client'` page that mounts a PixiJS v8 `Application`, applies the integer
pixel-scale fit (`computeScale` / `VIRTUAL_WIDTH=640` × `VIRTUAL_HEIGHT=360` from
`@/renderer/pixel-scale`), and renders into a fixed host div with `nearest` scaling. We gut the
planet bits and drop in a hand-rolled 2D physics toy.

**Throwaway rules (resist scope creep — this all gets deleted at CB.4):**

- `Math.random()` is allowed **here only** — no seeded RNG, no `src/game/sim/`, no determinism.
- No wiring to `RunState`, `deck.ts`, modules, or `main.ts` mode knobs.
- No Vitest tests, no real art / R64 palette-lock (optional ramp pull only if it's <10 min),
  no physics libraries (a lib for the *real* core would be an ADR).
- Keep it in the one page file (+ an optional sibling `core-breaker-spike.ts`), with a
  throwaway header comment like `planet-spike` has.

**Physics — hand-rolled circle-vs-circle solver with a fixed-timestep accumulator** (for
stability, *not* determinism):

```
const STEP = 1 / 240;                          // small sub-step → no tunneling
let acc = 0;
ticker.add((t) => {
  acc += Math.min(t.deltaMS / 1000, 0.05);     // clamp → no spiral-of-death
  while (acc >= STEP) { stepPhysics(STEP); acc -= STEP; }
  syncSprites();                               // draw separate from update
});
```

240 Hz sub-steps matter: a fast ball at 60 Hz can tunnel *through* a peg in a single frame.
Sub-step first; only reach for swept collision if tunneling persists.

Per step: gravity (`vy += G*STEP`, start G≈900), integrate, reflect off left/right walls, floor
ends the shot. Peg collision: if `dist(ball,peg) < ball.r + peg.r` → compute normal, **positional
correction** (push centres exactly `ball.r+peg.r` apart so it doesn't sink/stick), velocity
reflect with restitution `v -= (1+e)*dot(v,n)*n` (e≈0.6–0.8, *the* feel knob), register the hit
→ shatter peg (multi-hit pegs decrement first). Settle: end shot when ball passes the floor or
`|v|` stays under threshold ~0.5 s (no infinite dribble).

**Three ball types** (to feel the §6.4 variety):
1. **Straight / pierce** (Mining Laser) — passes through pegs, shatters on contact, slight
   slowdown per peg; high gravity so it arcs.
2. **Bouncy** (Missile) — high restitution, lots of caroms; optional AoE shatter of nearby pegs
   on rest.
3. **Homing / curve** (Tractor Beam) — small steering accel toward the nearest un-shattered ore
   peg each step.

**Input — touch-first (CLAUDE.md rule):** pointer events only (`pointerdown/move/up`), never
mouse-specific. Fixed launch point near top-centre; `pointerdown` starts an aim, drag sets angle
(try angle-only-fixed-power vs. drag-for-power, keep whichever feels better), aim guide drawn on
`pointermove`, `pointerup` fires + decrements shots. **Gotcha:** `touch-action: none` must live
on the **canvas host element** so the drag doesn't scroll the page on a phone.

**Live tuning knobs** as top-of-file consts + a tiny on-screen readout (current values + shots
remaining): gravity `G`, restitution `e`, ball radius, peg radius, peg density/count, launch
power, wall-bounce on/off, shots-per-drop (start 8–10).

## Steps

- [ ] `nvm use 22`, branch `feature/core-breaker-spike`.
- [ ] Clone `src/app/planet-spike/page.tsx` → `src/app/core-breaker-spike/page.tsx`; keep the
      `Application.init` + `applyScale` + `nearest` setup, gut the planet rendering. Add the
      throwaway header comment.
- [ ] Build the peg field: ~30–60 static circle pegs laid out across the playfield (some ore
      pegs flagged for the homing ball), placeholder shapes (Pixi `Graphics`).
- [ ] Hand-roll the circle-vs-peg solver with the 240 Hz fixed-timestep accumulator
      (gravity · integrate · walls · positional-correct + restitution reflect · shatter ·
      settle).
- [ ] Pointer aim/fire: launch point, drag aim guide, release fires the active ball, shots
      counter decrements; floor/settle ends the shot.
- [ ] Three switchable ball types (pierce / bouncy / homing) with distinct behaviour.
- [ ] On-screen readout of live knobs + shots remaining; expose knobs as editable consts.
- [ ] `eslint src` + `pnpm type-check` clean (TS strict — no `any`/`@ts-ignore` w/o a why-comment,
      enforced by the pre-commit hook even in throwaway code). No tests added.
- [ ] Feel checkpoint pass (below) on desktop + 375px touch; record the answers in
      "What actually happened".

## Manual test steps

- [ ] `nvm use 22 && pnpm dev`, open `localhost:3000/core-breaker-spike`.
- [ ] Drag from the launch point, release → ball fires, falls under gravity, bounces off pegs,
      shatters them; shots counter decrements.
- [ ] Switch ball type → straight pierces, bouncy caroms, homing curves toward ore. Each reads
      as clearly different.
- [ ] Tune G / e / density live → feel changes as expected; find a fun setting and write the
      numbers down (CB.1 inherits them).
- [ ] **Edge:** a very fast shot does **not** tunnel through pegs (sub-stepping holds).
- [ ] **Edge:** a ball that gets stuck/dribbling settles and ends the shot within ~0.5 s.
- [ ] **375px + touch:** drag-aim is accurate, the page does **not** scroll under the drag,
      field is readable.

### The feel checkpoint (the whole point — answer in writing)

- Is the **carom satisfying** — does a good shot chaining a cluster feel rewarding?
- Do the **three ball types feel meaningfully different**?
- What **G / e / density** made it sing? (Capture the numbers.)
- **Does it work on a phone?** Accurate drag, no scroll-fight, readable at 375px?
- Gut call: **is this more fun than the platformer was?** If no → stop, write up why
  (input lag? mushy bounce? boring field? bad on phone? fixable vs. fundamental?), and bring
  it back to the user before any further Phase CB work.

## Out of scope for this session

- Determinism / seeded RNG / fixed-timestep reproducibility (that's CB.1 —
  `surface/core-breaker.ts`, seeded + React/Pixi-free + Vitest).
- Field generation from seed + planet descriptor (CB.2 `surface/field-gen.ts`).
- Module → ball projection / the bag / reactor-as-shots wiring (CB.3).
- Real renderer, R64 palette-lock, ball glyph grammar, the dual-face `<ModuleCard>`, orbit
  DROP → Core Breaker wiring (CB.4 / CB.5).
- Bloom interference / hopper-clog soft-fail and shot-economy tuning (CB.6).
- Retiring `surface/physics.ts` and the platformer code paths (CB.7).
- Real peg-type set, multi-resource drops, biome physics modifiers (later CB slices).

---

<!-- Fill in below during/after the session -->

## What actually happened

Built exactly to plan. Split the spike into a **pure physics module** + a **Pixi page** even
though it's throwaway — it kept the solver readable and mirrors the sim/renderer split CB.1 will
formalise:

- `core-breaker-spike.ts` — pure (no Pixi/React): `Knobs`, `Peg`, `Ball`, `buildField`,
  `spawnBall`, `stepPhysics`. `Math.random()` used **here only** (field layout) per the handoff;
  a `// THROWAWAY` header points at the real seeded CB.1 core.
- `page.tsx` — clones the `planet-spike` Pixi/integer-scale harness, draws the field/ball/aim/HUD
  with `Graphics`, handles pointer aim-fire + on-screen ball buttons + keyboard knob tuning.

Decisions worth carrying to CB.1:
- **240 Hz fixed-timestep accumulator** with a 0.05 s clamp (anti-tunneling + anti-spiral), exactly
  as the handoff prescribed. Drawing is separated from the sub-step (`stepPhysics` mutates,
  `draw*` reads).
- **Per-peg hit cooldown** (0.08 s) so one overlap = one hit — this is what makes pierce
  (passes through, no reflection) and multi-hit pegs (ore=3, hardrock=2) behave without
  double-counting on consecutive sub-steps. Bouncy/homing use positional correction + restitution
  reflect (`v -= (1+e)·(v·n)·n`); pierce uses velocity drag (0.86/peg) and skips correction.
- **Three ball roles** wired to the §6.4 identities: pierce (Mining Laser), bouncy (Missile —
  on-rest AoE shatter), homing (Tractor Beam — steers toward nearest ore peg below it).
- **Direct drag-aim with drag-distance power** (clamped), plus a down-bias so you can't fire
  straight up out of the field. Gravity-projected aim-guide dots. Pointer events only;
  `touchAction: 'none'` on the host so a phone drag doesn't scroll the page.
- Live knobs: `Q/A` gravity, `W/S` restitution, `E/D` power, `R` reset, `1/2/3`/buttons ball
  type. Starting numbers (the CB.1 inheritance candidates, **pre-human-tuning**): G≈900,
  e≈0.72, ballR=6, pegR=7, ~46 pegs, shots=9.

**Verification done by me (machine):** `eslint src/app/core-breaker-spike` clean,
`pnpm type-check` clean, `pnpm build` compiles + statically generates `/core-breaker-spike`,
dev server serves the route 200 with no SSR error.

**The feel checkpoint itself is NOT done** — judging carom satisfaction, ball-type distinctness,
and 375px touch needs a human with a real browser/GPU (this environment has none). That hand-play
is the actual gate for the pivot; see below.

## Files created / modified

- `src/app/core-breaker-spike/core-breaker-spike.ts` (new — pure physics)
- `src/app/core-breaker-spike/page.tsx` (new — Pixi harness + input/HUD)
- `docs/work/2026-06-20-cb0-core-breaker-spike.md` (this plan)
- `CLAUDE.md` (Current State)

## Deferred to next session

- **HUMAN FEEL CHECKPOINT (blocking the pivot):** `pnpm dev` → `localhost:3000/core-breaker-spike`,
  play on desktop **and** a 375px phone. Answer in writing: is the carom satisfying? do the three
  balls feel different? what G/e/density sing? does drag-aim work on glass without scroll-fight?
  **is it more fun than the platformer?** If no → stop and re-judge the pivot before CB.1.
- Record the tuned G/e/density numbers — CB.1's deterministic core inherits them.
- (Only if feel demands) try slingshot drag-back aiming vs. the current direct-aim, and AoE/curve
  strength tuning.

## Status

- [ ] In progress
- [ ] Complete
- [x] Partial — code complete + machine-verified; **human feel checkpoint pending** (the gate)
