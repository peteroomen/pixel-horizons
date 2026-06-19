# Core Breaker pivot — surface loop redesign

**Date:** 2026-06-19
**Branch:** feature/core-breaker-pivot
**Roadmap item:** Pivot — Phase 3 (platformer) → Phase CB (Core Breaker)

## Goal

Decide and document a replacement for the action-platformer surface loop with a more
mobile-native, pace-coherent gametype, and capture it as durable design docs (GDD + roadmap +
ADR). **Docs only this session — no application code.**

## What actually happened

Worked through the "remove platforming?" question with the user. Their game library (STS,
Balatro, Dicey Dungeons, **Peglin**, Lichess, DQ8, Kingdom Rush, Shattered Pixel Dungeon)
pointed hard at deliberate/readable games and away from any real-time action — which killed
twin-stick and the earlier cooldown-action idea. Pitched three replacements (Peglin-style
physics extraction; Into-the-Breach turn-based grid; Kingdom Rush tower defense) + incremental
as a metagame layer. User chose **Core Breaker** (Peglin-style physics extraction).

Design decisions locked with the user:

- **Module → ball** is a *third projection* of the existing module→card conceit. Two surface
  roles only: **Ball** (projectile) or **Passive** — **no placeable board pieces** (user
  rejected the bumper idea). Shield-type modules give thematic passives/balls case-by-case.
- **Shared upgrade axis:** Mk tier buffs both faces (card + ball) together. Module **count** =
  copies of that ball in the firing **bag** (Peglin-style refill). **Reactor = shots-per-drop**
  (replaces the pod timer as the pressure).
- **Divergence only via events** — a ball/card pair stays locked except a rare event targeting
  one face (parallel to today's event-modifies-module → changes-card). Never a build axis.
- **UI is the long-term risk** (a module now carries card + ball + passive across many screens
  down to 375px). Adopted as constraints: one dual-face `<ModuleCard>`, a **ball glyph grammar**
  (straight/arc/curve + count badge), tier+count as the only changing numbers in fixed slots.
- **Determinism preserved:** new ball physics is a seeded, fixed-timestep circle-vs-peg sim
  (NOT the retired AABB model).
- **What survives / retires:** survives = runtime planets (ADR 010), `palette.ts`, orbit
  screen, surface recolor. Retires = `surface/physics.ts`, clone moveset/feel, touch platformer
  controls, chunk-grammar level gen, platformer enemy/hazard entities, clone death/corpse-run.

## Files created / modified

- **Created** `docs/decisions/011-core-breaker-surface-loop.md` (ADR — the pivot decision).
- **Rewrote** `docs/game-design.md` §6 (Surface Operations → Core Breaker, §6.1–6.10).
  Also: version 0.2→0.3, genre/platform/input front matter, §3 core-loop diagram, §4.2 module
  bullets + slot types, §4.3 reactor surface line, §5.8 catalog "Planet Item" supersession note.
- **Updated** `docs/roadmap.md`: PIVOT banner; Phase 3 marked SUPERSEDED; new **Phase CB**
  track (CB.0 throwaway feel prototype → CB.7 cleanup).
- **Created** this work log.

## Deferred to next session

- **CB.0 feel prototype** is the agreed next step: `/core-breaker-spike` throwaway harness to
  feel the aim-and-shatter on desktop + phone *before* any real slice. If it isn't fun, stop and
  re-judge the pivot.
- GDD follow-ups flagged in-place: §5.8 module catalog needs a real **ball-behaviour column**
  (currently the platformer "Planet Item" columns are flagged historical); §4.1 "planetside
  loadout" wording still platformer-era in spots.
- Roadmap Phase 5/6 cross-refs (5.3 biome recolor, 6.4 mobile pass touch tuning) still read
  platformer-era in places — fine for now, revisit when those slices come up.
- Actual code: nothing written. Phase CB slices not started.

## Status

- [x] Complete (design + docs)
- Next: CB.0 feel prototype (separate branch/session).
