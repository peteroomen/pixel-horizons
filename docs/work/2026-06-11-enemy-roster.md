# Enemy Roster — Carapace, Sporecaster, telegraphed intents (+ fun checkpoint)

**Date:** 2026-06-11
**Branch:** feature/enemy-roster
**Roadmap item:** Phase 2 — Slice 2.5 Enemy roster

## Goal

All five GDD §5.7 archetypes exist and demand different responses — Carapace
(regenerating armor, `strip-armor` works), Sporecaster (Infestation cards injected
mid-fight) — intent *kinds* are always telegraphed in the HUD, and a fun-checkpoint
tuning pass has been played and applied before Phase 3.

## Approach

**Infestation cards: `CombatCard.moduleIndex` becomes `number | null`.** Null = injected
from no module. A sentinel like `-1` was rejected (handoff warning): malfunction flipping
derives from `moduleIndex` membership in `malfunctioning`, and `null` makes "has no
module" type-checked instead of conventional — `isCardMalfunctioning` guards null
explicitly, `generateCombatDeck` keeps emitting numbers. The ripple is small (deck.ts,
combat.ts, combat-view.ts).

**Unplayable is a first-class card property.** `CardDef.unplayable?: true`; `playCard`
throws on it (same loud-failure policy as unaffordable), new `isCardPlayable` mirrors the
guard for the UI, `CardView` gains `unplayable` so the hand renders the clog distinctly
(and `affordable: false` keeps existing tap-guards working). `cardPlayCost` is unchanged —
malfunction flipping can't apply to a null-module card, so the question never overlaps.

**On-draw effects: `CardDef.onDraw?` with its own tiny effect union** (starting member:
`{ kind: 'lose-shield-layer'; count }`, the GDD §5.6 example). Applied inside `drawCards`
as each card enters the hand. `drawCards` runs inside `endTurn` *and* mid-card (`draw`
effects), so the union deliberately excludes anything that draws (no recursion) and the
starting member consumes no RNG (deterministic, re-entrant). The played/unplayed piles
die with CombatState, so "Infestations vanish when the encounter ends" is free.

**Injection is a third intent kind:** `{ kind: 'inject'; name; cardId; count }`.
Resolution inserts `count` instances (`moduleIndex: null`) at uniformly random positions
in the draw pile (combat RNG stream) — "into your deck", not onto your hand. Injection
is not a hit: dodge, untargetable, and shields don't block it (it's a Scrambler's quirk;
blocking it with defenses would erase the archetype).

**Carapace armor is a regenerating pool on the enemy:** `EnemyDef.armor?: { amount;
regen }`, `CombatState.enemyArmor`. All player damage funnels through one
`dealDamageToEnemy(state, total, piercing)` helper (cards *and* damage innates):
non-piercing damage depletes armor before HP; piercing bypasses armor entirely — this
finally makes `effect.piercing` real. Armor regenerates `+regen` (capped at `amount`) at
the end of each enemy phase, so chip damage spread across turns is eaten while sustained
damage within one turn breaks through — exactly the GDD's "needs sustained damage or
piercing". `strip-armor` (Kinetic Shred) sets `enemyArmor = 0` for the rest of the turn.
Vulnerable/buffs compute the printed total first; armor absorbs from the total.

