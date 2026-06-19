# Handoff — CB.0 Core Breaker feel prototype (`/core-breaker-spike`)

**For:** the next session (assume you start cold)
**Date written:** 2026-06-20
**Roadmap item:** Phase CB — CB.0 (throwaway feel prototype)
**Suggested branch:** `feature/core-breaker-spike`

---

## TL;DR

Build a **throwaway** browser harness that proves the Core Breaker carom is *fun* before we
commit to building it for real. Aim a ball from the top of a peg field, release to fire, watch
it bounce/ricochet and shatter pegs. **No determinism, no sim wiring, no real art, no tests.**
The single deliverable is a yes/no on feel — **on desktop and on a phone (375px)**. If the
aim-and-shatter doesn't feel good, **stop and re-judge the pivot** before building CB.1+.

This is the gate for the whole surface pivot. Treat it as a spike, not a feature.

---

## Context — read these first (~10 min)

The action-platformer surface loop was retired on 2026-06-19 for **Core Breaker**, a
Peglin-style physics-extraction loop. Background, in priority order:

1. `docs/decisions/011-core-breaker-surface-loop.md` — the pivot decision + rationale.
2. `docs/game-design.md` §6 (rewritten, v0.3) — the full Core Breaker design. §6.2 (Playfield),
   §6.3 (Bag & Shots), §6.4 (Ball roles) and §6.7 (Peg types) are what this prototype gestures
   at — but **only the physics feel matters here**, not the full design.
3. `docs/roadmap.md` — PIVOT banner + Phase CB track (CB.0 is this; CB.1–CB.7 come after).
4. `docs/work/2026-06-19-core-breaker-pivot.md` — the design-session log that produced the above.

**Mental model:** Peglin. A ball drops into a field of pegs, bounces, breaks things, pays out.
That's the feeling to chase.

---

## ⚠️ Before writing any code (CLAUDE.md gate)

CLAUDE.md requires this even for a spike:

1. Write a plan file `docs/work/2026-06-20-cb0-core-breaker-spike.md` (use the CLAUDE.md plan
   format, incl. Manual test steps). Present it and **get explicit confirmation** before coding.
2. `git checkout -b feature/core-breaker-spike`.
3. **Node 22 first:** `nvm use 22` before `pnpm install` / `pnpm dev` / any commit (Husky breaks
   on Node 20).

---

## Goal & explicit non-goals

**Done =** a `/core-breaker-spike` page where you can drag-aim, release-fire, and feel a ball
carom through ~30–60 pegs, shattering them, with a shots counter — tunable enough to judge the
fun, and verified good at 375px with touch.

**NOT in scope (resist the urge):**
- ❌ Determinism / seeded RNG — this is throwaway; `Math.random()` is fine **here only** (the
  real CB.1 core will be seeded + fixed-timestep per ADR 003). Do not touch `src/game/sim/`.
