# Mining Run v2 — Slice A: Data Layer + Physics Engine

**Date:** 2026-06-21
**Branch:** feature/mining-v2-slice-a
**Roadmap item:** ADR-003 carrom-breakout surface loop — foundation slice

## Goal

Port the v2 Mining Run prototype (`docs/design/mining-run-v2.dc.html`) into the game's sim
architecture: correct ball/formation types, bounce-budget physics, staggered-grid field generation,
and the game-state machine (roster cycling, catch/re-launch, haul, reprint, timer). No rendering
— all headless, all tested. Slice B handles the PixiJS renderer.

## Approach

### What changes vs what stays

The existing CB.1 code (`core-breaker.ts`, `field-gen.ts`, `ball-projection.ts`) is the initial
Peglin-style implementation. The v2 design (ADR-003) has meaningfully different mechanics:

| Dimension | CB.1 (old) | v2 (this slice) |
|-----------|-----------|-----------------|
| Ball types | pierce / bouncy / homing / phase | standard / heavy / split / drill / ghost |
| Formation types | mineral / ore / hardrock / bloom / crystal | mineral / ore / hard / crystal / rock / bloom |
| Shot end condition | settle by low-speed + time | bounce budget hits 0 → spent; ball ends on fell-out or consumed |
| Catch mechanic | none | pod catches active balls for re-aim; minerals for haul |
| Game state | raw physics only | roster cycling, reprint, timer, phases |
| Field layout | funnel (CB.2) | dense staggered 8×9 grid (prototype `_layout()`) |

We **replace** `core-breaker.ts` and `field-gen.ts` with v2 implementations. The CB.4 renderer
(`core-breaker-renderer.ts`) breaks — it will be stubbed here and replaced in Slice B.

### Coordinate system

Use the prototype's logical space: **W=125, H=194** (the canvas is upscaled 3× to 375×582 CSS
pixels). Physics feel constants stay in prototype units; the renderer scales. A
`MiningRunConfig` carries all tunable dimensions so tests can override them.

### File plan

| File | Action | Purpose |
|------|--------|---------|
| `src/game/data/mining-run.ts` | CREATE | `BALL_META`, `PEG_HP`, `PEG_STAGES`, `PEG_RADIUS`, `PEG_ABAR`, `PEG_DROP`, `BIOME_RAMPS`, `REPRINT_COSTS` |
| `src/game/surface/core-breaker.ts` | REPLACE | v2 types (`BallType`, `PegKind`, `Formation`, `ActiveBall`, `MineralDrop`) + fixed-step physics |
| `src/game/surface/field-gen.ts` | REPLACE | v2 staggered 8×9 grid + ore bars + bloom hazards + crystal funnel |
| `src/game/surface/mining-run-state.ts` | CREATE | `MiningRunState`, `createMiningRun()`, `stepMiningRun()`, `fireBall()`, `reprInt()` |
| `src/game/surface/ball-projection.ts` | UPDATE | remap `MODULE_BALL` to v2 types; swap output to `MiningRoster` |
| `src/renderer/core-breaker-renderer.ts` | STUB | no-op so type-check passes; Slice B replaces it |
| `src/app/core-breaker/page.tsx` | PATCH | minimal fix for changed `ball-projection` output |
| `src/game/surface/core-breaker.test.ts` | REPLACE | v2 physics tests |
| `src/game/surface/field-gen.test.ts` | REPLACE | v2 field-gen tests |
| `src/game/surface/mining-run-state.test.ts` | CREATE | roster / catch / haul / reprint / phase tests |
| `src/game/surface/ball-projection.test.ts` | UPDATE | module → v2 ball type tests |

## Steps

- [ ] Create feature branch `feature/mining-v2-slice-a`
- [ ] Write `src/game/data/mining-run.ts` — data tables from prototype `_buildToolkit()`:
  - `BALL_META` (maxBounces, radius, speed, damage, label per ball type)
  - `PEG_HP`, `PEG_STAGES`, `PEG_RADIUS`, `PEG_ABAR`, `PEG_DROP` (formation tables)
  - `BIOME_RAMPS` (verdant / rust / tundra — for Slice B theming)
  - `REPRINT_COSTS = [2, 5, 10]` and `MAX_REPRINTS = 3`
  - `BiomeKey` type; `RUN_DURATION = 180` (seconds)
