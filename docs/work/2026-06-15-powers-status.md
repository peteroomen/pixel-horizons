# Powers & status effects (Slice 4.7)

**Date:** 2026-06-15
**Branch:** feature/powers-status (off `main` — PR #13 arsenal + PR #14 world-art both merged)
**Roadmap item:** Phase 4 — 4.7 Powers & status effects
**Design:** GDD §5.10 (written in the arsenal session); handoff `docs/work/2026-06-15-handoff-slice-4.7.md`

## Goal

Combat gains a **visible, tooltipped, persistent status (Power) system** in the spirit of Slay the Spire — buffs on the ship and debuffs on the enemy core / specific organs, each rendered as a chip with a stack/duration count and a tap-to-reveal explanation. The flat buff cards that playtested as overpowered are rebalanced around it: the next-attack-+damage cards **Exhaust**, and **Tracer Lock** becomes a **targeted, Exhausting skill** that marks the selected organ/core instead of a free global modifier.

## Approach

**One status concept, data-driven (statuses are data, not code — ADR convention).**

- New catalog `src/game/data/statuses.ts`: `StatusDef { id, name, description, decay }` where `decay` is one of:
  - `'consume-on-attack'` — magnitude is a bonus spent by the next damage effect (Lock-On bonus, Overcharge multiplier).
  - `'persist'` — lasts the whole fight, magnitude = stacks (Vulnerable / Marked).
  - `'tick-enemy-phase'` — magnitude = turns, counts down once per enemy phase (Dodge, Cloak).
- A status instance is plain JSON: `{ id: StatusId; magnitude: number }` (ADR 003 — combat serializes mid-turn, no functions/closures).
- Placement on `CombatState`:
  - `shipStatuses: Status[]` — player buffs.
  - `coreStatuses: Status[]` + `partStatuses: Status[][]` (parallel to `partHp`) — enemy debuffs, per organ.
- **Migrate exactly the 3 economy modifiers** the handoff calls out (`nextAttackBonus`, `nextAttackMultiplier`, `enemyVulnerable`) into this system. **Leave** `dodgeChance`, `untargetableTurns`, `intentRevealed` as `CombatModifiers` fields (not part of the buff/debuff economy — migrating them is churn for no player-facing gain), but **surface dodge + cloak + scan as read-only status chips** derived in the view so the UI is complete.
- **Damage path:** Lock-On/Overcharge read+consume from `shipStatuses` (replacing modifiers.nextAttack*). Vulnerable moves out of the global `applyEffect` add and into the per-target funnels (`damageCore`/`damagePart`) so it lands only on the focused target.
- **Decay ticking:** `'tick-enemy-phase'` statuses tick where `untargetableTurns`/`dodgeChance` reset today (end of enemy phase). `'consume-on-attack'` consumed in the damage effect. `'persist'` never decays. Dead organs drop their `partStatuses` entry (already gated by `isPartAlive`).

**Rebalance (data + sim):**
- Lock-On (`card-lock-on`), Charge Capacitor (`card-charge-capacitor`), Combat Sim (`card-combat-sim`) → `exhaust: true`. (Overcharge already exhausts.) These now apply a `Charged`/`Overcharged` **ship status** instead of writing a hidden modifier.
- Tracer Lock (`card-tracer-lock`) → `exhaust: true`, and its effect becomes **apply `Marked` (Vulnerable) to the selected target** (reuse `targetPart`/`selectTarget`) instead of `debuff-target-vulnerable` global. New effect kind `apply-status` (`{ kind: 'apply-status'; status: StatusId; magnitude: number; to: 'self' | 'target' }`).

**View + UI:**
- `CombatView` gains `shipStatuses: StatusView[]` and per-target statuses: `enemyStatuses: StatusView[]` (core) + `statuses` on each `EnemyPartView`. `StatusView { id, name, description, label }` where `label` is the count/turns shown on the chip.
- `PlayerPlate.tsx`: a status strip of ship chips. `EnemyPlate.tsx`: a status strip on the core row and on each organ row.
- **Tooltips (mobile-first):** a small tap-to-toggle detail component (no hover on touch). 375px is tight — chips wrap, detail shows inline below the strip. **Both status chips AND the existing keyword chips** (Exhaust/Retain/Jettison/Cleave/Discard in `CombatHand`) get tap-to-explain this slice (Peter's call) — share one tooltip primitive across both.

**ADR 008** records the status model (unify-the-3 decision, decay enum, JSON shape, per-organ placement).

## Steps

- [ ] ADR 008 — status model decision.
- [ ] `data/statuses.ts` catalog + `StatusId` type; `apply-status` added to `CardEffect`.
- [ ] `CombatState`: add `shipStatuses` / `coreStatuses` / `partStatuses`; init in `createCombat`; remove the 3 migrated modifier fields.
- [ ] Sim: `applyEffect` handles `apply-status` (self → ship, target → core/organ via `targetPart`); damage path reads `consume-on-attack` ship statuses + per-target `persist` Vulnerable; enemy-phase tick for `tick-enemy-phase`. Update `combat.test.ts`.
- [ ] Data: Lock-On / Charge Capacitor / Combat Sim → `exhaust`; convert their effects + Overcharge to `apply-status`; Tracer Lock → targeted + exhaust.
- [ ] View: `StatusView` + ship/core/organ statuses in `buildCombatView`; update `combat-view.test.ts`.
- [ ] UI: tap-to-reveal tooltip primitive; status strips in `PlayerPlate` + `EnemyPlate`; wire keyword chips in `CombatHand` to the same tooltip.
- [ ] lint + type-check + test green; browser-verify desktop + 375px.

## Manual test steps

- [ ] Play Lock-On: a `Charged +3` chip appears on the ship plate (tap → tooltip). Next attack consumes it (chip gone, damage +3). Card is **Exhausted** — gone for the fight, can't re-stack.
- [ ] Play Overcharge then a hit: `Overcharged ×2` chip, next hit doubles, chip clears, card exhausts.
- [ ] `?enemy=enemy-gatemaw`: focus an organ, play Tracer Lock → `Marked` chip lands **on that organ's row** (not the core, not globally). Hits to that organ get the bonus; hits to the core do not. Card exhausts.
- [ ] Dodge/Cloak (read-only) chips show on the ship and tick down across enemy phases, disappearing at 0.
- [ ] Edge: scripted serialize→resume mid-fight — statuses survive the JSON round-trip (ADR 003).
- [ ] Edge: 375px, Gatemaw with organs + ship buff + organ debuff all active — no overflow, no console errors; tooltips readable.

## Out of scope for this session

- Migrating `dodgeChance`/`untargetableTurns`/`intentRevealed` mechanics into the status system (display-only this slice).
- (Keyword tooltips are now IN scope — Peter's call.)
- New status-bearing enemies beyond Gatemaw (already has organs to test on).
- Combat/boss difficulty tuning (5.5 / 5.2) — tune numbers *after* the buff/debuff economy change lands.
- Module-management UX / workbench-at-stations (4.8).

---

<!-- Filled in during/after the session -->

## What actually happened

Built the slice in green layers as planned; no major surprises. The status model unified exactly the 3 economy modifiers (Charged/Overcharged/Marked); `dodge`/`untargetable`/`intentRevealed` stayed as `CombatModifiers` but are surfaced read-only as derived chips (Evasion/Cloak/Deep Scan). Vulnerable became per-target inside `damageCore`/`damagePart`, preserving the old "added before armor" order. The generic `apply-status` effect replaced `buff-next-attack`/`amplify-next-attack`/`debuff-target-vulnerable` (removed). Keyword tooltips (Peter's call) landed as contextual `InfoChip`s in the MetaStrip showing only the keywords present in the current hand.

**Pre-work housekeeping (Peter's request):** PR #13 (arsenal) was already merged; PR #14 (World Art) was conflicting purely from the squash-merge duplication (world-art was branched off the arsenal branch, so main's squashed arsenal collided with world-art's individual arsenal commits). Resolved by cherry-picking world-art's two genuinely-new commits (pixel-art renderer + docs) onto main, retargeting the PR base main→main, and squash-merging. The roadmap had a numbering clash (world-art redefined 4.7 as a deckbuilding slice); preserved that as a new **4.9** so Peter's chosen 4.7 = Powers stayed intact.

435 tests (was 421: +7 status unit, +2 organ-marking combat, +5 status view, −0). Browser-verified desktop + 375px vs Gatemaw: Charged on the ship, Marked on the focused Spore-Sac organ (not the core/Armor-Node), status + keyword tooltips toggle on tap, no console errors.

## Files created / modified

- **Created:** `src/game/data/statuses.ts`, `src/game/sim/status.ts` (+`.test.ts`), `src/components/foundry/InfoChip.tsx`, `src/components/combat-keywords.ts`, `docs/decisions/008-powers-and-status-effects.md`.
- **Sim:** `src/game/sim/combat.ts` (status fields, `apply-status`, per-target Marked, consume/tick), `src/game/data/types.ts` (StatusId, `apply-status`, removed 3 kinds), `src/game/data/index.ts` (`getStatus`), `src/game/data/cards.ts` (5 cards rebalanced).
- **View:** `src/game/combat-view.ts` (StatusView + ship/core/organ statuses + apply-status text).
- **UI:** `PlayerPlate.tsx`, `EnemyPlate.tsx`, `MetaStrip.tsx`.
- **Tests:** `combat.test.ts`, `combat-view.test.ts`, `status.test.ts`.

## Tooltip-fix follow-up (same PR, commit `fbd721a`)

Two `InfoChip` bugs surfaced on a 375px playtest and were fixed in this PR: (1) the bubble was
absolutely positioned inside the plates, whose chamfer `clip-path` clipped it off-screen at the top
— now it renders in a **portal to `document.body`** with fixed positioning that flips below and
clamps to the viewport; (2) each chip held its own open state (multiple tooltips at once) — now a
single open chip is coordinated through an **`InfoChipProvider`** context wrapping the combat HUD.
Browser-verified at 375px; 435 tests still green.

## Deferred to next session

- Migrating `dodge`/`untargetable`/`intentRevealed` mechanics fully into the status system (display-only today).
- Tap-outside-to-close on tooltips — intentionally skipped (races with the single-open coordinator; the "one at a time, new tap dismisses previous" requirement is met without it). Easy follow-up if wanted.
- Numbers tuning for the now-Exhaust buff economy → 5.5 balance pass.
- New status-bearing enemies / more status kinds when an encounter needs them.

## Status

- [ ] In progress
- [x] Complete
- [ ] Partial — see deferred
