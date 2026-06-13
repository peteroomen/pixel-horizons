# Handoff → Slice 1.2 (Sim skeleton)

Written 2026-06-10 at the end of the Slice 1.1 (scaffold) session, for a fresh session with no prior context.

## Start here

Repo: `~/personal/pixel-horizons`. Read `CLAUDE.md` first and follow its **pre-session checklist** — orient (roadmap, latest work log), write a plan file to `docs/work/`, get it confirmed, then branch. Slice 1.1's plan was pre-approved; **yours is not** — do not skip the confirmation step.

## The task

Roadmap Phase 1, Slice 1.2 — Sim skeleton (`docs/roadmap.md` line 21):

> Seeded PRNG (`rng.ts`), `RunState` type + serialize/deserialize, localStorage save/load, seed-in-URL parsing. Vitest: same seed ⇒ identical state streams. _Done = tests pass; no UI._

All of it lives in `src/game/sim/` (currently just a `.gitkeep`). Relevant constraints from CLAUDE.md and ADR 001 (`docs/decisions/001-stack-and-architecture.md`):

- `src/game/sim/` imports nothing from React, PixiJS, or the DOM — pure, unit-testable functions only. localStorage access therefore needs a seam (e.g. sim exposes serialize/deserialize; the storage call sits outside the sim).
- ALL randomness flows through the seeded PRNG. `Math.random` is banned project-wide.
- RunState is the single source of truth and serializes to plain JSON; the seed lives in the URL; save includes the RNG cursor so a resumed run continues identically.

## Process rules that bit nobody yet (keep it that way)

- **This slice goes on a branch + PR.** The scaffold used up the one permitted direct-to-main commit. `git checkout -b feature/sim-skeleton` (or similar).
- Git identity: commit as the personal account — repo-local config is already set (`petertheoomen@gmail.com`). Push with `git push "https://$(gh auth token -u peteroomen)@github.com/peteroomen/pixel-horizons.git" <branch>` — the *active* `gh` account is the work one; don't switch it, and create the PR with `gh --repo peteroomen/pixel-horizons` plus `GH_TOKEN=$(gh auth token -u peteroomen)` if needed.
- Node: `nvm use 22` (or prefix `PATH="$HOME/.nvm/versions/node/v22.14.0/bin:$PATH"`) before `pnpm install`, `pnpm dev`, and **`git commit`** — the default Node 20 breaks the Husky/lint-staged hook.
- Don't bypass hooks (`--no-verify` is banned). The pre-commit hook works — it was tested.

## State as of end of 1.1

- Everything green: `pnpm lint` (= `eslint src`), `pnpm type-check`, `pnpm test` (3 scaler tests), `pnpm build`.
- Deployed at https://pixel-horizons.vercel.app, GitHub-connected — your PR will get a preview deploy automatically. Per-deployment `*-peter-oomens-projects.vercel.app` URLs 401 behind Vercel Authentication; that's expected, not a regression.
- Vitest is configured (`vitest.config.ts`, node environment, `src/**/*.test.ts`, `@` alias). Pattern example: `src/renderer/pixel-scale.test.ts`.
- `docs/` is in `.prettierignore` deliberately — don't reformat the hand-written docs.
- Full 1.1 outcome notes: `docs/work/2026-06-10-scaffold.md`.

## Deferred from 1.1 (not yours unless asked, but be aware)

- Physical-phone check of the production URL (emulated viewports only so far).
- Moving-sprite smoothness check by eye.
- `motion` is installed but intentionally unused until the card-feel slice.
