# Core Breaker — Visual Pass (sprites, crust bg, FOUNDRY HUD, portrait main-game)

**Date:** 2026-06-22
**Branch:** feature/cb-visual-pass
**Roadmap item:** Phase CB — CB.5 (partial) + CB.7 (partial): visual fidelity + portrait alignment

## Goal

Replace the Core Breaker renderer's placeholder visuals (colored circles, monospace
text HUD, flat fill background) with the design prototype's pixel-art: 6 silhouette-readable
peg sprites, 5 ball sprites, a crust/ceiling background, and a FOUNDRY-style panel HUD
(header + roster tray) — and make the **main game** mining phase render portrait, fitted as
a centered column inside the shared landscape stage. Source of truth for all art is
`docs/design/mining-run-v2.dc.html`.

## Approach

### Key decisions (confirmed with user)

1. **Portrait in main game = centered column, no app changes.** The app is one shared
   landscape stage (`VIRTUAL_WIDTH 640 × VIRTUAL_HEIGHT 360`, `pixel-scale.ts`). Rather than
   resize the stage per-phase, the renderer fits its own portrait "column" (360×640) into a
   target **viewport** via a scale+center transform on its root `scene` container. Standalone
   `/core-breaker` route: viewport = cfg (360×640) → scale 1 (no-op). Main game `enterMining()`:
   viewport = 640×360 → scale 0.5625, centered column with side letterboxing.
2. **One PR, but modularized.** The current single 425-line `core-breaker-renderer.ts` becomes
   a thin orchestrator over focused modules under `src/renderer/core-breaker/`.
3. **Sprites baked via the prototype's own 2D-canvas pixel toolkit, wrapped as PixiJS textures.**
   The renderer layer may use the DOM. Porting the prototype's `R/mix/blob/dither/outline/make`
   canvas ops verbatim and feeding the resulting `<canvas>` into `Texture.from(canvas)` (nearest
   scale) gives pixel-perfect parity with the design and is the lowest-risk port. No sim/test files
   are touched.

### Layout model (two nested fit transforms)

- **Column** = the portrait design frame, = cfg dims (360×640).
- **scene** container: fits the column into the viewport (handles main-game centering). 
- **playfield** sub-container (bg + pegs + balls + minerals + rig + pod): fits the full cfg sim
  space (360×640) into the field band = `{ y: headerH, height: columnH - headerH - trayH }`.
  This keeps the rig (y≈30, top of band, just under the header) and the prize crystal (y≈520,
  just above the tray) both visible without touching `cfg` or `field-gen.ts`. Pointer aim coords
  go through `playfield.toLocal(global)` so all aim math stays in cfg space.
- **header** (top, ~60px in column space) + **roster tray** (bottom, ~170px): fixed Pixi panel
  containers drawn in column space, framing the playfield band.

### Module breakdown (`src/renderer/core-breaker/`)

| File | Responsibility |
|---|---|
| `sprite-toolkit.ts` | Port of prototype `R/hx/mix/rng/blob/dither/outline/make` (offscreen `<canvas>` pixel ops) + `canvasTexture(canvas)` → PixiJS `Texture` (nearest). |
| `peg-sprites.ts` | `buildPegSprites(ramp)` → `Record<PegKind, Texture[]>` (one per damage stage). Ports `_makePeg`. |
| `ball-sprites.ts` | `buildBallSprites()` → `Record<BallType, Texture>` + `ballColors(type)`. Ports `_makeBall`/`_ballColors`. |
| `background.ts` | `crustBackground(W, H, ramp)` → baked `Texture` (gradient fill + dither + wall pillars + ceiling band + breach scar). Ports `_crustBG`/`_drawCeiling`. |
| `hud.ts` | `createHud(...)` → header panel (biome + timer + haul counters) and roster tray (armed preview + bounce pips + queue + reprint/return buttons), FOUNDRY chamfered panels. Returns `{ container, update(state), destroy() }`. |
| `layout.ts` | Pure helpers: `fitTransform(inner, outer)` → `{ scale, x, y }` for the scene-fit and playfield-fit. |

