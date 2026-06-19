# PIXEL HORIZONS — Game Design Document

> **Version:** 0.3 DRAFT
> **Genre:** Dual-Loop Roguelite (Turn-Based Deckbuilder + Physics Extraction)
> **Art Style:** 2D Pixel Art (Deep-Fold Pixel Planet Generator ecosystem)
> **Platform:** Web-first (browser playable, shareable via URL), mobile/touch-first
> **Input:** Touch-first (drag-to-aim) · Mouse · Keyboard

---

## 1. North Star

**"You are building a ship."** Every decision feeds back to the ship. Your module loadout determines your space combat deck, your clone's planetside equipment, your exploration range, and your strategic options on the map. If a feature doesn't serve the ship-as-build identity, it doesn't belong.

---

## 2. Setting & Factions

**The Horizon Collective** (the player): a mechanical/cyborg civilization pushing into uncharted space via clone-captain expeditions. Captains never risk their bodies — consciousness is projected into ships and printed clones. Everything about the player faction is manufactured: modular, repairable, replaceable.

**The Bloom** (working name — the enemy): a biological species that lives *inside hyperspace lanes*. Their "ships" are organisms — meat, carapace, spore-sacs. Realspace is largely safe; the lanes between nodes are their territory. The fleshy **Sector Gates** that block deeper travel are Bloom growths sealing the lanes.

This fiction does load-bearing work:

- **Why travel is dangerous:** combat happens in lanes because that's where the Bloom lives.
- **Why arrival ends combat:** dropping out of hyperspace into realspace escapes them — they can't follow.
- **Why engine cards matter:** the faster you traverse a lane, the less of the Bloom you meet.
- **Why gates exist:** Bloom growths must be killed (sector bosses) to open the way deeper.
- **Visual identity:** clean mechanical pixel art (player) vs. organic, pulsing bio-ships (enemy).

---

## 3. Core Loop

```
┌─────────────────────────────────────────────────┐
│                   SECTOR MAP                     │
│         (branching fixed paths between nodes)    │
└──────┬──────────────────────────────┬────────────┘
       │                              │
       ▼                              ▼
┌──────────────┐              ┌──────────────────┐
│ HYPERSPACE   │              │  PLANET DROP     │
│ RUN (lane    │              │   (Core Breaker, │
│ travel,      │              │    1-3 min)      │
│ 5-10 min)    │              │                  │
│              │              │ Physics          │
│ Card combat  │              │ extraction       │
│ vs Bloom     │              │                  │
│ ships in the │              │ Pod = hopper     │
│ lane.        │              │ Modules = balls  │
│ 3 axes:      │              │ Reactor = shots  │
│ • Engine     │              │ Shatter pegs     │
│ • Shield     │              │                  │
│ • Weapon     │              │                  │
└──────┬───────┘              └────────┬─────────┘
       │                              │
       ▼                              ▼
┌─────────────────────────────────────────────────┐
│              SHIP WORKBENCH                      │
│  Craft modules (blueprints + resources)          │
│  Install/swap modules (changes deck + items)     │
│  Repair hull damage (Scrap, at Engineer nodes)   │
│  Upgrade reactor (rare, +1 AP)                   │
└─────────────────────────────────────────────────┘
```

---

## 4. The Ship

### 4.1 Hull Selection (Run Start)

Each run begins by choosing a hull. Hulls define the ship's slot profile, starting modules, an innate ability, and thus starting deck composition and planetside loadout. Every hull has exactly **1 Clone Bay slot** in addition to the slots below. Hulls are unlocked via meta-progression.

| Hull | Weapon | Utility | Engine | Starting Modules | Innate Ability | Playstyle |
|------|--------|---------|--------|------------------|----------------|-----------|
| **Scout** | 1 | 2 | 2 | Light Laser, Phase Shifter, Thruster Mk I ×2 | *Slipstream:* once per turn, discard a card to draw a card | Fast traversal, evasion-heavy, lean deck |
| **Gunship** | 3 | 1 | 1 | Flak Array, Missile Pod, Autocannon, Shield Generator | *Point-Defense:* once per turn, 1 AP: deal 2 damage | Weapon-heavy deck, strong combat, slow (no starting engine module — can never shorten lanes) |
| **Freighter** | 1 | 2 | 1 | Mining Laser, Cargo Scanner, Hauler Engine | *Salvage Rig:* +2 Scrap after every won encounter | Resource-focused, utility-heavy |
| **Tactical** | 2 | 2 | 1 | Light Laser, Missile Pod, Shield Generator, Cargo Scanner, Thruster Mk I | *Auxiliary Router:* once per combat, gain 1 AP | Flexible, mid-range everything |

All hulls start with the **Standard Print Matrix** in the Clone Bay.

Innate abilities exist so the player always has *something* to do on a turn, without polluting the principle that every card maps to a physical module. They guarantee no fully dead hands even when modules are malfunctioning.

Deck size is the sum of installed modules' card contributions. A lean hull (Scout) draws its key cards more often; a slot-heavy hull has more options but less consistency. This is a core strategic tension tied to hull choice.

### 4.2 Module Slots

Modules are the atomic unit of the game. Each module:
- Adds specific cards to the space combat deck
- Projects a **ball or passive** in Core Breaker, the surface extraction loop (§6.4)
- Can be damaged in combat (its cards flip to Malfunction cards until field-repaired — see 5.6)
- Can be upgraded with resources to a higher Mk tier; tier improves **both faces** — combat cards and surface ball — together (§6.4)

