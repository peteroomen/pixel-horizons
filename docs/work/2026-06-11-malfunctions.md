# Malfunctions

**Date:** 2026-06-11
**Branch:** feature/malfunctions
**Roadmap item:** Phase 2 — Slice 2.3 Malfunctions

## Goal

A module hit flips that module's cards into playable repair cards (play = repair), hull
innate abilities work in combat, and the Parasite (hunts your best module) is fightable
in the browser.

## Approach

**Card instances replace flat CardIds in CombatState piles.** Malfunction is
module-level state, and flipping must follow the *instance* (Scout runs 2× Thruster —
only the hit Thruster's three cards flip). Piles become
`CombatCard { cardId, moduleIndex }[]` where `moduleIndex` indexes `run.modules`;
`deck.ts` gains `generateCombatDeck(moduleIds): CombatCard[]` (existing `generateDeck`
becomes its CardId projection). **Flipping is derived, never stored:** a card presents
as its Malfunction form iff its module index is in `CombatState.malfunctioning` — no
pile rewriting on flip/repair, and the played repair card lands in the discard pile
already "back to normal" for free (GDD §5.6).

**Malfunction state machine (all in sim/combat.ts):**

- `CombatState.malfunctioning: number[]` (module indices; plain JSON).
- `resolveIncomingHit` gains an optional module-targeting argument. Only when a hit
  actually reaches the hull (not dodged/untargetable/absorbed — a layer that absorbs
  the hit absorbs the malfunction, GDD §5.2) is a module picked and marked:
  `'highest-value'` = most Mk I cards among operational modules, ties to the lowest
  index (deterministic, no RNG); `'random'` = combat-stream pick among operational
  modules. All modules already malfunctioning → plain hull damage, no new malfunction.
- Playing a flipped card costs `MALFUNCTION_REPAIR_AP` (1, new constant in
  `data/constants.ts`) regardless of the card's printed cost, applies *no* card
  effects, and clears the module. `effectiveCardCost(state, handIndex)` is exported so
  main.ts guards and combat-view agree on affordability.
- `repair-all-modules` (Repair Clone) stops throwing: clears the whole set.
- Malfunctions live and die with the CombatState — persistence across encounters in a
  multi-encounter lane is 2.4's lane work (single fights today are effectively
  one-encounter lanes, so auto-clear-on-arrival is vacuously right).

**Enemy intent union grows a second member** (`types.ts`):
`{ kind: 'attack-module'; name; amount; piercing?; targeting: 'highest-value' | 'random' }`.
Parasite (Hunter, GDD §5.7) cycles Burrow (3, targets highest-value) / Tail Whip (5,
plain) / Gnaw (4, targets highest-value). Lamprey's Rend becomes a *random* module hit
(piercing 9) — 2.1's enemies.ts explicitly parked "module shredding (its real
signature)" for this slice. Numbers tunable, in data.

**Hull innates become interpreted data** (the engine hook the handoff asked for).
`InnateAbility` gains `uses: 'per-turn' | 'per-combat' | 'passive'` and a small effect
union: `damage {apCost, amount}` (Gunship Point-Defense), `discard-to-draw` (Scout
Slipstream), `gain-ap {amount}` (Tactical Auxiliary Router), `scrap-on-victory
{amount}` (Freighter Salvage Rig). New sim API `useInnate(state, handIndex?)` (loud
failures; handIndex only for discard-to-draw) + `canUseInnate(state)`;
`CombatState.hullId` + `innateUsedThisTurn`/`innateUsedThisCombat` flags (per-turn flag
resets in endTurn). Innate damage deliberately does **not** consume next-attack
modifiers (Point-Defense eating your Lock-On would be a trap); vulnerable applies.
Salvage Rig is passive: `applyCombatResult` adds its scrap on victory.

**View/UI (presentation only — flip *animation* is 6.6):** `CardView.malfunction`
flag; flipped cards present as "Damaged {Module}" / "Field-repair the {Module}" at the
repair cost. `CombatView` gains `modules` (name + malfunctioning, for HUD warnings) and
`innate` (name, description, ap cost, usable, requiresCardTarget, passive).
`RevealedIntent.targetsModule` so Deep Scan telegraphs module hunts. HUD: innate button
next to End Turn, red MALFUNCTION warnings; CombatHand: amber malfunction styling +
discard-arming mode (tap Slipstream → tap a card to discard it). main.ts: `useInnate`
on the GameHandle, fights now cycle the enemy roster (Lamprey → Parasite → …) so the
Parasite is reachable, and a `?hull=` URL param (validated, falls back to Gunship) so
all four innates are manually testable pre-hull-select (Phase 5).

