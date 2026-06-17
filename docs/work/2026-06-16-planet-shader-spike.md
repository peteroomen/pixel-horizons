# Runtime Planet Shader — Feasibility Spike

**Date:** 2026-06-16
**Branch:** feature/planet-shader-spike
**Roadmap item:** Phase 6 — 6.1 Visual identity pass (de-risking the runtime-vs-pregen decision)

## Goal

Prove that a Deep-Fold-style pixel planet can be generated **at runtime** inside our existing
PixiJS v8 pipeline, driven deterministically by a seed, with the chunky pixel-art look — before
committing to runtime generation in ADR/6.1. Throwaway code on an isolated dev page; not wired
into the game.

## What we're de-risking

ADR 002 marked runtime planet generation "out of scope" (Deep-Fold is a Godot-shader tool; a
WebGL port was assumed too costly). Two facts found 2026-06-16 reopen it:

- **Deep-Fold/PixelPlanets is MIT** — source + 8 planet types, stars, galaxies, a space-background
  generator. Credit appreciated, not required.
- **A JS/Three.js port already exists** (Timur310/PixelPlanets) — the Godot→GLSL translation is
  largely done.
- We already render with **PixiJS v8, which natively runs custom GLSL/WGSL shaders**.

The three things this spike must answer:

1. **Compiles** — a custom fragment shader links in Pixi v8's WebGL path (Mesh + `Shader.from`).
2. **Deterministic** — same seed uniform ⇒ identical pixels (no `Math.random`; preserves the
   "same seed = same run" contract that powers shareable URLs).
3. **Performs + reads as pixel art** — several planets on screen at once, crisp chunky pixels,
   smooth rotation.

## Approach

- **Isolated dev page**, not a `?mode=` knob: a Next.js route `/planet-spike` that creates its own
  Pixi `Application` and mounts the spike scene. Keeps `main.ts` and its large `GameHandle`
  untouched — trivially deletable.
- **Mesh + custom Shader** (`src/renderer/planet-spike.ts`), not a Filter — a unit-quad
  `Geometry` per planet with a fragment shader that:
  - **pixelates** by snapping UV to a low-res grid (`uPixels`) — the chunky look, and it means the
    output is inherently crisp regardless of stage zoom (no texture sampling).
  - maps the quad to a **sphere** (discard outside the disc, fake-Z limb), rotates longitude by
    `uTime` for spin.
  - samples **FBM value-noise** hashed with `uSeed` for terrain; bands it into an in-shader
    Resurrect-64-ish ocean/land ramp; cel-shades the light with 3 bands.
  - All uniforms are pure functions of `uSeed` (+ cosmetic `uTime`) ⇒ determinism.
  - Uniforms kept to 4 `f32` (uTime/uSeed/uPixels/uRadius) to dodge std140 packing pitfalls;
    palette lives as in-shader consts for the spike.
- Scene shows ~4 planets at distinct seeds (variety + determinism by eye) plus one large rotating
  one; `uTime` advanced on the ticker.

## Steps

- [ ] `src/renderer/planet-spike.ts` — vertex+fragment GLSL, `createPlanet(seed)` mesh factory,
      `buildPlanetSpike(app)` scene + ticker.
- [ ] `src/app/planet-spike/page.tsx` — client page; own Pixi app (nearest filtering, integer-ish
      scale), mounts the spike, destroys on unmount (StrictMode-safe).
- [ ] Run dev, open `/planet-spike`, read console for GLSL link errors, iterate to clean compile.
- [ ] Screenshot for the user; confirm determinism (reload → identical) and rotation.

## Manual test steps

- [ ] `pnpm dev`, open `localhost:3000/planet-spike` → several distinct pixel planets render, no
      console errors.
- [ ] Planets are visibly chunky/pixelated and rotate smoothly.
- [ ] Reload the page → the same seeds produce pixel-identical planets (determinism).
- [ ] Edge: a deliberately degenerate seed (0) still renders a valid disc, no NaN/black square.

