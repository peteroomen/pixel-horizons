# Boss Maw Redesign

**Date:** 2026-06-19
**Branch:** feature/boss-maw-redesign
**Roadmap item:** Phase 6 — 6.1 (boss maw redesign, surfaced from World Art Direction playtest)

## Goal

The Anchormaw's and Mawling's mouths read as too rectangular and stamped-on — a
box of `R()` fills bolted to an organic blob. Round the maw to follow the blob
silhouette, give it lips and curved lattice teeth and the wet-rim selout the rest
of the body uses, so it reads as part of the creature, not a stamped box.

## Approach

Renderer-only pixel-art pass in `src/renderer/sprites.ts`, on two factories:
- `anchormawBoss()` (64×54, maw center-left, ~lines 599–607)
- `bloomGrunt()` Mawling (28×26, maw left, ~lines 554–561)

Both maws today are rectangular `R()` fills with straight tooth rows. Rework:
- **Round the maw cavity** using the existing `blob()` helper (rounded corners)
  instead of stacked `R()` rectangles, so the opening follows the body's curve.
- **Lips:** a curved lighter-rim band around the opening (reuse the body's wet-rim
  colors — `#eaaded`/`#a884f3` family for the boss, `#fca790` highlights), so the
  mouth has a fleshy edge rather than a hard cut.
- **Curved lattice teeth:** stagger/offset the teeth to follow the rounded opening
  rather than a straight row; keep them the existing bone tone (`#fdcbb0`).
- **Wet-rim selout** consistent with the body's existing rim treatment.

Constraints:
- **Two-palette law:** stay on Resurrect 64 ramp colors already used by the body.
  Pure FOUNDRY accents stay reserved for signals — do not introduce new accents.
- **Preserve the targetable organs** on the boss (Spore-Sac, Armor-Node) and their
  pure-accent cores — those reads must stay distinct and unchanged.
- Keep both sprites within their current canvas bounds (64×54 / 28×26) so the
  renderer's anchors/scales don't shift.

## Steps

- [ ] Branch `feature/boss-maw-redesign` from latest `main`
- [ ] Rework `anchormawBoss()` maw: rounded cavity (blob), curved lips, staggered
      lattice teeth, wet-rim — leave the organs untouched
- [ ] Rework `bloomGrunt()` maw to match the same grammar at grunt scale
- [ ] `pnpm lint && pnpm type-check && pnpm test` (no test changes expected — these
      are pixel factories; just confirm the suite stays green)
- [ ] Commit, push, open PR

## Manual test steps (human follow-up — agent can't run the browser)

- [ ] Combat screen vs a Mawling and vs the Anchormaw: the maw reads as a fleshy
      mouth fused to the body, not a rectangular box
- [ ] Anchormaw organs (Spore-Sac green, Armor-Node amber) still read as distinct
      targetable growths
- [ ] Enemy hit-flash + boss-phase tint still look right (whole-sprite tint)
- [ ] 375px: the maw still reads at the scaled size

## Parallel-safe boundary

Renderer-only. Edits **only** `src/renderer/sprites.ts`. Do NOT touch
`renderer/palette.ts` / `renderer/surface-sprites.ts` (that's the concurrent
atmosphere/sky slice), any combat/shop/data file (open PRs #25/#26), or
`combat-view.ts`. No sim or data change.

## Out of scope

- Bloom Cruiser / Swarm new enemies (5.6)
- Any change to organ targeting logic or enemy data
- New animation (idle/breathe stays as-is)

---

## What actually happened

Renderer-only pixel pass on the two maws in `src/renderer/sprites.ts`, exactly as
planned — no sim/data/component changes.

**Boss (`anchormawBoss`, 64×54):** replaced the three stacked `R()` cavity rects +
two straight tooth rows with four nested `blob()`s centred at (16,28) — outer lip
flesh (`#a24b6f`), cavity (`#831c5d`), inner shadow (`#45293f`), throat glow
(`#c32454`) — so the opening now follows the body's curve. Added a curved wet-rim
lip band reusing the body's rim colours (`#eaaded`/`#a884f3`) plus a `#fca790` lip
corner. Ten bone-tone (`#fdcbb0`) teeth staggered in y to follow the rounded
upper/lower arcs instead of sitting on two flat rows. The Spore-Sac (cx46) and
Armor-Node (x44–58) organs and their pure-accent cores are untouched; the maw lives
at cx16, well clear of both.

**Grunt (`bloomGrunt`, 28×26):** same grammar at scale — three nested `blob()`s at
(7,14) for lip flesh / cavity / throat, a curved `#eaaded`/`#a884f3` lip band, a
`#fca790` corner, and five staggered `#fdcbb0` teeth replacing the old rectangular
fill + scattered lip pixels.

Stayed entirely on the Resurrect 64 ramp colours already present on the bodies — no
new FOUNDRY pure accents introduced. Both sprites stay within their original canvas
bounds (64×54 / 28×26), so renderer anchors/scales are unchanged. Used fresh art-rng
seeds (51–65) for the new blobs so the wobble is deterministic and doesn't disturb
existing seeds.

`pnpm lint`, `pnpm type-check`, `pnpm test` (516 passed) all clean. No test changes.
Browser verification remains a human follow-up per the manual test steps above.

## Files created / modified

- `src/renderer/sprites.ts` — reworked the maw blocks in `anchormawBoss()` and
  `bloomGrunt()` (renderer-only).
- `docs/work/2026-06-19-boss-maw-redesign.md` — this plan/log.

## Status

- [ ] In progress
- [x] Complete
- [ ] Partial — see deferred
