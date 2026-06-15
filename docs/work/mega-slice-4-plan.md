# Mega-Slice 4: THE ARSENAL — Card Keywords + Events + Enemy Organs

**Date:** 2026-06-14
**Branch:** feature/the-arsenal (not created yet — plan pending confirmation)
**Roadmap items:** Phase 4 — Slice 4.6 (card keywords & deckbuilding depth) + Slice 4.4 (events & discoveries) + a new **enemy-organ targeting** layer (GDD §5.4)
**Builds on:** feature/the-forge (PR #12 — must be merged to main first)

> **Scope decision (owner, 2026-06-14):** Slice 3.4 (clone death + hazards + surface enemies)
> is **split into its own PR** — a dedicated next session with a GDD §6.7 surface-threat
> design pass up front. THE ARSENAL is combat/deck identity only: keywords, events, organs.
>
> Like THE RUN and THE FORGE, this still violates "one slice = one PR" — same mitigation:
> sim-first, layer-ordered commits, each green (`lint` + `type-check` + `test`), so the PR
> reviews as a sequence of slices. **The floor is the keyword system alone (Part A)**, which
> is a complete, shippable PR on its own.

---

## 1. The pitch

THE FORGE made the economy real: you buy modules, repair your hull, fight a boss, choose a
reward. But the deckbuilder still has **no deckbuilding identity**, and a human playtest found
why:

1. **Cards are "deal X / shield Y / +N travel."** Every weapon plays the same; every module
   reads the same. There's no reason to prefer one build's *feel* over another's. Travel cards
   are dead draws at the boss. Malfunctions repair one-tap-per-module instead of the GDD's
   per-card AP tax. The starting loadout is so complete that acquiring a module barely changes
   the hand.
2. **Modules barely flow in mid-run.** Shops and the boss are the only injection points; cache
   nodes pay raw Scrap. The deck you start with is mostly the deck you finish with.
3. **Combat targeting is hollow.** You point at one enemy with one HP bar. In an 8–12-minute
   boss fight that's a damage race with no decisions in it.

**After this PR the deckbuilder has an identity.** Every module type has a *signature keyword*
— engines draw cards, shields hold barriers across turns, weapons exhaust for one-shot spikes
or combo off discards. Travel cards finally pull weight at the boss (they draw, and they
Jettison for AP). Events inject modules and modifiers mid-run, so the deck you reach the gate
with is one *you* assembled. And the Gatemaw grows targetable organs — silence the spore-sac
to stop the infestation, or race its core; spread damage with a Cleave card or focus-fire one
target down. The GDD §1 north star ("you are building a ship") is finally felt in combat.

### Why this combination

- **4.6 is the protected spine — "Deckbuilding IS the game."** The single highest-value feel
  problem in the backlog (GDD Open Questions #14, #15). The combat engine already has most of
  the *infrastructure* for keywords (draw, exhaust, on-draw, retain-count, multi-hit,
  vulnerable). What's missing is the **vocabulary, the catalog identity, and three mechanics**
  (per-card Retain, Jettison, Discard) — mostly data + small engine deltas. High payoff per
  line.
- **4.4 events are the supply side of 4.6's demand.** Keywords make modules feel distinct;
  events are how you *get* distinct modules mid-run (GDD §4.4 is flagged a "hard dependency for
  deckbuilding feel"). Cheap: a node type + a deterministic resolver + a text overlay — the
  phase machine and node-type system already support it (FORGE §6 predicted exactly this).
  Events also carry **module modifiers** (GDD §6.6) — the "draw 1 when played" / "−1 AP" hacks
  that deepen keyword interactions.
- **Enemy organs are the combat-depth complement to keywords.** Single-target focus-fire is
  hollow in a long boss fight. Organs create the **AoE-vs-single-target axis** that makes
  weapon keyword variety *matter*, and they mirror the player's own targetable modules —
  reinforcing the "you are a ship / the Bloom is a body" fiction (§2). Scoped to the boss only,
  it's contained — and it **seeds the multi-target combat UI** that future multi-enemy lane
  encounters will need (see §3, Future roadmap).
- **3.4 deliberately excluded.** It's a new real-time AI/damage system, the GDD's thinnest
  section (Open Question #4), and it deserves its own design-led session. It drops cleanly
  after this PR — clone re-prints cost Scrap (economy is live), and the keyword/identity work
  here doesn't touch the surface at all, so the two PRs don't collide.

This resolves standing deferred items: Kinetic Shred / Mk II keyword payoffs unreachable in
play, travel-cards-dead-at-boss (§5.4 design question), the malfunction repair fix (roadmap
2.3 ⚠️ note), module modifiers / Tinkerer, and the "starting deck too generous" audit.

---

## 2. Card keyword vocabulary

The heart of the PR. The vocabulary below is the GDD §5.9 table made real, with **module-type
affinities** (the owner's "each module type has a signature keyword") and a concrete example
card for each. Keywords are **data** — declared on `CardDef`, interpreted by combat, rendered
as chips by the card UI. No keyword is hardcoded in combat logic.

### Affinity model

| Slot | Signature keyword | Why it fits the fiction |
|---|---|---|
| **Engine** | **Draw** (+ **Jettison**) | Engines are *flow and momentum* — they keep the hand moving. Draw makes travel cards useful in combat (and at the boss); Jettison guarantees they're never fully dead. |
| **Utility / Shield** | **Retain** (+ **On-draw**) | Defensive tech is *preparation* — bank a barrier or a dodge now, spend it when the hit lands. Retain creates a cross-turn resource. |
| **Weapon** | **Exhaust** + **Discard** | Weapons are *spikes and combos* — Exhaust for one-shot nukes that don't dilute the deck; Discard to trade card economy for a burst. |
| **Clone Bay** | (mixed — already clone-flavored) | Telemetry draws, Resource Ping exhausts for Scrap, Repair Clone clears malfunctions. Left as-is. |

### Keyword definitions & example cards

| Keyword | Meaning | Engine support | Example card (module) |
|---|---|---|---|
| **Draw N** | On play, draw N cards immediately. | ✅ `{ kind: 'draw', count }` — exists | **Burn** (Thruster): `1 AP · +2 travel · Draw 1`. Travel *and* hand flow — now live at the boss. |
| **Exhaust** | Removed from this combat after one play; back next combat. | ✅ `CardDef.exhaust` — exists | **Overcharge** (Light Laser Mk II): `0 AP · Next attack ×2 · Exhaust`. One-shot spike. |
| **On-play: X** | Secondary effect listed after the primary (the `effects[]` array). | ✅ multi-effect array — exists | **Deep Scan** (Cargo Scanner): `1 AP · Reveal intent · Draw 1`. |
| **On-draw: X** | Fires the moment the card enters hand. | ✅ `CardDef.onDraw` — exists (expand union) | **Spore Cluster** (Infestation): `On-draw: −1 shield layer` (existing). New player-positive use below. |
| **Retain** *(NEW)* | This card is **not discarded** at end of turn — it stays in hand. | ❌ NEW — per-card flag | **Reinforce** (Shield Gen): `1 AP · Restore a shield layer · Retain`. Hold the heal until the hit lands. |
| **Jettison** *(NEW)* | Discard this card from hand (instead of playing) for a small benefit: Draw 1 or +1 AP. Resolves §5.4. | ❌ NEW — `jettison` action | **Afterburner** (Thruster): `2 AP · +5 travel · Jettison: +1 AP`. Dead at the boss? Trade it for energy. |
| **Discard N** *(NEW)* | Discard N cards from hand as a cost; the card's effect pays off the trade. | ❌ NEW — `discardCost` + effect | **Salvage Round** (new Autocannon Mk II card): `1 AP · Discard 1 → Deal 9`. Burst that eats hand. |
| **Cleave** *(NEW)* | Damage hits the core **and every living organ** at once (the AoE axis — see §3). | ❌ NEW — `damage.target: 'all'` | **Flak Volley** reworked, or a new Mk II shell: `2 AP · Deal 6 to all · piercing`. |

> **Distinction — Retain (keyword) vs. the existing `retain-cards` effect.** Today
> `Desync Hull` plays `{ kind: 'retain-cards', count: 1 }` (a *modifier* that keeps the
> leftmost N cards). The new **Retain keyword** is per-card: *this* card stays. **Recommend
> retiring `retain-cards`** (two mechanics that look identical to players = one too many to
> teach) and reframing `Desync Hull` as `0 AP · Draw 1 · Retain` (a Phase Shifter hand-fixer).

### The travel-card-at-boss fix (GDD §5.4 / §5.9 design question — resolved)

**Decision: (a) dual-mode + (b) Jettison, both.** Every Engine card gains an on-play secondary
(`Draw 1`) *and* the Jettison keyword. Dual-mode (Draw) makes engine cards a net positive in
any fight; Jettison is the floor — even a hand full of travel cards at the boss converts to
AP/draws. Strictly better than "intentional tension" (option c), which the GDD itself flags as
only valid with real hull choice (and hull select is still a knob). Resolves Open Question #14.

### The malfunction-repair fix (roadmap 2.3 ⚠️ / GDD §5.6 — the "too easy" bug)

**Current bug:** `combat.ts` tracks `malfunctioning: number[]` as **module indices**. Playing
*one* Malfunction card runs `malfunctioning.filter(i => i !== moduleIndex)` — clearing the
**whole module** in one play. The GDD (and the owner) want **per-card** repair: a module
contributing 3 cards produces 3 Malfunction cards, all three must be played.

**Fix:** move malfunction state from module-indexed to **per-card-instance**. Each `CombatCard`
is already a distinct object carried through the piles; add a `malfunctioning: boolean` flag on
the instance. When a module is hit, flag **all** its card instances across every pile
(draw/hand/discard/exhaust). Playing a flagged card clears **only that instance's** flag and
returns it to discard in normal form. A module is "operational" (a valid re-target) only when
**none** of its instances are flagged — preserving the GDD's "one damage state" rule even while
partially repaired. The module's planet item stays offline until all its instances clear.
`Repair Clone` / `repair-all-modules` clears every flag (unchanged role). This is the single
most important combat.ts change and converts malfunctions into the intended multi-turn AP tax.

### The starting-loadout audit (GDD Open Question #15 — "too generous")

**Decision: leave one empty slot of each hull's dominant type**, data-only in `hulls.ts`
`startingModules`. The first module you acquire should be a *visible* change to both deck and
clone. Concretely (tunable, confirm in playtest):

| Hull | Today | Proposed (one slot opened) |
|---|---|---|
| Gunship (3W/1U/1E) | Flak, Missile, Autocannon, Shield Gen | Flak, Autocannon, Shield Gen — **1 weapon slot open** |
| Scout (1W/2U/2E) | Light Laser, Phase Shifter, 2× Thruster | Light Laser, Phase Shifter, Thruster — **1 engine slot open** |
| Freighter (1W/2U/1E) | Mining Laser, Cargo Scanner, Hauler Engine | unchanged (already lean) |
| Tactical (2W/2U/1E) | Light Laser, Missile, Shield Gen, Cargo Scanner, Thruster | drop Missile — **1 weapon slot open** |

Default hull stays Gunship. **Cuttable** — pure data, no risk if left for the 5.5 balance pass.

---

## 3. Enemy targeting design decision

**The question (owner):** should enemies have targetable sub-parts like the player's ship has
modules, or stay single-target?

**Recommendation (confirmed by owner): targetable "organs" on the boss only — regular enemies
keep a single HP bar.** Minimum version: the **Gatemaw grows 2 organs** (a Spore-Sac and an
Armor-Node); trash enemies are untouched.

### Rationale

- **Full sub-targeting on every enemy is a complexity tax with no payoff on trash.** A 22-HP
  Lamprey dies in two turns; a target-select step there is friction, not depth. The
  quirk-per-enemy model (§5.7) already gives trash its identity. Reserve organs for fights long
  enough that *target priority is a decision* — the 8–12-minute boss.
- **Organs make the boss's existing phase system legible and player-driven.** Today phases flip
  on invisible HP fractions. Organs make the same idea visible: while the **Spore-Sac** lives,
  the boss injects spores each turn; while the **Armor-Node** lives, its armor regenerates. The
  player chooses the kill order instead of watching a threshold trip.
- **It creates the AoE-vs-single-target axis that makes weapon keywords pay off.** **Cleave**
  (`damage` with `target: 'all'`) hits core + every organ; focus-fire single-target burns one
  down fast. Spread vs. spike is a genuine build tension that doesn't exist with one HP bar.
- **Mirror symmetry sells the fiction.** You are a ship with targetable modules; the Bloom
  gate-guardian is a body with targetable organs (§2, §11 faction contrast).

### Minimum mechanical version

```ts
// data/types.ts
interface EnemyPart {
  id: string;
  name: string;
  maxHp: number;
  grants: PartAbility;          // 'inject-each-turn' | 'armor-regen' | 'amplify-attacks'
  onDestroy?: 'stagger' | 'break-armor';
}
interface EnemyDef {
  // ...existing...
  parts?: EnemyPart[];          // bosses/elites only; default undefined = single-target
}
```

- `CombatState` tracks `partHp: number[]` (parallel to `enemy.parts`). The player picks
  **core** (default) or a living organ for single-target `damage`; `Cleave` ignores selection.
- **The core is killable any time** — organs are *pressure*, not a gate. Ignoring them makes
  the fight harder (spores pile up, armor never breaks); clearing them is the skill path. Keeps
  the boss from becoming an HP sponge.
- `combat-view.ts` exposes `enemyParts: { name, hp, maxHp, ability }[]`; `EnemyPlate.tsx`
  renders organ bars under the core bar; the hand UI lets the player tap an organ before a
  single-target attack (default = core, so non-organ fights are unchanged).

### Future roadmap (owner request) — multi-enemy lane encounters

The owner wants **multiple enemy encounters during travel** on the roadmap for variety and
difficulty. Two readings, both worth a future slice:

1. **Multi-enemy lane fights** (face 2+ Bloom organisms at once in a single encounter). This
   **contradicts the current GDD commitment** (§5.1/§5.7: "single-enemy fights only — no fleet
   battles") and needs a design decision before building. The organ work in this PR
   **deliberately seeds the multi-target combat UI** (target selection, multiple HP bars,
   Cleave) that multi-enemy combat would reuse — so it's a natural follow-on, not a rewrite.
2. **Richer encounter sequencing within a lane** (already partly live via per-edge
   `encounterCount`) — escalating enemy mixes, infested/elite lanes (5.1).

**Action:** added to `docs/roadmap.md` as a Phase 5+ item (5.x "Multi-enemy encounters &
lane danger") with the §5.7 GDD tension flagged to resolve first. Not in this PR's scope.

---

## 4. Scope

Grouped logically; cut order in §9. **Part A is the protected floor.**

### Part A — Card keyword system & deckbuilding depth (Slice 4.6) — THE FLOOR

- **A1. Vocabulary on `CardDef`** (`data/types.ts`): add `retain?: true`, `jettison?: {
  benefit: 'draw' | 'ap'; amount: number }`, `discardCost?: number`. Extend `OnDrawEffect` with
  a player-positive member (e.g. `{ kind: 'gain-temp-shield'; count }`). Extend the `damage`
  effect with `target?: 'core' | 'all'` (Cleave; default core).
- **A2. Engine mechanics** (`combat.ts`):
  - **Per-card malfunction repair** (the bug fix, §2) — the central change.
  - **Retain**: in `endTurn`, instances flagged `retain` stay in hand; retire `retain-cards`.
  - **Jettison**: new `jettisonCard(state, handIndex)` — discards the card, applies the benefit
    (draw 1 / +1 AP), no AP cost; guarded like `playCard`.
  - **Discard cost**: `playCard` checks `discardCost`; UI supplies discard targets (A4).
  - **Cleave**: `dealDamageToEnemy` routes `target: 'all'` across core + organs (organs in
    Part C; until then it hits the core only — harmless).
- **A3. Catalog redesign** (`data/cards.ts`, `data/modules.ts`): re-author so every module
  carries its signature keyword(s) per §2's affinity table — engine cards get `Draw 1` +
  Jettison; Utility/Shield get Retain; Weapon gets Exhaust/Discard/Cleave variety. Add new
  cards (Salvage Round, a Cleave shell). Kinetic Shred / Overcharge reachable via Mk II decks
  (THE FORGE wired tiers).
- **A4. Keyword UI** (`combat-view.ts`, `CombatCard.tsx`, `CombatHand.tsx`): `CardView` gains
  `keywords: string[]` (RETAIN / EXHAUST / JETTISON / DISCARD / CLEAVE chips) + a `jettisonable`
  flag. Tap = play; an explicit corner ⤓ button = Jettison; discard-cost cards prompt
  (rightmost-first auto-select + confirm — simplest on mobile, no long-press). `describeCardText`
  extended for new effect text.
- **A5. Starting-loadout audit** (`hulls.ts`) — §2 table. Data-only.

### Part B — Events & discoveries (Slice 4.4)

- **B1. Event data** (`data/events.ts` — NEW): `{ id, title, body, choices[] }`; each choice
  `{ label, outcomes[] }`; outcome union: `gain-module-to-cargo`, `gain-resources`,
  `lose-resources`, `gain-blueprint`, `repair-hull`, `damage-hull`, `attach-modifier`,
  `nothing`. Pure data.
- **B2. Event resolution** (`sim/events.ts` — NEW, pure, Vitest): `pickEvent(seed, sector,
  nodeId)` on a derived stream (`event-{sector}-{nodeId}` — the FORGE/RUN keystone: never
  serialized, identical after resume); `applyEventChoice(run, eventId, choiceIndex)` validated
  like economy transactions.
- **B3. Module modifiers** (`data/modifiers.ts` — NEW; `ModuleInstance.modifiers?: ModifierId[]`
  on `run-state.ts`; **RUN_STATE_VERSION 2 → 3**): modifier defs that adjust deck generation —
  `cost-reduction` (−1 AP on the module's cards), `starts-in-hand`, `draw-on-play`. `deck.ts`
  applies modifiers per module. The Tinkerer's payload, and a deepener for keyword interactions.
- **B4. Map + phase** (`map-gen.ts`, `constants.ts`, `main.ts`): `NodeType` gains `'event'`;
  `MAP_NODE_WEIGHTS` adds `event: 2` (cache down — events are the richer "free find"). New
  `'event'` phase, `chooseEventChoice(index)` + `leaveEvent()` commands, `onEventUpdate(view)`.
- **B5. Event screen** (`components/EventScreen.tsx` — NEW, DOM, FOUNDRY-styled): title, body,
  choice buttons with outcome previews; `app/page.tsx` wires the phase; `SectorMap.tsx` gets
  the event node label/icon. **Tinkerer** = one authored event whose choice attaches a modifier
  to a chosen installed module.

### Part C — Enemy organs (boss targeting; GDD §5.4)

- **C1. Organ data + sim** (`data/types.ts`, `data/enemies.ts`, `combat.ts`): `EnemyPart`/`parts`;
  Gatemaw gets Spore-Sac (`inject-each-turn`, `onDestroy: stagger`) and Armor-Node
  (`armor-regen`, `onDestroy: break-armor`). `CombatState.partHp`, target selection, Cleave
  routing, per-turn organ-ability application, destruction consequences.
- **C2. Organ UI/render** (`combat-view.ts`, `EnemyPlate.tsx`, `CombatHand.tsx`,
  `space-renderer.ts`): `enemyParts` view; organ bars under the core bar; tap-an-organ target
  picker for single-target attacks; a cheap targeting indicator in the renderer.

### Explicitly out of scope

**3.4 (clone death, hazards, surface enemies — its own next PR)**, multi-enemy lane fights
(roadmapped, §3), 5.1 elite *encounters* (organs build the seam; elite lane modifier + souped
defs are a fast-follow), pod-defense events, second biome, full module-modifier roster /
specialization trees, item-swap-at-pod, hull select UI (still `?hull=`), card-flip / juice
animations (6.6), Supabase.

---

## 5. Files to create / modify

### New files

| Path | What |
|---|---|
| `src/game/data/events.ts` | Event catalog (text, choices, outcomes) + Tinkerer |
| `src/game/data/modifiers.ts` | Module-modifier catalog (deck-gen adjustments) |
| `src/game/sim/events.ts` (+ `.test.ts`) | Deterministic event pick + validated choice resolution |
| `src/game/event-view.ts` (+ `.test.ts`) | React-facing event snapshot |
| `src/components/EventScreen.tsx` | Event text + choices screen |
| `docs/decisions/006-card-keywords-and-modifiers.md` | ADR: keyword vocabulary, per-card malfunction state, modifier model |
| `docs/decisions/007-enemy-organs.md` | ADR: boss-only targetable organs + Cleave axis (seeds multi-enemy combat) |

### Modified files

| Path | What changes |
|---|---|
| `src/game/data/types.ts` | `CardDef` keywords (retain/jettison/discardCost), `damage.target`, `OnDrawEffect` member, `EnemyPart`/`parts`, `ModuleInstance.modifiers` |
| `src/game/data/cards.ts` | Catalog redesign — signature keywords per module; new cards |
| `src/game/data/modules.ts` | Re-map module → redesigned cards |
| `src/game/data/hulls.ts` | Starting-loadout audit (one open slot) |
| `src/game/data/enemies.ts` | Gatemaw organs (Spore-Sac, Armor-Node) |
| `src/game/data/constants.ts` | `MAP_NODE_WEIGHTS` adds `event` |
| `src/game/sim/combat.ts` (+ test) | Per-card malfunction, Retain, Jettison, Discard cost, Cleave + organ targeting |
| `src/game/sim/deck.ts` (+ test) | Modifier-aware generation; per-card retain/jettison flags propagate |
| `src/game/sim/run-state.ts` (+ test) | v3: `ModuleInstance.modifiers`; deserialize validates |
| `src/game/sim/map-gen.ts` (+ test) | `'event'` node type |
| `src/game/sim/economy.ts` | (unchanged unless a Tinkerer outcome needs a transaction) |
| `src/game/combat-view.ts` (+ test) | `keywords`, `jettisonable`, `enemyParts` view fields |
| `src/game/map-view.ts` | Event node label |
| `src/game/main.ts` | `'event'` phase, event/jettison/organ-target commands & callbacks |
| `src/components/CombatCard.tsx`, `CombatHand.tsx` | Keyword chips, Jettison gesture, organ target picker |
| `src/components/EnemyPlate.tsx` | Organ bars under the core bar |
| `src/components/SectorMap.tsx` | Event node icon/label |
| `src/app/page.tsx` | Event phase screen |
| `src/renderer/space-renderer.ts` | Organ targeting indicator (cheap) |
| `docs/game-design.md` | §5.9 keyword affinities; §5.4/§5.6 resolutions; organ note in §5.7 |
| `docs/roadmap.md` | Multi-enemy encounters item (§3) |
| `CLAUDE.md` | Current State |

**Estimated size:** ~2,500–3,200 added lines incl. tests (down from the 3.4-inclusive estimate).

---

## 6. Implementation order

Sim-first, every step green (`pnpm lint && pnpm type-check && pnpm test`), one conventional
commit per step. Parts A/B/C touch largely disjoint subsystems — steps stay verifiable.

1. **Keyword types + per-card malfunction** (Part A1/A2 core). The malfunction-state refactor
   lands first and alone — riskiest combat.ts change, with the 943-line `combat.test.ts` as the
   net. Retain/Jettison/Discard typed but stubbed.
2. **Retain + Jettison + Discard engine** (Part A2). `endTurn` retain, `jettisonCard`,
   `discardCost` in `playCard`. Scripted tests for each.
3. **Catalog redesign + loadout audit** (Part A3/A5). New `cards.ts`/`modules.ts`/`hulls.ts`;
   deck-snapshot + `catalog.test.ts` updated. Cleave effect wired (core-only until organs).
4. **Keyword UI** (Part A4). `combat-view` keywords/jettisonable; `CombatCard`/`CombatHand`
   chips + Jettison gesture + discard prompt. **Part A is now shippable — the floor.**
5. **RunState v3 + modifiers** (Part B3). `ModuleInstance.modifiers`, modifier catalog,
   `deck.ts` applies them; version bump + deserialize tests.
6. **Event sim** (Part B1/B2). `data/events.ts`, `sim/events.ts`, `event-view.ts` — pure,
   deterministic-per-node tests (same node ⇒ same event after regeneration).
7. **Event map + phase + screen** (Part B4/B5). `'event'` node type + weight; `main.ts` event
   phase; `EventScreen.tsx`; SectorMap label. **Part B shippable.**
8. **Enemy organs** (Part C). `EnemyPart` type, Gatemaw organs, `partHp` + target selection +
   Cleave routing in combat.ts; `combat-view` organ fields; `EnemyPlate` bars; renderer
   indicator. Scripted boss-with-organs tests. **Combat depth shippable.**
9. **Browser verification** (§7), then docs: ADRs 006/007, GDD updates, roadmap multi-enemy
   item, CLAUDE.md, handoff for 3.4.

---

## 7. Test plan

### Unit (Vitest, deterministic)

**Keywords / malfunction (Part A):**
- A module contributing 3 cards, hit once → all 3 instances flagged; playing 1 clears only that
  instance; module item offline until all 3 played; module not re-targetable while any instance
  flagged. `Repair Clone` clears every flag.
- Retain: a flagged card survives `endTurn` in hand; unflagged cards discard.
- Jettison: discards the card, applies draw/AP benefit, costs 0 AP, guarded after combat ends.
- Discard cost: card refuses without enough cards to discard; discards exactly N.
- Engine card (Burn) draws on play; deck regen reflects modifier'd cost (Part B).

**Events (Part B):**
- `pickEvent(seed, sector, nodeId)` deterministic across map regeneration (resume-safe).
- Each outcome mutates RunState correctly; `gain-module-to-cargo` lands in cargo;
  `attach-modifier` adds the modifier to the chosen installed module → next deck reflects it.
- v2 save JSON → null (version bump); v3 round-trips `modules[].modifiers`.

**Organs (Part C):**
- Gatemaw: Spore-Sac alive → injects each turn; destroyed → injection stops + `stagger`.
  Armor-Node alive → armor regens; destroyed → `break-armor`.
- Cleave hits core + all living organs; single-target hits only the selected target; default
  target = core; core killable with organs still alive (ends fight).

### Manual (browser, `?seed=` pinned, `?modules=` to force keyword cards, `?enemy=enemy-gatemaw`)

- [ ] **Keyword feel:** `?modules=thruster,shield-generator,flak-array` — Burn shows
      `Draw 1` + JETTISON and draws on play; Reinforce shows RETAIN and survives end of turn; a
      weapon shows EXHAUST and leaves the deck after one play. At a boss with a hand of travel
      cards, Jettison each for AP/draws — no dead hand.
- [ ] **Malfunction tax:** force a module hit on a 3-card module → 3 Damaged cards; play one →
      still 2 Damaged, item still offline; play all 3 → module + item back.
- [ ] **Events:** event node renders text + choices; "take the module" → workbench, module in
      cargo, installs, next deck grows. Tinkerer attaches "−1 AP" → that module's cards cost 1
      less next fight. Reload mid-event → same event after resume.
- [ ] **Organs:** Gatemaw shows 2 organ bars; ignore the Spore-Sac → spores pile up; kill it →
      injection stops. Cleave chips all bars; single-target with an organ tapped hits it. Kill
      the core with organs alive → fight ends.
- [ ] **Regression:** full Lamprey fight (cards, shields, the *new* malfunction tax); FORGE
      flows (shop buy → install → deck grows, engineer repair/upgrade, gate boss → reward);
      surface drop + mining unchanged (3.4 untouched); resume mid-run; 375 px mobile pass on
      EventScreen, keyword chips, organ bars.

---

## 8. What it unlocks

- **The deckbuilder has identity** — module choice changes *how the deck plays*, not just the
  numbers. GDD §1 north star felt in combat.
- **3.4 (next PR)** drops into a live economy (re-prints cost Scrap) and an untouched surface
  codebase — no collision with this PR's combat work.
- **Multi-enemy lane encounters** (roadmapped) inherit the multi-target combat UI organs seed.
- **5.1 elites** = souped-up enemy defs + organs (the seam exists) + an elite-lane modifier
  weight — a small data-only fast-follow.
- **5.5 balance pass** has its real subject: keyword tunables, organ HP, event payout rates,
  loadout sizes — every knob in `data/`.
- **6.6 card-feel pass** has keyword chips and organ bars to animate; **6.7 workbench feel** has
  modifiers to visualize on modules.

## 9. Risk assessment

| Risk | Severity | Mitigation |
|---|---|---|
| **Per-card malfunction refactor destabilizes combat.ts** | High | Lands first and alone (step 1); 943-line `combat.test.ts` regression net; flip logic stays in one derived helper |
| **Scope overrun** | Medium (lower now 3.4 is split out) | **Cut order below; the floor is Part A alone (a complete keyword PR).** |
| **Keyword UI gestures on mobile** (Jettison vs play, discard select) | Medium | Default tap = play; Jettison = explicit corner button; discard = rightmost-auto + confirm. No long-press dependency |
| **Organs destabilize the boss / become a slog** | Medium | Core killable any time (organs are pressure, not a gate); additive `parts?` defaults to current behavior; scripted phase+organ tests |
| **RunState v3 bump resets testers' saves** | Low | Expected pre-release, no migration code (same as FORGE v2) |
| **Event/modifier determinism trap** (rolling on a mutable stream) | High if missed | Keystone repeat: derived `event-{sector}-{nodeId}` stream; regenerate-and-compare test |
| **PR large to review** | Accepted | Layer-ordered commits, each green; PR description maps commits → slices; Parts A/B/C separable |

### Cut order (cheapest identity loss first)

1. **Enemy organs (Part C)** — boss keeps its phase system; Cleave ships as single-target data.
2. **Module modifiers / Tinkerer (B3)** — events still inject modules + resources.
3. **Discard keyword** — Draw/Retain/Jettison/Exhaust already carry module identity.
4. **Starting-loadout audit (A5)** — defer to the 5.5 balance pass.

**The floor (ships all of 4.6's core):** per-card malfunction fix + Retain + Jettison + catalog
redesign + keyword UI + travel-card-at-boss fix. The most important feel problem, solved.

### Logistics

- Branch from main **after** `feature/the-forge` (PR #12) merges.
- Node 22 before anything (`nvm use 22`).
- Push/PR with the `peteroomen`-scoped token (per memory).
- `RUN_STATE_VERSION` 2 → 3 — testers' saves reset, expected.

---

## 10. Playtest checklist (maps to the owner's feedback)

- [ ] **Card keywords give modules identity** — engines draw, shields retain, weapons
      exhaust/combo/cleave; each is legible as a chip on the card.
- [ ] **Travel cards are useful at the boss** — Burn draws; any engine card Jettisons for
      AP/draw. No dead hand at the gate.
- [ ] **Malfunction repair is a real multi-turn tax** — a 3-card module needs 3 plays; the
      one-tap-fixes-all bug is gone.
- [ ] **Starting loadout leaves room** — at least one empty slot; the first acquired module
      visibly changes the deck.
- [ ] **Events/caches actually pay out modules & blueprints** — an event hands you a module (to
      cargo) or a modifier, not just Scrap.
- [ ] **Enemy targeting feels meaningful** — the boss has organs worth killing; AoE vs
      single-target is a real choice; trash stays single-target (no friction).

---

<!-- Fill in below during/after the session -->

## What actually happened

Executed as planned across 8 layer-ordered commits on `feature/the-arsenal`, each green
(`lint` + `type-check` + `test`); 419 tests at the end (from 385). Sim-first; the per-card
malfunction refactor landed first and alone behind the 900-line `combat.test.ts` net.

Deviations, all sanctioned by the plan's own cut order:

- **Starting-loadout audit (A5) deferred** to the 5.5 balance pass — pure data, but it
  shifts module indices and would churn tuned combat/scout tests. Cut order item #4. The
  keyword *identity* pass (A3) shipped in full.
- **Two module modifiers shipped, not three:** `cost-reduction` (Tuned Capacitors) and
  `draw-on-play` (Feedback Loop), as per-instance `CombatCard` overrides. `starts-in-hand`
  deferred (needs opening-hand seeding). The Tinkerer uses cost-reduction.
- Salvage Round + an Autocannon Mk II tier were added in the engine step so the Discard
  engine had a real card to test against the orphan-card guard.
- **Pixi organ-targeting indicator (C2) deferred** — DOM organ bars carry the function;
  `amplify-attacks` organ ability unimplemented (no enemy uses it).
- Event/shop/engineer resume lands on the map at the node (existing convention); an event
  resolves straight to the map (no outcome overlay).

## Files created / modified

**New:** `data/modifiers.ts`, `data/events.ts`, `sim/events.ts` (+test), `event-view.ts`
(+test), `components/EventScreen.tsx`, ADRs `006-card-keywords-and-modifiers.md`,
`007-enemy-organs.md`. **Modified (sim/data):** `data/types.ts`, `cards.ts`, `modules.ts`,
`enemies.ts`, `constants.ts`, `index.ts`, `sim/combat.ts`, `deck.ts`, `run-state.ts` (v3),
`map-gen.ts`, `combat-view.ts`, `modes/combat-mode.ts`, `main.ts`. **Modified (UI):**
`CombatCard.tsx`, `CombatHand.tsx`, `EnemyPlate.tsx`, `HUD.tsx`, `GameCanvas.tsx`,
`SectorMap.tsx`, `app/page.tsx`. **Tests updated:** `combat`, `combat-view`, `deck`,
`run-state`, `map-gen`. **Docs:** `roadmap.md`, `CLAUDE.md`.

## Deferred to next session

A5 starting-loadout audit (5.5); `starts-in-hand` modifier; Pixi organ-targeting indicator
+ `amplify-attacks`; event outcome overlay; **Slice 3.4** (clone death/hazards/surface
enemies — its own design-led PR, see handoff). Pre-existing: ADR 005 is cited in code
(map-gen/events determinism keystone) but was never written by THE RUN.

## Status

- [ ] In progress
- [x] Complete
- [ ] Partial — see deferred