# Handover — Core Breaker is live (next: CB.5 / CB.6 / CB.7)

**Date:** 2026-06-22
**State:** Everything below is **merged to `main`** (commit `55fff53`, PR #38). 562 tests green;
type-check + `eslint src` + `pnpm build` clean. Assume the reader starts cold.

## What's live

Core Breaker (Mining Run v2) is the **live surface loop**. It is reached two ways, both running the
**same code** (`startCoreBreaker`):

- **In-game:** sector node = planet → orbit screen → **DROP** → `pod-deploy` transition →
  `enterMining()` (the stage flips to **portrait** and fills the screen) → bank haul → map.
- **Route:** `/core-breaker?seed=&modules=&difficulty=` — standalone, owns its own Pixi app.
- **Dev knob:** `?mode=mining` drops straight into the portrait mining run (skips orbit/drop).

Visuals are pixel-art (ported from `docs/design/mining-run-v2.dc.html`): 6 silhouette peg sprites
(× damage stages), 5 ball sprites, crust + ceiling-scar background. HUD is **React DOM**.

## Architecture (read ADR 012 first)

| Concern | Where |
|---|---|
| One session bootstrap (field+roster+ramp+renderer) | `src/renderer/core-breaker/session.ts` → `startCoreBreaker(app, opts)` |
| World rendering (no HUD); emits `onHud`; `reprint()`/`endRun()` | `src/renderer/core-breaker-renderer.ts` |
| Sprite factories (canvas → nearest PixiJS textures) | `src/renderer/core-breaker/{sprite-toolkit,peg-sprites,ball-sprites,background}.ts` |
| Portrait viewport math + contain-fit | `src/renderer/core-breaker/layout.ts` (`coreBreakerViewport`, `fitTransform`) |
| React HUD (FOUNDRY components) | `src/components/CoreBreakerHud.tsx` |
| In-game wiring | `src/game/main.ts` (`enterMining`, `setStageView`, `onMiningUpdate`, `miningReprint`/`miningReturn`) → `GameCanvas.tsx` → `src/app/page.tsx` |
| Route wiring | `src/app/core-breaker/page.tsx` |
| Sim (deterministic, untouched) | `src/game/surface/core-breaker.ts`, `field-gen.ts`, `ball-projection.ts` |

Key invariants: the **sim and all tests were never touched** by the rendering/HUD work. The HUD is
event-driven (renderer emits `onHud` only on change). The renderer reserves header/tray bands; the
React HUD aligns to them via `headerFrac`/`trayFrac`.

## Gotchas

- **Preview dev server runs from the worktree dir** regardless of `pnpm -C`; the worktree must hold
  the code you're testing. Use `?mode=mining` + a portrait viewport (e.g. 390×844) to see the loop.
- The **`pod-deploy` transition won't complete in the headless preview** (rAF throttles off-screen),
  so the in-game orbit→mining handoff can't be screenshot there — use `?mode=mining`, or test on a
  real focused browser. There is an **orientation snap** at orbit→mining (landscape → portrait).
- Node 22 required (`nvm use 22`) before pnpm. `next lint` is gone — use `eslint src`.
- Ball previews in the HUD are data URLs from `ballSpriteDataUrls()` (canvas `toDataURL`).

## Next slices

- **CB.5 (partial done):** ball **glyph grammar** (trajectory glyph + count badge) and the dual-face
  `<ModuleCard>` (combat + surface faces, §6.4) across Workbench/DeckViewer/shop at 375px. The pixel
  sprites already exist; this is the card UI + glyph layer.
- **CB.6:** Bloom interference / soft-fail — growths that eat banked yield if ignored (§6.5/§6.10);
  tune the shot economy. (Today Bloom just consumes a non-ghost ball.)
- **CB.7 cleanup:** remove the retired platformer (`surface/physics.ts`, clone moveset, corpse-run,
  chunk grammar, platformer enemy/hazard entities, the old `?mode=surface` platformer path) and stale
  tests now that Core Breaker is the live loop.

## Lower-priority follow-ups

- Smooth the orbit→mining orientation snap (make `pod-deploy` portrait, or cross-fade).
- Juice FX (hit-stop, screen shake, shatter shards, catch flash) — deferred from the visual pass.
- Live bounce-countdown pips (the v2 sim has no bounce budget; pips are cosmetic today).
- HUD band alignment on **landscape desktop** is approximate (canvas is letterboxed there); fine on
  phones. Revisit only if desktop play matters.
