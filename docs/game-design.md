# PIXEL HORIZONS — Game Design Document

> **Version:** 0.2 DRAFT
> **Genre:** Dual-Loop Roguelite (Turn-Based Deckbuilder + Action Platformer)
> **Art Style:** 2D Pixel Art (Deep-Fold Pixel Planet Generator ecosystem)
> **Platform:** Web-first (browser playable, shareable via URL)
> **Input:** Keyboard + Mouse / Gamepad

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
│ HYPERSPACE   │              │  PLANET LANDING  │
│ RUN (lane    │              │   (drop pod,     │
│ travel,      │              │    3-5 min)      │
│ 5-10 min)    │              │                  │
│              │              │ Platformer       │
│ Card combat  │              │ mining run       │
│ vs Bloom     │              │                  │
│ ships in the │              │ Pod = base camp  │
│ lane.        │              │ Clone = explorer │
│ 3 axes:      │              │ Modules = items  │
│ • Engine     │              │ Timed window     │
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
- Projects zero or more items/passives to the clone on planet surfaces
- Can be damaged in combat (its cards flip to Malfunction cards until field-repaired — see 5.6)
- Can be upgraded with resources to a higher Mk tier (improving cards + planetside items)

**Slot types:**
- **Weapon** — generates attack cards; projects offensive items to clone (e.g., orbital strike beacon)
- **Utility** — generates tactical/support cards and shield layers; projects traversal/survival items to clone (e.g., phase dash, scanner)
- **Engine** — generates travel/evasion cards; defines clone mobility (jump, dash, boost) and extends the drop-pod window
- **Clone Bay** — defines the clone chassis printed for planet surfaces; contributes 1 card to the deck (keeping the module→card mapping universal)

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
- **Planet surface:** Reactor level = maximum concurrent active items the clone can equip.
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
- **Anchor-type enemies** (see 5.7) halt travel progress until defeated or paid off, making them the counter to pure engine builds.

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
| **Anchormaw** | Blockade | Latches onto the lane — travel progress halted until it's killed or paid a toll (Scrap). The counter to engine-heavy builds. |
| **Parasite** | Hunter | Targets your highest-value module specifically. Protect it or fight without your best cards. |

### 5.8 Module Catalog (Examples)

Single source of truth for example modules. All numbers tunable.

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

## 6. Surface Operations (Action Platformer Mode)

### 6.1 Philosophy

Planet exploration is a focused mining run, not a sprawling adventure. Get in, grab resources, get out. 3-5 minutes per visit. The platformer is simple but precise — run, jump, attack, use items. Depth comes from what items you have (determined by ship modules), not from complex character progression.

### 6.2 The Drop Pod

The ship stays in orbit. A **drop pod** carries the clone to the surface and serves as base camp:

- **The pod is on a timer** (~5 minutes baseline; Engine module quality extends the window). When the window closes, the pod auto-launches back to orbit — with or without you.
- Walk back to the pod to **deposit resources** — deposited resources are safe no matter what happens after.
- **Leave early:** standing on the pod, you can launch before the window closes — the backpack deposits and you ride up with everything banked. Mining out a planet never means waiting out the clock.
- **Abandon:** the clone can always be recalled to orbit (e.g. trapped in a pit) — same consequences as missing the window. The pod leaves with what was deposited.
- **Miss the launch window:** the pod leaves with whatever was deposited. Resources still in the clone's backpack are lost; clone consciousness snaps back to orbit. Harsh but recoverable.
- Module items can be swapped at the pod (between forays on the same planet).
- **Pod-defense events:** something attacks the pod while you're deep in a cave, forcing a rushed return. Makes the base camp *felt*, and connects both game modes in real time.

The timer is the reason to leave: there is no staying indefinitely.

### 6.3 The Clone System

The captain never leaves the ship. A printed clone (defined by the Clone Bay matrix) is deployed via the pod.

**Clone baseline:** Run, jump, basic melee attack. That's it. Everything else comes from ship modules projecting items.

- No Engine module = no double jump
- No Utility module = no dash/blink
- No Weapon module = no ranged attack or orbital support

The clone should feel deliberately incomplete based on your ship config. A Gunship player has orbital strikes but can barely jump. A Scout player is agile but has minimal firepower. Your ship build creates your platformer experience. There are no character-level upgrades separate from the ship — clone variation lives in the Clone Bay module.

**Clone HP by matrix:** Standard Print Matrix = 3 HP; Scavenger Matrix = 2 HP; Enforcer Matrix = 2 HP. All Sector 1 enemies and hazards deal exactly 1 HP per hit.

