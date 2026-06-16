# Handoff — Economy & ship-slots polish (dedicated shield slot)

**From:** session after 3.4 (PR #17). **For:** a fresh session — assume you start cold.
**Branch from `main`** after PR #17 merges (it touches `data/types.ts`, `data/modules.ts`,
`data/surface.ts` which 3.4 also edited — rebase if #17 is still open).
**Roadmap:** fixes/extensions to 4.2 workbench, 4.3 shops, 4.8 station UX, and combat shield data.

## Why

Playtest feedback (2026-06-16, owner) on the shipped economy/ship-building:

1. **Buying should never be slot-gated.** You should be able to buy a module whether or not
   a slot is free; the UI should *tell* you the slot situation, not block the purchase.
2. **Dedicated shield slot.** Today "utility" holds the Shield Generator and everything else,
   which is cramped (Gunship has only 1 utility slot, eaten by the shield). Decision: add a
   **separate `shield` slot** (like the implicit `clone-bay` slot), so every hull starts with
   a shield equipped by default and utility slots are freed for scanners/etc.
3. **Default shield = 1 layer.** The Shield Generator's combat passive is `layers: 2`; drop to
   1, leaving room for stronger/variant shield modules later (different layers / recharge /
   cards). This is groundwork for a small family of shield modules.

## Scope (one slice, one PR)

### 1. Buy-without-a-slot
- `sim/economy.ts`: drop the `hasSlotRoom` gate from `buyModule`/`craftModule` and from
  `canBuyModule`/`canCraftModule` (keep only the affordability check). **Decision to make:**
  route purchases to `run.cargo` always (clean, explicit install step) vs. auto-install if a
  slot is free else cargo. Recommend **always → cargo** for consistency.
- `station-view.ts` `OfferBlock`: slot-full is now **info, not a block** — only block on
  `cannot-afford`. Keep showing the per-slot picture (the 4.8 `slotUsage` helper already exists).
- Tests: `sim/economy.test.ts` (buy with a full slot now succeeds → lands in cargo),
  `station-view.test.ts` (OfferBlock reason no longer returns slot-full).

### 2. Dedicated `shield` slot
- `data/types.ts`: add `'shield'` to `ModuleSlot`.
- `sim/economy.ts`: `hullSlotLimit` returns 1 for `'shield'` (mirror `clone-bay`); add it to
  `ALL_SLOTS` so `slotUsage` covers it. Decide `canUninstallModule` for shield (recommend:
  **swappable but the slot stays occupied** — you can change shield modules, not empty the slot;
  simplest first cut is to treat it like `clone-bay` = not uninstallable).
- `data/modules.ts`: move `mod-shield-generator` to `slot: 'shield'`.
- `data/hulls.ts`: every hull `startingModules` includes a shield module (Gunship/Tactical
  already do; **add one to Scout and Freighter**). Utility slot counts can now drop the
  implicit shield assumption — re-tune per hull.
- `data/catalog.test.ts`: the per-hull slot-count test (`counts` object + "exactly 1
  clone-bay") — add a `shield` bucket and assert exactly 1 shield per hull (if mandatory).
- `slot-labels.ts` + `Workbench.tsx`/`StationScreen.tsx`: add the `shield` slot label/summary.
- `surface/items.ts`: **no change needed** — it reads the `shield-bubble` planet effect by
  kind, not by slot, so the surface Shield Bubble keeps working.
- `sim/deck.ts`: shield cards generate regardless of slot — verify, no change expected.

### 3. Default shield → 1 layer
- `data/modules.ts`: `mod-shield-generator` passive `layers: 2` → `1`.
- `sim/combat.ts` + combat tests asserting 2 starting shield layers → re-tune to 1.

## Gotchas

- **RUN_STATE_VERSION stays 3** — slots are *derived from the hull*, not stored on RunState;
  adding a slot type changes no persisted shape. Only the starting-module list changes, which
  shifts the starting deck for Scout/Freighter → their deck-gen tests update.
- The combat "too easy" / shield economy is also flagged for the 5.5 balance pass — the
  1-layer default feeds into that; don't over-tune here, just make the data change.
- Keep the surface 3.4 invariant: surface sim stays economy-free; nothing here touches it.
- Node 22 + `pnpm install` in a fresh worktree. `pnpm lint`/`type-check`/`test`/`build` clean
  before PR. Push needs the `peteroomen`-scoped write (Claude GitHub App must be installed on
  the repo — it is now); commits are pushed via the normal git remote.

## Acceptance

- Buy a module with all matching slots full → succeeds, module appears in cargo; the offer
  shows the slot picture but no longer blocks.
- Every hull boots with a shield in its own `shield` slot; utility slots are free for other
  modules; the default Shield Generator grants 1 combat shield layer.
- All suites green; `pnpm build` clean; 375px station/workbench check (human step).
