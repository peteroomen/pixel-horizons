# Handoff — Slice 1.3: Data Catalog + Deck Generation

**From:** Slice 1.2 session (2026-06-10)
**For:** the next session, starting cold. You have no memory of previous sessions — everything you need is linked here.

## Read first, in order

1. `CLAUDE.md` — the pre-session checklist is mandatory: orient → clarify → **plan file → user confirmation** → branch. No application code before the plan is confirmed.
2. `docs/roadmap.md` — you are building **Phase 1, Slice 1.3**.
3. `docs/work/2026-06-10-sim-skeleton.md` — what Slice 1.2 built and deferred.
4. `docs/game-design.md` — §4.1 (hull table: starting modules per hull), §4.2 (module slot types + Clone Bay matrices table), §4.3 (reactor), §5.3 (deck construction rules), §5.4 (card axes), §5.8 (module catalog examples). The catalog you build must cover every module named in those sections.
5. `docs/decisions/003-determinism-and-persistence.md` — the determinism/RunState contract you must not break.

## Repo state when this was written

- `main` = Slice 1.1 scaffold only.
- **[PR #1](https://github.com/peteroomen/pixel-horizons/pull/1)** (`feature/sim-skeleton`, Slice 1.2) was open and unmerged. Check its state first: if merged, branch from `main`; if still open, ask the user whether to wait for the merge or branch off `feature/sim-skeleton`.
- Slice 1.2 gave you, all pure and tested (41 tests): `src/game/sim/rng.ts` (seeded PRNG, `deriveRng` sub-streams, serializable state), `src/game/sim/run-state.ts` (versioned `RunState`, null-on-invalid `deserializeRunState`), `src/game/save.ts` (`SaveStore` over injected storage), `src/game/sim/seed-url.ts`.

## Your slice (roadmap wording)

> **1.3 Data catalog + deck generation** — `data/` for hulls, modules, cards (GDD §4–5 catalog); module→deck generation in `deck.ts`. Vitest: each hull produces its documented starting deck. *Done = tests pass; catalog covers all GDD example modules.*

## Constraints that bind this slice

- **Data, not code:** definitions live in `src/game/data/`; card effects are declarative data that combat (Slice 2.1) will interpret later. Do **not** build the effect interpreter or any combat logic now — defining the effect-data shape is in scope, executing it is not.
- **Sim purity:** nothing in `src/game/` imports React/PixiJS/DOM. Deck generation in `src/game/sim/deck.ts` should be deterministic given a module list — if any randomness is ever needed, it comes from an injected `Rng` (shuffling belongs to combat, not deck generation).
- **Tunables live in data files** — no balance numbers hardcoded in logic.
- **IDs become real here:** `RunState.modules`/`hullId` are uninterpreted strings from 1.2 (`createRunState` defaults to placeholder `'hull-scout'`). Define the canonical id scheme in the catalog and align that default. If the `RunState` shape itself changes, bump `RUN_STATE_VERSION` (old saves invalidating is fine — ADR 003).
- Every hull's starting deck must match GDD §4.1's starting modules + §5.8 card contributions, plus the Standard Print Matrix card (§4.2) — those are the required tests.

## Required step for your PR (user instruction, 2026-06-10)

Add a handoff step to the **Post-Session Checklist** in `CLAUDE.md` as part of your PR, e.g.:

> - [ ] Write a handoff doc for the next slice at `docs/work/YYYY-MM-DD-handoff-{next-slice}.md` (state, pointers, gotchas — assume the reader starts cold)

…and write such a handoff for Slice 2.1 at the end of your session.

## Gotchas (will cost you time if skipped)

- **Node 22 first:** `source ~/.nvm/nvm.sh && nvm use 22` before `pnpm install`/`test`/`git commit` — Husky/lint-staged break on Node 20. Each Bash call is a fresh shell.
- **Fresh worktrees need `pnpm install`** — `node_modules` isn't shared from the main checkout.
- **Pushing 403s with the default gh account** (work account is active; repo belongs to `peteroomen`). Don't switch the global account — scope the token per command:
  - push: `git -c credential.helper= -c 'credential.helper=!f() { echo username=peteroomen; echo password=$(gh auth token --user peteroomen); }; f' push …`
  - gh: `GH_TOKEN=$(gh auth token --user peteroomen) gh pr create …`
- `pnpm lint` is `eslint src` (`next lint` is gone in Next 16); `docs/` is deliberately in `.prettierignore`.
