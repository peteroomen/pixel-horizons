# Space Always On — Persistent Portrait Canvas

**Date:** 2026-06-22
**Branch:** claude/game-map-space-ui-sfw624
**Roadmap item:** Phase 4 / 6 — Map + Space UI (Slice B of 3-slice plan)

## Goal

The Pixi canvas is always visible and always portrait; an animated starfield is the persistent base layer for every game phase. All non-canvas screens (map, shop, event, title) become glass panels floating over space instead of full-bleed solid-color overlays.

## Approach

The Pixi app already persists for the whole session — only the renderers it contains change per phase. The gap is:
1. The canvas is invisible (black) during map/shop/event phases
2. The virtual space is landscape (640×360); mining is the only thing that flips portrait
3. React overlays fully cover the canvas with opaque backgrounds

Fixes:
- Add `PORTRAIT_WIDTH = 360, PORTRAIT_HEIGHT = 720` to `pixel-scale.ts`. This becomes the universal virtual space. VIRTUAL_WIDTH/VIRTUAL_HEIGHT remain for legacy surface-renderer + spike routes.
- New `src/renderer/starfield.ts` — added to `app.stage` once at init, lives forever as the bottom-most layer. Never part of `destroyModes()`.
- `main.ts` boots into portrait stageView immediately; `setStageView()` in `enterMining` becomes a no-op (same dimensions already). `destroyModes` untouched.
- `space-renderer.ts` (combat) rewritten for portrait: ships stacked vertically (enemy near top, player near bottom), lane backdrop fills portrait canvas. Receives `virtW`/`virtH` params so it isn't hardwired to the constants.
- `orbit-renderer.ts`: remove static stars (starfield handles it), reposition planet (center) and ship (lower-left) for portrait.
- `transition.ts`: update `CX`/`CY`, orbit ship/planet poses, and REACH for portrait virtual space.
- React: `SectorMap`, `StationScreen`, `EventScreen`, `TitleOverlay` switch from opaque fills to semi-transparent glass. `page.tsx` run-over/sector-complete overlays go glass; vignette + scanline always on (not just lane/mining).

## Steps

- [ ] `src/renderer/pixel-scale.ts` — Add `PORTRAIT_WIDTH = 360`, `PORTRAIT_HEIGHT = 720`
- [ ] `src/renderer/starfield.ts` — NEW: `createStarfield(app, virtW, virtH, seed)` returning `{ destroy() }`. Three parallax layers (far/mid/near) with different counts, speeds, alpha. Stars are `Sprite` objects updated each ticker tick (`.y += speed`, wrap on overflow). Bottom of stage (`addChildAt(scene, 0)`). Seed from run seed so it's deterministic across hard-refresh.
- [ ] `src/game/main.ts` — (a) Derive portrait stageView at boot using `coreBreakerViewport(hostW, hostH, PORTRAIT_WIDTH)` — same helper mining uses. (b) `createStarfield(app, view.width, view.height, seedHash)` immediately after app.init, before mode entry. (c) `enterMining`: remove `setStageView()` call (already portrait). (d) `enterMining` `onComplete`: remove `setStageView()` reset call. (e) Pass `stageW`/`stageH` to `startCombatMode` and `startOrbitMode`.
- [ ] `src/renderer/space-renderer.ts` — `createSpaceRenderer(app, virtW, virtH)`. Portrait positions: `PLAYER_X = virtW / 2`, `PLAYER_Y = virtH * 0.72`; `ENEMY_X = virtW / 2`, `ENEMY_Y = virtH * 0.28`. Lane backdrop fills portrait. Shieldring ellipses updated. Floater spawn positions updated. Remove VIRTUAL_WIDTH/HEIGHT imports.
- [ ] `src/game/modes/combat-mode.ts` — Thread `virtW`/`virtH` through `CombatModeOptions` → `createSpaceRenderer`.
- [ ] `src/renderer/orbit-renderer.ts` — Remove static stars block. Update positions: planet at `(virtW/2, virtH*0.42)`, ship at `(virtW*0.22, virtH*0.80)`. Accept `virtW`/`virtH` params.
- [ ] `src/game/modes/orbit-mode.ts` — Thread `virtW`/`virtH` through to `createOrbitRenderer`.
- [ ] `src/renderer/transition.ts` — Update `CX = virtW/2`, `CY = virtH/2`, `REACH = max(virtW, virtH) * 0.8`, `ORBIT_SHIP_X/Y` and `PLANET_SIZE` for portrait. Accept `virtW`/`virtH` params. `playTransition(app, kind, assets, onComplete, virtW, virtH)`.
- [ ] `src/game/main.ts` — Pass `stageW`/`stageH` to `runTransition` → `playTransition`.
- [ ] `src/components/SectorMap.tsx` — `bg-fd-void/95` → `bg-fd-void/70 backdrop-blur-sm` (glass)
- [ ] `src/components/StationScreen.tsx` — Similar glass treatment for the outer container
- [ ] `src/components/EventScreen.tsx` — Glass
- [ ] `src/components/TitleOverlay.tsx` — Glass
- [ ] `src/app/page.tsx` — (a) Move vignette + scanline divs out of the `phase === 'lane' || ...` guard so they show on every phase. (b) run-over / sector-complete overlays: `bg-black/80` → `bg-black/60`. (c) orbit panel: already pointer-events-none, looks fine as-is.

## Manual test steps

- [ ] Open `localhost:3000` — the title screen shows animated stars drifting behind the glass title panel
- [ ] Start a run — map screen shows stars behind semi-transparent map
- [ ] Select a node — lane-launch transition plays in portrait orientation (ship centered)
- [ ] Combat — ships are vertical (enemy top, player bottom), lane backdrop fills portrait canvas, cards at DOM bottom, HUD at DOM top
- [ ] Win an encounter → Continue → another encounter starts; ships still correctly positioned
- [ ] Arrive at a planet — lane-drop transition in portrait; orbit screen shows planet + ship in portrait layout with stars in background
- [ ] Drop → pod-deploy transition in portrait → mining works same as before
- [ ] Return from mining → map screen shows stars behind glass
- [ ] Arrive at a shop — shop screen shows stars behind glass station panel
- [ ] Edge case: `?transition=lane-launch` in URL — loops correctly in portrait
- [ ] Edge case: desktop browser (landscape) — canvas is portrait column, centered, stars fill it, overlays work
- [ ] Edge case: `?mode=mining` — still works (portrait was already the mining mode)

## Out of scope for this session

- FTL-style map as Pixi layer (Slice C)
- Map generation rules / per-path guarantees (Slice A)
- Combat HUD layout changes (already DOM, already portrait-adaptive)
- Starfield in the Core Breaker mining renderer (it has its own bg; starfield lives behind)
- Surface / platformer renderer portrait (CB.7 cleanup handles this)
- Animated nebula / bloom visual effects in the starfield

---

## What actually happened

## Files created / modified

## Deferred to next session

## Status

- [ ] In progress
- [ ] Complete
- [ ] Partial — see deferred