**Considered and rejected:** storing flipped CardIds in piles (breaks the
derived-state/JSON-shape simplicity, ambiguous for duplicate modules); picking the
module target at telegraph time (repairing mid-turn would invalidate it; resolution
time is simpler and still deterministic); a separate `?enemy=` param (roster cycling
covers manual testing without a second dev knob).

## Steps

- [ ] Branch `feature/malfunctions` from main
- [ ] `data/types.ts`: `attack-module` intent kind; `InnateAbility.uses` + effect union; `data/constants.ts`: `MALFUNCTION_REPAIR_AP`
- [ ] `data/hulls.ts`: structured innate effects for all four hulls; `data/enemies.ts`: Parasite + Lamprey Rend→random module hit
- [ ] `sim/deck.ts`: `CombatCard` + `generateCombatDeck`
- [ ] `sim/combat.ts`: instance piles, `malfunctioning`, hit→malfunction in `resolveIncomingHit`, flipped-card play-to-repair, `effectiveCardCost`, `repair-all-modules`, `useInnate`/`canUseInnate`, salvage rig in `applyCombatResult`
- [ ] Update `combat.test.ts`/`deck.test.ts` for instances; new tests: flip/repair, shield-absorbs-malfunction, piercing module hit, targeting (highest-value, random, operational-only, all-down fallback), repair-all, all four innates incl. once-per-turn/combat gating, determinism replay with Parasite
- [ ] `combat-view.ts` + tests: malfunction card views, `modules`, `innate`, `targetsModule`
- [ ] `main.ts`: `useInnate` command, enemy roster cycling, `?hull=` param
- [ ] `CombatHand.tsx`: malfunction styling, discard-arming mode; `HUD.tsx`: innate button, malfunction warnings, module-hunt intent text; `page.tsx`: wiring + arming state
- [ ] Browser verification (preview tooling), desktop + mobile width
- [ ] Post-session checklist: lint, type-check, test, doc updates, commit, push, PR, handoff for 2.4

## Manual test steps

- [ ] Gunship vs Lamprey: survive to turn 3 with shields down — Rend (piercing) hits hull AND a random module; its cards in hand/draw flip to "Damaged {Module}" (amber), HUD shows red MALFUNCTION line
- [ ] Play a Damaged card (1 AP) → module repaired, card lands in discard as its normal form, HUD warning clears, future draws of that module's cards are normal
- [ ] Win → Fight Again → enemy is the **Parasite**; let Burrow land on bare hull → the highest-value operational module (Flak Array for the Gunship) malfunctions
- [ ] Point-Defense button (Gunship): costs 1 AP, deals 2, disabled after one use per turn, re-enabled next turn, disabled at 0 AP
- [ ] `?hull=hull-scout`: Slipstream button arms discard mode → tapping any card discards it and draws one; once per turn
- [ ] `?hull=hull-tactical`: Auxiliary Router grants +1 AP (4 visible), button stays disabled for the rest of the fight
- [ ] `?hull=hull-freighter`: win a fight → Fight Again → HUD scrap counter shows +2 from Salvage Rig
- [ ] Edge: shields up when Burrow lands → layer absorbed, **no** malfunction
- [ ] Edge: malfunctioning-card play at 0 AP is disabled (repair costs 1); double-tap on innate button doesn't double-fire (quiet guard)
- [ ] Edge: invalid `?hull=hull-nope` falls back to Gunship without crashing
- [ ] Mobile width (390px): innate button reachable, malfunction warnings readable

## Out of scope for this session

- Malfunction persistence across encounters within a lane (needs lanes — 2.4)
- Card-flip animation/juice (6.6 — only the flipped *state* renders)
- Infestation cards / Sporecaster (2.5), Carapace + strip-armor (2.5), Anchormaw (2.4)
- Planetside item offline-when-malfunctioning (no surface mode until Phase 3)
- Hull select UI (Phase 5) — `?hull=` is a dev/test knob, not a feature
- Enemy encounter selection by map/lane (2.4) — roster cycling is a placeholder

---

<!-- Fill in below during/after the session -->

## What actually happened

Went to plan, with four browser-found corrections:

