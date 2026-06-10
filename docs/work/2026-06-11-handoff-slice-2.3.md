# Handoff — Slice 2.3: Malfunctions

**From:** Slice 2.2 session (2026-06-11)
**For:** the next session, starting cold. You have no memory of previous sessions — everything you need is linked here.

## Read first, in order

1. `CLAUDE.md` — the pre-session checklist is mandatory: orient → clarify → **plan file → user confirmation** → branch. No application code before the plan is confirmed.
2. `docs/roadmap.md` — you are building **Phase 2, Slice 2.3**: module targeting, card flipping, play-to-repair, hull-innate abilities, Parasite enemy.
3. `docs/work/2026-06-11-combat-playable.md` — what 2.2 built and deferred to you.
4. `docs/game-design.md` — §5.6 (malfunctions: hit module → its cards flip to playable repair cards; play = repair, free in currency, expensive in tempo; auto-clear at lane end), §5.2 (shields absorb the malfunction along with the hit; one damage state only), §4.1/§4.3 (hull innate abilities — roadmap puts them here), §5.7 (Parasite: targets your highest-value module).
5. `docs/decisions/001-stack-and-architecture.md` and `003-determinism-and-persistence.md`.

## Repo state when this was written

- `main` = Slices 1.1–2.1 merged. **The Slice 2.2 PR (`feature/combat-playable`) was just opened** — check its state first: if merged, branch from `main`; if still open, ask the user whether to wait or branch off it.
- 111 tests green. The game is playable in the browser: one fight vs the Lamprey, Gunship hull, win/lose/restart loop, seed in URL.

## What 2.2 gives you

- **`src/game/main.ts` — the only module React may import from `src/game/`.** `initGame(host, callbacks)` owns the Pixi app, RunState, CombatState; returns a `GameHandle` (`playCard`/`endTurn`/`nextFight`/`restartRun`/`destroy`); emits `CombatView` snapshots via `onCombatUpdate` once per event. Command guards are quiet no-ops (double-taps must not throw); the sim itself still throws loudly on illegal calls.
- **`src/game/combat-view.ts`** — `buildCombatView(state)`: pure CombatState → `CombatView` projection; card rules text is generated from the `CardEffect` union in `describeEffect`. New effect kinds must be added there (the exhaustive switch makes TypeScript enforce this).
- **`src/renderer/space-renderer.ts`** — `createSpaceRenderer(app).sync(view)`: placeholder ships, hit flash (driven by HP deltas between syncs), shield ring, death fade.
- **`src/components/CombatHand.tsx` / `HUD.tsx`** — DOM hand (tap to play, unaffordable disabled) and HUD (hull bar, shield pips with recharge countdowns, AP pips, intent telegraph, pile counts, End Turn).
- **`applyCombatResult(run, combat)` in `sim/combat.ts`** — commits rng/hullHp/scrap when a fight ends; `nextFight()` uses it (hull damage persists across fights, RNG stream advances).

## Your slice (roadmap wording)

> **2.3 Malfunctions** — Module targeting, card flipping, play-to-repair, hull-innate abilities. Parasite enemy (targets best module) to exercise it.

Pre-built hooks waiting for you:

- `resolveIncomingHit` in `sim/combat.ts` is the single funnel for enemy damage — module-hit absorption extends there without reshaping callers (a shield layer that absorbs a hit absorbs the malfunction too, GDD §5.2).
- `EnemyIntentDef` is a union of one (`kind: 'attack'`) — add a module-targeting intent kind; `enemies.ts` + `getEnemy` follow the loud-failure lookup pattern.
- `repair-all-modules` (Repair Clone card) is a loud throw-stub in the effect interpreter — implement it this slice.
- `CombatState` has no notion of per-module state yet — deck cards are flat `CardId[]`. You'll need to decide how a malfunctioning module flips its cards (the deck knows which module contributed which cards only via `generateDeck`; that mapping may need to become part of CombatState).
- Hull innate abilities: `HullDef.innateAbility` is data-only today (Scout Slipstream, Gunship Point-Defense, Freighter Salvage Rig, Tactical Auxiliary Router). No engine hook exists — design one. The HUD deliberately renders no innate button yet.

## Gotchas (will cost you time if skipped)

- **Node 22 first:** `source ~/.nvm/nvm.sh && nvm use 22` before `pnpm install`/`test`/`git commit` — Husky/lint-staged break on Node 20. Each Bash call is a fresh shell.
- **Pushing 403s with the default gh account** (work account is active; repo belongs to `peteroomen`). Don't switch the global account — scope per command:
  - push: `git -c credential.helper= -c 'credential.helper=!f() { echo username=peteroomen; echo password=$(gh auth token --user peteroomen); }; f' push …`
  - gh: `GH_TOKEN=$(gh auth token --user peteroomen) gh pr create …`
- `.claude/launch.json` defines a `dev` server config — the preview tooling can start/screenshot the app for in-browser verification (used heavily in 2.2; cheaper than guessing at layout).
- **Don't mix sim and UI changes blindly:** 2.3 is mostly sim (malfunction state machine) + data (Parasite, malfunction card text). The UI side is card-flip presentation — `CombatView` extension + `CombatHand` rendering. Keep the PR scoped; the card-flip *animation* belongs to 6.6, only the state needs to render.
- The retro font is wide: card names wrap with `[overflow-wrap:anywhere]`. Long malfunction card names ("Damaged Flak Array") will wrap mid-word — acceptable placeholder, don't burn time on it.
- `pnpm lint` is `eslint src`; `react-hooks/set-state-in-effect` rejects sync setState in effects — browser-only init belongs in `main.ts`, not page effects (that's why seed resolution lives in `initGame`).
- Intent telegraph is hidden ("???") unless Deep Scan's `reveal-intent` sets `modifiers.intentRevealed`. A module-targeting intent needs a telegraph string too — extend `RevealedIntent` in combat-view.
- Write a handoff for Slice 2.4 at session end (standing Post-Session Checklist item in `CLAUDE.md`).
