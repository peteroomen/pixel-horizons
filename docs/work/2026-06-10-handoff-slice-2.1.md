# Handoff — Slice 2.1: Combat Engine (sim only)

**From:** Slice 1.3 session (2026-06-10)
**For:** the next session, starting cold. You have no memory of previous sessions — everything you need is linked here.

## Read first, in order

1. `CLAUDE.md` — the pre-session checklist is mandatory: orient → clarify → **plan file → user confirmation** → branch. No application code before the plan is confirmed.
2. `docs/roadmap.md` — you are building **Phase 2, Slice 2.1**.
3. `docs/work/2026-06-10-data-catalog.md` — what Slice 1.3 built and deferred.
4. `docs/game-design.md` — §4.1 (innate abilities), §4.3 (reactor = AP), §5.2 (ship health model: hull HP, hit-based shield layers, piercing, module damage), §5.4 (card axes), §5.5 (turn structure — this is your spec), §5.6 (malfunctions/infestations — *not* this slice, but the effect shapes must not paint it into a corner), §5.7 (enemy design — Lamprey is the scripted-fight enemy).
5. `docs/decisions/003-determinism-and-persistence.md` — RNG sub-streams; combat consumes the `combat` stream.

## Repo state when this was written

- `main` = Slices 1.1 + 1.2 merged.
- **PR #2** (`feature/data-catalog`, Slice 1.3) just opened. Check its state first: if merged, branch from `main`; if still open, ask the user whether to wait or branch off `feature/data-catalog`.
- You now have, all pure and tested (61 tests):
  - `src/game/data/` — 4 hulls, 16 modules (incl. 5 clone-bay matrices), 30 cards. `getCard`/`getModule`/`getHull` throw on unknown ids. `CardEffect` is a declarative discriminated union (`damage` with optional `piercing`, `travel`, `restore-shield-layer`, `temp-shield-layer`, `dodge-chance`, `untargetable`, `buff-next-attack`, `amplify-next-attack`, `debuff-target-vulnerable`, `strip-armor`, `reveal-intent`, `draw`, `gain-scrap`, `retain-cards`, `repair-all-modules`). **Your job is the interpreter for these** — at minimum the ones the roadmap names (damage/shield/travel); decide explicitly which others are in scope and stub the rest loudly.
  - `src/game/sim/deck.ts` — `generateDeck(moduleIds): CardId[]`, Mk I only, unshuffled. **Shuffling is yours**, via the combat RNG stream.
  - `src/game/sim/rng.ts` — `createRng`/`deriveRng`; `RunState.rng.combat` holds the serializable combat stream state.
  - `src/game/sim/run-state.ts` — `RunState.modules` is still `[]` after `createRunState`; **wiring starting modules in is deferred to you** (first consumer). Decide: `createRunState` taking hull data vs. run-state importing `data/`. If RunState's shape changes, bump `RUN_STATE_VERSION` (old saves invalidating is fine — ADR 003).

## Your slice (roadmap wording)

> **2.1 Combat engine (sim only)** — Turn loop in `combat.ts`: draw 5, AP spend, card effects (damage/shield/travel as data-interpreted effects), shield layers + recharge, piercing, enemy intent, hull HP, win/lose. Vitest: scripted fights resolve deterministically. *No rendering.*

## Constraints that bind this slice

- **Sim purity:** `src/game/sim/combat.ts` imports nothing from React/PixiJS/DOM. All randomness from the injected combat `Rng` — never `Math.random`.
- **Cards are data, interpreted:** never hardcode a card effect inline in combat logic. Enemy definitions (Lamprey at minimum: low HP, high damage, intents) belong in `src/game/data/`, not in combat code — tunables live in data files.
- **Turn structure is GDD §5.5:** draw 5 (fixed hand), spend AP (3 baseline), unplayed cards discard, enemy acts, shuffle discard into draw pile when empty.
- **One slice, sim only:** no rendering, no React, no `main.ts` wiring (that's 2.2). Malfunctions (2.3) and travel/lanes (2.4) are out of scope — but `damage` effects already carry `piercing`, and §5.2 says shields absorb module-hits too, so keep the resolution path malfunction-extensible.
- **Determinism is the test:** same seed + same scripted plays ⇒ identical fight outcome, asserted in Vitest. Combat must consume only the `combat` RNG stream so it can't desync map-gen/surface (ADR 003).

## Gotchas (will cost you time if skipped)

- **Node 22 first:** `source ~/.nvm/nvm.sh && nvm use 22` before `pnpm install`/`test`/`git commit` — Husky/lint-staged break on Node 20. Each Bash call is a fresh shell.
- **Fresh worktrees need `pnpm install`** — `node_modules` isn't shared from the main checkout.
- **Pushing 403s with the default gh account** (work account is active; repo belongs to `peteroomen`). Don't switch the global account — scope the token per command:
  - push: `git -c credential.helper= -c 'credential.helper=!f() { echo username=peteroomen; echo password=$(gh auth token --user peteroomen); }; f' push …`
  - gh: `GH_TOKEN=$(gh auth token --user peteroomen) gh pr create …`
- `pnpm lint` is `eslint src` (`next lint` is gone in Next 16); `docs/` is deliberately in `.prettierignore`.
- Some `CardEffect` kinds are easy to misread: `card-cannon-burst` has **two** `damage` effects (two hits — each interacts with shield layers separately); `buff-next-attack` is flat, `amplify-next-attack` is a multiplier; `card-boarding-clone` is just piercing damage.
- Write a handoff for Slice 2.2 at session end (now a standing Post-Session Checklist item in `CLAUDE.md`).