`core-breaker-renderer.ts` keeps: the tick/accumulator, sim stepping, pointer input, turn/redrop
logic, and now composes header + playfield (peg/ball **Sprites** instead of immediate-mode circles)
+ tray, applying the two fit transforms. Pegs become a `Map<pegId, Sprite>` (texture swapped on
damage stage, removed on break); balls a small Sprite pool; minerals stay tiny rects.

### Wiring `enterMining()` (main.ts)

- `cfg = miningPortraitConfig()` (rename import of `portraitConfig`).
- `generateField(..., cfg, ...)` with the portrait cfg (so peg layout matches portrait space).
- Pass `viewport: { width: VIRTUAL_WIDTH, height: VIRTUAL_HEIGHT }` into `createCoreBreakerRenderer`.

## Steps

- [ ] Branch `feature/cb-visual-pass`.
- [ ] `sprite-toolkit.ts` — port canvas pixel ops + `canvasTexture`.
- [ ] `peg-sprites.ts` — port `_makePeg` for all 6 kinds × stages; map planet `Ramp` → ramp roles.
- [ ] `ball-sprites.ts` — port `_makeBall` + `_ballColors` for all 5 types.
- [ ] `background.ts` — port crust + ceiling + scar to a baked texture.
- [ ] `layout.ts` — `fitTransform` helper.
- [ ] `hud.ts` — FOUNDRY header + roster tray panels (Pixi), incl. reprint & return-to-orbit buttons.
- [ ] Rewrite `core-breaker-renderer.ts` as orchestrator: scene-fit + playfield-fit transforms,
      peg/ball Sprites, crust bg, Pixi HUD; pointer via `playfield.toLocal`.
- [ ] Wire `enterMining()` (main.ts) → portrait cfg + viewport. Wire `/core-breaker` route to pass
      `viewport = cfg` (no-op) — or default viewport to cfg when omitted.
- [ ] `pnpm lint && pnpm type-check && pnpm test` clean (renderer not under test; ensure no sim churn).
- [ ] Browser verify both entry points (steps below).

## Manual test steps

- [ ] **Standalone happy path:** `localhost:3000/core-breaker?seed=cb-demo&difficulty=3` → portrait
      column fills the viewport; 6 distinct peg silhouettes visible (slab/steel/bar/diamond/wedge/sac);
      crust gradient bg + ceiling scar; FOUNDRY header (biome + 3:00 timer + haul icons) and roster
      tray (armed ball preview + bounce pips + queue previews + reprint/return buttons).
- [ ] **Aim + fire:** drag down from the rig → trajectory preview; release → ball sprite (correct
      silhouette per armed type) bounces, shatters pegs through their damage stages, mineral drops
      float up; haul counters in the header tick up.
- [ ] **Main game portrait:** `localhost:3000/?mode=orbit` → DROP → mining renders as a **centered
      portrait column** within the landscape canvas (side letterbox), not a clipped landscape field;
      rig at top and crystal at bottom both visible; complete → haul banks to the run, returns to map.
- [ ] **Drill ball:** load a drill (`?modules=mining-laser`) → elongated pointed sprite (non-circular),
      bores through non-rock pegs.
- [ ] **Edge — empty roster:** `?modules=` with only non-projecting modules → roster length 0 →
      header shows RUN COMPLETE / tray empty, no crash, run ends cleanly.
- [ ] **Edge — reprint with 0 scrap:** tap REPRINT before banking any scrap → button disabled/no-op,
      no negative scrap.

## Out of scope for this session

- Juice FX: hit-stop, screen shake, grid jiggle, squash-dent, shatter shards, catch flash, spark
  particles (later slice).
- Live bounce-countdown: per-bounce pip decrement, ≤2-bounce pulse warning, spent-ball fall-faster
  visuals (needs a renderer-side bounce counter; armed-ball pips shown statically this slice).
- Pod-catch / re-aim re-fire mechanic and the catch-value scrap bonuses (current renderer already
  resolves a turn per ball; keep that).
- Intro cinematic (4-phase) and the Mining Complete modal redesign (CB.7 / later).
- Ball trajectory glyphs in the dual-face `<ModuleCard>` UI (CB.5 proper).
- Bloom interference expansion (CB.6); removing platformer code (CB.7 cleanup).
- Per-phase app stage resize (rejected in favor of the centered-column fit).

---

<!-- Filled in during/after the session -->

## What actually happened