**Slot types:**
- **Weapon** — generates attack cards; projects an offensive **ball** (e.g. piercing laser shot, explosive missile)
- **Utility** — generates tactical/support cards and shield layers; projects a utility **ball or passive** (e.g. homing ball, phase-through, survive-one-hazard)
- **Engine** — generates travel/evasion cards; projects a **passive** (bonus shots, aim-guide length, shot power)
- **Clone Bay** — projects a **surface passive** (§6.9); contributes 1 card to the deck (keeping the module→card mapping universal)

**Clone Bay examples** (numbers tunable). Clone Bay cards are *clone-flavored* — deploying clones as combat actions, which opens unique design space:

| Matrix | Clone Effect (planetside) | Card Contributed (space) |
|--------|--------------------------|--------------------------|
| **Standard Print Matrix** | Baseline clone (3 HP) | 1× Telemetry Sync (1 AP, draw 1) |
| **Scavenger Matrix** | +15% mining yield, 2 HP | 1× Resource Ping (0 AP, gain 1 Scrap, exhaust) |
| **Enforcer Matrix** | +1 melee damage (deals 2 dmg/hit; one-shots Scrap Grubbers), 2 HP, -10% speed | 1× Combat Sim (1 AP, next attack +3 dmg) |
| **Repair Matrix** | Carries field-patch kit (slow self-heal) | 1× Repair Clone (2 AP, fix ALL malfunctioning modules — alternative to playing each Malfunction card) |
| **Assault Matrix** | +ranged attack, 2 HP | 1× Boarding Clone (2 AP, 5 dmg, teleports through shields — ignores layers) |

### 4.3 Reactor Core

The reactor sets the energy ceiling for the entire run.

- **Space combat:** Reactor level = starting Action Points (AP) per turn. Baseline: 3 AP.
- **Planet surface (Core Breaker):** Reactor level = shots fired per drop (§6.3).
- **Upgrades:** Each upgrade gives +1 AP. Two sources, both of which compete with other rewards so upgrades stay rare (expect 1-2 per run):
  - **Sector boss reward:** defeating a boss offers a **choice of one**: a Core Crystal (+1 AP), a rare Mk II module, or a Blueprint Matrix + resource cache.
  - **Found Core Crystals:** rarely findable deep on high-difficulty planets — a bonus beyond whatever you picked from bosses.

---

## 5. Space Operations (Deckbuilder Mode)

### 5.1 Hyperspace Runs (Travel Structure)

Combat occurs while traveling between nodes — inside Bloom-infested hyperspace lanes.

- Each lane has a **distance**, measured in turns (e.g., 6-12 turns depending on path length and modifiers).
- **Encounters** trigger at points along the lane; lane danger (path modifier) determines how many and how nasty. Single-enemy fights only — no fleet battles.
- **Engine cards grant travel progress**, reducing the remaining distance. Faster traversal = fewer encounter triggers.
- **Arrival ends everything:** if you reach the destination mid-combat, you drop into realspace and the encounter ends immediately (no rewards from the unfinished fight). This is the "escape" mechanic — you don't flee a fight, you finish the journey.
- **Anchor-type enemies** (see 5.7) halt travel progress until defeated — the only way past is to kill them. The anchor still holds engine-heavy builds accountable: you can't use travel cards to skip a lane that contains an Anchormaw, because its travel-halt is a hard blocker regardless of how much progress you accumulate. Engine-heavy builds may arrive at the destination faster in normal encounters, but an Anchormaw forces an engagement the same as everyone else.

Open design space: exact encounter spacing, whether unused travel progress carries between encounters in the same lane. To be tuned in playtesting — but the structure above is the commitment.

### 5.2 Ship Health Model

