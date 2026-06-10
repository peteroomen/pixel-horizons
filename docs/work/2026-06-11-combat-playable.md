# Combat Playable

**Date:** 2026-06-11
**Branch:** feature/combat-playable
**Roadmap item:** Phase 2 — Slice 2.2 Combat playable

## Goal

One full fight vs the Lamprey playable in the browser — DOM card hand, Pixi battle viewport, HUD — winnable and losable with touch or mouse on a phone.

## Approach

**The React↔game boundary lands this slice (`src/game/main.ts`).** `initGame(host, seed, callbacks)` creates the PixiJS Application inside the host element, owns the RunState + CombatState, and returns a command handle (`playCard`, `endTurn`, `nextFight`, `restartRun`, `destroy`). React components import only `@/game/main` (and its types) — never sim/data internals. Game→React communication is one `onCombatUpdate(view)` callback per event (card played, turn ended, fight over), never per frame; combat is turn-based so this is natural.

**View model is pure and testable (`src/game/combat-view.ts`).** `buildCombatView(combat)` projects `CombatState` into a render-ready `CombatView`: hand cards with derived rules text and affordability, AP, hull HP, shield layer states, enemy HP, telegraphed intent (hidden unless Deep Scan's `intentRevealed` — showing it for free would make Deep Scan a dead card; 2.5's "intents telegraphed in UI" can revisit), pile counts, outcome. Card rules text is generated from the `CardEffect` union — no hand-written strings to drift out of sync with data.

**`applyCombatResult(run, combat)` in `sim/combat.ts`** — the rng commit-back contract from the 2.1 handoff: when a fight ends, commit `combat.rng` → `run.rng.combat`, hull HP, and `scrapGained`. Throws on `outcome: 'ongoing'`. Unit-tested; consecutive fights continue the RNG stream instead of replaying it (proven by a test: two fights in sequence shuffle differently).

**Pixi battle viewport (`src/renderer/space-renderer.ts`)** — placeholder art: starfield backdrop, player ship (left) and Lamprey (right) as Graphics-built sprites, hit flash when either side loses HP, enemy fades on death. `createSpaceRenderer(app)` returns `{ sync(view), destroy() }`; `sync` is called once per event from `main.ts`. All HP/intent/AP numbers live in the DOM HUD, not the viewport.

**DOM combat UI** — `CombatHand.tsx` (tap/click a card to play it; unaffordable cards disabled and dimmed; CSS hover-lift only — Motion stays unused until the 6.6 juice pass), `HUD.tsx` (hull bar, shield pips with recharge countdowns, AP pips, enemy HP bar, intent telegraph, turn + pile counts, End Turn), outcome overlay with **Fight Again** (victory — commits results, next fight continues the run: hull damage persists, RNG stream advances) and **New Run** (defeat — fresh RunState, same seed). Pointer-agnostic events only (`onClick`); no hover-dependent functionality. Hull innate abilities are 2.3 — no dead buttons.

**Seed-in-URL wiring (deferred from 1.2, lands here):** the page reads `?seed=` via `parseSeedParam`; absent/invalid → generate a seed from `crypto.getRandomValues` (never `Math.random`) and write it into the URL with `history.replaceState` + `seedToSearchParam`, so every fight is shareable/reproducible. `SaveStore` wiring stays deferred — saves happen at node boundaries (ADR 003) and no node structure exists until 2.4/4.5.

**Default hull: Gunship** — weapon-rich starting deck, proven winnable vs the Lamprey in 2.1's scripted tests; the Scout's single Light Laser makes the first playable fight a slog.

**GameCanvas.tsx is refactored** from owning Pixi directly to a thin StrictMode-safe `initGame`/`destroy` lifecycle wrapper; the resize/integer-zoom logic moves into `main.ts` (unchanged `pixel-scale.ts` math).

Sim + view changes are small and test-only-consumable; the PR is mostly UI + renderer + boundary. Splitting `applyCombatResult` into its own PR would ship an untestable-in-browser stub — the 2.1 handoff explicitly assigns it to 2.2 as first caller.

## Steps

- [ ] Branch `feature/combat-playable` from `main`
- [ ] `sim/combat.ts`: `applyCombatResult` + tests (commit-back values; throws on ongoing; consecutive-fight RNG continuation)
- [ ] `src/game/combat-view.ts`: `CombatView` types, `buildCombatView`, effect→text formatter + tests
- [ ] `src/renderer/space-renderer.ts`: starfield, placeholder ships, hit flash, death fade
- [ ] `src/game/main.ts`: `initGame`/`GameHandle`/`GameCallbacks`, Pixi lifecycle + resize, command guards (never forward an illegal play to the engine)
- [ ] `src/components/GameCanvas.tsx`: refactor to `initGame` wrapper
- [ ] `src/components/CombatHand.tsx`, `src/components/HUD.tsx`
- [ ] `src/app/page.tsx`: seed from URL, compose canvas + HUD + hand + outcome overlay
- [ ] Post-session checklist: fill outcome sections, CLAUDE.md Current State, lint + type-check + test, commit, push, PR, handoff for 2.3

## Manual test steps

