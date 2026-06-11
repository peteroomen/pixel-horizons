# Platformer Core

**Date:** 2026-06-11
**Branch:** feature/platformer-core
**Roadmap item:** Phase 3 — Slice 3.1 Platformer core

## Goal

A clone runs, jumps, and melees through one hand-made Rocky test level at `/?mode=surface` — fixed-timestep loop, AABB tile collision, keyboard + touch controls, sim fully unit-tested — while the default combat mode is untouched.

## Approach

This is the first slice of the platformer half. `src/game/surface/` follows the same law as `sim/`: no React, no PixiJS, no DOM — everything Vitest-testable. The first real 60fps game loop in the project lives in `main.ts` (combat never needed one): a fixed-timestep accumulator driven by the Pixi ticker calls `updateSurface(state, input, FIXED_DT_MS)` zero or more times per frame, then `surfaceRenderer.sync(state)` draws. React gets **no** per-frame updates — only a one-time mode callback.

Key decisions made upfront:

- **Entry is a dev knob** — `?mode=surface` in `main.ts` (same pattern as `?enemy=`/`?hull=`). No sector map until 4.1; lanes/combat are simply not created in surface mode. `GameHandle` gains a `mode` field and a `surfaceInput()` method; existing combat methods quietly no-op in surface mode (the guard pattern already in place).
- **Fixed timestep, no interpolation** — 60Hz accumulator with a `MAX_FRAME_MS` clamp (spiral-of-death guard). Render interpolation is deferred; at 60Hz display it's invisible. Tunables in `src/game/data/surface.ts` per the no-numbers-in-logic rule.
- **Feel hooks implemented now, not stubbed** — coyote time, jump buffering, and variable jump height (jump-cut on release) are cheap today and brutal to retrofit (handoff warning). All driven by named constants.
- **Axis-separated AABB vs tile grid** — integrate X, resolve against solid tiles, then Y, resolve. Out-of-bounds tiles count as solid (keeps the clone in-level; pit-death semantics arrive with 3.4). `physics.ts` knows bodies and tiles, nothing about clones.
- **Melee needs a target with no enemies until 3.4** — the test level contains **breakable rock tiles** (`*`). The attack hitbox breaks them (they yield nothing — mining yields are 3.2). This proves hit detection and is the natural precursor to mining.
- **Levels are ASCII string rows** in `src/game/data/levels.ts` (`#` solid, `*` breakable, `P` spawn, `.` empty), parsed by `tilemap.ts` into a plain-JSON grid. One hand-made Rocky level, ~60×24 tiles at TILE_SIZE 16 (960×384 px > 640×360 virtual screen) so the **camera** must scroll: follow clone, clamped to level bounds, integer-rounded positions for pixel crispness.
- **Input is a plain held-keys snapshot** (`{left, right, jump, attack}`) owned by `main.ts`; rising-edge detection happens inside the sim (clone tracks prev-frame buttons) so input replay scripts are pure data and tests are deterministic. Keyboard listeners live in `main.ts` (cleaned up in `destroy()`); touch is a DOM overlay component calling `handle.surfaceInput(action, pressed)` on pointer events — events only, never React state per frame.
- **No RNG this slice** — the level is hand-made. The existing `surface` stream in `RunState.rng` stays untouched (level gen will consume it in Phase 5.3+).
- **ADR 004** documents the fixed-timestep loop + mode-switch architecture.

## Spec — constants (`src/game/data/surface.ts`)

All exported, all with a one-line GDD/feel justification comment:

```
TILE_SIZE = 16            FIXED_DT_MS = 1000 / 60     MAX_FRAME_MS = 250
GRAVITY = 1500            MAX_FALL_SPEED = 420        MOVE_SPEED = 140
JUMP_VELOCITY = -380      JUMP_CUT_MULTIPLIER = 0.45
COYOTE_TIME_MS = 80       JUMP_BUFFER_MS = 100
ATTACK_DURATION_MS = 180  ATTACK_ACTIVE_FROM_MS = 40  ATTACK_ACTIVE_TO_MS = 140
ATTACK_COOLDOWN_MS = 250  ATTACK_RANGE = 18           ATTACK_HEIGHT = 16
CLONE_WIDTH = 12          CLONE_HEIGHT = 20
```

