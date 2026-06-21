# Mining Run — Portrait Redesign

**Date:** 2026-06-22
**Branch:** feature/mining-portrait-redesign
**Roadmap item:** Phase CB — Core Breaker feel pass

## Goal

Redesign the mining run to feel right on a portrait phone: pod embedded at the top of the
planet surface fires balls *downward* into the rock, mineral drops float *upward* back to
the pod (auto-magnet, no player input during flight), ball expires when it falls past the
bottom.  Standalone `/core-breaker` route uses 360×640 portrait virtual canvas.

## Approach

Three mechanical changes drive everything else:

1. **Pod at top** — stationary, dual-purpose launch rig + collection bay.  `cfg.podY` ≈ 30.
   `cfg.launch = { x: cfg.width/2, y: cfg.podY }`.
2. **Drops float up** — mineral drops spawn with upward velocity and a continuous magnet pull
   toward the pod.  Auto-collected when `drop.y ≤ cfg.podY`.  No `bayWidth` catch check.
3. **Ball expires at floor** — `ShotEnd = 'fellOut' | 'consumed' | 'settled' | 'maxSteps'`
   (remove `'caught'`).  `StepEvents.caught` removed.

Portrait canvas (standalone route only for now): 360 × 640.  Field-gen constants redesigned
for this space.  Main-game `enterMining()` keeps landscape canvas for now (CB.7 concern).

## Steps

- [x] Branch `feature/mining-portrait-redesign`
- [x] `src/game/surface/core-breaker.ts`
  - Remove `caught` from `StepEvents`, `ShotEnd`
  - Remove pod-catch block from `step()`; `step()` no longer takes `podX`
  - `stepMinerals()`: magnet pull (700 px/s²) toward pod at top, collect at `m.y <= cfg.podY + 15`
  - `defaultConfig()`: portrait 360×640, `podY=30`, `launch={x:180,y:30}`, `floorY=628`
  - Remove `bayWidth` from config
- [x] `src/game/surface/field-gen.ts`
  - Portrait grid: 6 cols × 11 rows, GRID_Y0=90, GRID_Y1=490 within 360×640
  - Ore bars repositioned: oreY=[160,270,380], oreX=[120,230,160]
  - Bloom hazards: [120,200], [250,160], [190,320]
  - Crystal at (180,520), rock funnel around it
- [x] `src/renderer/core-breaker-renderer.ts`
  - Removed `caughtThisTurn`, pod drag input, separate `drawPod()`
  - `drawBg()`: underground fill + planet surface band at top + edge line
  - `drawRig()`: merged pod+rig — surface housing + downward launch tube + aim glow
  - `advanceTurn()`: no caught branch — just fell-out → next roster ball
  - `stepMinerals` called with fixed `cfg.launch.x` (pod center is fixed)
- [x] `src/app/core-breaker/page.tsx`
  - Portrait canvas: Pixi init uses `cfg.width=360, cfg.height=640`
  - Scale computation uses portrait dimensions; removed `VIRTUAL_WIDTH/HEIGHT` import
- [x] Tests updated for portrait config (peg x=180, tunneling peg y=130)
- [x] `pnpm lint && pnpm type-check && pnpm test` — 562/562 green, lint/build clean

## Manual test steps

- [ ] Open `/core-breaker` on phone (portrait) — canvas fills the screen vertically
- [ ] Drag down from the pod rig to aim; release fires ball downward
- [ ] Ball bounces through pegs; mineral drops float back up to pod
- [ ] Ball falls past bottom → "PROBE LOST", next ball loads
- [ ] All balls spent → "MINING COMPLETE"

## Out of scope

- Main-game portrait canvas (landscape 640×360 stays for `enterMining()` for now)
- Planet core / burn-in at bottom (future style pass)
- Sound effects, haptics

---

## What actually happened

Implemented as planned. Key detail: the `stepMinerals` magnet removes gravity entirely for drops
(replaces it with a 700 px/s² pull toward the pod at the top). The 1/60 coarse-step tunneling
test needed a peg y-shift (164→130) because the portrait launch origin (y=30) places coarse
steps at different positions than the old landscape origin (y=22).

`drawPod()` was merged into `drawRig()` (single function draws both the surface housing and the
downward launch tube); `podGfx` and `rigGfx` containers kept separate for layering.

## Files created / modified

- `src/game/surface/core-breaker.ts` — portrait config, no pod-catch, magnet drops
- `src/game/surface/field-gen.ts` — portrait 6×11 grid, new ore/bloom/crystal positions
- `src/renderer/core-breaker-renderer.ts` — pod-drag removed, surface-at-top background, merged rig draw
- `src/app/core-breaker/page.tsx` — portrait Pixi init + inline scale computation
- `src/game/surface/core-breaker.test.ts` — peg positions updated for portrait launch coords
- `docs/work/2026-06-22-mining-portrait-redesign.md` — this file

## Deferred to next session

- Main-game `enterMining()` canvas still landscape 640×360 (CB.7)
- Planet core burn-in visual at bottom (future style pass)
- Renderer art polish: real planet surface texture at top, underground gradients

## Status

- [ ] In progress
- [x] Complete
- [ ] Partial — see deferred
