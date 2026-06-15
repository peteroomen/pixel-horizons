# Handoff → Slice 4.7: Powers & status effects

**Written:** 2026-06-15 (end of the PR #13 playtest-fix session)
**For:** the next single-slice session (mega-slices are done — back to one slice = one plan = one branch = one PR)
**Roadmap item:** Phase 4 — **4.7 Powers & status effects** (`docs/roadmap.md`)
**Design direction:** GDD **§5.10** (`docs/game-design.md`) — written this session, read it first.

> **Why this slice is "next":** it's the most-emphasized PR #13 playtest item (Peter, feedback #2:
> *"we really need more status effects / a power concept like STS… this all needs displaying in the
> UI and explaining"*), and it builds directly on combat/organ/keyword code that's warm from THE
> ARSENAL. **Alternatives if you'd rather sequence differently:** Slice **3.4** (clone death + surface
> enemies — has its own handoff at `docs/work/2026-06-15-handoff-slice-3.4.md`), **4.8** (Station UX &
> workbench access — the other new playtest slice), or **4.5** (full save/resume). Confirm with Peter
> if unsure; otherwise 4.7.

---

## Where things stand

- **PR #13** (`feature/the-arsenal`) is open: THE ARSENAL (keywords + events + boss organs) **plus**
  the 2026-06-15 playtest fixes. 421 tests green.
- **Branch base:** 4.7 builds on the arsenal combat code (organs, `targetPart`, keywords). If PR #13
  is **merged**, branch `feature/powers-status` off `main`. If it's **still open**, branch off
  `feature/the-arsenal` (you need its code) and note the stacking in the PR.
- **Pre-session checklist still applies** (CLAUDE.md): read roadmap + this handoff + GDD §5–5.10,
  write a plan file, get Peter's confirmation **before** any code. Add an **ADR (008)** for the
  status model — it's a real architectural decision.

## What the slice is (two halves)