(Jump apex ≈ 380²/(2·1500) ≈ 48 px = 3 tiles — platforms in the test level must respect ≤3-tile climbs.)

## Spec — surface sim modules

- **`surface/tilemap.ts`** — `TILE_EMPTY = 0 | TILE_SOLID = 1 | TILE_BREAKABLE = 2`. `Tilemap = { width, height, tiles: number[], spawnX, spawnY, version }` (flat array, plain JSON; `version` increments on `breakTile` so the renderer knows to redraw). `parseLevel(rows: string[])` throws on ragged rows or spawn-count ≠ 1 (loud-failure policy for programming errors). `tileAt(map, tx, ty)` returns `TILE_SOLID` out of bounds. `isSolid(tile)` is true for solid **and** breakable (you stand on rocks until you break them).
- **`surface/physics.ts`** — `Body = { x, y, w, h, vx, vy }` (top-left origin, px, px/s). `moveBody(body, map, dtMs): { onGround, hitWall, hitCeiling }` — axis-separated sweep: move X, clamp to tile edge + zero `vx` on hit; move Y likewise. Gravity is applied by the caller (physics doesn't know what falls).
- **`surface/clone.ts`** — `CloneState = { body, facing: 1 | -1, grounded, coyoteMs, jumpBufferMs, jumpHeld, attackElapsedMs (-1 = idle), attackCooldownMs, prevJump, prevAttack }`. `InputState = { left, right, jump, attack }` (held booleans). `createClone(map)` spawns at `spawnX/Y`. `updateClone(clone, map, input, dtMs)`:
  1. `vx = (right - left) * MOVE_SPEED` (instant — acceleration curves deferred); update `facing` when moving.
  2. Rising edge of `jump` → `jumpBufferMs = JUMP_BUFFER_MS`; both timers tick down by `dtMs`.
  3. `vy += GRAVITY * dt`, clamped to `MAX_FALL_SPEED`.
  4. If `jumpBufferMs > 0` and (`grounded` or `coyoteMs > 0`): `vy = JUMP_VELOCITY`, zero both timers, set `jumpHeld`.
  5. Jump cut: if `jumpHeld` and `jump` released while `vy < 0` → `vy *= JUMP_CUT_MULTIPLIER`, clear `jumpHeld` (apply once).
  6. `moveBody`; on ground set `coyoteMs = COYOTE_TIME_MS`, else decay.
  7. Attack: rising edge while `attackCooldownMs <= 0` starts a swing (`attackElapsedMs = 0`, cooldown set). While `ATTACK_ACTIVE_FROM_MS <= attackElapsedMs <= ATTACK_ACTIVE_TO_MS`, `attackHitbox(clone)` returns a rect of `ATTACK_RANGE × ATTACK_HEIGHT` in front of `facing` at torso height (else `null`); every breakable tile overlapping it is broken via `breakTile`.
- **`surface/surface.ts`** — `SurfaceState = { map, clone }`, `createSurface(rows)`, `updateSurface(state, input, dtMs)`. The single entry point `main.ts` calls.

## Spec — renderer, wiring, UI

- **`renderer/surface-renderer.ts`** — `createSurfaceRenderer(app): { sync(state), destroy() }`. A `world` Container holds: tiles Graphics (rebuilt only when `map.version` changes — solid = gray-brown `0x6b5a4a`, breakable = ochre `0xa07a3a` with a crack mark, Rocky-ish placeholder palette), sky/parallax backdrop (flat fill + a few deterministic math-placed rocks, like the starfield), clone (light rect with a 2px visor stripe, flips with `facing`), and a white slash rect visible only while `attackHitbox` is non-null. Camera: `world.position = -round(clamp(cloneCenter - VIRTUAL/2, 0, levelPx - VIRTUAL))` per axis. `sync` is called once per rAF tick by `main.ts` — per-frame here is correct (it's Pixi, not React).
- **`main.ts`** — `resolveMode(): 'combat' | 'surface'` from `?mode=`. Combat path unchanged. Surface path: build `SurfaceState` + surface renderer, attach ticker: `acc += min(ticker.deltaMS, MAX_FRAME_MS); while (acc >= FIXED_DT_MS) { updateSurface(state, input, FIXED_DT_MS); acc -= FIXED_DT_MS; } renderer.sync(state)`. Keyboard: `keydown`/`keyup` on `window` (ArrowLeft/A = left, ArrowRight/D = right, Space/ArrowUp/W = jump, X/J = attack; `repeat` events ignored), removed in `destroy()`. `GameHandle` gains `readonly mode` and `surfaceInput(action: 'left' | 'right' | 'jump' | 'attack', pressed: boolean): void` (no-op in combat mode). `GameCallbacks` gains optional `onModeChange?(mode)` fired once after init. `onCombatUpdate` never fires in surface mode.
- **`components/TouchControls.tsx`** — DOM overlay (`pointer-events-none` wrapper, buttons `pointer-events-auto`): ◀ ▶ bottom-left, B (attack) / A (jump) bottom-right, 8bit-styled. `onPointerDown/Up/Leave/Cancel` → `surfaceInput(...)` via a callback prop — **pointer events only**, and pointer-up anywhere must release (no stuck buttons). Buttons also work with mouse on desktop by construction.
- **`app/page.tsx`** — `mode` state from `onModeChange` (threaded through `GameCanvas` props). Surface mode renders `TouchControls` instead of HUD/CombatHand/overlays; combat mode renders exactly what it does today.

## Steps

- [ ] Branch `feature/platformer-core` (see base-branch note in plan summary)
- [ ] `src/game/data/surface.ts` — constants per spec
- [ ] `src/game/surface/tilemap.ts` + `tilemap.test.ts` (parse, validation throws, OOB-solid, breakTile + version bump)
- [ ] `src/game/surface/physics.ts` + `physics.test.ts` (land exactly on tile top w/ vy zeroed, wall stop at boundary, ceiling bump, breakable-is-solid)
- [ ] `src/game/surface/clone.ts` + `clone.test.ts` (gravity, jump only grounded, coyote window honored then expires, jump buffer fires on landing, jump cut shortens apex, attack breaks facing-side rock, cooldown blocks spam, determinism: same input script twice ⇒ deep-equal states)
- [ ] `src/game/surface/surface.ts` (thin orchestrator) — covered by clone/integration tests
- [ ] `src/game/data/levels.ts` — `ROCKY_TEST_LEVEL` (~60×24): flat start, 2–3 platform steps ≤3 tiles, one 2-tile pit, a wall requiring a full jump, a cluster of 4–6 breakable rocks (some at standing height, one overhead), spawn at left
- [ ] `src/renderer/surface-renderer.ts` per spec
- [ ] `main.ts` — mode knob, fixed-timestep loop, keyboard input, `surfaceInput`, `onModeChange`
- [ ] `components/TouchControls.tsx` + `GameCanvas.tsx` prop threading + `page.tsx` mode switch
- [ ] ADR `docs/decisions/004-fixed-timestep-and-mode-switch.md`
- [ ] `pnpm lint`, `pnpm type-check`, `pnpm test` green
- [ ] Manual test pass (below), desktop + 375px
- [ ] Fill in plan-file results sections, update CLAUDE.md Current State, write `docs/work/2026-06-11-handoff-slice-3.2.md`
- [ ] Conventional commit, push (peteroomen-scoped credentials), open PR

## Manual test steps

- [ ] `nvm use 22 && pnpm install && pnpm dev`, open `http://localhost:3000/?mode=surface` — Rocky level renders crisply, clone at spawn, no combat HUD/hand anywhere
- [ ] Arrow keys/WASD: run both directions, facing flips; camera scrolls when crossing screen center and stops at level edges
- [ ] Jump (Space): clears 3-tile platforms; tap vs hold gives visibly different heights; can't double-jump
- [ ] Walk off a ledge and press jump within a beat — coyote jump fires; waiting noticeably longer does nothing
- [ ] X/J near a breakable rock: slash flashes, rock disappears, can walk through; rocks support standing before broken
- [ ] Resize to 375×667 (responsive mode): touch buttons appear/usable; hold ▶ + tap A mid-run works (multi-touch); sliding finger off a button releases it (no stuck movement)
- [ ] Plain `http://localhost:3000/` — combat plays exactly as before (regression check)
- [ ] Edge: hold left against the level's left wall — clone pins at the boundary, no jitter, no tunneling; mash attack — cooldown visibly limits swing rate
- [ ] Background the tab ~5s, return — clone hasn't tunneled through the floor (MAX_FRAME_MS clamp works)

## Out of scope for this session

- Pod, timer, deposits (3.2) — breakable rocks yield **nothing** yet
- Module→item projection, double jump, dash (3.3)
- Surface enemies, clone death, hazards, pit-death (3.4 — OOB is solid for now)
- Render interpolation, acceleration curves, animation/juice, SFX
- Level generation / surface RNG stream use (hand-made level only)
- Save/resume of surface state; entering surface from the map (4.1)

---

<!-- Fill in below during/after the session -->

## What actually happened

Implemented essentially to spec (an implementation agent built it from this plan; a
review pass caught and fixed one real bug before merge):

- **Sub-pixel tunneling bug (the one real find):** the agent's tile-scan range used the
  inclusive-pixel convention `floor((edge - 1) / TILE_SIZE)` for an AABB's bottom/right
  edge. Correct at integer positions, wrong for fractional ones: a clone resting flush on
  the floor gets nudged 0.42 px into it by a single 60 fps gravity step
  (`GRAVITY * dt = 25 px/s → 0.42 px`), the scan misses the floor tile (penetration
  < 1 px), the next frame the "already overlapping" guard skips it, and the clone sinks
  through every floor at ~9 frames per row — straight out of the level. Fixed with
  `maxEdgeTileIndex(edge) = ceil(edge / TILE_SIZE) - 1` in `tilemap.ts`, applied in
  `resolveX`, `resolveY`, and the attack-hitbox tile loop. The agent's 21 clone tests all
  passed because they only exercised fast falls (≥ 1 px penetration per frame) — resting
  contact was never simulated. Added regression tests: 600 frames of sub-pixel gravity on
  the floor, 600 frames of sub-pixel push against a wall, and 600 idle frames on the real
  `ROCKY_TEST_LEVEL`.
- One pre-existing clone test ("coyote does not fire after expiry") had a physically
  bogus setup — it faked walking off a ledge by clearing `grounded` while the clone still
  stood on the floor; correct physics re-grounds it and the jump legitimately fires.
  Rewritten with the clone genuinely airborne.
- Coyote implementation detail: the window starts on the leave-ground transition rather
  than refreshing every grounded frame — behaviorally equivalent to the spec.
- Browser-verified at desktop + 375 px: spawn/fall/land, run, wall + breakable-as-solid
  collision, melee breaking both floor rocks (tile redraw via `map.version`), jump over
  the 1-tile step, touch ▶/◀ driving movement through the React pointer pipeline, combat
  mode regression on plain `/`. Caveat: preview-tab rAF throttling means held-input tests
  advance only ~250 ms of sim per screenshot (`MAX_FRAME_MS` clamp working as designed);
  jump feel, coyote/buffer feel, and multi-touch need the human hand-play pass below.

## Files created / modified

- `src/game/data/surface.ts` — all tunables (new)
- `src/game/data/levels.ts` — `ROCKY_TEST_LEVEL` (new)
- `src/game/surface/tilemap.ts` + `.test.ts` — parse/query/break + `maxEdgeTileIndex` (new)
- `src/game/surface/physics.ts` + `.test.ts` — axis-separated AABB `moveBody` (new)
- `src/game/surface/clone.ts` + `.test.ts` — movement/jump/coyote/buffer/cut/melee (new)
- `src/game/surface/surface.ts` — `SurfaceState` orchestrator (new)
- `src/renderer/surface-renderer.ts` — tiles/clone/slash/camera (new)
- `src/components/TouchControls.tsx` — pointer-event overlay (new)
- `src/game/main.ts` — `?mode=` knob, fixed-timestep loop, keyboard, `surfaceInput`, `onModeChange`
- `src/components/GameCanvas.tsx`, `src/app/page.tsx` — mode threading + UI switch
- `docs/decisions/004-fixed-timestep-and-mode-switch.md` (new)

## Deferred to next session

- Mining yields from broken rocks, backpack, pod + timer (3.2 — plumbing ready:
  `breakTile` is the hook point)
- Human hand-play feel pass (jump arc, coyote/buffer windows, multi-touch on a real
  phone) — all knobs in `src/game/data/surface.ts`
- Render interpolation, acceleration curves (only if the feel pass demands them)
- Pit-death / OOB semantics (OOB is solid until 3.4)

## Status

- [ ] In progress
- [x] Complete
- [ ] Partial — see deferred