- ❌ Wiring to `RunState`, modules, `deck.ts`, or `main.ts` mode knobs.
- ❌ Real module→ball projection or the dual-face `<ModuleCard>` UI (that's CB.3/CB.5).
- ❌ Vitest tests (throwaway code).
- ❌ Final art / R64 palette lock — placeholder shapes are fine. (Optional: pull a ramp from
  `@/renderer/palette` just to make it less ugly, but don't spend time here.)
- ❌ Physics libraries — hand-roll it (see below). If a lib is ever seriously proposed for the
  *real* core, that's an ADR.

---

## Recommended approach

**Copy the existing throwaway-harness pattern.** `src/app/planet-spike/page.tsx` is the exact
template: a `'use client'` page that mounts a PixiJS v8 `Application`, applies the integer-scale
fit, and renders into a fixed host div. Clone it to `src/app/core-breaker-spike/page.tsx` and
gut the planet bits.

Reusable pieces (already in the repo):
- **Pixi app init + integer scaling:** copy the `Application.init({...})` block and the
  `applyScale()` helper from `planet-spike/page.tsx` verbatim. Uses
  `VIRTUAL_WIDTH/VIRTUAL_HEIGHT/computeScale` from `@/renderer/pixel-scale`. Keep
  `TextureSource.defaultOptions.scaleMode = 'nearest'`.
- **Game loop:** use `app.ticker.add((ticker) => …)` for the per-frame step. `ticker.deltaMS`
  gives you frame time — feed it into a fixed-timestep accumulator (below).
- **Optional recolor:** `@/renderer/palette` exports the R64 ramps if you want peg colours that
  don't clash. Skip if it costs more than 10 minutes.

Keep everything in the one page file (or a sibling `core-breaker-spike.ts` it imports) — it all
gets deleted when CB.4 lands. Add a header comment saying it's throwaway, like planet-spike's.

---

## The physics (the actual hard part)

Hand-roll a tiny 2D circle-vs-circle solver. Pegs are static circles; the ball is a moving
circle.

**Fixed-timestep accumulator (do this even though it's not deterministic — it's for stability):**
```
const STEP = 1 / 240;            // sub-step seconds; small to avoid tunneling
let acc = 0;
ticker.add((t) => {
  acc += Math.min(t.deltaMS / 1000, 0.05);   // clamp to avoid spiral-of-death
  while (acc >= STEP) { stepPhysics(STEP); acc -= STEP; }
  syncSprites();                              // draw separately from update
});
```
240 Hz sub-steps matter: a fast ball at 60 Hz can tunnel *through* a peg in one frame and miss
the collision entirely. Sub-stepping (or swept/continuous collision) is the usual Peglin-class
fix. Start with sub-steps; only reach for swept collision if tunneling persists.

**Per step:**
- Gravity: `vy += G * STEP` (tune G; start ~900 px/s²).
- Integrate: `x += vx*STEP; y += vy*STEP`.
- Walls: reflect `vx` at left/right bounds; floor ends the shot.
- Peg collision: for each peg, `d = dist(ball, peg)`. If `d < ball.r + peg.r`:
  - normal `n = (ball - peg) / d`
  - positional correction: push ball out so centres are exactly `ball.r + peg.r` apart (stops
    sticking/sinking)
  - velocity reflect with restitution `e`:
    `v -= (1 + e) * dot(v, n) * n`   (e ~0.6–0.8; this is *the* feel knob)
  - register the hit → shatter the peg (multi-hit pegs decrement a counter first).
- Rest/settle: end the shot when the ball falls past the floor, or `|v|` stays below a threshold
  for ~0.5 s (so it doesn't dribble forever).

**Three ball types** (enough to feel the variety promised in §6.4):
1. **Straight / pierce** (Mining Laser): no bounce off pegs — passes through, shatters what it
   touches, slight slowdown per peg. High gravity so it arcs.
2. **Bouncy** (Missile): high restitution, lots of caroms; optional AoE shatter of nearby pegs
   when it finally rests.
3. **Homing / curve** (Tractor Beam): each step, apply a small steering accel toward the nearest
   un-shattered "ore" peg.

---

## Input (touch-first — CLAUDE.md rule)

- **Pointer events only** (`pointerdown`/`pointermove`/`pointerup`), never mouse-specific.
- Fixed launch point near top-centre. `pointerdown` starts an aim; drag sets **angle (and
  optionally power)** — slingshot-style (drag back to aim) reads well on touch; try both
  angle-only-fixed-power and drag-for-power and keep whichever feels better.
- Draw an aim guide (a few projected dots, or just an angle line) on `pointermove`.
- `pointerup` fires the ball, decrement shots.
- **Gotcha:** `touch-none` (`touch-action: none`) must be on the **canvas host element** so the
  drag doesn't scroll the page on a phone (this is how `GameCanvas` does it in the real app).
  Set it on the host div's style.

---

## Tuning knobs to expose (so you can judge feel fast)

Put these as top-of-file consts and fiddle live: gravity `G`, restitution `e`, ball radius, peg
radius, peg density/count, launch power, wall bounce on/off, shots-per-drop (start 8–10). A
tiny on-screen readout of the current values + shots remaining is worth the 15 minutes.

---

## The feel checkpoint (the whole point)

After it runs, answer these — write the answers into the plan file's "What actually happened":

- Is the **carom satisfying** — does a good shot chaining through a cluster feel rewarding?
- Do the **three ball types feel meaningfully different**?
- What G / e / density made it sing? (Capture the numbers — CB.1 inherits them.)
- **Does it work on a phone?** Drag-to-aim accurate? No page-scroll fighting? Readable at 375px?
- Gut call: **is this more fun than the platformer was?** If no → stop, write up why, and bring
  it back to the user before any further Phase CB work.

---

## Gotchas (from CLAUDE.md "Known issues")

- **Node 22** (`nvm use 22`) before install/dev/commit.
- Lint is `eslint src` (`next lint` was removed in Next 16).
- Integer zoom is computed in **device** pixels (`src/renderer/pixel-scale.ts`) — don't "fix" it
  to CSS pixels; just reuse `computeScale`.
- TS strict, no `any`/`@ts-ignore` without a why-comment — even in throwaway code, the pre-commit
  hook enforces it.
- This is a feature branch → not phone-testable on the public Vercel URL until merged; test on
  the phone via `pnpm dev` on the LAN, or just use browser devtools at 375px + touch emulation
  for the first pass.

---

## What to hand to CB.1 (next slice after this)

If the prototype is a **yes**: the next slice is **CB.1 deterministic physics core** —
re-implement this same solver as `src/game/surface/core-breaker.ts`, but **seeded +
fixed-timestep + React/Pixi-free**, with Vitest proving same-seed-same-inputs determinism, and
retire `src/game/surface/physics.ts`. The tuned constants (G, e, density) from this spike are the
starting point. Note for that session: a fixed-timestep integer/float-stable loop is what keeps
the contract in ADR 003 — design the step to be reproducible (avoid frame-time-dependent math).

If the prototype is a **no**: capture exactly what felt wrong (input lag? mushy bounce? boring
field? bad on phone?) and whether it's fixable vs. fundamental, then escalate to the user.

---

## Manual test steps (for your plan file)

- [ ] `nvm use 22 && pnpm dev`, open `localhost:3000/core-breaker-spike`.
- [ ] Drag from the launch point, release → ball fires, falls under gravity, bounces off pegs,
      shatters them; shots counter decrements.
- [ ] Switch ball type → straight pierces, bouncy caroms, homing curves toward ore. Each reads
      as different.
- [ ] Tune G/e/density live → feel changes as expected; find a fun setting.
- [ ] Edge: a very fast shot does **not** tunnel through pegs (sub-stepping works).
- [ ] Edge: ball that gets stuck/dribbling settles and ends the shot within ~0.5 s.
- [ ] 375px + touch: drag-aim works, page doesn't scroll under the drag, field is readable.
