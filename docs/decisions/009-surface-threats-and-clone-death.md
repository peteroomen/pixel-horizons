# ADR 009: Surface threats & clone death model

Date: 2026-06-15
Status: Accepted

## Context

Slice 3.4 adds the first real-time damage/AI system to the surface mode: clone
HP, enemies, hazards, death, a corpse-recovery loop, and free-first/Scrap
re-prints (GDD §6.3, §6.7–6.10). Several structural questions had to be settled:

- Where do enemies/hazards come from — procedural spawning or authored data?
- Where does the re-print **economy** live, given the 3.2 invariant that the
  surface sim (`clone.ts`/`surface.ts`) is economy-free?
- Does any of the new clone state need to persist in `RunState`?
- How does the Shield Bubble's "no passive recharge" line (§6.10) become code?

## Decision

1. **Threats are placed by explicit level tile-tokens, not procedural spawning.**
   `parseLevel` resolves `H`/`G`/`C` (enemy spawns), `^` (Spike Bramble, a
   non-solid hazard tile), `~` (Crumbling Sandstone, a solid tile with a state
   machine), and `V` (Sandstorm Vent emitter). The surface sim consumes no RNG —
   enemy behaviour is deterministic from positions + clone state. Procedural
   chunk-weighting (GDD §6.7/§6.9) is deferred to map-gen (Phase 4/5).

2. **Clone HP / death / re-prints are ephemeral per-drop state**, held on
   `SurfaceState`, never written to `RunState`. Saves happen at node boundaries
   (ADR 003), not mid-drop, so there is nothing to persist and **no
   `RUN_STATE_VERSION` bump**. `reprintsUsed` resets each visit, which is exactly
   the "first re-print per planet visit is free" rule.

3. **The re-print economy stays in the orchestrator.** The sim exposes
   `clone.dead`, `reprintsUsed`, and a pure `reprintClone(state)` that only
   respawns; `main.ts` gates the Scrap cost against `run.resources` (free first,
   then `REPRINT_SCRAP_COST`) and enriches the emitted `SurfaceView` with
   `canReprint`. The surface sim never reads run economy — the 3.2 invariant
   holds.

4. **Matrix HP/melee/regen are structured data**, projected into
   `CloneCapabilities` via new `PlanetItemEffect` kinds (`clone-hp`,
   `melee-damage`, `clone-regen`) — no clone-bay id is special-cased in logic.

5. **Shield Bubble recharges on its `cooldownMs`.** It absorbs one hit (incl.
   hazards), pops, and becomes ready again after the cooldown. This is a
   pragmatic reading of the GDD's "no passive recharge" line: the data already
   modelled a `cooldownMs`, and a cooldown-gated bubble is the simplest version
   that is both useful and testable. A movement/mining-driven charge meter can
   replace it later without touching callers.

## Consequences

- **Easier:** deterministic, fully Vitest-covered surface combat; clean economy
  boundary; no save-format churn; data-driven enemy/matrix tuning.
- **Harder / deferred:** real procedural spawn density and flood-fill validation
  still owe a map-gen pass; the Shield "no passive recharge" nuance is a
  documented simplification, not the final design; mid-drop resume remains
  impossible by construction (acceptable — drops are short and bounded by the
  pod timer).
- The orchestrator now owns one more cross-cutting concern (re-print Scrap),
  mirroring how it already banks pod deposits on exit — consistent, not novel.
