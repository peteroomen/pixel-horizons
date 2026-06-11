# Hyperspace Run

**Date:** 2026-06-11
**Branch:** feature/hyperspace-run
**Roadmap item:** Phase 2 — Slice 2.4 Hyperspace run

## Goal

Combat happens *inside a lane*: lanes have a distance in turns, encounters trigger at
points along them, engine cards shorten the trip, arriving mid-fight ends the encounter
(escape-by-arrival), malfunctions persist between fights in a lane and clear on arrival,
and the Anchormaw halts travel until killed or paid a Scrap toll.

## Approach

**A lane is its own plain-JSON struct (`sim/travel.ts`), owned by main.ts next to the
RunState — not inside it.** ADR 003 saves at node boundaries; a lane is the space
*between* nodes, so it never needs to serialize into a save (abandon-mid-lane = resume at
the previous node, 4.5). `LaneState { distance, progress, encounters: {at, enemyId}[],
nextEncounter, malfunctioning }`. `createLane(run)` rolls distance, encounter positions,
and enemy picks on the **map-gen RNG stream** (lane structure is map content — 4.1 will
own this generator) and commits the stream back, same contract as combat.
`advanceLane(lane)` moves progress to the next *unpassed* encounter or to the
destination: encounter points overshot during combat are **skipped** — that is the GDD's
"faster traversal = fewer encounter triggers", and it settles §5.1's open question in
favor of unused travel progress carrying between encounters.

**Combat learns about the lane through a frozen snapshot, like `modules`.**
`createCombat(run, enemyId, lane?)` stores `CombatState.lane: { distance,
progressAtStart } | null` and seeds `malfunctioning` from the lane (carry-in). Travel
mechanics, all in the sim where Vitest can reach them:

- **Passive tick:** every survived full turn is a turn of travel — `endTurn` adds +1
  `travelProgress` *after* the enemy phase. Engine cards add on top (existing `travel`
  effect).
- **Escape-by-arrival:** when `progressAtStart + travelProgress >= distance`, outcome
  becomes **`'escaped'`** (new `CombatOutcome` member) immediately. An engine card can
  therefore end the fight mid-turn, skipping the enemy phase entirely — that's the
  escape payoff. No lane (`lane: null`, all existing tests) = no escape, `travelProgress`
  stays a bare counter.
- **No victory rewards on escape:** `applyCombatResult` already gates Salvage Rig on
  `'victory'`; scrap from your own played cards (Salvage Sweep) keeps — it was earned,
  not a kill reward.
- **Anchor = enemy trait, not an intent.** `EnemyDef.anchor?: { tollScrap: number }`.
  Latching is a permanent state of the encounter, not a telegraphed turn action, so it
  doesn't belong in the intent union (considered and rejected below). While an anchor
  enemy is alive, the passive tick and `travel` effects are halted (no-op — the stated
  counter to engine builds; engine cards stay playable, learning that they're wasted
  here is the player's counterplay signal). **The latch is always visible** (HUD
  `⚓ ANCHORED — TRAVEL HALTED`) — it's archetype state, not intent info; a halt you
  can't see is just a stat drain (handoff design call, made here).
- **Toll:** `payToll(state)` / `canPayToll(state)` in sim/combat.ts. Affordability
  checks `scrapAtStart + scrapGained` (new frozen `CombatState.scrapAtStart`, like
  `modules`); paying sets `scrapGained -= tollScrap` and outcome `'escaped'` — the
  blockade lets you pass, no rewards. The existing `applyCombatResult` delta commit
  handles the negative.

**Malfunction persistence (the headline carry-over):** on victory, main.ts copies
`combat.malfunctioning` into `lane.malfunctioning`; the next `createCombat` in the same
lane carries it in. Arrival ends the lane — the next lane starts with a clean ship
(GDD §5.6 "arrival in realspace = systems reset"). Module indices stay valid because
refits don't exist mid-lane (§5.3) and `modules` is frozen per fight from the same run
list.

**main.ts orchestration replaces roster cycling.** The run becomes a chain of lanes:
`createLane` → `advanceLane` → fight → (victory w/ lane left → carry malfunctions,
advance, next fight) → arrival → fresh lane. `GameHandle.nextFight` becomes
**`continueTravel()`** (valid after `victory` *or* `escaped`); `payToll()` added;
`restartRun` unchanged. New **`?enemy=` dev knob** (validated, quiet fallback like
`?hull=`) forces every encounter to one enemy — lane picks are now random, and the
Anchormaw must be reachable on demand for testing. `seedToSearchParam` already preserves
extra params.