Built as planned. The renderer was split into `src/renderer/core-breaker/` modules
(`sprite-toolkit`, `peg-sprites`, `ball-sprites`, `background`, `layout`, `hud`) with
`core-breaker-renderer.ts` reduced to an orchestrator. Sprites are baked via a near-verbatim
port of the prototype's 2D-canvas pixel toolkit (`R/mix/blob/dither/outline/make`) wrapped as
nearest-filtered PixiJS textures — pixel-perfect parity, no sim/test files touched. The toolkit's
`dither` dropped the per-pixel `getImageData` read (every call site pre-fills the region opaque, so
the read was redundant and a real cost over a full-screen bake). Uniform 2× sprite scale matches
the ~2×-of-prototype collision radii. Peg sprites are persistent `Sprite`s (texture swapped per
damage stage, hidden on break); balls a small Sprite pool with accent-dot trails. HUD fonts resolve
the `--font-label`/`--font-readout` CSS vars to concrete families via a DOM probe (monospace
fallback). Reprint/return buttons are interactive Pixi containers that `stopPropagation` so a tap
doesn't also start an aim drag. Reprint synthesizes a standard `RosterBall` (only `type`/
`yieldMultiplier` are read by the renderer).

**Workspace correction (important for next session):** the auto-provisioned worktree branch was a
stale snapshot (pre-`portraitConfig`); the real, current base is **`feature/mining-portrait-redesign`**
(portrait redesign + `portraitConfig` split, pushed to origin, unmerged). This slice was rebased onto
that branch as **`feature/core-breaker-visual-pass`**, so its PR base is `feature/mining-portrait-redesign`,
not `main`. The preview dev server always runs from the worktree dir regardless of `-C`, so the
worktree must hold the code under test.

## Files created / modified

- `src/renderer/core-breaker/sprite-toolkit.ts` (new) — pixel-draw toolkit + `canvasTexture`.
- `src/renderer/core-breaker/peg-sprites.ts` (new) — `buildPegSprites(ramp)`, 6 kinds × stages.
- `src/renderer/core-breaker/ball-sprites.ts` (new) — `buildBallSprites()` + `ballColors`.
- `src/renderer/core-breaker/background.ts` (new) — `buildBackground` crust + ceiling scar + floor.
- `src/renderer/core-breaker/layout.ts` (new) — `fitTransform` contain-fit helper.
- `src/renderer/core-breaker/hud.ts` (new) — FOUNDRY header + roster tray (Pixi).
- `src/renderer/core-breaker-renderer.ts` (rewritten) — orchestrator: scene-fit + playfield-fit,
  sprite pegs/balls, crust bg, Pixi HUD, reprint/return wiring.
- `src/game/main.ts` — `enterMining()` uses `portraitConfig` + passes `viewport`/`biome`.
- `src/app/core-breaker/page.tsx` — passes `biome` (viewport defaults to cfg).

## Verification

- type-check + `eslint src` + `pnpm build` + 562 tests all green.
- Standalone `/core-breaker` (browser): portrait centered column, all 6 peg silhouettes, crust bg +
  ceiling scar + wall pillars, FOUNDRY header (TERRAN + 3:00 + haul icons) and roster tray (armed
  STANDARD + pips + queue + REPRINT/RETURN), fonts render, ball fires + bounces + trails, difficulty
  scaling visible, centered-column-in-landscape confirmed by resizing to a wide window.
- Main-game `?mode=orbit` → DROP: `enterMining()` is reached with no JS errors, but the 3.6s
  `pod-deploy` transition couldn't accumulate time in the throttled headless preview tab (rAF paused
  off-screen), so the in-game mining column wasn't screenshot-confirmed. Verify on a focused
  browser/device.

## Deferred to next session

- Device/focused-browser confirmation of the main-game orbit→mining portrait column.
- All out-of-scope items above (juice FX, live bounce-countdown, pod-catch re-aim, intro cinematic,
  complete-modal redesign, ModuleCard glyphs, platformer cleanup).
- Possible field-gen Y-range tweak if the header/tray framing feels tight on a real phone (not needed
  in testing — the nested playfield fit keeps rig + crystal visible without touching cfg).

## Status

- [ ] In progress
- [x] Complete (pending real-device confirmation of the in-game transition handoff)
- [ ] Partial — see deferred
