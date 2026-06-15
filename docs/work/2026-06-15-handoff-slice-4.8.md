# Handoff → Slice 4.8: Station UX & workbench access

**Written:** 2026-06-15 (end of the Slice 4.7 Powers & status session, PR #15)
**For:** the next single-slice session (one slice = one plan = one branch = one PR)
**Roadmap item:** Phase 4 — **4.8 Station UX & workbench access** (`docs/roadmap.md`)

> **Why this slice is "next":** it's the remaining PR #13 playtest item (feedback #3 + #7 —
> *"module management is illegible and the workbench is hard to reach"*), and it builds directly
> on the tooltip/legibility work that's warm from 4.7. **Alternatives if you'd rather sequence
> differently:** Slice **3.4** (clone death + surface enemies — has its own handoff at
> `docs/work/2026-06-15-handoff-slice-3.4.md`), or **4.9** (deckbuilding acquisition & starting-deck
> audit — fewer starting modules, more module rewards). Confirm with Peter if unsure; otherwise 4.8.

---

## Where things stand

- **Slice 4.7 (Powers & status) is merged** (PR #15) — visible/stacking statuses with tooltips, buff
  cards now Exhaust, Tracer Lock is a targeted Mark. 435 tests. See
  `docs/work/2026-06-15-powers-status.md` + ADR 008.
- **All prior PRs merged to main:** through #13 (arsenal), #14 (world-art), #15 (powers/status).
- **Branch base:** branch `feature/station-ux` off `main`.
- **Pre-session checklist still applies** (CLAUDE.md): read roadmap + this handoff + GDD §4–§4.2/§8,
  write a plan file, get Peter's confirmation **before** any code.

## What the slice is

Make module management **legible** and **reachable** (FOUNDRY design language; the tactile
drag-and-drop polish stays in 6.7):

1. **Workbench accessible from Merchant/Engineer nodes** — today it's reachable on its own only
   (NodeType has `shop`/`engineer` but no `workbench` — verify how `Workbench.tsx` is currently
   entered). Surface a "WORKBENCH" affordance inside the station screens.
2. **Module-management UX:** what's equipped and in which slot, **slots used / free / required** for a
   candidate module, **module + generated-card comparisons** before buying/swapping, and **tooltips on
   keywords/mechanics**.
3. **Generalize the buy-block reason** shipped in PR #13 (`NEED SLOT` / `NEED SCRAP`,
   `ShopOfferView.blockReason`) into the **full slot picture** (X/Y slots, which slot a module needs).

## The seam — precise pointers (verify line numbers, they drift)

- **Station UI:** `src/components/StationScreen.tsx` (shops/engineer) + `src/components/Workbench.tsx`
  (install/swap/craft). View model: `src/game/station-view.ts` (`ShopOfferView.blockReason` lives here).
- **Ship/loadout view:** `src/game/ship-view.ts` — likely where "equipped modules + slots" projects;
  extend it for the slot picture (used / free / required) and the module/card comparison.
- **Economy & inventory (sim):** `src/game/sim/economy.ts`, `src/game/sim/shop-inventory.ts`
  (+ their tests `economy.test.ts`, `shop-inventory.test.ts`) — buy/sell/install rules. Keep all the
  **legibility in the view layer**; the sim already enforces slot/scrap rules (don't duplicate them).
- **Deck preview:** module → cards is `generateCombatDeck` / the per-card view text in
  `src/game/combat-view.ts` (`describeEffect`). Reuse `describeEffect` to show a candidate module's
  generated cards before buying.
- **Node types:** `src/game/sim/map-gen.ts:32` (`NodeType`). Phase machine / node entry is in
  `src/game/main.ts`.

## Reuse from 4.7 (this is the big leg-up)

- **`src/components/foundry/InfoChip.tsx`** — the tap-to-reveal tooltip primitive (portal + viewport
  clamp + single-open via `InfoChipProvider`). **Use it for the workbench keyword/mechanic tooltips**
  (playtest feedback #3 explicitly asks for this). Wrap the station/workbench screens in
  `<InfoChipProvider>` just like `HUD.tsx` does.
- **`src/components/combat-keywords.ts`** — `KEYWORD_GLOSSARY` (Exhaust/Retain/Jettison/Cleave copy).
  Reuse it so keyword explanations are consistent between combat and the workbench. Consider promoting
  it to a shared location if both surfaces import it.
- **`src/game/data/statuses.ts` `getStatus`** — if you show what a module's cards *do*, status names
  come from here.

## Open design questions (resolve in the plan)

1. **Entry point:** a tab/button inside `StationScreen` vs a distinct sub-screen? Mobile-first — the
   station screen is already content-dense at 375px.
2. **Comparison model:** swap = show outgoing module's cards vs incoming side-by-side? How much fits at
   375px (the plates are tight; you just reworked them).
3. **Slot picture source of truth:** does `ship-view.ts` already expose slot counts, or does the sim
   need a `slotsUsed/slotsFree` projection added? Keep rules in the sim, presentation in the view.

## Gotchas / guardrails

- **Sim stays React/Pixi/DOM-free**; legibility is a view/UI concern — don't move slot/scrap rules into
  components. The sim already enforces them; the UI just *explains* them.
- **Numbers live in data** (`data/economy.ts`, module defs) — no hand-balancing in logic.
- Tooling: **Node 22** (`nvm use 22`) before `pnpm install`/`dev`/`commit`; lint is `eslint src`;
  `docs/` is in `.prettierignore`. Push uses the scoped `peteroomen` token (see the memory note).
- Mobile tap hardening: tappable controls use `touch-manipulation`; the canvas host carries
  `touch-none`. Follow the same pattern for new station controls.

## Manual test steps (happy path + edges)

- Open a Merchant/Engineer node → a WORKBENCH affordance is present and opens module management.
- The loadout shows each equipped module **and its slot**; slots read **used / free**.
- A candidate module shows its **generated cards** (reuse `describeEffect`) and **how many slots it
  needs**; if you can't afford/fit it, the block reason says **why** (full slot picture, not just
  NEED SLOT/NEED SCRAP).
- Tooltips: tapping a keyword/mechanic in the workbench explains it (reuse `InfoChip`); only one open
  at a time; verify at **375px** — fully on-screen (4.7 fixed the clipping, keep using the portal).
- **Edge:** swap a module when slots are full — the swap math and the UI agree. **Edge:** no console
  errors at 375px with a full module list + an open tooltip.

## Out of scope (don't scope-creep)

- Drag-and-drop module slots + install animations → **6.7**.
- Buff/debuff number tuning (the now-Exhaust economy) → **5.5**.
- Deckbuilding acquisition pacing (fewer starting modules / more rewards) → **4.9**.
- New modules/blueprints beyond what's needed to test the UX.