**Invincibility frames (iFrames):** 1.5 s (90 frames at 60 Hz) after taking damage. Sprite blinks at 10 Hz during this window. iFrames activate during the freeze-frame phase (§6.10), preventing chain hits from adjacent hazards. Hit-stun eats 0.20 s of input lock; momentum-based knockback also eats pod-timer seconds.

**Moveset matrix:**

| State | Available Inputs |
|-------|-----------------|
| Ground | Run · Jump · Ground Melee Swipe |
| Airborne | Air Spin (one per airborne sequence; jump-button tap) |

*Ground Melee Swipe:* 24 × 16 px hitbox, front-facing. 3f startup / 4f active / 5f recovery (<0.25 s total). 0.4 s cooldown between swings. Deals 1 HP + minor knockback; Enforcer Matrix scales to 2 HP (one-shots Scrap Grubbers). Passes through wall tiles — no recoil on terrain contact.

*Air Spin:* exclusive to the airborne state. 0.15 s gravity clamp; ±1.5 m/s horizontal drift. One per airborne sequence; refreshes on: solid floor landing, wall-slide contact, or successful enemy bounce.

**Module-item composition:**

- *Double Jump + Air Spin:* jump → double-jump at apex → Spin for hover/drift. Spin refreshes after each double-jump sequence.
- *Phase Dash + Air Spin:* complete the blink, then tap Spin while still airborne. Input priority: Phase Dash wins over simultaneous Spin input; Spin becomes Available once the dash exits.
- *Phase Dash distinction:* invincible horizontal blink *through* tiles and enemies; Air Spin deflects enemies on contact. They are separate states, not alternatives.

### 6.4 Death Penalty

- **Clone dies:** NOT a run-ender. Consciousness snaps back to orbit. Backpack resources drop at the death point. **First clone print per planet visit is free; re-prints cost Scrap.** You can redeploy (within the remaining pod window) to corpse-run your dropped loot (see §6.10 for corpse marker lifecycle).
- **Ship destroyed (space combat):** Immediate Game Over. Run terminates.

This asymmetry is key: planet risks are recoverable, space risks are fatal. It encourages bold exploration but careful combat. Minimum Scrap drops from every won encounter guarantee the economy can't fully bottom out.

### 6.5 Planet Resources

| Resource | Found On | Used For |
|----------|----------|----------|
| **Scrap** | Everywhere (surface caches, defeated enemies, space combat drops — minimum drop guaranteed) | Hull repairs, crafting costs, shop currency, clone re-prints. The universal currency — every spending decision competes. |
| **Biominerals** | Planet subsurface layers (mining) | Module upgrades, specialization branches |
| **Core Crystals** | Deep caves on high-difficulty planets only | Reactor upgrades (+1 AP). Extremely rare. Also one of the three boss reward choices. |
| **Blueprint Matrices** | Hidden in deep caves, anomalous ruins | Unlock new module variants at the workbench |

**Surface enemy drops** go into the clone's **backpack** — not direct-banked — preserving the risk/reward tension of the pod timer. A full backpack causes drops to bounce to the nearest valid floor position as world items; pickup magnetism radius is 2.5 tiles. See §6.7 for enemy rosters, §6.9 for corpse mechanics.

Planet type determines what resources are available and in what quantities:

- **Rocky/Desert worlds:** Rich in Biominerals, safe but low-value
- **Volcanic worlds:** Biomineral-rich + Core Crystal chance, but extreme hazards (lava, fire, heat pressure)
- **Ice worlds:** Safe, moderate Biominerals, some unique blueprint locations
- **Jungle/Toxic worlds:** Blueprint-rich (alien ruins), dangerous fauna, poison hazards
- **Ocean worlds:** Buoyancy/underwater traversal, unique deep-sea blueprint caches
- **Gas Moons:** Storm hazards, wind physics, but high-value salvage from orbital debris

This makes planet choice a strategic decision: do you need Biominerals (safe rocky world) or are you hunting a Core Crystal (dangerous volcanic world)?

### 6.6 Surface Discoveries

Beyond raw resources, planets can yield:

- **Module modifiers:** Found in ruins or reward caches, or applied by a rare **Tinkerer** character (event/shop encounter) who hack-customizes a module. Modifiers attach to the *module* (not the abstract card), persist through Mk upgrades, and leave with the module if it's sold. Examples: -1 AP cost on one of its cards, "starts in hand," "draw 1 when played."
- **Random events:** Distress signals, alien encounters, environmental puzzles. Can yield unique modules, resources, or information about the sector.
- **Environmental intel:** Scanning certain formations reveals information about upcoming nodes (enemy types, shop inventory, hazard warnings).

### 6.7 Surface Enemies (Sector 1 Roster)

Three enemy types appear on Rocky/Desert planets in Sector 1. All deal 1 HP per hit.