- [ ] `pnpm dev`, open `localhost:3000` — battle viewport renders (starfield, two ships), HUD shows hull 100, 2 shield pips (Gunship's Shield Generator), 3 AP, enemy Lamprey 22 HP, hand of 5
- [ ] Play Missile Salvo (2 AP) → enemy HP drops by 8, AP drops to 1, card leaves hand, enemy flashes in viewport
- [ ] End Turn → enemy acts (hull/shield reacts), AP resets to 3, hand refills to 5, turn increments
- [ ] Win a fight → VICTORY overlay; Fight Again → new fight, hull damage carried over, different opening shuffle (RNG stream advanced)
- [ ] Lose a fight (end turns without defending) → DEFEAT overlay; New Run → hull back to 100, same seed reproduces the same first shuffle
- [ ] Edge: unaffordable cards are dimmed and unclickable at 0–1 AP; clicking does nothing (no console error)
- [ ] Edge: `?seed=foo` reload reproduces the identical opening hand; invalid seed (`?seed=ALL!CAPS`) falls back to a generated seed written into the URL
- [ ] Phone-width viewport (DevTools 390px): hand cards reachable and tappable, HUD readable, End Turn reachable
- [ ] Deep Scan is not in the Gunship deck — intent shows hidden ("?") and no crash on intent display

## Out of scope for this session

- Hull innate abilities, malfunctions, module targeting (2.3)
- Lane structure / travel consumption — travel progress is displayed but unused (2.4)
- Other enemies, always-on intent telegraphs (2.5)
- Card animation polish — Motion stays unused (6.6)
- `SaveStore` page wiring (no node boundaries until 2.4/4.5)
- Retain-with-choice API (engine keeps leftmost; Gunship has no retain card)
- Enemy scrap rewards / economy (4.3) — only card-generated scrap is committed

---

<!-- Fill in below during/after the session -->

## What actually happened

Went to plan with one structural change and a few small UI fixes:

- **Seed resolution moved out of the page into `initGame`.** The original plan had the page read `?seed=` and hold it in React state, but `react-hooks/set-state-in-effect` (correctly) rejects sync `setState` in an effect for client-only values. Since main.ts is the browser-facing boundary anyway, `initGame` now resolves the seed (URL param → fallback to `crypto.getRandomValues`) and writes it back via `history.replaceState`. The page got simpler: no seed state, no effect; `GameHandle.seed` exposes it if the UI ever wants to display it.
- **Command guards are quiet no-ops, not throws.** The sim's loud-failure policy stands for programming errors, but a double-tap racing a state update is normal pointer input — `main.ts` checks affordability/outcome before forwarding to the sim.
- **Card layout fixes found by playing:** the AP badge needs `shrink-0` (long retro-font names squeezed it to invisible), and names need `[overflow-wrap:anywhere]` (the retro font is wide enough that "Reinforce" doesn't fit a card at 10px — mid-word wrap beats hidden text; 6.6 can do better).
- **Verified end-to-end in the browser (desktop + 375px mobile viewport):** full fight vs Lamprey, card play, AP gating (unaffordable cards dimmed/disabled), enemy phase (Feeding Frenzy eaten by both shield layers, recharge countdowns shown, Lash hitting bare hull), victory overlay → Fight Again (hull damage persisted, RNG stream advanced — visibly different shuffle), defeat overlay → New Run (same seed visibly reproduced the original opening hand). Console clean.
- 111 tests green (3 new `applyCombatResult`, 7 new combat-view). No new dependencies, no ADR needed — main.ts implements what ADR 001 already decided.
- `.claude/launch.json` added (dev-server launch config for in-session browser verification).

## Files created / modified

- `src/game/main.ts` — **new**: the React↔game boundary; `initGame`/`GameHandle`/`GameCallbacks`, Pixi lifecycle + integer-zoom resize, seed resolution, quiet command guards
- `src/game/combat-view.ts` + `combat-view.test.ts` — **new**: `CombatView` projection, effect→rules-text formatter
- `src/renderer/space-renderer.ts` — **new**: starfield, placeholder ships, hit flash, death fade, shield ring
- `src/components/CombatHand.tsx`, `src/components/HUD.tsx` — **new**: DOM card hand + combat HUD
- `src/components/GameCanvas.tsx` — refactored to a thin StrictMode-safe `initGame` wrapper (no more direct Pixi imports in React)
- `src/app/page.tsx` — combat screen composition + outcome overlay
- `src/game/sim/combat.ts` + `combat.test.ts` — `applyCombatResult` (the 2.1 rng commit-back contract)
- `.claude/launch.json`, `CLAUDE.md`, this file, handoff for 2.3

## Deferred to next session

- Hull innate abilities (2.3 per roadmap) — AP display only, no buttons rendered
- Malfunctions / module targeting / play-to-repair (2.3); `repair-all-modules` still a loud stub
- Travel progress is displayed in the HUD but consumed by nothing until lanes (2.4)
- `SaveStore` page wiring — no node boundaries to save at until 2.4/4.5
- Retain-with-choice API (engine keeps leftmost; no starting Gunship retain card to exercise it)
- Card animation polish — Motion still unused (6.6); current hover-lift is CSS-only
- Intent telegraph is hidden unless Deep Scan reveals it — 2.5's "intents telegraphed in UI" should decide whether base telegraphs become always-on (and what Deep Scan means then)
- Carried: physical-phone check of production URL; Mk II tier tracking (4.2)

## Status

- [ ] In progress
- [x] Complete
- [ ] Partial — see deferred