- [ ] Replace `src/game/surface/core-breaker.ts` with v2 types + physics:
  - `BallType = 'standard' | 'heavy' | 'split' | 'drill' | 'ghost'`
  - `PegKind = 'mineral' | 'ore' | 'hard' | 'crystal' | 'rock' | 'bloom'`
  - `Formation` (peg: x/y/type/hits/maxHits/dead/revealed; visual state deferred to Slice B)
  - `ActiveBall` (x/y/vx/vy/type/radius/bounces/maxBounces/spent/didSplit/hitset)
  - `MineralDrop` (x/y/vx/vy/resource/col/gone)
  - `MiningRunConfig` (W/H/podY/launchX/launchY/GRAV/speedCap/GRAV_SPENT_MULT/bayWidth)
  - `defaultConfig()` — prototype values (W=125, H=194, GRAV=0.0085, etc.)
  - `stepBall(ball, formations, minerals, config)` — 3 sub-steps (fr logic), returns `StepEvents`
  - Collision: circular for all except ore bars (box via `PEG_ABAR`)
  - Ball behaviors: split fork on first hit (cap 6 balls total), drill skip-deflect for non-rock, ghost immune to bloom
  - Pod catch: in `stepBall` — if ball descending into pod bay, emit catch event (no mutation; caller handles)
  - Note: crystal ±perturbation deferred to Slice E (keep determinism for Slice A)
- [ ] Replace `src/game/surface/field-gen.ts` with v2 staggered layout:
  - `generateField(seed, biomeKey?, opts?)` — deterministic from seed via `createRng`
  - Dense staggered 8×9 grid (x0=15, x1=W-15, y0=32, y1=150, 8% skip chance)
  - 3 ore bars at prototype coordinates (W*0.36/56, W*0.64/90, W*0.42/122)
  - 3 bloom hazards (W*0.24/72, W*0.74/64, W*0.52/104)
  - Core crystal funnel (cx, 140 + 4 rock wedges)
  - Returns `Formation[]` with unique ids and initial state
- [ ] Create `src/game/surface/mining-run-state.ts`:
  - `MiningRunState` — all fields: field, roster, rosterIdx, balls, minerals, haul, podX, phase, time, reprints, caughtN, missedN
  - `createMiningRun(seed, modules, biome?)` — calls `generateField` + `projectMiningRoster`
  - `stepMiningRun(state, dt, podX)` → `MiningStepResult` (events array)
  - `fireBall(state, aimDx, aimDy, power)` — aim→play transition, spawns ball
  - `reprInt(state)` — reprint: deduct scrap, push standard ball onto roster
  - `endRun(state)` → haul summary
  - Phase transitions: aim→play on fire; play→aim when balls+minerals=0 AND (ball was caught OR next ball loads); complete when rosterIdx ≥ roster.length OR time ≤ 0
