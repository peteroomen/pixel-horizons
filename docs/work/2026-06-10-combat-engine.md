# Combat Engine (sim only)

**Date:** 2026-06-10
**Branch:** feature/combat-engine
**Roadmap item:** Phase 2 — Slice 2.1 Combat engine (sim only)

## Goal

A deterministic, fully serializable turn-based combat engine in `src/game/sim/combat.ts` — draw 5, AP spend, data-interpreted card effects, hit-based shield layers with recharge, piercing, enemy intents, hull HP, win/lose — proven by Vitest scripted fights vs a Lamprey defined in `src/game/data/enemies.ts`. No rendering, no React, no `main.ts` wiring.

## Approach

**Combat state is a plain serializable object (`CombatState`), same philosophy as `RunState`.** It carries everything a fight needs: enemy id/HP/intent cursor, hull HP, shield layers, AP, turn number, the four card zones (draw/hand/discard/exhaust), travel progress, active combat modifiers, scrap gained, outcome, and an `RngState` snapshot of the combat stream. API functions restore the `Rng` from the snapshot, mutate the state in place, and write the snapshot back — so a `CombatState` round-trips through JSON mid-fight and continues identically (ADR 003 by-value RNG discipline).

**API surface (`combat.ts`):**

- `createCombat(runState, enemyId): CombatState` — builds the deck via `generateDeck(runState.modules)`, shuffles it with the combat stream restored from `runState.rng.combat`, collects shield layers from module passives (`shield-layers`), draws the opening hand of 5, rolls the first enemy intent.
- `playCard(state, handIndex): void` — validates (combat ongoing, index in hand, AP affordable — violations throw, loud-failure policy; the UI's job in 2.2 is to never offer an illegal play), pays AP, interprets each `CardEffect` in order, moves the card to discard (or exhaust), checks win.
- `endTurn(state): void` — discards the hand (honoring retain), enemy acts on its telegraphed intent, shield recharge ticks, turn increments, modifiers expire, new intent is rolled, draws up to 5.

All randomness (shuffle, dodge rolls, enemy intent selection) consumes only the combat stream. Combat never touches the other RunState streams.

**Effect interpreter — explicit scope decision (handoff requirement):**

- *Implemented:* `damage` (with `piercing`, consuming `buff-next-attack` → `amplify-next-attack` ordering: (base + flat bonus) × multiplier, plus target `vulnerable`), `travel` (accumulates a progress counter; lanes consume it in 2.4), `restore-shield-layer`, `temp-shield-layer`, `dodge-chance` (vs enemy attacks until your next turn starts), `untargetable` (enemy attacks auto-miss N turns), `buff-next-attack`, `amplify-next-attack`, `debuff-target-vulnerable` (+N damage taken, rest of fight), `reveal-intent` (sets a flag — already-rolled intent becomes visible data for the UI), `draw`, `gain-scrap` (accumulates in `CombatState.scrapGained`; applying it to RunState is the caller's job when fights get wired in), `retain-cards`.
- *Loud stubs (throw with the target slice in the message):* `strip-armor` (armor is Carapace, 2.5), `repair-all-modules` (malfunctions, 2.3). No Mk I starting deck contains either except Repair Matrix's Repair Clone, which no hull starts with — safe.

**Shield model (GDD §5.2):** hit-based layers, not HP. Each layer is `{ rechargeTurns, turnsUntilUp }` (0 = up); a layer absorbing a hit starts its individual recharge countdown, ticked during the enemy-phase end. Temp layers (Emergency Barrier, Cargo Thrust) are one-shot — absorbed first, never recharge. Multi-hit cards/attacks interact per hit (Cannon Burst's two `damage` effects eat two layers). Piercing skips all layers. The resolution path takes a generic "incoming hit" so module-hit absorption (2.3) extends it without reshaping.

**Enemy data (`src/game/data/enemies.ts`):** `EnemyDef = { id, name, maxHp, intents: EnemyIntentDef[], pattern: 'cycle' | 'random' }` with `EnemyIntentDef = { kind: 'attack', amount, piercing? }` as a union open for later kinds (module-target 2.3, infest 2.5, anchor 2.4). Lamprey (low HP, high damage): ~22 HP, cycle of attacks averaging ~7 — all numbers tunable in the data file, none in combat logic. `getEnemy` joins the existing loud-failure lookups in `data/index.ts`.

**Wiring starting modules into `createRunState` (deferred from 1.3, decided here):** `run-state.ts` imports `getHull` from `data/` (sim→data is already sanctioned — `deck.ts` does it) and seeds `modules: [...hull.startingModules]`. The `RunState` *shape* is unchanged (`modules` was already `string[]`), so no `RUN_STATE_VERSION` bump — old saves still validate.

**Out-of-scope mechanics that shaped the design anyway:** malfunctions (2.3) — the hit-resolution path stays module-extensible; hull innate abilities (2.3 per roadmap) — not implemented, no API hole; infestations (2.5); lane/encounter structure (2.4) — travel is just a counter here.

## Steps

- [ ] Branch `feature/combat-engine` from `main`
- [ ] `src/game/data/enemies.ts` — `EnemyDef`/`EnemyIntentDef` types + Lamprey; `getEnemy` + re-exports in `data/index.ts`; extend `catalog.test.ts` (unique `enemy-*` ids, intents non-empty, positive numbers)
- [ ] `run-state.ts` — `createRunState` seeds `modules` from the hull's `startingModules`; update run-state tests (modules no longer `[]`, round-trip still green)
- [ ] `src/game/sim/combat.ts` — `CombatState`, `createCombat`, `playCard`, `endTurn`, effect interpreter, shield/hit resolution, enemy phase
- [ ] `src/game/sim/combat.test.ts` — see test list below
- [ ] Post-session: fill outcome sections, update CLAUDE.md Current State, lint + type-check + test, conventional commit, push, PR, handoff doc for 2.2

## Manual test steps

No UI this slice by design — verification is suite-driven plus spot checks:

- [ ] `pnpm test` green (existing 61 + new combat/enemy tests), `pnpm type-check` + `pnpm lint` clean
- [ ] Determinism: same seed + same scripted play sequence run twice ⇒ deep-equal final `CombatState` (and a third run after a mid-fight serialize/deserialize round-trip matches too)
- [ ] Happy path scripted fight: Gunship vs Lamprey, scripted plays reach `outcome: 'victory'` with exact expected enemy HP trail
- [ ] Defeat path: Scout playing no cards vs Lamprey eventually hits `outcome: 'defeat'` at hull 0
- [ ] Edge: playing a card with insufficient AP throws; playing after combat ended throws
- [ ] Edge: draw with empty draw pile reshuffles discard (exhausted cards stay out); tiny-deck case where draw+discard < 5 yields a short hand without error
- [ ] Spot-check: Cannon Burst vs 2 shield layers consumes both layers and deals 0 hull damage; Flak Volley (piercing) vs full shields hits hull directly
- [ ] Grep: no balance numbers in `combat.ts` (all in `data/`), no `Math.random`

## Out of scope for this session

- Rendering, React, `main.ts` wiring (2.2)
- Malfunctions, module targeting, play-to-repair, hull innate abilities (2.3)
- Lane structure, encounter triggers, escape-by-arrival (2.4) — travel is a bare counter
- Infestation cards, remaining enemy roster, armor/`strip-armor` (2.5)
- Applying combat results (scrap, hull HP) back into `RunState` — caller's job when 2.2/2.4 wire fights into the run
- Combat event log for animation (2.2 decides what it needs)

---

<!-- Fill in below during/after the session -->

## What actually happened

Went to plan; 101 tests green (35 new combat, 2 new enemy-catalog, 3 new run-state), type-check and lint clean on first full run. Decisions made during implementation worth recording:

- **Next-attack modifiers are per-hit, not per-card:** `buff-next-attack`/`amplify-next-attack` are consumed by the next single `damage` *effect*, so only the first hit of Cannon Burst benefits. Vulnerable applies to every hit. Tested explicitly so the semantics are pinned.
- **Damage formula:** `(base + flat bonus) × multiplier + vulnerable`, per hit. Lock-On + Overcharge + Missile Salvo = (8+3)×2 = 22 = exactly one dead Lamprey (used as the victory-check test).
- **Dodge stacking is `max`, not sum** — stacked dodge sources can't reach certainty.
- **Shield recharge semantics pinned:** `rechargeTurns` = full enemy phases a spent layer stays down. Implemented by snapshotting which layers were already recharging *before* the enemy attack and ticking only those — a layer spent this phase doesn't tick the same phase. (2-recharge layer spent T1 is back for T4's attack.)
- **Retain keeps the leftmost N cards** — no player choice without a UI; if 2.2 wants chosen retention it needs a small API addition.
- **`BASELINE_AP` (3) and `HAND_SIZE` (5) live in `data/constants.ts`**, not in combat logic, per the no-balance-numbers-in-logic rule.
- **Lamprey concretized** (GDD §5.7 is qualitative — numbers are data-only, no GDD edit needed): 22 HP, cycle of Feeding Frenzy (4 dmg × 2 hits), Lash (7), Rend (9, piercing). `EnemyIntentDef` gained `name` (for UI telegraphs) and `hits` (per-hit shield interaction).
- **RNG commit-back contract documented in `combat.ts` header:** `createCombat` reads but never mutates RunState; the caller (2.2/2.4) commits `CombatState.rng` → `runState.rng.combat` (and hull HP / scrap) when the fight ends, so consecutive fights continue the stream.
- **Player-side `piercing` is currently a no-op** (no enemy has layers/armor until 2.5) — flagged in a comment.
- **`pattern: 'random'` is implemented but unexercised** — no enemy uses it yet; first random-pattern enemy should add a test.
- Determinism proven three ways: replayed action log ⇒ deep-equal state; JSON round-trip between *every* action ⇒ identical; different seeds ⇒ different shuffles.

## Files created / modified

- `src/game/sim/combat.ts` — the engine: `CombatState`, `createCombat`, `playCard`, `endTurn`, `currentIntent`, effect interpreter, single-funnel hit resolution
- `src/game/sim/combat.test.ts` — 35 tests
- `src/game/data/enemies.ts` — `ENEMY_DEFS` (Lamprey)
- `src/game/data/constants.ts` — `BASELINE_AP`, `HAND_SIZE`
- `src/game/data/types.ts` — `EnemyDef` / `EnemyIntentDef` / `EnemyId`
- `src/game/data/index.ts` — `getEnemy`, enemy/constants re-exports
- `src/game/sim/run-state.ts` — `createRunState` now seeds `modules` from the hull's `startingModules` (no shape change, no version bump)
- `src/game/sim/run-state.test.ts`, `src/game/data/catalog.test.ts` — updated/extended
- `CLAUDE.md` — Current State updated
- `docs/work/2026-06-11-handoff-slice-2.2.md` — handoff for next session

## Deferred to next session

- Applying combat results back to `RunState` (`rng.combat`, hull HP, `scrapGained`) — lands with the first wiring consumer (2.2 for a single fight, 2.4 for lanes)
- Hull innate abilities (roadmap puts them in 2.3); Slipstream/Point-Defense have no engine hook yet
- Retain-with-choice API if 2.2's UI wants the player to pick the retained card (engine currently keeps leftmost)
- `strip-armor` (2.5), `repair-all-modules` (2.3) — loud throw-stubs
- Enemy `pattern: 'random'` test coverage when the first random enemy lands
- Carried from earlier slices: seed-url/`SaveStore` page wiring (2.2 is the natural consumer); physical-phone check of production URL; Mk II tier tracking (4.2)

## Status

- [ ] In progress
- [x] Complete
- [ ] Partial — see deferred
