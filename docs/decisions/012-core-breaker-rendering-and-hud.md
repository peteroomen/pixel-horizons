# ADR 012: Core Breaker rendering, session & HUD architecture

Date: 2026-06-22
Status: Accepted

## Context

Core Breaker (the Mining Run v2 surface loop) is reached two ways: the in-game flow
(orbit → DROP → `enterMining`) and a standalone `/core-breaker` dev route. It is **portrait**
while the rest of the game runs on a fixed **landscape** 640×360 stage (`pixel-scale.ts`). Its HUD
(timer, haul, roster tray, reprint/return) needs to behave like the rest of the game's UI.

Three forces:

1. The two entry paths each duplicated the run bootstrap (build field → roster → ramp → renderer),
   so they could silently drift apart.
2. The HUD was first built in PixiJS — the odd one out, since combat/stations/etc. are React DOM
   (ADR 001: "React owns the UI shell, PixiJS owns the world").
3. Portrait-in-a-landscape-app: a fixed 360×640 column letterboxed on phones.

## Decision

1. **One session, two entry paths.** A single `startCoreBreaker(app, opts)` (`renderer/core-breaker/
   session.ts`) assembles field + roster + ramp and mounts the renderer. The route and `enterMining`
   are thin callers that only own their Pixi app / stage scaling and supply inputs + an optional
   `onComplete`. The experience is identical; only the door (and what happens on completion) differs.

2. **The Pixi renderer draws only the world.** `core-breaker-renderer.ts` renders the field, balls,
   pegs, rig, background, and **reserves** the header/tray bands (so the field never sits under the
   HUD). It draws no HUD. It streams HUD state out via an `onHud` callback — **event-driven** (emits
   only when the displayed state changes: per-second timer, haul, roster advance, reprint), never per
   frame — and exposes `reprint()` / `endRun()` commands on its handle.

3. **The HUD is React DOM** (`components/CoreBreakerHud.tsx`), built from the existing FOUNDRY kit
   (`Plate`, `FoundryButton`, `chamfer`/`fd-*` tokens, Silkscreen/VT323 fonts). It overlays the
   canvas and aligns to the reserved bands via `headerFrac`/`trayFrac` from the state. In-game it is
   fed through a new `onMiningUpdate` callback + `miningReprint`/`miningReturn` `GameHandle` commands
   (the `SurfaceHUD` pattern); the route wires it straight to the renderer handle. Ball previews are
   pixel-art **data URLs** (`ballSpriteDataUrls()`) rendered as `<img image-rendering:pixelated>`.

4. **Portrait fill, shared math.** `coreBreakerViewport(hostW, hostH, simW)` (`core-breaker/layout.ts`)
   returns a portrait viewport that matches a portrait host's aspect (fills the screen, no letterbox)
   and falls back to a phone-shaped canvas on a landscape host. The renderer's "column" grows to that
   viewport (header pins top, tray pins bottom, field fills between). In-game, `enterMining` flips the
   **shared stage** to portrait (`setStageView`, generalised `computeScale`) for the mining phase and
   restores landscape on exit; other phases stay landscape.

## Consequences

- The world is one codepath; the two entry paths can't drift. Adding a third entry point is trivial.
- The HUD is stylable/accessible/testable like every other screen, and reuses the FOUNDRY system.
- HUD↔field alignment depends on `headerFrac`/`trayFrac`; the React bands are positioned over the
  canvas as fractions, so they line up on a portrait host (where the canvas fills the screen).
- Flipping the shared stage means an **orientation snap** at orbit→mining (landscape orbit/transition
  → portrait mining). Acceptable; could be smoothed later by making the `pod-deploy` transition
  portrait.
- A `?mode=mining` dev knob drops straight into the (portrait) mining run for feel-tuning.
- Reaffirms ADR 001 (UI is DOM) and ADR 003 (the sim/field stay deterministic and renderer-free —
  no sim or test files were touched by any of this).