**1. A real status/Power system** — persistent, stacking, **visible** buffs/debuffs (STS-style):
- Carried across turns with a **stack count and/or duration**; decays by its own rule.
- **Rendered always**: a status strip on the **ship plate** (`PlayerPlate.tsx`) and on the
  **enemy/organ plates** (`EnemyPlate.tsx`), with **tooltips** explaining each status + keyword
  (nothing is explained in the UI today — that's the core complaint).

**2. Rebalance the two card families Peter called out:**
- **Next-attack-+damage cards → `Exhaust`** (one-shot spikes, not free spammable stacks). Cards:
  Lock-On, Charge Capacitor, Combat Sim, Overcharge.
- **Blanket "+N from every hit" → a targeted "skill"**: `Exhaust` + apply a debuff to the
  **selected** enemy organ/core (reuse the §5.4 target selection), not a global modifier. Card:
  **Tracer Lock**.

## The seam — this is mostly already half-built (precise pointers)

Combat already has ad-hoc, **invisible** status fields. The slice generalizes them into one
visible, tooltipped system. Key locations (verify line numbers — they drift):

- **`CombatModifiers`** — `src/game/sim/combat.ts:56-69`. Already holds proto-statuses:
  `nextAttackBonus`, `nextAttackMultiplier`, `enemyVulnerable` (← this **is** Tracer Lock, a
  fight-long debuff), `dodgeChance`, `untargetableTurns`, `intentRevealed`. Initialized at
  `combat.ts:193`. **Decide:** unify these into a single `statuses` structure the UI renders, or
  layer a new system beside them. *Recommendation: unify — one concept the player can see.*
- **Card-effect application** — `combat.ts`: `buff-next-attack` (~710), `amplify-next-attack`
  (~712), `debuff-target-vulnerable` (~716, the global one to make targeted). Damage reads them at
  `combat.ts:~674-679` (`nextAttackBonus`/`multiplier`/`enemyVulnerable`) and `~481`.
- **`CardEffect` union** — `src/game/data/types.ts:25-45`. You'll likely add status-applying effect
  kinds (or a generic `apply-status`) and mark the rebalanced cards `exhaust: true`.
- **The buff/debuff cards** — `src/game/data/cards.ts`: Overcharge (l.24, amplify), Tracer Lock
  (l.37, debuff — make targeted+exhaust), Charge Capacitor (l.64, +5), Lock-On (l.87, +3), Combat
  Sim (l.244, +3, clone-bay). **All the +next-attack ones need `exhaust`.**
- **Target selection** — `targetPart` / `selectTarget` in `combat.ts`, surfaced through
  `EnemyPlate.tsx` organ rows + the `◎ TARGET` badge (built this session). Per-organ statuses run
  parallel to `partHp` (`combat.ts:94`). This is how a debuff lands on the chosen organ.
- **The view gap** — `src/game/combat-view.ts:191` exposes **only** `intentRevealed` from
  modifiers; statuses are otherwise **not in the view at all**. You must add status data to
  `CombatView` (ship statuses + enemy/organ statuses) and render it. ADR 006 (keyword/modifier view
  plumbing) and ADR 007 (organs) are the precedent patterns.

## Open design questions (resolve in the plan, capture in ADR 008)

1. **Status model:** stacks, duration (turns), or both per status? Per-status decay rule
   (end-of-turn tick? consume-on-use like `nextAttackBonus`? permanent like `enemyVulnerable`?).
2. **Unify or layer:** fold the 5 ad-hoc `CombatModifiers` fields into one `statuses` collection, or
   keep them and add a parallel system? Unifying is cleaner for the UI but **churns tuned combat
   tests** — scope it.
3. **Where statuses live:** ship statuses (array on `CombatState`) + target statuses (per-enemy and
   **per-organ**, parallel to `partHp`). Must be **plain JSON** (ADR 003 — combat serializes
   mid-turn).
4. **Tooltips on touch:** no hover on mobile. Tap-to-reveal a status detail? A persistent legend?
   The plates are already tight at 375px (we just reworked `EnemyPlate`) — design for the phone.

## Gotchas / guardrails

- **CombatState is plain JSON and serializes mid-turn** (ADR 003) — statuses are data, no functions/closures. Determinism: any randomness only on the combat RNG stream.
- **Making buff cards `exhaust` shifts balance and breaks tuned combat tests** (many assert exact
  damage; exhaust also changes deck cycling). Budget time to update `combat.test.ts` /
  `combat-view.test.ts`. **Numbers live in data, never hand-balanced in logic.**
- **Sim stays React/Pixi/DOM-free.** UI updates flow through the existing combat-view callback —
  **never** update React state at 60fps; once per event.
- `enemyVulnerable` is applied **globally** today (every hit, any target). Targeting it per-organ
  means the damage path must check which part is focused.
- Tooling: **Node 22** (`nvm use 22`) before `pnpm install`/`dev`/`commit`; lint is `eslint src`
  (not `next lint`); `docs/` is in `.prettierignore` — don't reformat docs.
- Mobile tap hardening from this session lives in `FoundryButton` (`touch-manipulation`) and the
  canvas-host `touch-none` — any new interactive status chips should follow the same pattern.

## Suggested cut order (each layer green: lint + type-check + test)

1. **Status data model** on `CombatState` + unify the 3 existing combat modifiers into it (sim + tests).
2. **Rebalance:** buff cards `exhaust`; Tracer Lock → targeted + exhaust (data + sim + tests).
3. **UI:** status strips on `PlayerPlate` (ship) + `EnemyPlate` (enemy/organ), reading the new view fields.
4. **Tooltips / explanation** for statuses + keywords. *Cuttable to a fast-follow if time runs short.*

## Manual test steps (happy path + edges)

- Play Lock-On / Charge Capacitor: the buff shows as a **visible status** on the ship; the next
  attack consumes it; the card is **gone for the fight (Exhaust)** — can't be replayed to re-stack.
- Tracer Lock with an organ focused (vs Gatemaw, `?enemy=enemy-gatemaw`): the debuff lands on **that
  organ** (shown on its plate), is consumed/decays per its rule, and the card **Exhausts**.
- A status with a duration ticks down across turns and disappears at 0; a stacking status shows its
  count and stacks correctly.
- Tooltip: tapping a status/keyword explains it (verify at **375px** — plates are tight).
- **Edge:** mid-fight serialize/resume (or a scripted test) — statuses survive the JSON round-trip
  (ADR 003). **Edge:** no console errors when an enemy has organs **and** ship+organ statuses are
  all active at once on a 375px screen.

## Out of scope (don't scope-creep)

- Full module-management UX + workbench-at-stations → that's **4.8**.
- Combat/boss difficulty tuning → **5.5 / 5.2** (do it *after* the buff/debuff economy changes land).
- New status-bearing enemies beyond what's needed to test → only what the slice needs.
