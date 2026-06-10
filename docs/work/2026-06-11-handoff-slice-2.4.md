# Handoff — Slice 2.4: Hyperspace Run

**From:** Slice 2.3 session (2026-06-11)
**For:** the next session, starting cold. You have no memory of previous sessions — everything you need is linked here.

## Read first, in order

1. `CLAUDE.md` — the pre-session checklist is mandatory: orient → clarify → **plan file → user confirmation** → branch. No application code before the plan is confirmed.
2. `docs/roadmap.md` — you are building **Phase 2, Slice 2.4**: lane distance in turns, travel-progress cards, encounter triggers along the lane, escape-by-arrival, malfunctions persisting within a lane and clearing on arrival. Anchormaw (halts progress).
3. `docs/work/2026-06-11-malfunctions.md` — what 2.3 built and deferred to you.
4. `docs/game-design.md` — §5.1 (hyperspace runs: lanes measured in turns, multi-encounter lanes, escape-by-arrival), §5.6 (malfunctions auto-clear when the hyperspace run ends — *not* per fight), §5.7 (Anchormaw: latches onto the lane, travel halted until killed or paid a Scrap toll), §7.3 (lane modifiers — data shape worth keeping in mind, building them is 4.1).
5. `docs/decisions/001-stack-and-architecture.md` and `003-determinism-and-persistence.md`.

## Repo state when this was written

- `main` = Slices 1.1–2.2 merged. **The Slice 2.3 PR (`feature/malfunctions`) was just opened** — check its state first: if merged, branch from `main`; if still open, ask the user whether to wait or branch off it.
- 142 tests green. Playable in the browser: Gunship vs Lamprey then Parasite (roster cycling), malfunctions + repairs, all four hull innates (`?hull=` knob).

## What 2.3 gives you

- **Card instances:** piles are `CombatCard { cardId, moduleIndex }[]` (`sim/deck.ts` — `generateCombatDeck`). `moduleIndex` indexes `CombatState.modules` (the run module list frozen at combat start). Malfunction flipping is **derived** via `isCardMalfunctioning` — never stored in the pile.
- **`CombatState.malfunctioning: number[]`** — module indices. Created empty by `createCombat` and currently *dies with the fight*. **Your headline sim change:** persistence within a lane — carry it across encounters (probably `createCombat` taking initial malfunctions + `applyCombatResult` exposing them, or a lane-scoped struct owning both) and clear it on arrival (GDD §5.6: "arrival in realspace = systems reset").
- **`resolveIncomingHit(state, rng, amount, piercing, moduleTargeting?)`** — single funnel for enemy damage; module hits already flow through it.
- **`EnemyIntentDef`** is now a union (`attack` | `attack-module`) — add an anchor/halt-travel kind for the Anchormaw; the exhaustive switch in `resolveEnemyIntent` will force you to handle it. The Scrap-toll alternative ("pay to unlatch") needs a player command — there is no precedent for non-card combat actions besides `activateInnate`; consider modeling the toll as part of the travel/lane layer rather than a combat card.
- **`CombatState.travelProgress`** — bare accumulating counter, displayed in the HUD, consumed by nothing. Lane distance/escape-by-arrival is yours; decide whether the lane lives inside CombatState or above it (RunState knows `position`, ADR 003 wants saves at node boundaries).
- **Hull innates:** `activateInnate`/`canUseInnate` in `sim/combat.ts`; data-interpreted via `InnateAbility.uses` + `effect` union. (Named activate- because a bare `useX()` call trips `react-hooks/rules-of-hooks` at main.ts call sites.)
- **Enemy selection placeholder:** `main.ts` cycles `ENEMY_DEFS` per fight (`nextFight`). Replace with lane-driven encounter triggers; the Parasite must stay reachable.
- **`seedToSearchParam(seed, currentSearch)`** preserves unrelated URL params (the `?hull=` dev knob relies on this — don't regress it).

## Gotchas (will cost you time if skipped)

- **Node 22 first:** `source ~/.nvm/nvm.sh && nvm use 22` before `pnpm install`/`test`/`git commit` — Husky/lint-staged break on Node 20. Each Bash call is a fresh shell.
- **Pushing 403s with the default gh account** (work account is active; repo belongs to `peteroomen`). Don't switch the global account — scope per command:
  - push: `git -c credential.helper= -c 'credential.helper=!f() { echo username=peteroomen; echo password=$(gh auth token --user peteroomen); }; f' push …`
  - gh: `GH_TOKEN=$(gh auth token --user peteroomen) gh pr create …`
- `.claude/launch.json` defines a `dev` server config — the preview tooling can start/screenshot the app (used heavily in 2.2/2.3; cheaper than guessing at layout).
- **Determinism tests will catch you:** anything random (encounter triggers along a lane) must consume the combat RNG stream via `CombatState.rng` / `RunState.rng`, never a fresh stream mid-flow. The "survives a JSON round-trip between every action" test is the canary.
- **Mobile layout is tight:** the HUD bottom row stacks buttons vertically below `sm:`; the retro font is ~50% wider than you expect. Anything you add to the HUD, measure at 375px before calling it done (preview_resize preset `mobile`).
- The repair-card rules text is deliberately short (`Field-repair`) — long text made flipped cards taller than the hand row and overlapped the buttons on phones. Same constraint applies to any new card text.
- Intent telegraphs stay hidden unless Deep Scan reveals them; if the Anchormaw's latch needs to be *visible* to be counterplayable (probably yes — a halt you can't see is just a stat drain), that's a design call to make in the plan, not silently.
- Write a handoff for Slice 2.5 at session end (standing Post-Session Checklist item in `CLAUDE.md`).
