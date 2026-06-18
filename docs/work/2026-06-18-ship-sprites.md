# Ship Sprite Refinement & Hull Variety

**Date:** 2026-06-18
**Branch:** feature/ship-sprites
**Roadmap item:** Phase 5 — Hull variety / renderer fidelity (Slice 6.x)

## Goal

Port the pixel-art hull sprites and module grammar from `docs/design/foundry-transitions-ships.dc.html` into the game renderer, replacing the old 44×28 Gunship hull with three distinct 64×32 hulls (Gunship, Scout, Freighter) and the old chunky overlays with small 8×8 module sprites mounted on per-hull fixed positions.

## Approach

1. **sprites.ts** — Add new hull factories (64×32 each from the design doc's `_sprites()` method), new module sprite factories (mWeapon, mTurret, mEngine, mUtil, mEmpty from the same), a per-hull mount point config, and a new `compositeShipForHull(hullId, slotCounts)` that produces a 72×40 composite. Keep old `compositeShip`/`gunshipHull` for reference but unused.

2. **combat-view.ts** — Add `hullId: string` field to `CombatView`, populated from `state.hullId`.

3. **space-renderer.ts** — Update `moduleKind` → `moduleSlotType` (returns `HullSlot`), update key computation to include hull ID, call `compositeShipForHull` in `setPlayerShip`.

4. **hulls.ts** — Fix Freighter slot counts to match design doc: `{ weapon: 1, utility: 1, engine: 2 }` (was `utility: 2, engine: 1`).

## Steps

- [x] Create branch `feature/ship-sprites` from origin/main
- [ ] Write plan file (this file)
- [ ] Add Collective palette constants to sprites.ts
- [ ] Add 4 module sprite factories (mWeapon, mTurret, mEngine, mUtil, mEmpty)
- [ ] Add 3 hull factories (gunshipHullNew 64×32, scoutHull 64×32, freighterHull 64×32)
- [ ] Add mount point config per hull + `compositeShipForHull`
- [ ] Update `muzzleFlash` to 72×40
- [ ] Export `HullSlot` type and `compositeShipForHull`
- [ ] Add `hullId` to `CombatView`
- [ ] Update `space-renderer.ts` to use hull-aware compositor
- [ ] Fix Freighter slots in hulls.ts
- [ ] `pnpm lint && pnpm type-check && pnpm test`
- [ ] Commit + push + PR

## Manual test steps

- [ ] `pnpm dev`, open localhost:3000
- [ ] Default (Gunship): combat screen shows the new 64×32 hull silhouette with turrets on the dorsal spine and a belly weapon
- [ ] Switch hull via `?hull=hull-scout`: sleek dart silhouette with rear engine cluster visible
- [ ] Switch via `?hull=hull-freighter`: wide boxy body with stacked cargo containers
- [ ] Enemy hits still flash the ship red; muzzle flash still appears at the nose
- [ ] 375px viewport: all three hulls read cleanly at the scaled size
- [ ] Edge case: Gunship with no modules installed shows all mEmpty brackets

## Out of scope for this session

- Tactical hull (hull-tactical) sprite — uses gunship hull as placeholder
- Hull picker UI (Phase 5)
- Bloom Cruiser / Swarm sprites
- Lane drop / launch transition animations

---

## What actually happened

(fill in during/after session)

## Files created / modified

- `src/renderer/sprites.ts`
- `src/game/combat-view.ts`
- `src/renderer/space-renderer.ts`
- `src/game/data/hulls.ts`
- `docs/work/2026-06-18-ship-sprites.md` (this file)

## Status

- [ ] In progress
- [ ] Complete
- [ ] Partial — see deferred
