# Playtest Fixes — Early Launch, Abandon, Lane-Only Combat

**Date:** 2026-06-13
**Branch:** feature/the-run (PR #11 — lands with THE RUN mega-slice)
**Roadmap item:** Phase 3/4 — fixes from the first human playtest of THE RUN

## Goal

Three fixes from Peter's hand-play of THE RUN: no dead waiting after mining out
a planet, no soft-locks on the surface, and combat only in lanes — never at
nodes.

## What was done

**1. Early pod return** (`surface/surface.ts`, `surface-view.ts`,
`modes/surface-mode.ts`, `main.ts`, `page.tsx`)

- `canLaunchPod(state)` — clone standing on the pod, window still open.
- `launchPod(state)` — deposits the backpack, launches, outcome `'aboard'`;
  no-op unless `canLaunchPod` (callers gate UI on the same check).
- `SurfaceView.canLaunch` drives a top-center LAUNCH POD button (FoundryButton
  primary). Walk onto the pod → tap → everything banked, run continues.

**2. Abandon planet** (same files)

- New outcome `'abandoned'` + `abandonSurface(state)`: identical consequences
  to `stranded` (backpack → `lostBackpack`, deposits safe, pod leaves, sim
  freezes) via a shared `strandClone` helper. Works on pod-less levels too.
- Always-visible ABANDON button during an ongoing drop, **two-tap confirm**
  (arms for 2.5 s — abandoning costs the backpack; a misclick must not).
  Result overlay reads PLANET ABANDONED / CLONE RECALLED — BACKPACK LOST.

**3. Combat only in lanes** (`sim/map-gen.ts`, `data/constants.ts`, `main.ts`,
`SectorMap.tsx`, GDD §7)

- Nodes are realspace destinations — the Bloom can't follow (GDD §2). The
  `'combat'` node type, `MAP_NODE_WEIGHTS.combat`, `NODE_COMBAT_LANE`, and the
  `nodeFightPending` forced-encounter branch in `main.ts` are all removed.
  Arrival always resolves straight to the node's screen.
- Node weights are now `{ planet: 4, cache: 2 }`; danger lives entirely on
  edges (`encounterCount`). GDD §7.1/§7.2/§7.3 updated to match: the Combat
  node row is gone, elites re-framed as **elite lanes** (5.1).

## Manual test steps (verified in preview browser)

- [x] Map shows only START / PLANET / CACHE / GATE nodes (seed `fixcheck1`).
- [x] Lane to a cache: Carapace encounter triggers mid-lane, escape-by-arrival
      at 7/7 → CONTINUE → straight to map, cache scrap banked (+9), hull 97
      carried — **no node fight**.
- [x] `?mode=surface`: walk onto pod → LAUNCH POD appears → tap → POD
      LAUNCHED / CLONE ABOARD. Off the pod, no LAUNCH button.
- [x] ABANDON → CONFIRM ABANDON? → PLANET ABANDONED / CLONE RECALLED —
      BACKPACK LOST (deposits retained in sim test; empty-backpack case in
      browser).
- [x] 375 px: buttons top-center, no HUD/touch-control overlap.

## Files created / modified

`src/game/surface/surface.ts` (+test), `src/game/surface-view.ts` (+test),
`src/game/modes/surface-mode.ts`, `src/game/main.ts`,
`src/game/sim/map-gen.ts` (+test), `src/game/data/constants.ts`,
`src/components/SectorMap.tsx`, `src/app/page.tsx`, `docs/game-design.md`,
`CLAUDE.md`.

## Deferred to next session

- Pod-defense events and lane-modifier variety (infested/elite lanes) — the
  natural home for "forced" combat now that nodes are safe (4.1+/5.1).
- LOST/BANKED "—" rows on the abandon overlay when nothing was carried could
  be suppressed — cosmetic.

## Status

- [x] Complete