**View/HUD:** `CombatView` gains `travel: { progress, distance } | null` (lane-absolute,
so the bar doesn't reset confusingly per fight) and `anchor: { tollScrap, payable } |
null` (non-null while latched). HUD: `TRAVEL n/D` replaces the bare `TRAVEL +n` line,
anchored warning line, `Pay Toll (5⛏)` button in the bottom button group (it already
stacks vertically on mobile — measure at 375px). page.tsx overlays: victory with lane
remaining → "Continue"; `escaped` or victory at the destination → "Arrived — systems
reset" → next lane. Defeat overlay unchanged.

**Tunables in data:** `LANE_DISTANCE_MIN/MAX` (7/10 — GDD's 6–12 band, modifiers are
4.1), `LANE_ENCOUNTER_COUNT` (2), min encounter spacing; Anchormaw def (Blockade, ~26 HP,
chunky cycle intents, `anchor: { tollScrap: 5 }` — reachable via Freighter Salvage Rig
wins or Salvage Sweep plays). All numbers tunable.

**Considered and rejected:** anchor as a third intent kind (latching isn't a turn
action; the exhaustive intent switch stays two-armed) · lane state inside CombatState
(a lane spans multiple fights) · lane state inside RunState (saves are node-boundary
snapshots, a lane is between nodes — revisit in 4.5 if abandon-mid-lane needs to
resume mid-lane) · ending the fight only after the enemy phase on card-driven arrival
(kills the escape fantasy and the tactical value of engine cards) · a 'toll-paid'
fourth outcome (lane progress already discriminates "passed the blockade" from
"arrived"; one `'escaped'` covers both).

## Steps

- [ ] `data/types.ts`: `EnemyDef.anchor?: { tollScrap }`; `data/constants.ts`: lane tunables; `data/enemies.ts`: Anchormaw
- [ ] `sim/travel.ts`: `LaneState`, `createLane` (map-gen stream, commit back), `advanceLane` (skip overshot encounters, arrival) + `travel.test.ts` (determinism, spacing/bounds, overshoot skip, arrival)
- [ ] `sim/combat.ts`: `lane` snapshot + `scrapAtStart` in `CombatState`, malfunction carry-in, passive travel tick in `endTurn`, escape check (mid-turn via `travel` effect + post-enemy-phase), anchor halt, `payToll`/`canPayToll`, `'escaped'` outcome, `applyCombatResult` on escape
- [ ] `combat.test.ts`: passive tick, card-driven escape skips enemy phase, anchored halts tick + travel effects, toll (pays, unaffordable throws, outcome, negative `scrapGained` commit), carry-in malfunctions, escape grants no Salvage Rig scrap, JSON round-trip mid-lane fight
- [ ] `combat-view.ts` + tests: `travel`, `anchor` fields; HUD strings derived only from view
- [ ] `main.ts`: lane orchestration (chain lanes, carry/clear malfunctions), `continueTravel`, `payToll`, `?enemy=` knob
- [ ] `HUD.tsx`: `TRAVEL n/D`, anchored warning, Pay Toll button; `page.tsx`: Continue / Arrived overlay variants
- [ ] Browser verification (preview tooling), desktop + 375px
- [ ] Post-session checklist: lint, type-check, test, docs, commit, push, PR, handoff for 2.5

## Manual test steps

- [ ] New run: HUD shows `TRAVEL n/D` from the first fight (first encounter sits at a rolled point > 0)
- [ ] Play a Thruster travel card → progress jumps by the printed amount; end a full turn → +1 more
- [ ] Win fight 1 leaving a module OFFLINE (don't repair) → Continue → fight 2 in the same lane starts with the module still flipped/OFFLINE
- [ ] Reach the destination mid-fight with an engine card → fight ends instantly on the card play (no enemy phase), "Arrived" overlay, no Salvage Rig scrap (`?hull=hull-freighter` to verify the absence)
- [ ] After arrival → next lane's first fight: malfunction cleared, fresh `TRAVEL n/D`
- [ ] `?enemy=enemy-anchormaw`: ⚓ ANCHORED line visible from turn 1, travel frozen (end turns + travel cards move nothing)
- [ ] Anchormaw + scrap ≥ 5 (win a few Freighter fights first): Pay Toll button enabled → tap → scrap −5, fight ends, lane continues
- [ ] Edge: scrap < 5 → Pay Toll visible but disabled; double-tap doesn't double-fire (quiet guard)
- [ ] Edge: kill the Anchormaw instead → victory as normal, travel resumes next fight
- [ ] Edge: defeat mid-lane → restart run works; `?seed=` reproduces the same lane (distance, encounter positions, enemies)
- [ ] Mobile 375px: Pay Toll + innate + End Turn all reachable, anchored warning readable

## Out of scope for this session

- Lane modifiers (clear/asteroid/infested/nebula/debris — 4.1) and danger-weighted encounter counts; `createLane` is the placeholder generator 4.1 replaces
- Sector map / node choice (4.1) — lanes chain automatically; arrival UX is an overlay, not a screen
- Saves at arrival / abandon-mid-lane resume (4.5); SaveStore page wiring stays deferred
- Carapace, Sporecaster, Infestation cards, always-on intent telegraphs (2.5)
- Travel-card balance vs. anchor (wasted engine cards may need a "convert to dodge" escape valve — note for the 2.5 fun checkpoint)
- Pixi lane backdrop / travel visualization (HUD text only; renderer juice later)

---

<!-- Fill in below during/after the session -->

## What actually happened

Went to plan. Notes beyond it:

- **PR #5 (Slice 2.3) was still open at session start** — merged to main first (user's call),
  then branched `feature/hyperspace-run` from fresh main.
- Encounter positions partition `[1, distance-1]` into equal segments (one roll each) instead
  of the planned min-spacing rule — strictly increasing and never at the mouth/destination by
  construction, no rejection sampling. Back-to-back encounter points are possible and fine
  (an ambush, not a bug).
- `CombatView` additionally gained **`scrap` (total = at-start + gained)** — the toll button's
  affordability was invisible when the HUD only showed scrap *gained*. The HUD now shows
  `SCRAP {total}` always.
- A false alarm during browser verification: the same seed appeared to roll two different
  lanes. Ground truth from a node repro matched the later visits exactly — the first
  snapshot had raced ahead of a `location.href` navigation and captured the previous
  random-seed run. Determinism confirmed in the browser (forced and fallback pools roll
  identical distances/positions, as designed).
- Browser-verified on desktop + 375px: passive tick (+1/turn), escape-by-arrival via the
  passive tick (Lamprey untouched at 22/22 — pure out-travel), ARRIVED overlay, malfunction
  carried until arrival then cleared, hull damage persisting across lanes, Anchormaw latch
  warning + frozen travel + disabled toll at 0 scrap, `?enemy=` forcing and quiet fallback,
  three stacked buttons reachable on mobile. Console clean. Toll *payment* is sim-test
  covered (choreographing 5 scrap by hand wasn't worth it).
- 165 tests green (23 new). No new dependencies; no ADR — lane ownership (between-nodes,
  outside RunState) is documented in the travel.ts/combat.ts headers and the rejections
  list above; revisit as an ADR only if 4.5 makes abandon-mid-lane resumable.

## Files created / modified

- `src/game/data/types.ts` — `EnemyDef.anchor?: { tollScrap }`
- `src/game/data/constants.ts` — `LANE_DISTANCE_MIN/MAX`, `LANE_ENCOUNTER_COUNT`
- `src/game/data/enemies.ts` — Anchormaw (Blockade, 26 HP, toll 5)
- `src/game/sim/travel.ts` — **new**: `LaneState`, `createLane` (map-gen stream), `advanceLane` (overshoot skip, arrival)
- `src/game/sim/combat.ts` — `LaneContext`, `lane` + `scrapAtStart` in CombatState, malfunction carry-in, passive travel tick, `checkArrival` + `'escaped'` outcome, `isTravelAnchored` halt, `payToll`/`canPayToll`
- `src/game/combat-view.ts` — `travel` (lane-absolute), `anchor`, `scrap` view fields
- `src/game/main.ts` — lane orchestration (`nextEncounter` chain), `continueTravel` (replaces `nextFight`), `payToll`, `?enemy=` dev knob
- `src/components/HUD.tsx` — `TRAVEL n/D`, `SCRAP` total, ⚓ TRAVEL HALTED, Pay Toll button
- `src/app/page.tsx` — outcome overlay variants (VICTORY / ARRIVED / TOLL PAID / DEFEAT), single Continue path
- Tests: `travel.test.ts` (new, 9), `combat.test.ts` (+11 lane suite), `combat-view.test.ts` (+3)

## Deferred to next session

- **Infestation cards (2.5) will strain `CombatCard`** — every card instance carries a
  `moduleIndex`, but injected Infestations come from no module. Needs a sentinel or a
  shape change in `deck.ts`/`combat.ts` before the Sporecaster exists.
- `strip-armor` still throws (Carapace armor, 2.5).
- Wasted engine cards vs. an anchor (no-op for full AP) may need an escape valve —
  judge at the 2.5 fun checkpoint.
- Always-on intent telegraphs vs. Deep Scan-only — standing 2.5 design call.
- Arrival is an overlay and lanes chain automatically — real arrival lands on a map node
  (4.1); lane modifiers and danger-weighted encounter counts replace `createLane`'s
  placeholder generator (4.1); saves at arrival/abandon-mid-lane resume (4.5).
- Carried: physical-phone check of production URL; Mk II tier tracking (4.2);
  retain-with-choice API; `SaveStore` page wiring (4.5); card-feel/flip animation (6.6).

## Status

- [ ] In progress
- [x] Complete
- [ ] Partial — see deferred