- **Hull: 100 HP.** Persistent across the run. Repaired with Scrap at Engineer nodes. Hull at 0 = ship destroyed = **run over**.
- **Shields: hit-based layers, not HP** (FTL-style). Utility modules grant shield layers; each layer absorbs one hit, then recharges after a cooldown (turns). E.g., Shield Generator Mk I = 2 layers, 2-turn recharge each.
- **Shield-piercing weapons** (both yours and the Bloom's) bypass layers entirely — strategic depth on both sides.
- **Module damage:** attacks that land on the hull can also hit a module (targeted or random, by enemy type). A hit module takes hull damage AND enters **Malfunctioning** state (5.6). Shields protect modules — a layer absorbing a hit absorbs the malfunction too.
- One damage state only (Malfunctioning). No second "damaged" tier — not worth the complexity.

### 5.3 Deck Construction

The deck is not curated by the player directly. It is generated automatically from installed modules. No abstract baseline cards exist — every card maps to a physical component (hull innates are abilities, not cards).

- Each module contributes 1-4 cards to the deck
- Deck size = sum of all module card contributions
- Installing/swapping/upgrading a module takes effect at the **next combat** (no mid-lane refitting)

### 5.4 Card Axes

Every card falls into one of three tactical categories. A hand of 5 cards forces you to prioritize:

- **Engine cards** (from Engine modules): Travel progress (shorten the lane, reduce future encounters, escape-by-arrival), evasion buffs, repositioning.
- **Shield cards** (from Utility modules): Restore/add shield layers, reduce recharge time, defensive buffs. Keeping your ship intact preserves your deck quality.
- **Weapon cards** (from Weapon modules): Deal damage, apply debuffs, target specific enemy organs/systems. Kill the enemy before they kill you.

The balance of these three axes in your deck depends entirely on your module loadout.

> **Design question (travel cards vs. boss fights) — RESOLVED (mega-slice 4): (a) dual-mode + (b) Jettison, both.** Every Engine card now carries an on-play `Draw 1` *and* the Jettison keyword, so engine cards are a net positive in any fight and never fully dead at the gate. (Original options for the record: (a) dual-mode Thruster cards; (b) Jettison keyword; (c) intentional tension — rejected, only valid with real hull choice, and hull select is still a knob.)

### 5.5 Turn Structure

1. Draw 5 cards from deck (hand size fixed at 5)
2. Spend AP to play cards (3 AP baseline, more with reactor upgrades); hull innate ability available
3. Unplayed cards discarded (no retention by default; specific modules may grant retain)
4. Enemy acts (attacks, buffs, targets modules)
5. Shuffle discard into deck when draw pile empty

### 5.6 Malfunctions & Infestations

> Terminology: "Malfunction" replaces the earlier "curse" naming. Full game-verbiage glossary TBD (see Open Questions).

**Malfunction cards (from your own damaged modules):**

- When a module is hit, it enters **Malfunctioning** state: all of its cards in the deck flip to Malfunction cards (e.g., *Damaged Flak Array — 1 AP: field-repair the Flak Array*).
- Malfunction cards are **playable, and playing them is how you repair**. **Each Malfunction card repairs only itself** — a module contributing 3 cards produces 3 Malfunction cards, and all three must be played to fully restore the module. The played card returns to the discard pile as its normal form. This is a deliberate design: malfunctions are a real multi-turn AP tax, not a one-card fix. You choose each turn between repairing and fighting.
- Until *all* of a module's Malfunction cards have been played, the module is still partially malfunctioning and its planetside item remains offline.
- Repair is free in currency but expensive in tempo: AP spent repairing is AP not spent fighting or traveling. **All malfunctions auto-clear when the hyperspace run ends** (arrival in realspace = systems reset). Multi-encounter lanes are therefore the real threat — damage compounds within a lane.
- Hull HP damage is the lasting cost; Scrap pays for that, not for module repair.

**Infestation cards (injected by enemies):**

- Some Bloom enemies inject Infestation cards (spores, parasites) into your deck **mid-fight**.
- Unplayable hand-clog, possibly with on-draw effects (e.g., *Spore Cluster — Unplayable. When drawn: lose 1 shield layer*).
- **Combat-only:** all Infestations vanish when the encounter ends.

### 5.7 Enemy Design

Single-ship encounters against Bloom organisms. Each has a distinct quirk demanding different responses. Enemy variety comes from quirks, not quantity — one well-designed enemy per fight with clear counterplay.

| Enemy (working name) | Archetype | Quirk |
|----------------------|-----------|-------|
| **Lamprey** | Raider | Low HP, high damage. Race to kill before it shreds your modules. |
| **Carapace** | Bulwark | Regenerating organic armor. Needs sustained damage or piercing cards. |
| **Sporecaster** | Scrambler | Injects Infestation cards into your deck mid-fight. |
| **Anchormaw** | Blockade | Latches onto the lane — travel progress halted until it's **killed**. The counter to engine-heavy builds: no amount of engine cards lets you skip a lane that has one. (Scrap toll removed — 4.13 playtest; see §5.1.) |
| **Parasite** | Hunter | Targets your highest-value module specifically. Protect it or fight without your best cards. |

### 5.8 Module Catalog (Examples)

Single source of truth for example modules. All numbers tunable.

> ⚠️ The **Planet Item** columns below describe the retired platformer loop and are superseded by **Core Breaker ball/passive projection** (§6.4, ADR 011). They will be re-specced as a *ball behaviour* column when the Core Breaker module table is built; treat them as historical until then.

| Module | Slot | Mk I Cards | Mk II Cards | Mk I Planet Item | Mk II Planet Item |
|--------|------|-----------|-------------|------------------|-------------------|
| **Light Laser** | Weapon | 2× Laser Burst (1 AP, 4 dmg) | 2× Focused Beam (1 AP, 6 dmg), 1× Overcharge (0 AP, next laser deals 2×) | — | Laser Cutter (mine hard rock) |
| **Flak Array** | Weapon | 2× Flak Volley (2 AP, 6 dmg, piercing), 1× Tracer Lock (1 AP, target takes +2 dmg) | 2× Heavy Flak (2 AP, 10 dmg, piercing), 1× Kinetic Shred (1 AP, strip armor) | — | Passive: +3 temp shield at combat start |
| **Kinetic Railgun** | Weapon | 1× Railgun Shot (3 AP, 20 dmg, pierces shields), 1× Charge Capacitor (1 AP, next attack +5 dmg) | TBD | Orbital Strike Beacon (45s cooldown, vaporizes terrain/enemies) | TBD |
| **Mining Laser** | Weapon | 1× Slag Shot (1 AP, 3 dmg) | 2× Slag Shot (1 AP, 4 dmg) | Enhanced Mining (2× yield) | Enhanced Mining + Deposit Scanner |
| **Missile Pod** | Weapon | 1× Missile Salvo (2 AP, 8 dmg), 1× Lock-On (1 AP, next attack +3 dmg) | TBD | — | TBD |
| **Autocannon** | Weapon | 2× Cannon Burst (1 AP, 3 dmg ×2 hits) | TBD | — | TBD |
| **Phase Shifter** | Utility | 2× Ghost Shift (1 AP, 50% dodge), 1× Desync Hull (0 AP, retain 1 card) | + 1× Phase Walk (1 AP, untargetable 1 turn) | Phase Dash (blink through walls) | + Phase Vision (see through walls briefly) |
| **Shield Generator** | Utility | 2 shield layers (2-turn recharge); 2× Reinforce (1 AP, restore 1 layer), 1× Emergency Barrier (0 AP, +1 temp layer, exhaust) | 3 layers; improved cards TBD | Shield Bubble item (absorbs 1 hit; kinetic recharge: run 45 tiles at ≥3.0 m/s — no passive regen while standing still) | TBD |
| **Cargo Scanner** | Utility | 1× Deep Scan (1 AP, reveal enemy intent next turn) | TBD | Resource Scanner (highlights hidden deposits) | TBD |
| **Thruster** | Engine | 2× Burn (1 AP, +2 travel), 1× Afterburner (2 AP, +5 travel) | 2× Hard Burn (1 AP, +3 travel), 1× Emergency Boost (0 AP, +2 travel, exhaust) | Double Jump | + Air Dash, + Hover (brief) |
| **Hauler Engine** | Engine | 1× Burn (1 AP, +2 travel), 1× Cargo Thrust (2 AP, +3 travel, +1 temp shield layer) | TBD | High Jump (taller single jump, no double jump) | TBD |

### 5.9 Card Keyword Vocabulary

Keywords give cards mechanical identity beyond raw damage/shield numbers. Each keyword opens cross-card interactions and makes module identity legible at a glance. This vocabulary is the foundation of 4.6 (deckbuilding depth slice).

| Keyword | Meaning |
|---------|---------|
| **Draw N** | When this card is played, draw N additional cards immediately. |
| **Discard** | Discard one or more cards from your hand as a cost or trigger for this card's effect. |
| **Retain** | This card is not discarded at end of turn — it stays in your hand. (Only specific modules grant retain; it is not the default.) |
| **Exhaust** | After playing this card, remove it from the current combat entirely. It returns to the deck next combat. One-use power spike. |
| **On-play:** | A secondary effect that triggers when this card is played, listed after the primary effect (e.g. *on-play: draw 1*). |
| **On-draw:** | An effect that triggers the moment this card enters your hand from the draw pile (e.g. *on-draw: lose 1 shield layer*). Used primarily on Infestation cards to create passive hand-pressure. |
| **Jettison** *(design question)* | This card may be discarded from hand for a reduced benefit (e.g. draw 1, or gain 1 AP) even if its primary effect is inapplicable. Targets Engine cards during boss fights — see §5.4. |

**Design intent:** keywords create synergy axes. A module whose cards say *Discard* pairs with a module whose innate ability rewards discarding. *Retain* creates a short-term resource that accumulates across turns. *Exhaust* lets you include high-power one-shots without deck consistency issues. Every module in the catalog (§5.8) should have at least one card with a keyword to give it mechanical personality beyond "deal X damage."

### 5.10 Powers & status effects *(planned — roadmap 4.7)*

> Direction set by the PR #13 playtest (feedback #2); full model to be specified before building 4.7.

Cards today apply only one-shot, here-and-now effects (a single attack's `+N`, an immediate shield layer). That made the flat next-attack-+damage cards (Lock-On, Combat Sim) **overpowered**: they cost little, **stack without limit**, and combine with multi-hit attacks for runaway damage. Combat needs a **Power/status layer** in the spirit of Slay the Spire:

- **Statuses are persistent, stacking, and visible.** A status (buff on your ship, debuff on an enemy or a specific organ) carries across turns with a **stack count and/or duration**, decays by its own rule, and is **always rendered** — a status strip on the ship plate and on the enemy/organ plates — with **tooltips** that explain what each status and keyword does (the playtest also flagged that none of this is currently explained in the UI).
- **Rebalance the existing cards around it.** The next-attack-+damage cards become **Exhaust** one-shots (a spike you spend, not a tap you spam). The blanket "+N from every hit" card becomes a **targeted skill**: Exhaust, and apply a debuff to a **chosen enemy ship/organ** (reusing the §5.4 target-selection seam) instead of a free global modifier.
- **This is the debuff half of the organ system (§5.4).** Organs are the targets; statuses are what you do to them — silence, armor-shred, mark-for-extra-damage — making focus-fire a real decision rather than just "hit the lowest bar."

---

## 6. Surface Operations (Core Breaker — Physics Extraction Mode)

> **This section supersedes the action-platformer design** (ADR 011, 2026-06-19). The old
> platformer spec is preserved in git history. Phases 3.1–3.4 shipped that loop; it is being
> retired and rebuilt as Core Breaker.

### 6.1 Philosophy

Planet extraction is a focused, tactile burst: aim, fire, watch it shatter, bank the drop.
~1–3 minutes per visit. It is the **hands** half of the game to space combat's **brain** —
where combat is deliberate and turn-based, Core Breaker is a physics toy you read and release.
Depth comes from which **balls** you carry (determined by ship modules) and how you read the
field, not from character progression. Reference point: **Peglin**, themed to the planet.

### 6.2 The Playfield

The ship stays in orbit; the drop pod descends and the captain fires the pod's extraction
ordnance into the planet's crust, rendered as a **side-on cross-section**:

- The field is packed with **deposit pegs** — mineral nodes, ore veins, Bloom growths —
  generated from the planet (biome sets layout density, richness, and hazard mix; §6.8).
- You **aim from the top** (drag to set angle/power, release to fire) and a ball drops into the
  field, **bouncing and ricocheting** off pegs.
- Hitting a deposit peg **shatters it** (some take multiple hits) and **drops resources** that
  fall to the **pod hopper** at the bottom — banked the instant they land.
- A drop is a **bounded number of shots** (the pod budget; §6.5). Spend them well, then launch.

The pleasure is the carom: one shot that chains through a cluster and pays out far more than
you aimed for.

### 6.3 The Bag & Shots

Core Breaker is fired from a **bag of balls**, Peglin-style — the direct surface analogue of
the combat deck:

- Your **installed modules project to balls** (§6.4). The bag is the multiset of those balls;
  **module count = how many copies** of that ball are in the bag.
- You fire balls from the bag in order; when it empties it **refills** (reshuffles) for the
  next pass, the way the combat draw pile cycles.
- The **reactor level = shots per drop** (the surface analogue of AP-per-turn). A bigger
  reactor means more shots before the pod launches — the bounded budget that replaces the
  platformer's pod *timer* as the core pressure. Engine modules can grant bonus shots.
- The bag is fixed for the drop (no mid-drop refitting), mirroring "no mid-lane refitting" in
  combat. Loadout changes take effect on the next drop.

### 6.4 Ball Roles & the Module Projection

This is the North Star made literal a third time. A module already projects to **cards** in
combat (`deck.ts`); Core Breaker adds **module → ball**. Modules project to one of **two
surface roles** — never a placeable board piece:

- **Ball** — a projectile fired into the field. Most Weapon / Utility / Engine modules.
  Behaviour comes from the module's identity:
  - **Mining Laser** → piercing straight shot (low bounce, punches a line through soft rock).
  - **Missile Pod** → heavy, bouncy ball that explodes on rest (AoE shatter).
  - **Tractor Beam / scanner** → curving ball that magnetises toward ore.
  - **Phase Shifter** → a ball that phases through one Bloom growth without being consumed.
- **Passive** — a standing modifier on the drop. **Reactor → shots-per-drop**; an **Engine**
  module may extend aim-guide length or shot power; a defensive module may let a ball survive
  one Bloom hazard. The surface analogue of a combat Power, not a projectile.

**Shared upgrade axis.** A module's **Mk tier buffs both faces together** — Mining Laser Mk II
is a better attack card *and* a better ball (more pierce / bounces / yield). One upgrade path,
no separate mining economy to balance. Your ship build is your ship, everywhere.

**Divergence only via events.** A ball and its card stay locked except when a rare **event**
targets a single face — exactly parallel to today's event-modifies-a-module →
changes-its-combat-card. Events are the *only* way the two faces ever drift; never a
build-planning axis. (Data: tier drives both; an event records a per-face override.)

**Ball glyph grammar (UI law, ADR 011).** Each ball reads at a glance via a trajectory glyph —
**straight** (pierce), **arc** (bounce), **curve** (homing) — plus a count badge, no text
required. A single `<ModuleCard>` component shows both faces (combat + surface) off one anchor
(icon · name · tier pips · count); tier and count are the only changing numbers and get fixed,
prominent positions on every screen (Workbench, DeckViewer, shop, event, orbit loadout, bag
preview), down to 375px. Extends the hull-sprite "module grammar."

### 6.5 The Pod & Hopper

The drop pod is still the vessel and base camp, but the loop is shots, not footsteps:

- **Shots are the budget** (reactor-set; Engine modules can grant bonus shots). When shots run
  out — or you choose to **launch early** — the pod returns to orbit with everything in the
  hopper.
- **The hopper banks on contact:** resources that fall into it are safe the instant they land.
  There is no run-back-to-deposit step and no backpack to lose.
- **Bloom interference (pod-defense, reimagined):** on infested planets the Bloom can **clog
  the hopper or foul the field** as you fire — a growth that must be cleared with a shot, or it
  starts eating banked yield. This keeps the "base camp under threat" tension of the old
  pod-defense idea, expressed in the new verbs.
- **No staying indefinitely:** the shot budget is the reason every drop ends.

### 6.6 Planet Resources

The resource model is unchanged from the platformer design — only the *delivery* changes
(shattered pegs drop into the hopper instead of being mined by a clone):

| Resource | Found On | Used For |
|----------|----------|----------|
| **Scrap** | Everywhere (deposit pegs, cleared Bloom-growth pegs, space combat drops — minimum drop guaranteed) | Hull repairs, crafting costs, shop currency. The universal currency. |
| **Biominerals** | Ore-vein pegs (deeper / harder-to-reach lanes of the field) | Module upgrades, specialization branches |
| **Core Crystals** | Rare **crystal pegs**, deep in high-difficulty planet fields only | Reactor upgrades (+1 shot / +1 AP). Extremely rare. Also a boss reward choice. |
| **Blueprint Matrices** | Hidden **vault pegs** behind hazard clusters | Unlock new module variants at the workbench |

Resources fall into the hopper and bank on contact (§6.5) — no backpack, no corpse run.

**Surface discoveries** carry over from the old design at the node/event layer (not the
field): **module modifiers** (found in vault pegs or applied by the **Tinkerer**; attach to the
*module*, persist through Mk upgrades, can now target either face — card or ball — see §6.4
divergence); **random events**; and **environmental intel** about upcoming nodes.

### 6.7 Peg & Hazard Types (Sector 1)

The platformer's enemies/hazards convert to **peg types** in the field. Sector 1
(Rocky/Desert):

| Peg | Behaviour | Drop |
|-----|-----------|------|
| **Mineral Node** | Single-hit deposit peg | 1 Scrap |
| **Ore Vein** | Multi-hit (3); chips down per bounce | 2 Biominerals when broken |
| **Hardrock** | Multi-hit (2); wants a piercing/heavy ball or repeated bounces | 1 Scrap |
| **Bloom Growth** | Hazard peg; **consumes the ball** that hits it (shot wasted) unless the ball pierces/phases; spreads to a neighbour every few shots if left | — (clearing it drops 1 Scrap) |
| **Crystal Peg** | Rare, deep, armoured | Core Crystal (very rare) |

**Field rules (analogues of the old spawn rules):**
- Field = one screen of pegs, themed by biome; peg count/density set by planet difficulty.
- Bloom Growths weighted to guard ore veins and crystal pegs (risk gates reward).
- Deterministic, seeded layout (ADR 003) — same seed = same field.

### 6.8 Biome Theming

The field is recoloured and re-stocked from the **same R64 ramp the orbit planet was generated
from** (ADR 010 / `palette.ts`) — no separate art pipeline. Biome also sets a **field-physics
modifier**, which keeps Core Breaker varied across worlds:

| Biome | Field Character (physics modifier) | Resources | Difficulty |
|-------|-----------------------------------|-----------|------------|
| **Rocky/Desert** | Open peg field, few hazards (baseline) | Biominerals (common) | Low |
| **Ice** | Slick pegs — higher restitution, ball bounces further/wilder | Biominerals (moderate), blueprints | Low-Med |
| **Volcanic** | Lava-gap lanes + many Bloom/hazard pegs | Biominerals (rich), Core Crystal chance | High |
| **Jungle/Toxic** | Dense growth, vault pegs behind hazards | Blueprint Matrices | Med-High |
| **Ocean** | Buoyancy drift — slow upward curve on the ball | Deep-field blueprint caches | Med |
| **Gas Moon** | Wind-impulse zones nudge the ball mid-flight | High-value pegs, Core Crystal chance | High |

Sector 1 ships Rocky; Ice/Volcanic and the wind/buoyancy/restitution modifiers are later biome
slices — they're the field-physics knobs that keep extraction fresh.

### 6.9 The Clone Bay on the Surface

There is no walking avatar, so the Clone Bay slot keeps its **combat card** (the module→card
mapping stays universal) and projects a **surface passive** instead of a platformer chassis:

| Matrix | Surface Passive (Core Breaker) | Card Contributed (space) |
|--------|--------------------------------|--------------------------|
| **Standard Print Matrix** | Baseline (no modifier) | 1× Telemetry Sync (1 AP, draw 1) |
| **Scavenger Matrix** | +15% resource yield from shattered pegs | 1× Resource Ping (0 AP, gain 1 Scrap, exhaust) |
| **Enforcer Matrix** | Balls hit harder — count as +1 hit on multi-hit pegs | 1× Combat Sim (1 AP, next attack +3 dmg) |
| **Repair Matrix** | +1 shot per drop | 1× Repair Clone (2 AP, fix ALL malfunctioning modules) |
| **Assault Matrix** | Longer aim guide / truer trajectory preview | 1× Boarding Clone (2 AP, 5 dmg, ignores shield layers) |

### 6.10 Risk & Failure

Surface risk is recoverable and bounded — the asymmetry with combat is preserved (planet risks
recoverable, space risks fatal), just expressed in the new verbs:

- **No clone death, no corpse run, no re-print economy.** Those retire with the platformer
  (ADR 011).
- **The shot budget is the pressure:** waste shots into Bloom Growths or whiff the field and
  you bank less. The cost of a bad drop is *opportunity* (lost yield), not a death.
- **Bloom interference** (§6.5) can eat banked yield if ignored — a soft fail state that
  rewards reading the field, not reflexes.
- **Ship destroyed (space combat):** still immediate Game Over. Space is where you lose the
  run; the planet is where you lose only a good haul.

---

## 7. Sector Map & Progression

### 7.1 Structure

The game is divided into **3 sectors, each ending with a sector boss**, with a secret 4th sector as an alternative path (details TBD).

Each sector is a fixed branching-path map (like Slay the Spire). Paths are visible from the start. The player chooses which path to take, weighing:

1. **What's at the node** — planet type (resources), shop, event
2. **What's on the lane** — distance (turns), encounter density, lane modifiers

A safe destination might have a dangerous lane. A dangerous planet might be easy to reach. Both dimensions matter.

**Nodes are realspace — combat never happens at them.** The Bloom lives in the lanes (§2): every fight is a lane encounter, and arrival means safety. Forced combat is therefore a *lane* property (infested/elite lanes, §7.3), never a destination. The one exception is the Sector Boss: the gate itself is a Bloom growth sealing the lane mouth, so the boss fight happens at the gate.

> **Gate guardians never appear as random lane encounters.** Enemies flagged `boss` (the Gatemaw) are excluded from the default lane encounter pool — the boss is fought once, at the gate. (Fixed in PR #13 after a playtest where the boss was rolling into ordinary lanes repeatedly. The `?enemy=` dev knob can still force it into a lane for testing.)

### 7.2 Node Types

| Node | What Happens | Duration |
|------|-------------|----------|
| **Planet** | Drop pod, explore (platformer mode), mine resources | 3-5 min |
| **Shop/Merchant** | Buy modules, sell resources | 1-2 min |
| **Engineer** | Hull repairs (Scrap), module Mk upgrades (Biominerals + Scrap) | 1-2 min |
| **Event** | Random event with choices (text-based, quick decisions) | 1-2 min |
| **Sector Boss** | Major multi-phase encounter at the Bloom gate | 8-12 min |

### 7.3 Lane Modifiers

The travel between nodes has its own properties:

- **Clear lane:** Short distance, no encounters
- **Asteroid field:** Moderate encounters, some resource pickups
- **Infested lane:** Guaranteed combat encounter en route
- **Elite lane:** A souped-up encounter guards the lane — high-value rewards for going through it
- **Nebula:** Reduced visibility, harder combat, but possible rare salvage
- **Debris field:** Chance to find wreckage from previous failed runs (meta-progression tie-in)

### 7.4 Shops

Two shop types:

- **Merchant:** Sells modules (random selection from unlocked pool), consumables, and module modifiers. Accepts Scrap.
- **Engineer:** Repairs hull HP for Scrap; performs module Mk upgrades (Biominerals + Scrap) and specialization branching. Hull repair Scrap competes directly with buying new modules — taking hull damage has a lasting economic cost.

### 7.5 Sector Boss

Each sector ends with a boss: a unique Bloom gate-guardian with a multi-phase fight and specific mechanics. Defeating a boss:

- Offers a **choice of one**: Core Crystal (+1 AP) / rare Mk II module / Blueprint Matrix + resource cache
- Destroys the sector gate, opening the path to the next sector

---

## 8. Module Acquisition & Crafting

### 8.1 How You Get Modules

- **Shops:** Buy pre-built modules from merchants (Scrap cost, random inventory)
- **Crafting:** At the ship workbench — available at any node, never mid-lane — combine a Blueprint Matrix + Biominerals + Scrap to build a new module. Blueprints are found on planets (deep caves, ruins).
- **Combat rewards:** Encounters primarily drop Scrap (minimum guaranteed) and occasionally salvageable components. Full modules from combat are rare (elite/boss rewards).

Install/swap/craft happens between encounters at the workbench; deck changes take effect at the next combat. The Engineer node handles what the workbench can't: Mk upgrades and specialization branches.

### 8.2 Module Upgrades

At the Engineer, spend Biominerals + Scrap to upgrade a module to its next Mk tier. Upgrades improve both the cards it generates AND the planetside item it projects. Upgrade paths may branch (choose specialization). Naming is Mk-tier everywhere (Mk I, Mk II, …) — no "Advanced/Basic" variants.

---

## 9. Meta-Progression

### 9.1 The Expedition Framework

**Story context:** You are one of many clone-captain expeditions launched by the Horizon Collective, pushing deeper into Bloom-infested space. Each run is one expedition. The overarching goal: destroy the Bloom's **Sector Gates** that seal the hyperspace lanes to deeper space, ultimately reaching and killing the source.

**Runs always start at Sector 1.** Meta-progression changes what's available, never where you start.

### 9.2 Permanent Unlocks

Between runs, accumulated progress unlocks:

- **Hull blueprints:** New ship chassis options with different slot profiles
- **Module blueprints:** New module types added to the game's loot/shop pools
- **Clone Bay matrices:** New clone print options (Scavenger, Enforcer, …)
- **Sectors:** Destroying a sector's gate for the first time permanently unlocks that sector's content pool and the ability to travel beyond it on future runs (you still fight each boss every run)

### 9.3 Run Legacy — Wreckage System

When a run fails (ship destroyed), your wreck persists in the sector:

- On your next run, if you reach the same area, you may find your previous ship as a **salvage node**
- Salvaging a wreck yields some of the modules/resources that ship had
- Only the most recent wreck persists — die before reaching it and it's replaced by the new one
- A failed run can bootstrap your next attempt, but only if you get far enough

### 9.4 Endgame & Replayability

- **Final boss:** At the end of Sector 3, a major encounter that completes the campaign
- **Secret Sector:** An alternative path (details TBD) for experienced players. Harder, different rewards, different story branch.
- **Ascension ladder (post-campaign):** Stacking difficulty modifiers unlocked by campaign completion (à la Slay the Spire ascension / Hades heat). Design TBD, but committed to as the long-term replayability backbone.

---

## 10. Biome & Planet Generation

Planet visuals and properties are driven by the Deep-Fold Pixel Planet Generator. The generator produces sprite assets (planet overworld, surface tiles, atmosphere colors) that the game consumes.

### 10.1 Planet Properties Derived from Generator

| Generator Output | Gameplay Effect |
|-----------------|-----------------|
| Surface color/type | Tile palette, visual theme |
| Atmosphere | Visibility, wind effects, hazard type |
| Liquid layers | Water/lava/acid mechanics |
| Cloud density | Storm frequency, lightning hazards |
| Ring system | Orbital debris (resource pickup during pod descent) |

### 10.2 Biome Gameplay Effects

| Biome | Physics/Hazards | Resources | Difficulty |
|-------|----------------|-----------|------------|
| **Rocky/Desert** | Standard gravity, sandstorms (visibility) | Biominerals (common) | Low |
| **Ice** | Slippery surfaces, freezing water | Biominerals (moderate), unique blueprints | Low-Med |
| **Volcanic** | Rising lava, fire hazards, heat pressure | Biominerals (rich), Core Crystal chance | High |
| **Jungle/Toxic** | Poison zones, aggressive fauna | Blueprint Matrices (alien ruins) | Med-High |
| **Ocean** | Buoyancy, drowning, underwater caves | Unique deep-sea blueprint caches | Med |
| **Gas Moon** | High wind, low gravity, lightning | High-value salvage, Core Crystal chance | High |

---

## 11. Visual Identity

- **Pixel art** throughout, consistent resolution scale
- **Faction contrast:** clean/mechanical (Collective) vs. organic/fleshy (Bloom) — ships, gates, UI accents
- **Planet sprites** from Deep-Fold generator (or derivative)
- **Ship sprites** modular — visible module slots that change appearance as you install/swap
- **Space combat** presented as a side-view or top-down tactical display (cards overlaid); hyperspace lane visual language distinct from realspace
- **Platformer** side-scrolling, camera follows clone, drop pod visible at landing site
- **Transition beats:** pod descent (ring debris pickups) and launch-back are short interactive/animated moments, not hard cuts — they sell the fantasy
- **UI** clean, readable, information-dense where needed (deck viewer, module inspector)
- Animation budget is a known cost center — scoped in roadmap, placeholder-first

---

## 12. Session Pacing

**Development focus: Sector 1 (Act 1) first**, targeting a complete, polished ~25-35 minute experience. The 3-sector full run (60-90 min target) builds on that iteratively.

| Activity | Target Duration | Frequency per Sector |
|----------|----------------|---------------------|
| Planet visit | 3-5 min | 2-3 |
| Hyperspace run + encounters | 3-6 min per lane | 3-4 lanes |
| Shop/event/engineer | 1-2 min | 1-2 |
| Sector boss | 8-12 min | 1 |
| **Sector total** | **~25-35 min** | — |

**Mid-run save/resume is required** (web sessions churn). Save points: any node arrival.

---

## 13. Tech Considerations

- **Web-first:** Browser-playable, shareable via URL
- **Seeded runs:** run seed encoded in URL → shareable challenge runs and daily runs for free; forces deterministic generation from day one (the right architecture call regardless)
- **2D pixel art rendering:** Canvas or WebGL (lightweight)
- **Platformer physics:** Simple, responsive (no heavy physics engine needed — custom or lightweight lib)
- **Card system:** Data-driven, modules define card arrays
- **Planet generation:** Consume sprite output from Deep-Fold generator (pre-generated or runtime) — verify generator license/asset pipeline before building on it
- **State management:** Module → card mapping is deterministic; save state = modules + hull HP + resources + map position + seed
- **Save/resume:** mid-run persistence at node boundaries
- **Audio:** Placeholder hooks initially, proper SFX/music later

---

## 14. Open Questions (To Be Resolved During Development)

1. **Game verbiage/glossary** — final names for Malfunction/Infestation cards, the Bloom, hyperspace runs, etc. Placeholder names throughout.
2. **Hyperspace run tuning** — encounter spacing, whether travel progress carries between encounters in a lane, what happens to encounter rewards on escape-by-arrival
3. **Exact card balance numbers** — AP costs, damage values, shield layer counts need playtesting
4. **Platformer enemy design (Sector 1 resolved)** — Bloom Hopper, Scrap Grubber, Ceiling Dropper specified in §6.7; hazards (Spike Bramble, Crumbling Sandstone, Sandstorm Vent) in §6.8. Enemy types for Sectors 2–3 and non-Rocky biomes are still TBD.
5. **Secret Sector details** — unlock condition, unique mechanics, story implications
6. **Module modifier system depth** — how many modifier types, stacking rules, rarity; Tinkerer encounter design
7. **Pod-defense events** — frequency, mechanics, interaction with the pod timer
8. **Module specialization trees** — branching upgrade paths, how many branches per module
9. **Clone Bay matrix roster** — full list, unlock conditions
10. **Ascension ladder design** — modifier list, stacking rules
11. **Audio/music direction** — style, adaptive music between modes
12. **Exact shop pricing economy** — Scrap values, Biomineral costs, inflation across sectors
13. **Multiplayer/sharing** — co-op potential beyond seeded-run sharing, or purely single-player?
14. ~~**Travel card design at boss fights**~~ — RESOLVED (mega-slice 4): dual-mode (`Draw 1`) + Jettison on every Engine card. See §5.4.
15. **Starting deck size** — are there too many starting modules? Fewer starting slots means each new module has higher relative impact on the deck. The keyword pass (mega-slice 4) deferred the starting-loadout audit to the 5.5 balance pass; evaluate then with the keyword identity in place.
16. **Module acquisition pacing** — are shop/engineer/event encounters frequent enough? Events (shipped mega-slice 4, weight 2) are the primary mid-run injection point; tune timing in playtest.
17. **Multi-enemy encounters** — the boss-organ work (mega-slice 4) seeded a multi-target combat UI. Should lanes ever present 2+ enemies at once? This contradicts the current §5.1/§5.7 "single-enemy fights only" commitment — resolve before building (roadmap 5.x).
