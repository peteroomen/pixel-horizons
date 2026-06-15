# ADR 008: Powers & status effects (the visible status model)

Date: 2026-06-15
Status: Accepted

## Context

Combat cards applied only here-and-now effects. Buffs/debuffs lived as ad-hoc, **invisible** fields on `CombatModifiers` (`nextAttackBonus`, `nextAttackMultiplier`, `enemyVulnerable`, `dodgeChance`, `untargetableTurns`, `intentRevealed`). The PR #13 playtest (feedback #2) flagged two problems:

1. The flat next-attack-+damage cards (Lock-On, Combat Sim, Charge Capacitor) were **overpowered** — cheap, stacked without limit, and nothing in the UI explained any of it.
2. The game lacks a Slay-the-Spire-style **Power/status layer** — persistent, stacking, *visible* buffs/debuffs that make focus-fire and setup real decisions.

GDD §5.10 set the direction. Slice 4.7 implements it. The question was how to model statuses without churning the entire tuned combat sim.

## Decision

**One data-driven status concept**, deliberately scoped to the buff/debuff *economy*.

- **Catalog** (`src/game/data/statuses.ts`): `StatusDef { id, name, description, side, decay, stack, display, cardText }`. Statuses are data; the sim interprets them (same rule as cards/enemies). `decay` ∈ `consume-on-attack | persist | tick-enemy-phase`; `stack` ∈ `add | multiply`.
- **Instances are plain JSON**: `Status { id, magnitude }` (ADR 003 — combat serializes mid-turn, so no functions/closures). `magnitude` is a bonus, a multiplier, stacks, or turns depending on the def.
- **Placement on `CombatState`**: `shipStatuses: Status[]` (player) and, parallel to the organ system (ADR 007), `coreStatuses: Status[]` + `partStatuses: Status[][]` (one list per organ, parallel to `partHp`). A debuff lands on the *focused* target via the existing `targetPart` seam.
- **Sim helpers** live in `src/game/sim/status.ts` (pure, unit-tested): `applyStatus`, `consumeAttackBuffs`, `sumMagnitude`, `tickStatuses`.
- **Scope the migration to the 3 economy modifiers** (`nextAttackBonus`, `nextAttackMultiplier`, `enemyVulnerable`). `dodgeChance`/`untargetableTurns`/`intentRevealed` keep their existing mechanics in `CombatModifiers` but are **surfaced as read-only status chips** derived in the view — full UI visibility, bounded sim churn.
- **Vulnerable is per-target.** It moved out of the global damage formula into the per-target funnels (`damageCore`/`damagePart`), so a mark only helps hits against the marked organ/core.
- **Generic `apply-status` card effect** replaces `buff-next-attack`/`amplify-next-attack`/`debuff-target-vulnerable` (now removed). `{ kind: 'apply-status'; status; magnitude; to: 'self' | 'target' }`.
- **Card rebalance:** the next-attack buff cards Exhaust (one-shot spikes, not free stacks); Tracer Lock applies `Marked` to the *selected* target and Exhausts.
- **Tooltips:** a shared tap-to-reveal primitive (mobile-first — no hover) renders status descriptions on the ship/enemy/organ plates *and* the keyword chips in the hand.

## Consequences

- **Easier:** statuses are now visible, explained, and serializable; adding a new status is a catalog entry + (if novel) a decay rule. Per-organ debuffs make focus-fire meaningful. The buff economy is tunable from data.
- **Harder / costs:** migrating the 3 modifiers churned tuned combat tests (many asserted exact damage and the old global-vulnerable behavior). Two status math modes (`add` vs `multiply`) exist because additive Charged and multiplicative Overcharged coexist. `dodge`/`cloak`/`scan` are display-derived, not real instances — a mild inconsistency accepted to bound scope; a later slice can fully migrate them if needed.
