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
- [ ] **4.4 Events + discoveries** — Text event nodes, module modifiers (attach-to-module), Tinkerer encounter. *(⚠️ Hard dependency for deckbuilding feel — events are the primary mid-run module injection point. Prioritize alongside or before 4.3 if the deck variety problem persists after 4.6.)*
- [ ] **4.5 Save/resume** — Full RunState persistence at node boundaries, resume from main screen, abandon run.
- [ ] **4.6 Card keywords & deckbuilding depth** — Define and implement keyword vocabulary (Draw N, Discard-to-trigger, Retain, Exhaust, on-play, on-draw effects). Redesign/extend the module card catalog so each module's cards have distinct mechanical identity and interact with other cards. Audit starting deck size: consider fewer starting modules or more empty hull slots so each new acquisition is a bigger relative change. This is the deckbuilder's identity layer — arguably the most important feel problem to solve. *Coordinate with 4.3/4.4 on acquisition pacing.*

## Phase 5 — Act 1 Complete

- [ ] **5.1 Elite encounters** — Souped-up variants, better rewards.
- [ ] **5.2 Sector boss + gate** — Multi-phase Bloom gate-guardian, boss reward choice (Core Crystal / Mk II module / Blueprint cache), gate destruction.
- [ ] **5.3 Biomes 2–3** — Volcanic + Ice: hazards, tileset recolor pipeline driven by generated planet colors (`palette.ts`).
- [ ] **5.4 Meta shell** — Main menu, hull select, localStorage unlocks (hulls, modules, clone matrices), run summary screen, wreckage salvage node.
- [ ] **5.5 Act 1 balance pass** — Full 25–35 min Sector 1 playthrough tuning. **Checkpoint: the vertical slice — would you replay it?**
  - *Combat difficulty:* Space combat is currently too easy — enemy damage output and encounter pressure are too low. Tune enemy intent values, damage numbers, and encounter density before locking balance. Surface enemies arrive in 3.4 but space combat itself needs a separate pass.
  - *Travel card design (resolve before balancing):* Engine cards are dead draws during the sector boss fight (no lane distance to shorten). Options: (a) dual-mode Thruster cards with a secondary combat effect (weak shield, Draw 1, 1 AP refund on discard); (b) *Jettison* keyword — discard a travel card for a small benefit; (c) intentional tension, but only valid if the player had a real choice about installing Engine modules. See GDD §5.4. Resolve the design question here before tuning AP costs.

## Phase 6 — Identity & Feel

- [ ] **6.1 Visual identity pass** — Deep-Fold integration (planets, backgrounds, ship bases), Resurrect 64 palette lock, modular ship sprite with visible module slots.
- [ ] **6.2 SFX first pass** — jsfxr/ChipTone set; mechanical-vs-organic sound rule.
- [ ] **6.3 Adaptive music** — WebAudio bus, mode crossfade, placeholder tracks.
- [ ] **6.4 Mobile pass** — Touch control tuning, responsive layouts, performance on mid-range phones.
- [ ] **6.5 Seeded/daily runs** — Seed display + share URL, daily seed mode.
- [ ] **6.6 Card feel & juice pass** — Hand fan, hover-lift, play/discard/draw animations (Motion/FLIP), malfunction card-flip, screen shake, hit effects crossing DOM→Pixi. Baseline animations land with 2.2; this is the polish pass.
- [ ] **6.7 Workbench feel pass** — Drag-and-drop module slots, visible reactor connections, snap/install animations. FOUNDRY design language applied to the Workbench/outfitter screen so module management feels tactile and mechanical.

## Phase 7 — Platform

- [ ] **7.1 Supabase** — Auth + cloud saves (swap storage backend behind existing save interface).
- [ ] **7.2 Daily leaderboard** — Score model + daily seed board.

## Phase 8+ — Beyond Act 1 (unscoped)

Sectors 2–3 · remaining biomes (Jungle/Toxic, Ocean, Gas Moon) · final boss · ascension ladder · secret sector · pod-defense events · module specialization trees · full Clone Bay matrix roster · expanded events.