| Enemy | Behavior | Drop |
|-------|----------|------|
| **Bloom Hopper** | Ground patrol; 3-tile horizontal range; leaps toward clone when within 5 tiles | 1 Scrap |
| **Scrap Grubber** | Slow-moving ground scavenger; attacks only if cornered or attacked first | 2 Scrap (each item takes 1 backpack slot) |
| **Ceiling Dropper** | Clings to ceiling; drops when clone passes beneath; brief stun on landing; thrown upward 1.0 s on Shield Bubble pop | 1 Scrap |

**Spawn rules:**
- Chunk size: 16 × 10 tiles (one viewport). Maximum 2 enemies per chunk.
- Minimum 5-tile separation between enemy spawn points.
- 8-tile zero-spawn radius around the Drop Pod.
- Enemies weighted to spawn within 3 tiles of high-value deposits.
- No vertical stacking: Ceiling Dropper cannot spawn above a Bloom Hopper in the same column.
- Enemies do **not** respawn once killed — dead state persists for the current pod window.

All enemy drops land in the clone's **backpack** (not direct-banked). Full backpack: drops bounce to the nearest valid floor position as world items. Boundary drops use the nearest valid floor position to prevent items stuck in geometry. Pickup magnetism radius: 2.5 tiles.

### 6.8 Environmental Hazards (Sector 1)

| Hazard | Tile Token | Behavior | Notes |
|--------|-----------|----------|-------|
| **Spike Bramble** | H1 | Stationary; deals 1 HP on contact | iFrames from the triggering hit allow a recovery jump or wall-kick out of a bramble pit |
| **Crumbling Sandstone** | — | Breaks 0.5 s after standing contact; re-forms after 8 s | Requires movement across or a timed jump-chain |
| **Sandstorm Vent** | V1 | ±2 m/s horizontal impulse push while active; visual dust column | Cycles on/off with a clearly telegraphed timing window |

Shield Bubble absorbs all damage types including environmental hazards (1 hit, then pops — see §6.10 for visual states and recharge). Knockback into a Spike Bramble: existing iFrames remain active, giving the full 1.5 s window to escape.

### 6.9 Level Design Grammar

Levels are assembled from named chunk templates and validated before serving to the player.

**Chunk templates (Sector 1 — Rocky/Desert):**

| Template | Dimensions | Focus | Typical Enemies |
|----------|-----------|-------|-----------------|
| **A — Open Mining Cave** | 32 × 10 tiles | Horizontal, Biomineral-rich | Scrap Grubbers |
| **B — Vertical Shaft** | 10 × 30 tiles | Wall-kicks required for full traversal | Bloom Hoppers |
| **C — Choke Point Corridor** | Variable; 2-tile ceiling height | Tight space, limited dodge room | Ceiling Droppers |

**Tile spawn tokens:**

| Token | Meaning |
|-------|---------|
| E1 | Bloom Hopper spawn point |
| E2 | Scrap Grubber spawn point |
| E3 | Ceiling Dropper spawn point |
| H1 | Spike Bramble hazard tile |
| V1 | Sandstorm Vent |

**Flood-fill validation:** After assembly, a flood-fill runs from the Drop Pod tile to every resource node (deposits, caches). Any node unreachable without module-gated abilities (double jump, phase dash) causes the level to be rejected and a new one generated. This guarantees all resources are attainable by any starting loadout.

### 6.10 Damage Feedback & Death Sequence

**Per-hit feedback sequence:**

1. 0.05 s freeze-frame — iFrames begin here, blocking chain hits from adjacent hazards
2. 12-frame camera shake
3. 0.1 s red-flash screen overlay
4. Knockback: 4-tile horizontal impulse + 2-tile vertical lift
5. 0.20 s (12 frames) complete input lock
6. Sprite blinks at 10 Hz for the remainder of the 1.5 s iFrame window

**Death sequence (HP reaches 0):**

1. 1.5 s fade-to-black with pixel-collapse animation
2. Orbital Cloning Bay menu overlay appears
3. Backpack contents drop at the death point as a **corpse marker**
4. First re-print per planet visit is free; subsequent re-prints cost Scrap

**Corpse marker lifecycle:**
- **Single-instance rule:** a second death deletes the first marker; all its items are permanently lost.
- Pickup radius: 1.5 tiles. HUD shows a neon-green edge beacon when the marker is >10 tiles away.
- **Partial pickup:** if the backpack cannot hold everything, the marker persists with the remaining items.
- **Auto-nudge:** if an enemy overlaps the marker, it shifts 2 tiles horizontally.
- Persists across re-prints within the same pod window; vanishes when the pod launches to orbit.

**Shield Bubble visual states:** Ready (blue ring) · Popped (ripple + camera shake) · Charging (meter above clone's head). No passive recharge — standing still accumulates no charge.

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
