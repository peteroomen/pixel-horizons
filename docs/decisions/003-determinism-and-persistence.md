# ADR 003: Determinism Model & Save Persistence

Date: 2026-06-10
Status: Accepted

## Context

The GDD commits to shareable seed URLs, daily runs, and reproducible sim tests ("same seed = same run"). That requires deciding, before any consumer exists, how randomness is generated, how it is partitioned between game systems, and how a run's random state survives save/load. It also requires a persistence shape that can move from localStorage (now) to Supabase (Phase 7) without rewriting callers.

## Decision

1. **PRNG: xmur3 string hash → mulberry32, zero dependencies** (`src/game/sim/rng.ts`). Human-readable string seeds; 32-bit state; statistically solid for game purposes and trivially serializable.
2. **Serializable-by-value RNG state.** Generator state is a plain `{ seed, state }` object snapshot. RunState stores these snapshots, so a deserialized save continues every random sequence exactly where it stopped — determinism survives save/load, not just run start.
3. **Named sub-streams per system** via `deriveRng(seed, label)` (hash of `seed:label`). Map-gen, combat, and surface each consume their own stream. Without this, any change in how systems interleave their draws (a new feature, a refactor, a skipped encounter) would silently desync every other system and break seed reproducibility.
4. **One sanctioned entropy point:** `newSeed()` uses `crypto.getRandomValues`. `Math.random` remains banned project-wide.
5. **Versioned plain-JSON RunState with null-on-invalid deserialization** (`run-state.ts`). `deserializeRunState` never throws and rebuilds the object field-by-field (unknown properties dropped); corrupt or version-mismatched saves degrade to "no save". No migration machinery pre-release — bumping the version invalidates old saves, which is acceptable until launch.
6. **Persistence behind an injected interface** (`src/game/save.ts`): `SaveStore` over a minimal `StringStorage` (`getItem`/`setItem`/`removeItem`). Browser passes `window.localStorage`; tests pass an in-memory map; Phase 7 swaps in Supabase behind the same interface. This also keeps `sim/` free of DOM globals.

## Consequences

- Sim tests can assert exact value streams; replays and daily seeds are feasible from day one.
- Every future system that needs randomness must take an `Rng` (or stream label), never create its own entropy — slightly more plumbing, intentionally.
- Adding a new RNG stream to `RNG_STREAMS` changes the RunState shape and thus requires a version bump (old saves invalidate). Cheap now, worth revisiting if saves must survive updates post-launch.
- 32-bit state means streams could theoretically collide/cycle; irrelevant at game scale, but not cryptographic — fine, it guards fun, not secrets.
- The validator in `run-state.ts` must be extended whenever RunState grows a field; tests enforce the round-trip so forgetting fails loudly.
