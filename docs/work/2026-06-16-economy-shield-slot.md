# Economy & ship-slots polish — buy-without-slot + dedicated shield slot

**Date:** 2026-06-16
**Branch:** claude/quizzical-chaplygin-f2defe (worktree off `main`, PR #17 merged)
**Roadmap item:** Fixes/extensions to 4.2 workbench, 4.3 shops, 4.8 station UX, and combat shield data
**Handoff:** `docs/work/2026-06-16-handoff-economy-shield-slot.md`

## Goal

Three playtest-driven changes shipped as one PR: (1) buying a module is never slot-gated — only
affordability blocks it, and an over-cap buy lands in cargo; (2) a dedicated `shield` slot (like
the implicit `clone-bay`) so every hull boots with a shield without eating a utility slot; (3) the
default Shield Generator grants 1 combat shield layer instead of 2.

## Approach

Three independent edits sharing the same data/sim/UI seam:

1. **Buy-without-slot.** Drop `hasSlotRoom` from `buyModule`/`craftModule`/`canBuyModule`/
   `canCraftModule` (keep affordability only). **Decision:** purchases always route to `run.cargo`
   (not auto-install) — clean, explicit install step, consistent whether or not a slot is free.
   `OfferBlock` loses its `need-slot` kind; the only block becomes the scrap shortfall. The slot
   picture stays visible (separate `slotUsage` → `SlotPicture`), so the player still sees the cap.

2. **Dedicated `shield` slot.** Add `'shield'` to `ModuleSlot`. `hullSlotLimit` returns 1 for
   `'shield'` (mirror `clone-bay`); add both to `ALL_SLOTS` so `slotUsage` covers them — they were
   missing today. Shield slot is **not uninstallable** (treat like `clone-bay`; swap-only is
   deferred). Move `mod-shield-generator` to `slot: 'shield'`. Add a shield to Scout & Freighter
   starting modules (Gunship/Tactical already carry one — it just moves out of utility). Hull
   utility counts unchanged: the shield leaving utility is itself the freed-slot win.

3. **Default shield → 1 layer.** `mod-shield-generator` passive `layers: 2 → 1`.

`RUN_STATE_VERSION` stays 3 — slots derive from the hull, nothing persisted changes shape.
Surface `items.ts` reads the `shield-bubble` effect by kind, not slot — no change.

## Steps

- [ ] `data/types.ts`: add `'shield'` to `ModuleSlot`; update the `HullDef.slots` comment (now
      "exactly 1 clone-bay AND 1 shield slot").
- [ ] `data/modules.ts`: `mod-shield-generator` → `slot: 'shield'`, passive `layers: 1`.
- [ ] `data/hulls.ts`: add `mod-shield-generator` to Scout & Freighter `startingModules`.
- [ ] `sim/economy.ts`: `hullSlotLimit` returns 1 for `'shield'`; `ALL_SLOTS` += `'shield'`
      (and confirm `'clone-bay'` already present — it is); drop `hasSlotRoom` from
      `buyModule`/`craftModule`/`canBuyModule`/`canCraftModule`; route `buyModule`/`craftModule`
      to `run.cargo` instead of `run.modules`; `canUninstallModule`/`uninstallModule` reject
      `'shield'` like `'clone-bay'`.
- [ ] `station-view.ts`: `OfferBlock` collapses to the scrap-shortfall kind only; `blockReason`
      returns `null` when affordable, else the scrap block (no slot block).
- [ ] `components/slot-labels.ts`: add `shield: 'SHIELD'` to `SLOT_LABELS` and `'shield'` to
      `SLOT_ORDER`.
- [ ] `components/StationScreen.tsx`: `blockReasonText` drops the `need-slot` branch (now only the
      scrap line). `SlotPicture` already iterates `slots` so the shield bucket renders for free.
- [ ] `components/Workbench.tsx`: verify the `SLOT_ORDER`-driven grouping renders the shield slot
      group with its used/limit; no change expected beyond the label.
- [ ] Tests:
  - `sim/economy.test.ts`: buy/craft with a full matching slot now succeeds → module lands in
    `cargo`, not `modules`; `canBuyModule` true when affordable regardless of slot; shield slot
    not uninstallable.
  - `station-view.test.ts`: `OfferBlock` never returns `need-slot`; affordable-but-slot-full offer
    is now `canBuy: true`.
  - `data/catalog.test.ts`: add a `shield` bucket to `counts`; assert exactly 1 shield per hull.
  - `sim/deck.test.ts`: update Scout & Freighter expected tallies (+ `card-reinforce` ×2 +
    `card-emergency-barrier`); Gunship/Tactical unchanged.
  - `sim/combat.test.ts`: gunship now has 1 starting layer; scout now has 1 (not `[]`). The
    multi-layer mechanic tests ("two-hit spends two layers", recharge) need a **2-layer fixture**
    (equip a second shield module in the test run) rather than relying on the default.
- [ ] `pnpm lint` / `type-check` / `test` / `build` all clean.

## Manual test steps

- [ ] `pnpm dev`, start a run, reach a Merchant. A module whose slot is full now shows the slot
      picture but has a live BUY button; buying it succeeds and it appears in cargo (Workbench).
- [ ] A module you can't afford still shows "Need N scrap · have M" and no BUY.
- [ ] Open the Workbench: a SHIELD slot group shows `1/1` with the Shield Generator; it has no
      uninstall affordance.
- [ ] Enter combat on any hull: the ship starts with exactly 1 shield layer (HUD pip + plate).
- [ ] Edge: buy two modules for the same already-full slot → both land in cargo, no crash, slot
      picture unchanged at the cap.
- [ ] 375px station/workbench check (human step).

## Out of scope for this session

- Shield-module **swap** (changing which shield occupies the slot) — slot is occupied-and-fixed
  for now, like clone-bay.
- A family of variant shield modules (different layers/recharge/cards) — this is groundwork only.
- Combat "too easy" / shield-economy rebalance — 5.5 balance pass owns that; the 1-layer default
  feeds it but we don't over-tune here.
- Re-tuning hull utility/weapon/engine slot counts beyond freeing the shield out of utility.

---

<!-- Fill in below during/after the session -->

## What actually happened

Built exactly to plan, no scope changes.

- **Buy-without-slot:** `buyModule`/`craftModule` now route to `run.cargo` and only gate on
  affordability; `canBuyModule`/`canCraftModule` dropped their slot checks. `canCraftModule`'s
  `moduleId` param became genuinely unused (craft cost is module-independent) so it was removed
  from the signature rather than left as a dead `_moduleId` (lint). `OfferBlock` collapsed to a
  single `need-scrap` member; `blockReason` no longer takes `slots`.
- **Shield slot:** added `'shield'` to `ModuleSlot`, limit 1 via `hullSlotLimit`, added to
  `ALL_SLOTS` (shield + clone-bay were previously missing from `slotUsage`). Shield is
  not-uninstallable like clone-bay. Moved the Shield Generator to `slot:'shield'`; added it to
  Scout & Freighter starting modules. `slot-labels` gained `SHIELD`; the Workbench/Station UIs
  pick it up for free (they're `SLOT_ORDER`/`slotUsage`-driven).
- **1-layer shield:** Shield Generator passive `layers: 2 → 1`.

**Test fallout:** the combat suite leaned on Gunship having 2 layers and Scout having 0. Added
two combat-test helpers — `twoShieldRun()` (gunship + a 2nd shield generator) for the
multi-layer mechanics, and `stripShields()` for the malfunction/dodge/untargetable tests that
assume a bare hull (stripping the shield also restores Scout's original module indices, so those
tests' index comments stay valid). Same pattern (`twoShieldCombat`) in `combat-view.test`.

**Browser smoke check:** app boots with no console errors; `?mode=surface` (Gunship) and
`?mode=surface&hull=hull-freighter` both project **SHIELD BUBBLE** in the HUD with the shield
ring, confirming the `slot:'shield'` move didn't break surface item projection and that the new
Freighter shield projects. The live station/merchant/workbench/combat visual + 375px check still
needs a human playthrough (canvas-driven map, scrap-gated buys — not reliably scriptable).

## Files created / modified

- `src/game/data/types.ts` — `ModuleSlot` += `'shield'`; HullDef.slots comment.
- `src/game/data/modules.ts` — Shield Generator `slot:'shield'`, `layers: 1`.
- `src/game/data/hulls.ts` — Scout & Freighter gain `mod-shield-generator`.
- `src/game/sim/economy.ts` — slot limit/ALL_SLOTS, buy/craft → cargo + no slot gate,
  shield not uninstallable, `canCraftModule(run)` signature.
- `src/game/station-view.ts` — `OfferBlock` = `need-scrap` only; `blockReason` simplified.
- `src/components/slot-labels.ts` — `SHIELD` label + SLOT_ORDER.
- `src/components/StationScreen.tsx` — `blockReasonText` scrap-only; dropped need-slot styling.
- Tests: `economy.test.ts`, `station-view.test.ts`, `catalog.test.ts`, `deck.test.ts`,
  `combat.test.ts`, `combat-view.test.ts`.

## Deferred to next session

- Live 375px station/workbench/combat visual check (human step — canvas map, scrap-gated buys).
- Shield-module **swap** (the slot is occupied-and-fixed for now, like clone-bay).
- Variant shield modules (different layers/recharge/cards) — this slice is groundwork.
- Combat "too easy" / shield-economy rebalance — 5.5 balance pass; the 1-layer default feeds it.

## Status

- [ ] In progress
- [x] Complete (pending the deferred human visual check)
- [ ] Partial — see deferred
