# Handoff — Slice 2.5: Enemy Roster (+ fun checkpoint)

**From:** Slice 2.4 session (2026-06-11)
**For:** the next session, starting cold. You have no memory of previous sessions — everything you need is linked here.

## Read first, in order

1. `CLAUDE.md` — the pre-session checklist is mandatory: orient → clarify → **plan file → user confirmation** → branch. No application code before the plan is confirmed.
2. `docs/roadmap.md` — you are building **Phase 2, Slice 2.5**: remaining archetypes (Carapace with regenerating armor + `strip-armor`, Sporecaster + Infestation cards), intents telegraphed in the UI. **Then the checkpoint: is the combat loop fun on its own? Tune before proceeding to Phase 3.**
3. `docs/work/2026-06-11-hyperspace-run.md` — what 2.4 built and deferred to you.
4. `docs/game-design.md` — §5.6 (Infestation cards: unplayable hand-clog injected mid-fight, possible on-draw effects, vanish when the encounter ends), §5.7 (Carapace: regenerating organic armor, needs sustained damage or piercing; Sporecaster: injects Infestations), §5.5 (turn structure the telegraph UI must respect).
5. `docs/decisions/001-stack-and-architecture.md` and `003-determinism-and-persistence.md`.

## Repo state when this was written

- `main` = Slices 1.1–2.3 merged. **The Slice 2.4 PR (`feature/hyperspace-run`) was just opened** — check its state first: if merged, branch from `main`; if still open, ask the user whether to wait or branch off it.
- 165 tests green. Playable in the browser: lanes chain automatically (travel `n/D` in the HUD, +1 per survived turn, engine cards on top), escape-by-arrival, malfunctions persist within a lane and clear on arrival, Anchormaw halts travel until killed or paid off.

## What 2.4 gives you

- **Lanes:** `sim/travel.ts` — `LaneState` (plain JSON, owned by `main.ts`, *not* in RunState), `createLane(run, enemyPool?)` rolls on the map-gen stream, `advanceLane` skips overshot encounter points. Combat receives a frozen `LaneContext` (`createCombat(run, enemyId, lane?)`); without one, fights behave like 2.3 (no tick, no escape) — most existing tests run lane-less.
- **`CombatOutcome` now includes `'escaped'`** (arrival *or* paid toll — lane progress discriminates; see `outcomeLabel` in `page.tsx`). `applyCombatResult` already skips victory-only rewards for it.
- **Anchor enemies are a trait** (`EnemyDef.anchor?: { tollScrap }`), not an intent kind. `isTravelAnchored` halts the passive tick and `travel` effects; `payToll`/`canPayToll` end the encounter as a negative `scrapGained` delta (`CombatState.scrapAtStart` frozen for affordability).
- **`?enemy=` dev knob** (alongside `?hull=`): forces every lane encounter to one enemy — your way to reach the Carapace/Sporecaster on demand. Quiet fallback on unknown ids.
- **Telegraph plumbing exists:** `RevealedIntent` in `combat-view.ts` (name/amount/hits/piercing/targetsModule), currently surfaced only when Deep Scan sets `modifiers.intentRevealed`. "Intents telegraphed in UI" (this slice) is the standing design call: probably make the *kind* of action always visible (StS-style) and keep exact numbers behind Deep Scan — decide in the plan, with the user.

## Gotchas (will cost you time if skipped)

- **Infestation cards will strain `CombatCard`** — every instance is `{ cardId, moduleIndex }` and `moduleIndex` indexes `CombatState.modules`; injected Infestations come from **no module**. Malfunction flipping derives from `moduleIndex` membership in `malfunctioning`, so a careless sentinel (e.g. `-1`) must never collide with that logic, and "unplayable" needs a first-class notion — `cardPlayCost`/`playCard` assume everything is playable. Design this in the plan, not mid-code.
- **"Vanish when the encounter ends" is free** — piles die with CombatState — but **on-draw effects** touch `drawCards`, which runs inside `endTurn` *and* mid-card (`draw` effects); keep it deterministic and re-entrant.
- **`strip-armor` throws today** (`applyEffect` in `sim/combat.ts`) — the Carapace's armor model decides what it does. Note: enemy-side piercing already exists; *player*-side piercing (`effect.piercing`) is recorded but indistinguishable from plain damage until armor exists — the Carapace makes it real.
- **Node 22 first:** `source ~/.nvm/nvm.sh && nvm use 22` before `pnpm install`/`test`/`git commit` — Husky/lint-staged break on Node 20. Each Bash call is a fresh shell.
- **Pushing 403s with the default gh account** (work account is active; repo belongs to `peteroomen`). Don't switch the global account — scope per command:
  - push: `git -c credential.helper= -c 'credential.helper=!f() { echo username=peteroomen; echo password=$(gh auth token --user peteroomen); }; f' push …`
  - gh: `GH_TOKEN=$(gh auth token --user peteroomen) gh pr create …`
- **Preview server cwd matters:** if a `dev` preview server is already running, check `preview_list` — one rooted in the main repo serves *main's* code, not your worktree. Stop and restart from the worktree.
- **Determinism:** anything random consumes `CombatState.rng` (in-fight) or the run streams — never a fresh stream mid-flow. The JSON-round-trip-between-every-action test is the canary. A browser "nondeterminism" sighting in 2.4 turned out to be a snapshot racing a `location.href` navigation — get node ground truth (scratch test) before chasing ghosts.
- **Mobile is tight:** three buttons already stack vertically below `sm:` (Pay Toll, innate, End Turn) and card text must stay short (see the `Field-repair` precedent). Measure anything new at 375px (`preview_resize` preset mobile).
- **The fun checkpoint is part of the slice:** budget session time for actually playing several full lanes and tuning numbers (all in `data/` — never in logic). Candidate knobs already flagged: wasted engine cards vs. an anchor feel bad (escape valve?), Anchormaw toll 5 vs. thin scrap economy, lane band 7–10.
- Write a handoff for Phase 3.1 (platformer core) at session end — and flag that it's a mode switch: `src/game/surface/` is untouched scaffolding.