## Out of scope for this session

- Wiring planets into map/orbit/surface, RunState planet identity, biome→surface recolor.
- Porting the real Deep-Fold shaders 1:1, atmospheres, space-background, multiple planet *types*.
- The revised ADR and the `palette.ts` R64 LUT (follow-ups **if** the spike lands).
- WGSL/WebGPU path — WebGL/GLSL only here.

---

<!-- Fill in below during/after the session -->

## What actually happened

**Spike succeeded — runtime planet generation is feasible in our exact stack.** Seven planets
(one hero + six seeds) render from a single fragment shader: sphere-mapped, FBM-noise
ocean/land, cel-shaded, chunky-pixelated, rotating. All three goals verified at the pixel
level via `gl.readPixels`:

1. **Compiles** in PixiJS v8's WebGL2 path — no GLSL errors.
2. **Deterministic** — seed 7 at `uTime=0` is byte-reproducible (`time0Reproducible: true`);
   advancing time changes pixels (`rotationChangedPixels: true`). Identity comes purely from
   the `uSeed` uniform → it can be fed from the seeded RNG; a baked still (fixed `uTime`) is
   reproducible, preserving "same seed = same run".
3. **Performs + reads as pixel art** — 7 animated planets, smooth, crisp.

**Three PixiJS v8 gotchas pinned down (the real value for 6.1):**

- GLSL ES 3.00 (`in`/`out`) is only enabled when the source literally contains
  `#version 300 es` — `GlProgram.from` greps for it (`isES300`). Without it, `out` and
  interface blocks fail to compile.
- A `Shader.from` **resource group is uploaded as _loose_ uniforms in the GL path**, so the
  GLSL must declare loose `uniform float uSeed;` — NOT a UBO `uniform Block { ... }`. A block
  declaration leaves an active UBO with no buffer bound → `gl INVALID_OPERATION` and a
  silently skipped draw (no console error — found via `gl.getError()` + pixel reads).
- Pixi only feeds the scene-graph camera/transform UBOs (`globalUniforms` at group 100,
  local at 101) to its _own_ mesh shader, not reliably to a custom one. The spike sidesteps
  this by emitting quad corners directly in **clip space (NDC)** — fine for a spike; 6.1 will
  decide whether to integrate with the scene transform or keep planets as baked
  `RenderTexture`s.

Debugging burned several cycles on a **stale Turbopack bundle in the worktree** (HMR/reload
kept serving old shader source; a dev-server restart fixed it) — flag for future worktree
shader work.

**Known cosmetic (defer to 6.1):** faint translucent halos where the square quads' transparent
corners overlap — alpha-0 `discard` region still blends. Fix with premultiplied alpha, a hard
`discard`, or per-planet `RenderTexture` baking.

## Files created / modified

- `src/renderer/planet-spike.ts` (new) — shader + `buildPlanetSpike(app)` scene.
- `src/app/planet-spike/page.tsx` (new) — isolated `/planet-spike` dev page, own Pixi app.
- `docs/work/2026-06-16-planet-shader-spike.md` (this plan).

Both source files are throwaway and self-contained — delete the two to remove the spike.
No sim/game code touched; 492 tests still green, lint + type-check clean.

## Deferred to next session

- **Revised ADR** superseding ADR 002's "runtime out of scope" note → runtime generation is
  in-scope; pre-gen pool no longer needed. Attribution: Deep-Fold (MIT) in credits.
- **6.1 build-out:** port real Deep-Fold planet *types* (terran/gas/ice/lava/ocean) + their
  palettes; seed→type mapping in `map-gen`; planet identity on `RunState`; atmosphere + space
  background; `palette.ts` feeding Resurrect-64 ramps as uniforms + recoloring the surface
  tileset from the chosen planet's ramp; scene-graph integration vs RenderTexture decision;
  the halo fix.

## Status

- [ ] In progress
- [x] Complete (spike — proof achieved; build-out is 6.1)
- [ ] Partial — see deferred
