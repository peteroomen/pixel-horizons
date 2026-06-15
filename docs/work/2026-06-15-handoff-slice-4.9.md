# Handoff → Slice 4.9: Deckbuilding acquisition & starting-deck audit

**Written:** 2026-06-15 (end of Slice 4.8 Station UX, branch `claude/sharp-wright-iv37l2`)
**For:** the next single-slice session (one slice = one plan = one branch = one PR)
**Roadmap item:** Phase 4 — **4.9 Deckbuilding acquisition & starting-deck audit** (`docs/roadmap.md`)

> **Alternatives if you'd rather sequence differently:** Slice **3.4** (clone death +
> surface enemies — handoff at `docs/work/2026-06-15-handoff-slice-3.4.md`). Confirm with
> Peter; both are unblocked.

---

## Where things stand

- **Slice 4.8 (Station UX) is built** on branch `claude/sharp-wright-iv37l2` (not yet a PR
  unless Peter asked) — see `docs/work/2026-06-15-slice-4.8-station-ux.md`. The shop +
  workbench now show generated-card previews, the slot picture (`slotUsage`), and a full
  `OfferBlock` buy-block reason. 441 tests green.
- **All prior PRs merged to main:** through #15 (powers/status).
- **Pre-session checklist still applies** (CLAUDE.md): read roadmap + this handoff + GDD
  §4–§5; write a plan file; get Peter's confirmation **before** any code.

## What the slice is (from the 2026-06-15 playtest)

The keyword/status/legibility work landed, but the deckbuilding *juice* is still missing.
Two confirmed changes:

1. **Start runs with fewer installed modules** so each acquisition is a bigger relative
   change to both the deck and the ship silhouette. This is the A5 starting-loadout audit
   deferred from 4.6 — it's **pure data** in `data/hulls.ts` (`startingModules`), but it
   **shifts module indices and churns the tuned combat tests** (many fixtures assume the
   current decks), so budget time for test updates.
2. **Make more modules flow as rewards** — shops, events, elites, and the boss should hand
   out modules often enough that the deck visibly grows across a run. Re-audit acquisition
   pacing end to end.

## The seam — precise pointers (verify line numbers, they drift)

- **Starting loadouts:** `src/game/data/hulls.ts` (`startingModules` per hull). Default run
  hull is `hull-scout` (`createRunState`); the dev/game default is `hull-gunship` (`?hull=`).
- **Shop offers:** `src/game/sim/shop-inventory.ts` (`generateShopOffers`) +
  `data/economy.ts` (`SHOP_OFFER_COUNT`, prices). The 4.8 shop UI already previews a
  module's cards (`describeModuleCards`) — reuse it for any new reward surfacing.
- **Event/boss rewards:** events in `data/events.ts` + `sim/events.ts`; boss reward in
  `BossReward.tsx` / `main.ts` `boss-reward` phase.
- **Deck regen:** `sim/deck.ts` `generateCombatDeck` — deck rebuilds from `run.modules` each
  combat, so changing the starting module list automatically reshapes the opening deck.
- **Slot picture / install rules (4.8, reuse, don't duplicate):** `sim/economy.ts`
  `slotUsage`/`hasSlotRoom`; views in `ship-view.ts` / `station-view.ts`.

## Gotchas / guardrails

- **Tuned combat tests will move.** Changing starting modules changes the opening deck and
  module indices (malfunction targeting keys off index — see `deck.ts` header comment).
  Expect to update `combat.test.ts` / `deck.test.ts` fixtures; do it deliberately, don't
  paper over a real regression.
- **Numbers live in data** (`data/hulls.ts`, `data/economy.ts`) — no hand-balancing in logic.
- **Sim stays React/Pixi/DOM-free.** Acquisition rules are sim; surfacing is view/UI.
- Coordinate with 4.2 workbench, 4.3 shops, 4.4 events, 5.1 elites, 5.5 balance (per roadmap).
- Tooling: **Node 22** (`nvm use 22`) before `pnpm install`/`dev`/`commit`; lint is
  `eslint src`; `docs/` is in `.prettierignore`.

## Out of scope (don't scope-creep)

- Full 5.5 balance pass (enemy damage, boss tuning) — 4.9 is about *acquisition pacing*,
  not combat difficulty.
- Mk II deck generation / tier tracking beyond what already exists.
- Drag-and-drop workbench feel → 6.7.
