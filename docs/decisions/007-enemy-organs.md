# ADR 007: Boss-only targetable organs and the Cleave axis

Date: 2026-06-15
Status: Accepted

## Context

Single-target focus-fire is hollow in an 8–12-minute boss fight — a damage race with no
decisions in it. The question (GDD §5.4): should enemies have targetable sub-parts like
the player's ship has modules, or stay single-target?

## Decision

**Targetable "organs" on bosses/elites only; trash enemies keep a single HP bar.** The
Gatemaw grows two organs: a Spore-Sac (injects a spore each turn; `stagger` on destroy)
and an Armor-Node (gates the armor regrow; `break-armor` on destroy). `EnemyDef.parts?`
is optional and absent on every other enemy, so their behaviour is unchanged.

- `CombatState.partHp` tracks organ HP; `targetPart` is the single-target focus (null =
  core). The player picks core (default) or a living organ before a single-target attack.
- **Cleave** (`damage.target: 'all'`) hits the core and every living organ at once,
  creating the AoE-vs-single-target axis that makes weapon keyword variety matter.
- **The core is killable any time** — organs are pressure, not a gate. Ignoring them makes
  the fight harder (spores pile up, armor never breaks); clearing them is the skill path.
  This keeps the boss from becoming an HP sponge.
- Organs have no armor; the core keeps its armor pool. The armor regrow is gated on a
  living Armor-Node, so enemies *without* an armor organ (Carapace) regrow as before.

## Consequences

- Full sub-targeting on every enemy was rejected as a complexity tax with no payoff on
  trash; the per-enemy quirk model already gives trash its identity.
- This deliberately **seeds the multi-target combat UI** (target selection, multiple HP
  bars, Cleave) that future multi-enemy lane encounters will reuse — added to the roadmap
  as a Phase 5+ item, with the GDD §5.7 "single-enemy fights only" tension to resolve
  first.
- The Pixi-side targeting indicator is deferred; the DOM organ bars in `EnemyPlate` carry
  the selection function. `amplify-attacks` from the GDD organ menu is unimplemented (no
  enemy uses it yet).
