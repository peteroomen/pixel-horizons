# Handoff: Space Always On — Next Steps

**Date:** 2026-06-22
**Branch:** `claude/game-map-space-ui-sfw624`
**PR:** pending (not yet opened — create it for review)

---

## What was built

Slice B of the map/space UI plan: persistent portrait canvas with animated starfield as the base layer for all game phases.

**The core change**: `stageView` is computed once at boot from `coreBreakerViewport(hostW, hostH, PORTRAIT_WIDTH)` and never changes. Every phase — combat, orbit, map, shop, event — now runs in portrait (360 virtual width). The starfield container is added at `app.stage` index 0 at init and never destroyed.

**Files created:**
- `src/renderer/starfield.ts` — 3-layer parallax starfield (50/22/8 stars, far/mid/near speeds), seeded LCG, returns `{ destroy() }`

**Files modified:**
- `src/renderer/pixel-scale.ts` — `PORTRAIT_WIDTH = 360`, `PORTRAIT_HEIGHT = 720`
- `src/renderer/space-renderer.ts` — accepts `(app, virtW, virtH)`; ships at 38%/71% (player) and 62%/29% (enemy) for a diagonal dogfight angle; `spawnFloater` takes explicit `spawnY`
- `src/renderer/orbit-renderer.ts` — accepts `(app, descriptor, hullId, modules, virtW, virtH)`; removed its own static stars; planet at center-ish, ship at lower-left
- `src/renderer/transition.ts` — accepts `(..., virtW, virtH)`; all layout constants computed inside the function (no module-level VIRTUAL_* references)
- `src/game/main.ts` — single `const stageView` at boot; starfield created right after `applyScale()`; threads dims to combat/orbit/transition
- `src/game/modes/combat-mode.ts` — `CombatModeOptions` adds `virtW`/`virtH`
- `src/game/modes/orbit-mode.ts` — `startOrbitMode` accepts `virtW`/`virtH`
- `src/components/TitleOverlay.tsx` — transparent outer, solid inner `bg-fd-void` panel
- `src/components/EventScreen.tsx` — same pattern
- `src/components/SectorMap.tsx` — transparent map area, solid header strip
- `src/components/StationScreen.tsx` — fully opaque `bg-fd-void`
- `src/app/page.tsx` — vignette/scanline always-on; run-over/sector-complete as centered solid panels

---

## What still needs doing before merge

### 1. Browser verification (human step)

The UI changes can't be verified in a headless environment. Check these on a phone or desktop browser with `pnpm dev`:

- `localhost:3000` — title screen: animated stars visible behind the solid title panel; space shows AROUND the panel (not behind it)
- Start a run — sector map: stars visible behind map; header strip is solid, map area is transparent
- Select a combat node — lane-launch transition in portrait orientation
- Combat — player ship lower-left, enemy ship upper-right (diagonal); lane backdrop fills the portrait canvas; cards at DOM bottom work as before
- Win/lose — run-over panel is centered solid panel over transparent background
- Travel to a planet — orbit screen: planet visible upper-center, ship lower-left, stars behind everything
- DROP → mining — same experience as before (mining was already portrait)
- Station (shop/engineer) — solid panels, space visible at the sides if any canvas shows
- `?transition=lane-launch` URL — plays in portrait
- Resize desktop window — canvas reorients correctly (portrait column centered in landscape browser)

### 2. Open the PR

```bash
gh pr create --title "feat(ui): Space Always On — persistent portrait canvas with animated starfield" --base main --head claude/game-map-space-ui-sfw624
```

---

## What's next after this merges

**Roadmapped from this session:**
- **Slice A** — Map generation rules: per-path guarantees (every path must have ≥1 shop, ≥1 combat); column-type constraints (no all-same-type column); unfun generation prevention. Lives in `src/game/sim/map-gen.ts`.
- **Slice C** — FTL-style sector map as a Pixi canvas overlay drawn over the persistent starfield. Node positions as pixel art icons; edges as animated dotted lines; the React `SectorMap.tsx` becomes a thin click handler over a Pixi scene.

**Core Breaker track (higher priority per roadmap):**
- **CB.5** — Ball glyph grammar + dual-face `<ModuleCard>` (card shows weapon face / ball face)
- **CB.6** — Bloom soft-fail (what happens when you fail to extract enough before time runs out)
- **CB.7** — Platformer cleanup (retire `physics.ts`, `clone.ts`, `tilemap.ts`; remove `?mode=surface`; wire `?mode=orbit` and `/core-breaker` to same `startCoreBreaker`)

---

## Gotchas / things not to break

- `destroyModes()` in `main.ts` **must never touch index 0** of `app.stage` — that's the starfield. It only destroys the containers above it (combat/surface/orbit/mining each add their own container above).
- `stageView` is a `const` — don't introduce any code that tries to reassign or recompute it per-mode. The whole point is it never changes.
- The standalone `/core-breaker` route has its own `PixiApplication` and `portraitConfig()` — it is **not** affected by `main.ts` changes. Keep it independent.
- `?transition=lane-drop` / `lane-launch` / `pod-deploy` still work — they call `runTransition()` in main which already passes `stageView.width/height`.
