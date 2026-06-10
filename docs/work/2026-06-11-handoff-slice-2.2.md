# Handoff — Slice 2.2: Combat Playable

**From:** Slice 2.1 session (2026-06-10/11)
**For:** the next session, starting cold. You have no memory of previous sessions — everything you need is linked here.

## Read first, in order

1. `CLAUDE.md` — the pre-session checklist is mandatory: orient → clarify → **plan file → user confirmation** → branch. No application code before the plan is confirmed.
2. `docs/roadmap.md` — you are building **Phase 2, Slice 2.2**.
3. `docs/work/2026-06-10-combat-engine.md` — what Slice 2.1 built, the semantics it pinned (shield recharge, per-hit buffs, retain-leftmost), and what it deferred to you.
4. `docs/game-design.md` — §5.5 (turn structure), §5.2 (what the HUD must show: hull HP, shield layers, recharge), §4.1/§4.3 (innate abilities are 2.3 — do NOT build them; AP display only), §11 (visual identity), §12 (session pacing).
5. `docs/decisions/001-stack-and-architecture.md` — **cards are DOM, not Pixi**; React shell communicates with the game only through `src/game/main.ts` callbacks.
6. `docs/decisions/003-determinism-and-persistence.md` — RNG-by-value; see "the rng commit-back contract" below.

## Repo state when this was written

- `main` = Slices 1.1–1.3 merged. **The Slice 2.1 PR (`feature/combat-engine`) was just opened** — check its state first: if merged, branch from `main`; if still open, ask the user whether to wait or branch off `feature/combat-engine`.
- 101 tests green. The whole game is still sim-only — `src/app/page.tsx` renders the Slice 1.1 pixel test scene; nothing game-related is wired into the page yet.

## What 2.1 gives you (all pure, all tested)

- `src/game/sim/combat.ts` — `CombatState` (plain JSON, serializable mid-fight) and the full engine:
  - `createCombat(runState, enemyId)` — shuffles the module deck via the combat RNG stream, collects shield layers from module passives, draws 5, telegraphs the first intent. **Does not mutate the RunState.**
  - `playCard(state, handIndex)` — throws on illegal plays (insufficient AP, bad index, fight over). **Your UI must never offer an illegal play** — disable unaffordable cards.
  - `endTurn(state)` — discard (honors retain), enemy acts on the telegraphed intent, shield recharge ticks, redraw to 5.
  - `currentIntent(state)` — the enemy action coming next phase, for the telegraph UI (`modifiers.intentRevealed` is the Deep Scan flag).
- `src/game/data/enemies.ts` — the Lamprey (22 HP; Feeding Frenzy 4×2 / Lash 7 / Rend 9 piercing, cycling). Intents have display `name`s for the UI.
- `src/game/data/constants.ts` — `BASELINE_AP`, `HAND_SIZE`.
- `createRunState(seed, hullId)` now installs the hull's starting modules — a fresh RunState is combat-ready as-is.

## Your slice (roadmap wording)

> **2.2 Combat playable** — React card hand (DOM) + Pixi battle viewport + HUD. One full fight vs. Lamprey with placeholder art, playable in browser, touch + mouse. *Done = a stranger can win/lose a fight on a phone.*

## Constraints that bind this slice

- **React must not import from `src/game/` internals** — everything flows through `src/game/main.ts` (`initGame`/`destroyGame`/callback hooks; this file is currently a stub or absent — building that boundary is part of your slice). Cards/HUD are DOM (ADR 001); the battle viewport is PixiJS.
- **Never update React state at 60fps** — combat is turn-based, so this is natural: one React state update per event (card played, turn ended, fight over).
- **The rng commit-back contract (documented in `combat.ts` header):** when the fight ends, the caller commits `CombatState.rng` → `runState.rng.combat`, hull HP, and `scrapGained` back to the RunState. 2.2 is the first caller — decide where this lives (a small `applyCombatResult(runState, combatState)` in `sim/` is the obvious shape, unit-testable).
- **Touch + mouse via pointer events only** — playable on a phone is the done-condition, not a stretch goal.
- **Sim purity stands:** any new logic that isn't rendering belongs in `sim/` with tests, not in components.

## Gotchas (will cost you time if skipped)

- **Node 22 first:** `source ~/.nvm/nvm.sh && nvm use 22` before `pnpm install`/`test`/`git commit` — Husky/lint-staged break on Node 20. Each Bash call is a fresh shell.
- **Fresh worktrees need `pnpm install`** — `node_modules` isn't shared from the main checkout.
- **Pushing 403s with the default gh account** (work account is active; repo belongs to `peteroomen`). Don't switch the global account — scope the token per command:
  - push: `git -c credential.helper= -c 'credential.helper=!f() { echo username=peteroomen; echo password=$(gh auth token --user peteroomen); }; f' push …`
  - gh: `GH_TOKEN=$(gh auth token --user peteroomen) gh pr create …`
- `pnpm lint` is `eslint src`; `docs/` is deliberately in `.prettierignore`.
- Integer zoom in `src/renderer/pixel-scale.ts` is computed in *device* pixels — don't "fix" it to CSS pixels.
- shadcn CLI fails on the v5 components.json schema — write base components manually or fetch `https://8bitcn.com/r/{name}.json`.
- Engine semantics your UI should reflect (all pinned by tests in `combat.test.ts`): retain keeps the *leftmost* cards (if you want player choice, add a sim API + tests); next-attack buffs are consumed by the first hit of multi-hit cards; `exhaust` cards leave the deck for the rest of the fight; a too-small deck deals a short hand.
- Hull innate abilities (Slipstream etc.) are **2.3** — don't render dead buttons for them.
- `motion` is installed but unused — baseline card animations are allowed to land with 2.2 (roadmap 6.6 note), but don't gold-plate; 6.6 is the juice pass.
- Vercel: only `pixel-horizons.vercel.app` is public; per-deployment URLs 401 behind Vercel Authentication (expected).
- Write a handoff for Slice 2.3 at session end (standing Post-Session Checklist item in `CLAUDE.md`).