**Intent telegraphs: kind + name always visible, numbers behind Deep Scan** (the
handoff's standing recommendation, StS-style). `CombatView.intent` becomes always
non-null: `{ kind; name; detail }` where `detail` (amount/hits/piercing/module
targeting/card count) is non-null only while `modifiers.intentRevealed`. Deep Scan stays
alive — it buys the *numbers*, the archetype's shape is free. HUD renders e.g.
`INTENT: ATTACK` bare vs `INTENT: Lash — 7` revealed.

**New enemies (all numbers tunable in data/):**
- **Carapace** — Bulwark, ~30 HP, armor `{ amount: 5, regen: 5 }` (full regrowth each
  enemy phase), straightforward chunky attack cycle.
- **Sporecaster** — Scrambler, ~20 HP, cycle alternating inject (Spore Cluster ×1–2)
  and light attacks.
- **Spore Cluster** — Unplayable. When drawn: lose 1 shield layer (GDD §5.6 verbatim).

`DEFAULT_ENEMY_POOL` in travel.ts is all of `ENEMY_DEFS`, so both join lane rotation
automatically and `?enemy=` reaches them on demand.

**Fun checkpoint is in-scope:** play several full lanes (varied hulls via `?hull=`),
judge the loop, and tune in `data/` only. Standing candidates from 2.4: Anchormaw toll 5
vs thin scrap economy, lane band 7–10, wasted-engine-cards-vs-anchor escape valve
(build it only if play proves the pain).

**Considered and rejected:** `moduleIndex: -1` sentinel (collides conceptually with the
malfunction derivation, nothing type-checks it) · injecting into the discard pile
(too gentle — the threat should surface this fight, not after a full cycle) · injecting
directly into the hand (too swingy with a 5-card hand; also breaks "into your deck")
· armor as per-hit flat reduction (punishes multi-hit cards instead of rewarding
sustained damage — wrong counterplay) · always-on full intent numbers (dead-cards Deep
Scan, the Cargo Scanner's only Mk I card) · a generic `CardEffect` list for `onDraw`
(invites recursive draws and RNG re-entrancy bugs for power we don't need yet).

## Steps

- [ ] `data/types.ts`: `CardDef.unplayable?` + `onDraw?` (new `OnDrawEffect` union), `EnemyDef.armor?`, `EnemyIntentDef` third member `inject`
- [ ] `data/cards.ts`: Spore Cluster; `data/enemies.ts`: Carapace, Sporecaster
- [ ] `sim/deck.ts`: `CombatCard.moduleIndex: number | null` (generation still all-number)
- [ ] `sim/combat.ts`: `enemyArmor` in CombatState, `dealDamageToEnemy` funnel (cards + damage innate), armor regen in `endTurn`, `strip-armor` implementation, `inject` resolution (random draw-pile positions on the combat stream), unplayable guard in `playCard` + `isCardPlayable`, on-draw effects in `drawCards`, null-guard `isCardMalfunctioning`
- [ ] `combat.test.ts`: armor absorbs/regens/pierced/stripped, sustained-damage breakthrough, innate damage respects armor, inject determinism + null moduleIndex + vanish-on-end, unplayable throws, on-draw fires on end-turn draw *and* mid-card draw, JSON round-trip mid-fight with infestations in piles
- [ ] `combat-view.ts` + tests: always-on `intent: { kind, name, detail }`, `enemyArmor`, `CardView.unplayable`, Spore Cluster text
- [ ] `HUD.tsx` / `CombatHand.tsx`: intent line (bare kind vs revealed numbers), enemy armor display, unplayable card styling (no tap)
- [ ] Browser verification: desktop + 375px (`?enemy=enemy-carapace`, `?enemy=enemy-sporecaster`)
- [ ] **Fun checkpoint:** play ≥3 full lanes across hulls; tune `data/` numbers; record verdict + changes in this file
- [ ] Post-session checklist: lint, type-check, test, docs, CLAUDE.md, commit, push, PR, handoff for 3.1 (flag the mode switch — `src/game/surface/` is untouched scaffolding)

## Manual test steps

- [ ] `?enemy=enemy-carapace`: armor visible next to enemy HP; a 4-damage Laser Burst into armor 5 leaves HP untouched; two in one turn break through (1 reaches HP); next turn armor is back to 5
- [ ] `?hull=hull-vanguard&?enemy=enemy-carapace` (or any Flak hull): piercing Flak Volley damages HP straight through full armor
- [ ] Kinetic Shred (if reachable Mk I — otherwise sim-test only): armor drops to 0, follow-up non-piercing damage lands clean, armor regrows next enemy phase
- [ ] `?enemy=enemy-sporecaster`: after its inject turn, draw count grows; Spore Cluster eventually appears in hand — rendered as unplayable, tap does nothing
- [ ] Spore Cluster drawn with a shield layer up → layer drops on draw; with no shields → no effect, no crash
- [ ] Win the fight, next encounter in the lane: no Spore Clusters anywhere (vanished with the encounter)
- [ ] Intent line always shows the kind (ATTACK / MODULE HIT / INJECT) from turn 1 on every enemy; numbers absent until Deep Scan (Scout hull), present the turn after playing it, gone again next turn
- [ ] Edge: `?seed=` reproduces the same injected-card positions (play the same fight twice)
- [ ] Edge: defeat against a Carapace mid-armor → restart works
- [ ] Mobile 375px: armor + intent line readable, unplayable card text fits (Field-repair precedent)

## Out of scope for this session

- Lane modifiers, danger-weighted encounters, sector map (4.1); saves (4.5)
- Mk II deck generation (Kinetic Shred reachable only if a dev knob already surfaces it — otherwise strip-armor is sim-test covered)
- Enemy shield layers (GDD mentions none for these archetypes)
- More Infestation card variants / on-draw effect kinds beyond lose-shield-layer
- Surface mode (Phase 3) — next session, see handoff
- Pixi combat visuals; intent icons beyond text labels

---

<!-- Fill in below during/after the session -->

## What actually happened

Went to plan, with one tuning change out of the fun checkpoint:

- **Carapace regen tuned 5 → 2 (armor 5 kept).** A scratch sim probe (greedy
  autoplayer, 5 seeds × every hull × every enemy, deleted after use) showed full
  regrowth made the Carapace *unwinnable* for Scout and Freighter (5/5 defeats) —
  chip decks could never out-burst armor that resets each turn. At regen 2, paired
  Scout lasers make real progress, Tactical kills in ~9 turns, Gunship piercing still
  trivializes it, and the Freighter's correct play is escape-by-arrival (its whole
  deck prints 3 damage — that matchup is archetype counterplay, not a balance bug).
- **Fun-checkpoint lane runs** (browser, scripted greedy player): a Scout run produced
  a genuinely tense arc — beat a Parasite, escaped a Carapace by arrival at 51 hull,
  then lost the Anchormaw kill-race 2 HP short with travel correctly frozen (a human
  playing Ghost Shift wins that). A Gunship run chained ~13 lanes / 26 fights
  (hull 100 → 36) without incident. Verdict: the loop generates real decisions and
  tension; numbers feel right for a bot floor. **Human hand-play still recommended
  before calling the checkpoint fully passed.**
- **Scrap economy finding:** scrap stayed 0 across all 26 Gunship fights — combat
  awards no scrap until 4.3 (shops + minimum-Scrap drops), so **Pay Toll is
  effectively Freighter-only until then**. Left as-is; 4.3 makes the knob real.
- **Anchor escape valve: not built.** The Scout defeat was a damage race, not a
  wasted-engine-cards problem per se; the halt is the Blockade's identity. Re-judge
  with human play.
- The orphan-card catalog guard needed to learn that inject intents are a legitimate
  second way a card enters the game.
- Browser verification hit the known snapshot-races-navigation ghost again
  (first `?enemy=` check showed a stale page); re-reading after the navigation settled
  showed everything correct. Console clean, desktop + 375px verified.

## Files created / modified

- `src/game/data/types.ts` — `CardDef.unplayable?`/`onDraw?` (+ `OnDrawEffect` union), `EnemyDef.armor?`, `inject` intent kind
- `src/game/data/cards.ts` — Spore Cluster (unplayable, on-draw: lose 1 shield layer)
- `src/game/data/enemies.ts` — Carapace (30 HP, armor 5/regen 2), Sporecaster (20 HP, inject cycle)
- `src/game/sim/deck.ts` — `CombatCard.moduleIndex: number | null`
- `src/game/sim/combat.ts` — `enemyArmor`, `dealDamageToEnemy` funnel (cards + damage innate), armor regen in `endTurn`, working `strip-armor`, `inject` resolution, `isCardPlayable` + unplayable guard, on-draw effects in `drawCards`
- `src/game/combat-view.ts` — `IntentView { kind, name, detail }` (replaces `RevealedIntent`), `enemyArmor`, `CardView.unplayable`, on-draw card text
- `src/game/main.ts` — `isCardPlayable` quiet guard, type re-exports
- `src/components/HUD.tsx` — always-on intent line (numbers behind Deep Scan), ⛨ ARMOR display
- `src/components/CombatHand.tsx` — spore-green unplayable rendering, no AP badge, discard-mode exception
- Tests: `combat.test.ts` (+15: armor suite, infestation suite), `combat-view.test.ts` (+4 / 2 reshaped), `catalog.test.ts` (inject/armor guards, orphan rule extended)

## Deferred to next session

- **Human hand-play of the fun checkpoint** — bot floor verdict is positive, but the
  user should feel a few lanes (esp. Scout vs Anchormaw and a spore-clogged fight)
  before Phase 2 is declared done-done.
- Pay Toll unaffordable for non-Freighter hulls until 4.3 adds scrap drops (recorded, intentional).
- Anchor escape valve — re-judge with human play (data-only change if needed).
- Only one Infestation card exists; more variants + on-draw effect kinds when an enemy needs them.
- Kinetic Shred (strip-armor) is Mk II — unreachable in play until Workbench tier tracking (4.2); sim-tested.
- Carried from 2.4: lane modifiers + danger weighting + map-node arrival (4.1), SaveStore wiring (4.5), retain-with-choice API, planetside offline items (Phase 3), Mk II decks (4.2), hull select UI (Phase 5), card-flip animation (6.6), physical-phone check.

## Status

- [ ] In progress
- [x] Complete
- [ ] Partial — see deferred
