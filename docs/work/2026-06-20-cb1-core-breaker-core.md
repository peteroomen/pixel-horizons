# CB.1 — Deterministic Core Breaker physics core

**Date:** 2026-06-20
**Branch:** claude/brave-hamilton-yds2fo
**Roadmap item:** Phase CB — CB.1 (deterministic physics core, sim-only)

## Goal

`src/game/surface/core-breaker.ts` exists as a pure, deterministic, fixed-timestep circle-vs-peg
simulation (no React/Pixi/DOM), with `core-breaker.test.ts` proving same field + same shot inputs
⇒ identical peg-break + drop streams, plus the core behaviours (multi-hit pegs, ball-consumed-by-
Bloom, pierce/phase pass-through, settle/fall-out, no-tunneling at the fixed step).

## Approach

Port the CB.0 spike solver (`src/app/core-breaker-spike/core-breaker-spike.ts`) into sim code
under the determinism + purity contract. Key changes from the spike:

- **Driven by a fixed `cfg.step` only** — no frame-time `dt`. The 240 Hz accumulator stays a
  renderer concern (CB.4); the sim advances by the fixed sub-step.
- **No `Math.random()`** — the core is RNG-free (seed enters at field-gen, CB.2). Field is an
  **input** (`Peg[]`), not generated here.
- **Peg kinds (§6.7):** `mineral` (1-hit→1 scrap), `ore` (3-hit→2 biominerals), `hardrock`
  (2-hit→1 scrap), `bloom` (consumes a normal ball; pierce/phase pass through + clear), `crystal`
  (4-hit→1 core crystal). Drops returned as an ordered stream; banking to RunState is CB.4.
- **Ball types:** `pierce`, `bouncy`, `homing`, `phase` (phases one Bloom then is consumable).
- **API:** `step(ball, pegs, cfg)` mutates + returns this-step events (renderer path);
  `simulateShot(pegs, shot, cfg)` creates the ball and loops `step` to completion, returning the
  ordered `ShotResult` — the thing determinism pins. Hard `maxSteps` cap so a pathological shot
  can't hang.

CB.1 stays **additive** — `physics.ts` and the platformer stay wired until CB.7 (it has live
importers; deleting now cascades into the whole cleanup). Confirmed with the handoff.

## Steps

- [ ] `core-breaker.ts`: types (`Peg`/`PegKind`/`Ball`/`BallType`/`ShotInput`/`CoreBreakerConfig`/
      `Drop`/`ShotResult`), `defaultConfig`, `createPeg`, `spawnBall`, `step`, `simulateShot`.
- [ ] Restitution reflect + positional correction; pierce drag-through; homing steer-to-ore;
      bouncy on-rest AoE; per-peg hit cooldown; Bloom consume / pierce+phase pass-through; settle
      + fall-out + maxSteps end reasons.
- [ ] `core-breaker.test.ts`: determinism (single + sequence), multi-hit decrement + break-on-3rd,
      Bloom consume vs pierce/phase pass-through, settle (zero-g) + fall-out, no-tunneling at the
      fixed step, distinguishable ball trajectories.
- [ ] `eslint src` + `pnpm type-check` + `pnpm test` green.

## Manual test steps

- [ ] `nvm use 22 && pnpm test` — `core-breaker.test.ts` green; determinism headline passes.
- [ ] `pnpm type-check` + `eslint src` clean.
- [ ] `pnpm build` still green (nothing in `src/app` broke).
- [ ] Edge: maxSteps cap holds (no hang); Bloom consumes a bouncy ball but not pierce/phase.

## Out of scope

Field-gen from seed/descriptor (CB.2), rendering (CB.4), module→ball/bag (CB.3), Bloom
spread/hopper-clog (CB.6), deleting `physics.ts` (CB.7), RunState persistence / version bump.

---

## What actually happened

Built to plan; additive (no `physics.ts` touched). Two bugs caught by the tests and fixed:

1. **Pierce drag was applied every overlapping sub-step**, slowing the ball enough to *linger
   inside* a peg past the 0.08 s hit cooldown → it scored multiple hits on one pass (a fresh ore
   peg dropped from 3 hits to 0 in a single transit). Fix: apply pierce drag **once per peg**,
   gated by the same `!onCooldown` check as the hit. Now one pass = one hit + one speed bleed.
2. **The no-tunneling contrast test was position-sensitive.** A peg at y=150 happened to sit on a
   60 Hz sample, so it didn't tunnel. Moved the peg to y=164 (it falls in the ~41 px gap between
   60 Hz samples but is still caught by the ~10 px 240 Hz samples), making the
   "coarse-step tunnels / default-step catches" contrast deterministic and meaningful.

Design notes worth carrying:
- The core is **RNG-free** — determinism is by construction; the seed enters at field-gen (CB.2).
- `simulateShot(pegs, shot, cfg)` **mutates** `pegs` (the field degrades shot-to-shot, like a real
  drop) and returns the ordered `ShotResult`; `step(ball, pegs, cfg)` is the renderer-facing
  per-sub-step entry. Determinism is proven by building two identical fields and comparing
  outputs, not by input-immutability.
- Added the `phase` ball type now (passes one Bloom, consumed by the next) so CB.3's projection
  table won't need a solver change.
- `maxSteps` cap (default 10 000) returns `end: 'maxSteps'` instead of hanging — tested with a
  frictionless zero-g horizontal trap.

Verified: 15 new tests green, full suite 544 green, `pnpm type-check` + `eslint src` clean,
`pnpm build` clean.

## Files created / modified

- `src/game/surface/core-breaker.ts` (new — pure deterministic physics core)
- `src/game/surface/core-breaker.test.ts` (new — 15 tests)
- `docs/work/2026-06-20-cb1-core-breaker-core.md` (this plan)
- `CLAUDE.md` (Current State)

## Status

- [ ] In progress
- [x] Complete — CB.1 sim core landed; field-gen (CB.2) and renderer (CB.4) are the next slices