- **`useInnate` had to be renamed `activateInnate` in the sim** — `react-hooks/rules-of-hooks`
  flags any bare `useX()` call as a conditional hook call at the main.ts call sites. The
  GameHandle *method* keeps the `useInnate` name (member calls aren't flagged).
- **`seedToSearchParam` was wiping the `?hull=` param**: `resolveSeed` writes the seed back
  with `history.replaceState`, and the helper built a fresh query string with only `seed` in
  it. It now takes the current search string and preserves unrelated params (tested).
- **The innate button broke the 375px layout** — "Point-Defense (1 AP)" in the retro font is
  310px wide; End Turn was pushed off-screen entirely. The button group stacks vertically on
  mobile (`flex-col sm:flex-row`) and the innate label drops to 9px below `sm:`.
- **Malfunction card text shortened to "Field-repair"** — "Field-repair the Flak Array"
  wrapped flipped cards ~40px taller than the rest of the hand and overlapped the End Turn
  button on phones. The card name already says which module.
- HUD AP pips render `max(apPerTurn, ap)` so Auxiliary Router's 4th pip is visible.
- Verified end-to-end in the browser (desktop + 375px): Rend flipping the Flak Array with
  the HUD warning + amber flipped cards, play-to-repair (warning clears, twin card unflips),
  Parasite as fight 2 with shields absorbing Burrow ×2 then Gnaw flipping the Flak Array
  (highest-value), Point-Defense (damage, AP cost, per-turn gating), Slipstream arming mode
  (discard + draw, per-turn), Auxiliary Router (+1 AP, per-combat), Salvage Rig passive
  label, `?hull=` fallback on bogus values. Console clean.
- 142 tests green (31 new). No new dependencies; no ADR — the card-instance pile change is
  interior to the sim and documented here and in the combat.ts header.

## Files created / modified

- `src/game/data/types.ts` — `attack-module` intent kind (+`ModuleTargeting`), `InnateEffect` union + `InnateAbility.uses`
- `src/game/data/constants.ts` — `MALFUNCTION_REPAIR_AP`
- `src/game/data/hulls.ts` — structured innate effects for all four hulls
- `src/game/data/enemies.ts` — Parasite; Lamprey Rend → random module hit
- `src/game/sim/deck.ts` — `CombatCard` instances, `generateCombatDeck` (`generateDeck` is now its projection)
- `src/game/sim/combat.ts` — instance piles, `malfunctioning`, hit→malfunction funnel, play-to-repair, `cardPlayCost`/`isCardMalfunctioning`, `repair-all-modules`, `activateInnate`/`canUseInnate`, Salvage Rig in `applyCombatResult`
- `src/game/sim/seed-url.ts` — `seedToSearchParam` preserves unrelated params
- `src/game/combat-view.ts` — malfunction card views, `modules`, `innate`, `targetsModule`
- `src/game/main.ts` — `useInnate` command, enemy roster cycling, `?hull=` dev knob
- `src/components/CombatHand.tsx` — malfunction styling, discard-arming mode
- `src/components/HUD.tsx` — innate button, OFFLINE warnings, module-hunt intent text, mobile stacking
- `src/app/page.tsx` — innate wiring + arming state
- Tests: `combat.test.ts` (instance rewrite + 21 new), `combat-view.test.ts` (+5), `deck.test.ts` (+2), `catalog.test.ts` (+2), `seed-url.test.ts` (+1)

## Deferred to next session

- **Malfunction persistence across encounters within a lane** (2.4): `CombatState.malfunctioning` dies with the fight today. When lanes land, `applyCombatResult` (or a lane-scoped wrapper) must carry it between encounters and clear it on arrival.
- **Enemy encounter selection** — `main.ts` cycles `ENEMY_DEFS` so the Parasite is reachable; replaced by lane/map-gen encounter picks (2.4).
- `?hull=` is a dev knob, not hull select (Phase 5).
- Card-flip animation (6.6) — only the flipped state renders.
- `strip-armor` still throws (Carapace, 2.5); planetside item offline-when-malfunctioning (Phase 3).
- Innate damage deliberately skips next-attack modifiers — revisit if a future hull innate should scale.
- Carried: physical-phone check of production URL; Mk II tier tracking (4.2); retain-with-choice API; `SaveStore` page wiring (2.4/4.5).

## Status

- [ ] In progress
- [x] Complete
- [ ] Partial — see deferred