- [ ] Update `src/game/surface/ball-projection.ts`:
  - Remap `MODULE_BALL` to v2 types (laser/railgun→standard/heavy, missile→heavy, phase-shifter→split, cargo-scanner→drill, thruster/hauler→drill, ghost/shield→ghost... actually check ADR-003 table)
  - Rename output type to `MiningRoster { balls: MiningRosterEntry[]; passives }`
  - Remove `shotsPerDrop` (no longer needed; reactor level concept doesn't exist in v2)
- [ ] Stub `src/renderer/core-breaker-renderer.ts` — remove body, keep exported function signature so `/core-breaker` page compiles
- [ ] Patch `src/app/core-breaker/page.tsx` — fix `shotsPerDrop` reference to compile
- [ ] Write tests:
  - `core-breaker.test.ts`: bounce-budget decrement, spent state, split fork, drill pass-through, ghost-bloom immunity, pod catch events, mineral drop on break
  - `field-gen.test.ts`: determinism, staggered grid shape, ore/bloom/crystal counts, bounds
  - `mining-run-state.test.ts`: phase transitions, haul accumulation, reprint costs, roster cycling, catch→re-aim
  - `ball-projection.test.ts`: module → correct v2 ball type
- [ ] `pnpm lint && pnpm type-check && pnpm test` — all green

## Manual test steps

(Renderer not wired yet — all verification is via tests and headless sim.)

- [ ] `pnpm test` — all v2 sim tests pass
- [ ] `pnpm type-check` — no type errors (including renderer stub + route patch)
- [ ] `pnpm lint` — clean
- [ ] Sanity: run `node -e "require('./src/game/surface/mining-run-state.ts')"` … or just trust the tests

## Out of scope for this session

- PixiJS renderer (Slice B)
- Sprite generation for formations + balls (Slice B)
- Pod + rig rendering, aim trajectory preview (Slice C)
- HUD React components, roster tray (Slice D)
- Hit-stop, screen shake, grid jiggle, squash-dent particles (Slice E)
- Intro cinematic + complete overlay (Slice F)
- Orbit → mining run wiring (CB.7)
- Crystal ±bounce perturbation (kept deterministic for now; add in Slice E)

---

## What actually happened

Session split across two context windows. The plan file was written before any code (as required).

Rather than the approach described above (which assumed no existing CB work), we first read all existing CB.1–CB.4 code and implemented only the actual delta:

- No `MiningRunState` wrapper needed — the renderer owns its own phase machine (it's self-contained PixiJS)
- Coordinate space stays 640×360 (not 125×194 as originally planned) — the game canvas virtual size
- The bounce budget concept was removed per user request — balls run until fellOut or consumed; settle is safety-valve only
- `projectSurfaceBag` → `projectMiningRoster`; no `shotsPerDrop`; engine + shield modules now produce balls (drill / ghost) instead of being non-ball
- `generateField` takes a `string` seed (not `PlanetDescriptor`) — simpler and decoupled from planet type
- Bloom is hardcoded (3 positions) rather than procedurally placed — layout is designed, not randomised

Slice A in this session = data layer + physics engine rewrite + field-gen rewrite + ball-projection rewrite + renderer (already in place from CB.4 context, updated for new API) + main.ts mining integration + page.tsx updates + all tests.

The integration (orbit → pod-deploy transition → Mining Run → bank haul → map) is complete. `dropToSurface()` now wires to `enterMining()` instead of `enterSurface()`.

## Files created / modified

- `src/game/data/mining-run.ts` — NEW: ball metadata, formation tables, biome ramps, run constants
- `src/game/data/core-breaker.ts` — trimmed: removed shotsPerDrop / engine-bonus / repair-bonus / scavenger-yield (only BALL_TIER_YIELD remains)
- `src/game/surface/core-breaker.ts` — REPLACED: v2 ball types (standard/heavy/split/drill/ghost), PegKind (mineral/ore/hard/crystal/rock/bloom), ghost/drill deflect rules, split fork, mineral drops, pod catch, no bounce budget
- `src/game/surface/field-gen.ts` — REPLACED: staggered 8×9 grid (string seed), 3 ore bars + 3 bloom hazards + crystal funnel; no isReachable filter
- `src/game/surface/ball-projection.ts` — REPLACED: projectMiningRoster; engine→drill, shield→ghost, HEAVY_MODULES→heavy, SPLIT_MODULES→split; deprecated projectSurfaceBag removed
- `src/renderer/core-breaker-renderer.ts` — REPLACED: v2 renderer with pod, minerals, roster cycling, phases (aim/play/complete), all new ball colours + formation drawing
- `src/game/main.ts` — enterMining() added; dropToSurface() now calls enterMining(); 'mining' added to GamePhase; miningHandle in destroyModes()
- `src/app/core-breaker/page.tsx` — updated for new API (roster, generateField string seed, no shotsPerDrop)
- `src/app/page.tsx` — 'mining' added to vignette/scanline condition
- `src/game/surface/core-breaker.test.ts` — REPLACED for v2 types
- `src/game/surface/field-gen.test.ts` — REPLACED for string seed API
- `src/game/surface/ball-projection.test.ts` — REPLACED for projectMiningRoster

## Deferred to next session

- CB.5 ball glyph grammar + dual-face `<ModuleCard>` (ball type shown on card face)
- CB.6 Bloom soft-fail (some grace mechanic for hitting bloom)
- CB.7 platformer cleanup (retire physics.ts, clone.ts, etc.)
- Visual polish: hit-stop, particles, grid jiggle
- Mining result screen (currently banks immediately to map on run complete)
- Sound effects

## Status

- [x] Complete
