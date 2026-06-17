# Pixel Horizons — Roadmap

> Source of truth for build order. One slice = one plan file = one branch = one PR = one session.
> Slices are scoped to be completable (including manual testing) in a single session.
> Design reference: `docs/game-design.md` (GDD v0.2). Architecture: `docs/decisions/`.

**Guiding sequence:** prove the space combat loop first (it's the bigger design risk), then the platformer, then connect them into the run loop, then complete Act 1 (Sector 1), then identity/polish, then platform features. Sectors 2–3, ascension, and the secret sector come after Act 1 is fun.

---

## Phase 0 — Design ✅

- [x] 0.1 GDD v0.2 (`docs/game-design.md`)
- [x] 0.2 Architecture ADRs 001–002, roadmap, repo init

---

## Phase 1 — Foundation

- [ ] **1.1 Scaffold** — Next.js 16 + TS strict + Tailwind v4 + 8bitcn/ui + PixiJS v8 + Vitest + Husky/lint-staged. Pixel-perfect canvas test scene (integer scaling, nearest-neighbor, letterbox). Deploy to Vercel. *Done = test scene renders crisply on desktop + phone, CI green.*
- [ ] **1.2 Sim skeleton** — Seeded PRNG (`rng.ts`), `RunState` type + serialize/deserialize, localStorage save/load, seed-in-URL parsing. Vitest: same seed ⇒ identical state streams. *Done = tests pass; no UI.*
- [ ] **1.3 Data catalog + deck generation** — `data/` for hulls, modules, cards (GDD §4–5 catalog); module→deck generation in `deck.ts`. Vitest: each hull produces its documented starting deck. *Done = tests pass; catalog covers all GDD example modules.*

## Phase 2 — Space Combat Vertical (the design-risk slice)

- [ ] **2.1 Combat engine (sim only)** — Turn loop in `combat.ts`: draw 5, AP spend, card effects (damage/shield/travel as data-interpreted effects), shield layers + recharge, piercing, enemy intent, hull HP, win/lose. Vitest: scripted fights resolve deterministically. *No rendering.*
- [ ] **2.2 Combat playable** — React card hand (DOM) + Pixi battle viewport + HUD. One full fight vs. Lamprey with placeholder art, playable in browser, touch + mouse. *Done = a stranger can win/lose a fight on a phone.*
- [ ] **2.3 Malfunctions** — Module targeting, card flipping, play-to-repair, hull-innate abilities. Parasite enemy (targets best module) to exercise it.
  > **⚠️ Repair fix (post-playtest):** Repair is per-card, not per-module — playing one Malfunction card repairs only that card's slot, not the whole module. A module contributing 3 cards produces 3 Malfunction cards; all three must be played to fully restore it. This makes malfunctions a genuine multi-turn AP tax: fight or repair, not both.
- [ ] **2.4 Hyperspace run** — Lane distance in turns, travel-progress cards, encounter triggers along the lane, escape-by-arrival, malfunctions persisting within a lane and clearing on arrival. Anchormaw (halts progress).
- [ ] **2.5 Enemy roster** — Remaining archetypes (Carapace, Sporecaster + Infestation cards), intents telegraphed in UI. **Checkpoint: is the combat loop fun on its own? Tune before proceeding.**

## Phase 3 — Surface Vertical

- [ ] **3.1 Platformer core** — Fixed-timestep loop, AABB physics, run/jump/melee, tilemap collision + render (one hand-made Rocky test level). Keyboard + touch controls.
- [ ] **3.2 Mining + drop pod** — Deposits, backpack, deposit-at-pod, pod timer + auto-launch, miss-the-window consequence.
- [ ] **3.3 Module item projection** — Items derived from installed ship modules (double jump, phase dash, scanner, shield bubble…), reactor item cap. *This is the slice where the north star becomes real — test with multiple loadouts.*
- [ ] **3.4 Clone death + hazards** — Death/backpack drop/corpse run, free first print + Scrap re-prints, basic surface enemies + Rocky-biome hazards. *Design complete — see GDD §6.3, §6.7–6.10.*

## Phase 4 — The Run Loop

- [ ] **4.1 Sector map** — Seeded map-gen (branching nodes, lane modifiers), map screen, path choice, node entry → correct mode.
- [ ] **4.2 Workbench** — Install/swap/craft modules, deck regenerates next combat, blueprint + resource costs.
- [ ] **4.3 Shops + economy** — Merchant and Engineer nodes, hull repair for Scrap, module purchases, sell resources, minimum-Scrap drops.
- [x] **4.4 Events + discoveries** — Text event nodes, module modifiers (attach-to-module), Tinkerer encounter. *(Shipped in THE ARSENAL, mega-slice 4.)*
- [ ] **4.5 Save/resume** — Full RunState persistence at node boundaries, resume from main screen, abandon run.
- [x] **4.6 Card keywords & deckbuilding depth** — Keyword vocabulary (Draw, Retain, Jettison, Discard, Exhaust, Cleave, on-play, on-draw) + signature keyword per module slot; per-card malfunction repair fix; travel-card-at-boss fix. *(Shipped in THE ARSENAL, mega-slice 4.)* **Deferred:** the starting-deck-size audit (A5) and `starts-in-hand` modifier — now folded into **4.9** below.
- [ ] **4.7 Powers & status effects** *(from PR #13 playtest, feedback #2)* — STS-style stacking statuses: persistent buffs/debuffs with stack-count and/or duration semantics, carried across turns, rendered as a **status strip on the ship and on the enemy/organ plates** with **tooltips that explain each status and keyword**. Rebalances the current flat-buff cards, which playtested as overpowered (they stack with no cost): the **next-attack +damage cards Exhaust** (one-shot spike, not spammable), and the blanket "+N from every hit" card becomes a **targeted "skill"** — Exhaust + apply a debuff to a **chosen enemy organ/ship** (reuses the §5.4 target selection from mega-slice 4) rather than a free blanket. Design the status model in the GDD (§5.10, to be written) before building. *The combat-identity slice the keyword pass (4.6) sets up.*
- [ ] **4.8 Station UX & workbench access** *(from PR #13 playtest, feedback #3 + #7)* — Make module management legible and reachable. **Workbench accessible from Merchant/Engineer nodes** (today it's a separate node only). **Module-management UX:** what's equipped and in which slot, slots used / free / required for a candidate module, **module + generated-card comparisons** before buying/swapping, and **tooltips on keywords/mechanics**. Generalize the buy-block reason shipped in PR #13 (NEED SLOT / NEED SCRAP) into the full slot picture. *FOUNDRY design language; the tactile drag-and-drop polish stays in 6.7.*
- [ ] **4.9 Deckbuilding acquisition & starting-deck audit** — *(⚠️ Playtest 2026-06-15: keywords landed but the deckbuilding juice is still missing.)* Two confirmed changes: **(a) start runs with fewer installed modules** so each acquisition is a bigger relative change to both the deck and the ship silhouette; **(b) make more modules flow as rewards** — shops, events, elites, and the boss should hand out modules often enough that the deck visibly grows across a run. Re-audit acquisition pacing end to end. Absorbs the A5 starting-loadout audit deferred from 4.6. Coordinate with 4.2 workbench, 4.3 shops, 4.4 events, 5.1 elites, and 5.5 balance.
- [ ] **4.10 Shop restock rules & toll removal** *(playtest 2026-06-16)* — Two economy fixes:
  - **Buy duplicates of modules you already own** — owning a module no longer greys it out in the shop; you can re-buy it to get more copies of its cards. But **each shop carries 1 stock per component** — buying a module removes it from that shop's inventory (no buying multiples of the same offer). Today `station-view.ts` greys out owned modules (`owned` flag) and `shop-inventory.ts` has no purchased-stock tracking — drop the owned-gate, add per-shop "sold out" state. Coordinate with the just-shipped buy-without-slot → cargo economy slice (`docs/work/2026-06-16-economy-shield-slot.md`).
  - **Remove the pay-toll mechanic** — the Anchormaw Scrap toll playtested as unwanted; anchor enemies must be **killed**, not bought off. Remove `payToll`/`canPayToll` across `sim/combat.ts`, `combat-view.ts`, `modes/combat-mode.ts`, `main.ts`, `page.tsx`, and the `TOLL PAID` state. ⚠️ **Contradicts GDD §5.7 / §5.1** (the toll is documented as "the counter to engine builds") — resolve that design note first: anchor stays a hard wall the player must defeat, and the engine-build counter is re-justified (or dropped).
- [ ] **4.11 Travel impact & depth difficulty** *(playtest 2026-06-16)* — Travel currently lacks impact/visibility. Two parts:
  - **Lane progress bar** at the top of the combat screen during hyperspace runs — distance travelled vs lane length, advancing on each travel/engine card so the player *sees* travel paying off. (Progress is sim-tracked today but barely surfaced.)
  - **Harder enemies deeper into the run** so travel's risk/escape-by-arrival actually matters and pure-combat builds feel the pressure. Add a **depth/sector difficulty axis** — `encounterCount` is the only danger lever today. Coordinate with 5.5 balance and 5.1 elites.
- [ ] **4.12 Custom ship builder (dev loadout tool)** *(playtest 2026-06-16)* — A start-of-run builder: pick a **hull**, then any combination of **modules / upgrades**, and launch. Primary purpose now is **dev/test** (replaces the `?hull=`/`?modules=` URL knobs with a real screen) but it doubles as forcing-function for the module **information screens** — what each module does, the cards it generates, slot usage, comparisons — extending the 4.8 station-UX legibility work. Precursor to the 5.4 hull-select meta shell (which gates by unlocks); this version is unrestricted for testing.
- [ ] **4.13 Playtest quick-wins bundle** *(playtest 2026-06-16)* — One small PR pulling the cheap, independent pieces of 4.10/4.11/6.8 forward so the playtest pain points land fast, leaving the bigger work in their home slices. Scope:
  - **Buy duplicates / 1 stock per shop** (from 4.10) — drop the owned-module grey-out, add per-shop sold-out tracking.
  - **Remove the pay-toll mechanic** (from 4.10) — see the GDD §5.7 note; reversible.
  - **Lane progress bar** (from 4.11) — surface travel distance at the top of the combat screen. *(Depth difficulty stays in 4.11.)*
  - **Card legibility** (from 6.8) — louder card title, card types, consistent card width. *(Full card layout/conveyor-belt rework stays in 6.8.)*

## Phase 5 — Act 1 Complete

- [ ] **5.1 Elite encounters** — Souped-up variants, better rewards. Elites can grow targetable organs (the seam exists from mega-slice 4) + an elite-lane modifier weight.
- [ ] **5.x Multi-enemy encounters & lane danger** — Face 2+ Bloom organisms in one encounter for variety/difficulty. ⚠️ **Contradicts the current GDD commitment** (§5.1/§5.7: "single-enemy fights only — no fleet battles") — resolve that design tension first. The boss-organ work (mega-slice 4) deliberately seeded the multi-target combat UI (target selection, multiple HP bars, Cleave) this would reuse, so it is a natural follow-on, not a rewrite. Also covers richer per-lane encounter sequencing (infested/elite lanes).
- [ ] **5.2 Sector boss + gate** — Multi-phase Bloom gate-guardian, boss reward choice (Core Crystal / Mk II module / Blueprint cache), gate destruction.
  - *Boss difficulty (PR #13 playtest, feedback #1/#5):* the Gatemaw was beaten on a first attempt — it's too easy. Tune boss HP / armor / intent damage and the phase-2 escalation in the 5.5 pass. (Two boss bugs are already fixed in PR #13: the boss was leaking into random lane encounters via the default enemy pool — now excluded via the `boss` flag — and the dedicated gate fight is a single encounter, not a repeating one.)
- [ ] **5.3 Biomes 2–3** — Volcanic + Ice: hazards, tileset recolor pipeline driven by generated planet colors (`palette.ts`). *(Per ADR 010, planets are runtime-generated and `palette.ts` owns the Resurrect 64 ramps fed to the shaders — the surface recolor reads the same ramp the planet was generated from, a direct read rather than sampling an exported sprite.)*
- [ ] **5.4 Meta shell** — Main menu, hull select, localStorage unlocks (hulls, modules, clone matrices), run summary screen, wreckage salvage node.
- [ ] **5.5 Act 1 balance pass** — Full 25–35 min Sector 1 playthrough tuning. **Checkpoint: the vertical slice — would you replay it?**
  - *Combat difficulty:* Space combat is currently too easy — enemy damage output and encounter pressure are too low (reconfirmed in the PR #13 playtest, including a first-try boss kill). Tune enemy intent values, damage numbers, encounter density, and the boss (§5.2) before locking balance. Surface enemies arrive in 3.4 but space combat itself needs a separate pass.
  - *Buff/debuff economy (depends on 4.7):* the flat next-attack-+damage cards playtested as overpowered because they stack for free; 4.7 makes them Exhaust and turns blanket debuffs into targeted skills. Tune the numbers once that lands.
  - *Travel card design (resolve before balancing):* Engine cards are dead draws during the sector boss fight (no lane distance to shorten). Options: (a) dual-mode Thruster cards with a secondary combat effect (weak shield, Draw 1, 1 AP refund on discard); (b) *Jettison* keyword — discard a travel card for a small benefit; (c) intentional tension, but only valid if the player had a real choice about installing Engine modules. See GDD §5.4. Resolve the design question here before tuning AP costs.

## Phase 6 — Identity & Feel

- [ ] **6.1 Visual identity pass** — Deep-Fold integration (planets, backgrounds, ship bases), Resurrect 64 palette lock, modular ship sprite with visible module slots. *(Combat-screen world-art shipped — `docs/work/2026-06-15-world-art-direction.md` / `docs/design/foundry-world-art-direction.dc.html`.)* **Planets are now RUNTIME-generated** via ported Deep-Fold GLSL through PixiJS v8 — not a pre-exported sprite pool (ADR 010 supersedes ADR 002 on this; feasibility spike done: `docs/work/2026-06-16-planet-shader-spike.md`). First slice planned: `docs/work/2026-06-16-6.1-runtime-planets.md` (generation + deterministic run integration + `palette.ts` R64 ramps; surface-recolor/backdrops/more-types are follow-on slices).
  - **Boss maw redesign (future design pass):** the Anchormaw's mouth currently reads as too rectangular and isn't integrated into the organic body — it needs to look like a real maw fused to the mass. Round it to follow the blob silhouette, give it lips/curved lattice teeth and the wet-rim selout that the rest of the body uses, so it reads as part of the creature rather than a stamped box. Extends to the Mawling grunt's maw. *(Surfaced from World Art Direction playtest, 2026-06-15.)*
- [ ] **6.2 SFX first pass** — jsfxr/ChipTone set; mechanical-vs-organic sound rule.
- [ ] **6.3 Adaptive music** — WebAudio bus, mode crossfade, placeholder tracks.
- [ ] **6.4 Mobile pass** — Touch control tuning, responsive layouts, performance on mid-range phones.
- [ ] **6.5 Seeded/daily runs** — Seed display + share URL, daily seed mode.
- [ ] **6.6 Game feel & juice pass** — *(⚠️ Playtest 2026-06-15: the game feels not tactile/engaging — pull a first juice slice forward, ahead of the rest of Phase 6.)* Beyond cards: hand fan, hover-lift, play/discard/draw animations (Motion/FLIP), malfunction card-flip, screen shake, hit effects crossing DOM→Pixi — **plus weighty feedback on every action**: card-play impact (recoil/punch), floating damage numbers, enemy hit reactions, AP/shield pip pops, and SFX hooks (coordinate with 6.2). The goal is that every tap feels like it lands. Baseline animations land with 2.2; this is where the loop gets its crunch.
- [ ] **6.7 Workbench feel pass** — Drag-and-drop module slots, visible reactor connections, snap/install animations. FOUNDRY design language applied to the Workbench/outfitter screen so module management feels tactile and mechanical.
- [ ] **6.8 Card design pass** *(playtest 2026-06-16)* — Cards need a dedicated visual/layout design session. **Quick wins that can ship early (don't need the full session):** (a) **louder card title** — stronger type hierarchy so the name reads at a glance; (b) **card types** — a visible category per card (e.g. Attack / Skill / Power, building on the 4.6 keyword + 4.7 skill/Exhaust vocabulary); (c) **consistent card width** — uniform footprint so the hand reads as a clean row. **Full session:** complete card layout/hierarchy rework and explore the **conveyor-belt hand** presentation. Coordinate with the 6.6 juice pass (hand fan, hover-lift, play/draw animations).

## Phase 7 — Platform

- [ ] **7.1 Supabase** — Auth + cloud saves (swap storage backend behind existing save interface).
- [ ] **7.2 Daily leaderboard** — Score model + daily seed board.

## Phase 8+ — Beyond Act 1 (unscoped)

Sectors 2–3 · remaining biomes (Jungle/Toxic, Ocean, Gas Moon) · final boss · ascension ladder · secret sector · pod-defense events · module specialization trees · full Clone Bay matrix roster · expanded events.
