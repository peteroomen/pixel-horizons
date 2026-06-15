# ADR 006: Card keyword vocabulary, per-card malfunction state, and module modifiers

Date: 2026-06-15
Status: Accepted

## Context

THE FORGE made the economy real, but a playtest found the deckbuilder had no
deckbuilding identity (GDD Open Questions #14, #15): every weapon played the same,
travel cards were dead at the boss, and the malfunction repair was a one-tap-fixes-all
bug rather than the intended multi-turn AP tax. The mega-slice 4 plan (THE ARSENAL)
calls for a keyword vocabulary, a catalog identity pass, and attach-to-module modifiers.

Three sub-decisions needed recording.

## Decision

**1. Keywords are data on `CardDef`, interpreted by combat — never hardcoded.**
Added `retain?`, `jettison?: { benefit: 'draw' | 'ap'; amount }`, `discardCost?` to
`CardDef`, plus `damage.target?: 'core' | 'all'` (Cleave) and a player-positive
`gain-temp-shield` on-draw effect. The card UI renders them as chips; combat interprets
them. Each module slot has a signature keyword (Engine → Draw + Jettison; Utility/Shield
→ Retain; Weapon → Exhaust/Discard/Cleave) so a build's *feel* follows from its modules.

**2. Malfunction state moved from module-indexed to per-card-instance.**
`CombatState.malfunctioning: number[]` is gone; each `CombatCard` carries a
`malfunctioning: boolean`. A hit flags every instance of the targeted module across all
piles; playing one card clears only that instance. A module is "operational" (a valid
re-target, and its planet item online) only when none of its instances are flagged. The
lane still carries the cross-fight set as module indices (per-card flags can't survive
deck regeneration) via `malfunctioningModules` / re-flagging in `createCombat`.

**3. The travel-card-at-boss problem (GDD §5.4) is resolved with dual-mode + Jettison.**
Every Engine card gains an on-play `Draw 1` *and* the Jettison keyword, so engine cards
are a net positive in any fight and never fully dead at the gate.

**4. Module modifiers are per-instance overrides applied at deck generation.**
`ModuleInstance.modifiers?: ModifierId[]` (RunState v3). `deck.ts` aggregates a module's
modifiers into `CombatCard.apCostDelta` / `bonusEffects`; `cardPlayCost` floors the
reduced cost at 0 and `playCard` fires bonus effects after the card resolves.

## Consequences

- Keyword behaviour is testable in the sim with no rendering, and new keywords are a data
  + small-engine-delta change. The card UI is a pure projection of `CardView.keywords`.
- Per-card malfunction is the single most important combat.ts change; it landed first and
  alone behind the 900-line `combat.test.ts` regression net.
- RunState v3 resets testers' saves (no migration — same policy as FORGE's v2).
- Deferred: the `starts-in-hand` modifier (needs opening-hand seeding in `createCombat`)
  and the starting-loadout audit (A5 — pure data, shifts module indices and churns tuned
  combat tests; left for the 5.5 balance pass).
