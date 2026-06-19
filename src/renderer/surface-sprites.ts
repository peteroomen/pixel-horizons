/**
 * Pixel-art sprite factories for the surface/overworld renderer — a faithful port of the
 * "Foundry · Overworld Art Direction" design doc (companion to the combat `sprites.ts`).
 *
 * Same render path as combat: paint an offscreen <canvas> with the shared primitives, then
 * the renderer wraps it in a nearest-neighbour texture (textures.ts). Two palettes, one law:
 * terrain/creatures draw from Resurrect 64 in muted 3–5 step ramps; the five pure FOUNDRY
 * accents are reserved for signals (mining spark, melee arc, core-crystal glint, corpse
 * beacon) — the only fully-saturated pixels allowed to touch the dirt.
 *
 * Browser-only: every factory creates a <canvas> and must run client-side.
 */

import type { Ctx } from './sprite-primitives';
import { blob, dither, make, mix, OUTLINE, R, rng } from './sprite-primitives';

// ─── Resurrect 64 material ramps (index 0 = lightest .. 5 = darkest) ────────
// One ordered ramp per material so the whole tileset LUT-swaps as a unit later
// (Volcanic/Ice are the same ramp positions, different hues — wired in 5.3).
export const ROCKY = ['#fbb954', '#e6904e', '#cd683d', '#9e4539', '#7a3045', '#45293f'];
export const VOLCANIC = ['#fbff86', '#f9c22b', '#f57d4a', '#ea4f36', '#b33831', '#6e2727'];
export const ICE = ['#c7dcd0', '#8fd3ff', '#4d9be6', '#4d65b4', '#484a77', '#323353'];

// Default sky ramp (warm peach — matches the rust desert land ramp, preserving the
// existing look when no planet sky ramp is available).
export const ROCKY_SKY = ['#fdcbb0', '#fca790', '#e6904e', '#cd683d', '#9e4539', '#7a3045'];

type Ramp = readonly string[];

// ─── Terrain tiles (16×16, autotile-friendly: no directional banding on fill) ──

/** Breakable rock — FILL tile (no top crust, so stacked tiles read as solid body). */
export const rockFillTile = (P: Ramp = ROCKY, seed = 5): HTMLCanvasElement =>
  make(16, 16, (g) => {
    R(g, 0, 0, 16, 16, P[2]);
    R(g, 3, 2, 3, 2, P[3]);
    R(g, 9, 5, 3, 3, P[3]);
    R(g, 12, 11, 3, 2, P[3]);
    R(g, 1, 10, 3, 2, P[3]);
    R(g, 6, 13, 3, 2, P[3]);
    R(g, 7, 3, 1, 2, P[4]);
    R(g, 10, 7, 2, 1, P[4]);
    R(g, 4, 9, 1, 2, P[4]);
    R(g, 13, 13, 1, 1, P[4]);
    R(g, 2, 5, 2, 1, P[1]);
    R(g, 11, 2, 2, 1, P[1]);
    R(g, 7, 10, 2, 1, P[1]);
    R(g, 14, 8, 1, 1, P[1]);
    dither(g, 0, 0, 16, 16, P[3], seed, 0.04);
    dither(g, 0, 0, 16, 16, P[1], seed + 9, 0.025);
  });

/** Breakable rock — SURFACE tile (same body + a single sunlit crust on the top row). */
export const rockSurfaceTile = (P: Ramp = ROCKY, seed = 5): HTMLCanvasElement =>
  make(16, 16, (g) => {
    R(g, 0, 0, 16, 16, P[2]);
    R(g, 3, 5, 3, 2, P[3]);
    R(g, 9, 8, 3, 3, P[3]);
    R(g, 12, 12, 3, 2, P[3]);
    R(g, 1, 11, 3, 2, P[3]);
    R(g, 10, 10, 2, 1, P[4]);
    R(g, 4, 12, 1, 2, P[4]);
    dither(g, 0, 4, 16, 12, P[3], seed, 0.04);
    // sunlit crust
    R(g, 0, 0, 16, 3, P[1]);
    R(g, 0, 0, 16, 1, P[0]);
    R(g, 0, 3, 16, 1, P[2]);
    dither(g, 0, 1, 16, 2, P[0], seed + 3, 0.25);
  });

/** Bedrock — cool slate-violet, unbreakable (the material grammar: cool = can't mine). */
export const bedrockTile = (): HTMLCanvasElement =>
  make(16, 16, (g) => {
    R(g, 0, 0, 16, 16, '#3e3546');
    R(g, 3, 3, 3, 2, '#313638');
    R(g, 9, 6, 3, 3, '#313638');
    R(g, 2, 11, 3, 2, '#313638');
    R(g, 11, 11, 3, 2, '#313638');
    R(g, 6, 4, 1, 2, '#2e222f');
    R(g, 10, 9, 2, 1, '#2e222f');
    R(g, 4, 9, 1, 2, '#2e222f');
    R(g, 1, 2, 2, 1, '#7f708a');
    R(g, 12, 3, 2, 1, '#625565');
    R(g, 7, 9, 2, 1, '#625565');
    R(g, 13, 7, 1, 1, '#7f708a');
    dither(g, 0, 0, 16, 16, '#313638', 61, 0.05);
  });

/** Biomineral vein — rock body + a Bloom-grown crystal socket (ramps toward green, never pure). */
export const biomineralTile = (P: Ramp = ROCKY): HTMLCanvasElement =>
  make(
    16,
    16,
    (g) => {
      g.drawImage(rockFillTile(P), 0, 0);
      R(g, 4, 4, 8, 8, '#45293f');
      R(g, 6, 5, 4, 6, '#6b3e75');
      R(g, 6, 5, 2, 6, '#905ea9');
      R(g, 5, 7, 1, 3, '#a24b6f');
      R(g, 8, 6, 2, 4, '#753c54');
      R(g, 9, 8, 2, 3, '#831c5d');
      R(g, 7, 4, 2, 1, '#a884f3');
      R(g, 6, 5, 1, 1, '#eaaded');
      R(g, 10, 9, 2, 2, '#239063');
      R(g, 10, 9, 1, 1, '#1ebc73');
      R(g, 5, 10, 1, 1, '#676633');
    },
    OUTLINE,
  );

/** Buried Collective salvage — a machined box embedded in rock. */
export const scrapCacheTile = (P: Ramp = ROCKY): HTMLCanvasElement =>
  make(
    16,
    16,
    (g) => {
      g.drawImage(rockFillTile(P), 0, 0);
      R(g, 3, 5, 10, 7, '#374e4a');
      R(g, 3, 5, 10, 1, '#547e64');
      R(g, 3, 11, 10, 1, '#313638');
      R(g, 3, 5, 1, 7, '#547e64');
      R(g, 12, 5, 1, 7, '#313638');
      R(g, 7, 5, 1, 7, '#313638'); // panel seam
      R(g, 5, 7, 1, 1, '#625565');
      R(g, 9, 7, 1, 1, '#625565');
      R(g, 5, 10, 1, 1, '#625565');
      R(g, 9, 10, 1, 1, '#625565');
      R(g, 10, 8, 2, 2, '#7a3045');
      R(g, 11, 8, 1, 1, '#fb6b1d'); // dim running light (muted orange)
    },
    OUTLINE,
  );

/** Scanned vein — plain rock + a muted-cyan internal vein revealed by the scanner. */
export const scannedTile = (P: Ramp = ROCKY): HTMLCanvasElement =>
  make(16, 16, (g) => {
    g.drawImage(rockFillTile(P), 0, 0);
    R(g, 4, 6, 7, 1, '#0b5e65');
    R(g, 5, 7, 1, 2, '#0b5e65');
    R(g, 8, 7, 1, 3, '#0b8a8f');
    R(g, 10, 5, 1, 3, '#0b5e65');
    R(g, 6, 6, 1, 1, '#0eaf9b');
    R(g, 9, 9, 1, 1, '#30e1b9');
    dither(g, 3, 4, 10, 7, '#0b8a8f', 13, 0.05);
  });

/** Hidden deposit — identical to plain rock by design (only the scanner tells them apart). */
export const hiddenTile = (P: Ramp = ROCKY): HTMLCanvasElement => rockFillTile(P);

/** Core crystal — the one tile that earns a pure-cyan glint (the bridge rule's lone exception). */
export const coreTile = (P: Ramp = ROCKY): HTMLCanvasElement =>
  make(
    16,
    16,
    (g) => {
      g.drawImage(rockFillTile(P), 0, 0);
      R(g, 4, 4, 8, 9, '#45293f'); // socket
      R(g, 6, 5, 4, 7, '#0b5e65');
      R(g, 6, 5, 2, 7, '#0b8a8f');
      R(g, 7, 4, 2, 1, '#0eaf9b');
      R(g, 9, 7, 2, 4, '#0b5e65');
      R(g, 8, 6, 1, 4, '#0eaf9b');
      R(g, 5, 8, 1, 3, '#0b8a8f');
      // THE one pure glint
      R(g, 8, 7, 1, 1, '#6ad1e3');
      R(g, 8, 6, 1, 1, '#ffffff');
    },
    OUTLINE,
  );

/** Spike Bramble — non-solid Bloom thorn bed sitting on the tile floor (16×16). */
export const brambleTile = (P: Ramp = ROCKY): HTMLCanvasElement =>
  make(
    16,
    16,
    (g) => {
      R(g, 0, 12, 16, 4, P[4]);
      R(g, 0, 12, 16, 1, P[3]);
      const thorn = (x: number, h: number, lean: number): void => {
        for (let i = 0; i < h; i++) R(g, x + Math.round(i * lean), 12 - i, 1, 1, '#6b3e75');
        R(g, x + Math.round((h - 1) * lean), 12 - h, 1, 1, '#91db69');
        R(g, x + Math.round((h - 1) * lean), 12 - h + 1, 1, 1, '#c32454');
      };
      thorn(2, 6, 0.2);
      thorn(5, 8, -0.1);
      thorn(9, 5, 0.15);
      thorn(12, 7, 0.05);
      R(g, 2, 11, 12, 1, '#831c5d');
      R(g, 5, 11, 2, 1, '#1ebc73');
      R(g, 10, 11, 2, 1, '#239063');
    },
    OUTLINE,
  );

/** Crumbling Sandstone — lighter, hollow-looking block webbed with fractures (16×16). */
export const crumbleTile = (P: Ramp = ROCKY): HTMLCanvasElement =>
  make(
    16,
    16,
    (g) => {
      R(g, 0, 0, 16, 16, P[1]);
      R(g, 0, 0, 16, 2, P[0]);
      R(g, 0, 13, 16, 3, P[3]);
      const cr = P[4];
      R(g, 6, 0, 1, 9, cr);
      R(g, 6, 6, 7, 1, cr);
      R(g, 12, 2, 1, 11, cr);
      R(g, 2, 9, 5, 1, cr);
      R(g, 9, 9, 1, 5, cr);
      R(g, 3, 3, 1, 4, cr);
      dither(g, 0, 2, 16, 11, P[2], 57, 0.05);
    },
    OUTLINE,
  );

// ─── The clone (12×20, visor-lit) ───────────────────────────────────────────

export type ClonePose = 'idle' | 'run' | 'jump' | 'air' | 'melee';

const ARM = '#547e64';
const ARL = '#92a984';
const ARD = '#374e4a';
const PK = '#625565';
const VD = '#0b5e65';
const VL = '#30e1b9';
const VH = '#8ff8e2';

const cloneBodyFn = (g: Ctx, pose: ClonePose): void => {
  // helmet
  R(g, 3, 1, 6, 5, ARM);
  R(g, 3, 1, 6, 1, ARL);
  R(g, 3, 5, 6, 1, ARD);
  // visor (the one saturated body pixel)
  R(g, 4, 2, 4, 2, VD);
  R(g, 4, 2, 3, 1, VL);
  R(g, 5, 2, 1, 1, VH);
  // backpack
  R(g, 1, 7, 2, 5, PK);
  R(g, 1, 7, 2, 1, '#7f708a');
  R(g, 1, 8, 1, 1, VL);
  // torso
  R(g, 3, 6, 6, 6, ARM);
  R(g, 3, 6, 6, 1, ARL);
  R(g, 3, 11, 6, 1, ARD);
  R(g, 5, 7, 2, 3, ARD);
  if (pose === 'idle') {
    R(g, 9, 7, 1, 4, ARM);
    R(g, 2, 7, 1, 4, ARM);
    R(g, 3, 12, 2, 7, ARD);
    R(g, 7, 12, 2, 7, ARD);
    R(g, 3, 18, 3, 1, '#313638');
    R(g, 6, 18, 3, 1, '#313638');
    R(g, 3, 12, 2, 1, ARM);
    R(g, 7, 12, 2, 1, ARM);
  } else if (pose === 'run') {
    R(g, 9, 8, 2, 3, ARM);
    R(g, 1, 8, 2, 2, ARM);
    R(g, 2, 12, 2, 5, ARD);
    R(g, 8, 13, 3, 5, ARD);
    R(g, 1, 16, 3, 1, '#313638');
    R(g, 9, 17, 3, 1, '#313638');
    R(g, 8, 13, 3, 1, ARM);
  } else if (pose === 'jump') {
    R(g, 9, 6, 1, 3, ARM);
    R(g, 2, 6, 1, 3, ARM);
    R(g, 3, 12, 2, 6, ARD);
    R(g, 7, 12, 2, 6, ARD);
    R(g, 3, 17, 2, 1, '#313638');
    R(g, 7, 17, 2, 1, '#313638');
  } else if (pose === 'air') {
    R(g, 9, 7, 2, 2, ARM);
    R(g, 1, 7, 2, 2, ARM);
    R(g, 3, 12, 3, 4, ARD);
    R(g, 7, 13, 3, 3, ARD);
    R(g, 3, 15, 3, 1, '#313638');
    R(g, 7, 15, 3, 1, '#313638');
  } else {
    // melee
    R(g, 9, 8, 3, 1, ARM);
    R(g, 11, 7, 1, 3, ARL);
    R(g, 2, 8, 1, 3, ARM);
    R(g, 3, 12, 2, 6, ARD);
    R(g, 7, 12, 2, 6, ARD);
    R(g, 3, 18, 3, 1, '#313638');
    R(g, 6, 18, 3, 1, '#313638');
  }
};

/** Clone pose sprite. Melee is wider (18px) to fit the cyan arc; the rest are 12×20. */
export const cloneSprite = (pose: ClonePose): HTMLCanvasElement => {
  if (pose === 'melee') {
    return make(
      18,
      20,
      (g) => {
        cloneBodyFn(g, 'melee');
        // cyan slash arc (the one pure FX on the body)
        R(g, 13, 6, 1, 3, '#0b8a8f');
        R(g, 14, 5, 1, 5, '#30e1b9');
        R(g, 15, 6, 1, 4, '#8ff8e2');
        R(g, 16, 7, 1, 2, '#6ad1e3');
        R(g, 14, 4, 1, 1, '#8ff8e2');
        R(g, 15, 11, 1, 1, '#30e1b9');
      },
      OUTLINE,
    );
  }
  return make(12, 20, (g) => cloneBodyFn(g, pose), OUTLINE);
};

// ─── Drop pod (32×48 shell; camp/launch variants) ───────────────────────────

const HUL = '#547e64';
const HUH = '#92a984';
const HUD = '#374e4a';
const STR = '#f79617';
const STRD = '#7a3045';

const podShellFn = (g: Ctx): void => {
  R(g, 6, 8, 20, 34, HUL);
  R(g, 6, 8, 20, 2, HUH);
  R(g, 6, 40, 20, 2, HUD);
  R(g, 6, 8, 2, 34, HUH);
  R(g, 24, 8, 2, 34, HUD);
  // nose cone
  R(g, 9, 3, 14, 5, HUL);
  R(g, 9, 3, 14, 1, HUH);
  R(g, 12, 1, 8, 2, HUL);
  R(g, 12, 1, 8, 1, HUH);
  // hazard stripes (amber, muted)
  R(g, 6, 16, 20, 3, STRD);
  for (let x = 6; x < 26; x += 4) R(g, x, 16, 2, 3, STR);
  // panel seams
  R(g, 6, 24, 20, 1, HUD);
  R(g, 15, 8, 1, 34, HUD);
  // landing legs
  R(g, 4, 40, 3, 6, '#625565');
  R(g, 25, 40, 3, 6, '#625565');
  R(g, 2, 45, 4, 2, '#3e3546');
  R(g, 26, 45, 4, 2, '#3e3546');
  // bolts
  R(g, 9, 11, 1, 1, '#313638');
  R(g, 22, 11, 1, 1, '#313638');
  R(g, 9, 37, 1, 1, '#313638');
  R(g, 22, 37, 1, 1, '#313638');
};

/** Base camp — cracked open, ramp down, cloning bay lit. The respawn point (44×52). */
export const podCampSprite = (): HTMLCanvasElement =>
  make(
    44,
    52,
    (g) => {
      g.save();
      g.translate(2, 0);
      podShellFn(g);
      g.restore();
      // rectangular doorway cut into the lower front
      R(g, 9, 24, 16, 16, '#2e222f');
      R(g, 9, 24, 16, 1, '#7f708a'); // lit lintel
      R(g, 9, 24, 1, 16, '#625565');
      R(g, 24, 24, 1, 16, '#374e4a');
      // interior cloning bay: lit floor + printer gantry
      R(g, 11, 35, 12, 3, '#0b3a44');
      R(g, 11, 35, 12, 1, '#0b8a8f');
      R(g, 12, 26, 1, 9, '#625565');
      R(g, 21, 26, 1, 9, '#625565');
      R(g, 12, 26, 10, 1, '#625565');
      // clone forming on the platform
      R(g, 15, 29, 4, 6, '#0b5e65');
      R(g, 16, 29, 2, 5, '#30e1b9');
      R(g, 16, 29, 1, 2, '#8ff8e2');
      R(g, 15, 27, 4, 2, '#0b3a44');
      R(g, 16, 27, 2, 1, '#0b8a8f');
      // hinged door panel swung flat to the right
      R(g, 26, 26, 7, 13, HUD);
      R(g, 26, 26, 7, 1, HUL);
      R(g, 26, 38, 7, 1, '#2e222f');
      R(g, 29, 28, 1, 9, '#2e222f');
      R(g, 27, 27, 1, 1, '#f79617');
      // ramp down to the ground
      R(g, 9, 40, 21, 3, '#625565');
      R(g, 9, 40, 21, 1, '#7f708a');
      R(g, 9, 42, 21, 1, '#3e3546');
      // base-camp marker light
      R(g, 7, 18, 1, 1, '#fb6b1d');
    },
    OUTLINE,
  );

/** Launch — sealed, lifting on a pure-orange thruster burn (32×52). */
export const podLaunchSprite = (): HTMLCanvasElement =>
  make(
    32,
    52,
    (g) => {
      g.save();
      g.translate(0, -2);
      podShellFn(g);
      g.restore();
      R(g, 12, 25, 8, 10, HUD);
      R(g, 15, 29, 2, 2, '#0b5e65');
      // pure-orange thruster burn
      R(g, 11, 40, 10, 3, '#f9c22b');
      R(g, 12, 43, 8, 4, '#fb6b1d');
      R(g, 13, 47, 6, 3, '#f79617');
      R(g, 14, 50, 4, 2, '#fbb954');
      R(g, 9, 41, 2, 2, '#fb6b1d');
      R(g, 21, 41, 2, 2, '#fb6b1d');
      R(g, 15, 42, 2, 4, '#fbff86');
    },
    OUTLINE,
  );

// ─── Bloom fauna (read by silhouette/motion; sick-green eye is the aggro tell) ──

/** Sick-green springer, mid-leap pose (24×18). */
export const hopperSprite = (): HTMLCanvasElement =>
  make(
    24,
    18,
    (g) => {
      blob(g, 13, 10, 7, 5, '#676633', 21, 1);
      blob(g, 12, 8, 6, 3, '#a2a947', 23, 1);
      R(g, 8, 12, 10, 1, '#4c3e24');
      R(g, 11, 13, 5, 1, '#d5e04b');
      R(g, 15, 6, 3, 3, '#2e222f');
      R(g, 16, 6, 2, 2, '#91db69');
      R(g, 16, 6, 1, 1, '#cddf6c');
      R(g, 18, 10, 3, 1, '#831c5d');
      R(g, 7, 13, 2, 3, '#4c3e24');
      R(g, 6, 15, 3, 1, '#2e222f');
      R(g, 13, 14, 2, 3, '#4c3e24');
      R(g, 12, 16, 3, 1, '#2e222f');
    },
    OUTLINE,
  );

/** Slow armored scavenger, salvaged plate shell, half-shut sleepy eye (28×16). */
export const grubberSprite = (): HTMLCanvasElement =>
  make(
    28,
    16,
    (g) => {
      blob(g, 14, 11, 12, 4, '#6b3e75', 31, 1);
      blob(g, 10, 10, 7, 2, '#905ea9', 33, 1);
      R(g, 4, 13, 20, 1, '#45293f');
      R(g, 8, 5, 13, 4, '#547e64');
      R(g, 8, 5, 13, 1, '#92a984');
      R(g, 8, 8, 13, 1, '#374e4a');
      R(g, 13, 5, 1, 4, '#374e4a');
      R(g, 17, 5, 1, 4, '#374e4a');
      R(g, 10, 6, 1, 1, '#f79617'); // one amber rivet
      R(g, 5, 9, 3, 2, '#2e222f');
      R(g, 5, 9, 2, 1, '#cf657f');
      for (const lx of [8, 13, 18, 21]) R(g, lx, 14, 1, 2, '#45293f');
    },
    OUTLINE,
  );

/** Hangs from the cave roof by a fleshy stalk, one down-eye, a drip (18×20). */
export const dropperSprite = (): HTMLCanvasElement =>
  make(
    18,
    20,
    (g) => {
      R(g, 8, 0, 2, 5, '#45293f');
      R(g, 8, 0, 1, 5, '#6b3e75');
      blob(g, 9, 10, 6, 5, '#905ea9', 41, 1);
      blob(g, 9, 8, 5, 2, '#a884f3', 43, 1);
      R(g, 5, 13, 8, 1, '#165a4c');
      R(g, 7, 14, 5, 1, '#1ebc73');
      R(g, 7, 9, 3, 3, '#2e222f');
      R(g, 8, 10, 2, 2, '#c32454');
      R(g, 8, 10, 1, 1, '#f68181');
      R(g, 5, 14, 1, 4, '#6b3e75');
      R(g, 9, 15, 1, 4, '#45293f');
      R(g, 12, 14, 1, 3, '#6b3e75');
      R(g, 9, 19, 1, 1, '#1ebc73');
    },
    OUTLINE,
  );

// ─── Death & economy props ──────────────────────────────────────────────────

/** Fallen clone husk under a rising pure-green beacon column — the death signal (20×24). */
export const corpseSprite = (): HTMLCanvasElement =>
  make(
    20,
    24,
    (g) => {
      R(g, 9, 2, 2, 16, '#3a5a1c');
      R(g, 9, 2, 1, 16, '#8ac926');
      R(g, 8, 1, 4, 2, '#8ac926');
      R(g, 9, 0, 2, 1, '#cddf6c');
      R(g, 9, 7, 2, 2, '#8ac926');
      R(g, 8, 8, 4, 1, '#cddf6c');
      R(g, 8, 7, 1, 1, '#cddf6c');
      R(g, 5, 18, 10, 3, '#374e4a');
      R(g, 5, 18, 10, 1, '#547e64');
      R(g, 5, 20, 10, 1, '#2e222f');
      R(g, 6, 16, 4, 3, '#3e3546');
      R(g, 7, 16, 2, 1, '#0b5e65');
      R(g, 12, 19, 3, 1, '#374e4a');
      R(g, 3, 21, 1, 1, '#625565');
      R(g, 16, 20, 1, 1, '#625565');
    },
    OUTLINE,
  );

/** Dropped world item, tinted by source faction (10×10). Only the core frag carries a glint. */
export type ItemKind = 'biomineral' | 'scrap' | 'core';

export const itemSprite = (kind: ItemKind): HTMLCanvasElement =>
  make(
    10,
    10,
    (g) => {
      if (kind === 'biomineral') {
        R(g, 3, 2, 4, 6, '#6b3e75');
        R(g, 3, 2, 2, 6, '#905ea9');
        R(g, 4, 1, 2, 1, '#a884f3');
        R(g, 5, 4, 2, 3, '#831c5d');
        R(g, 6, 3, 1, 1, '#1ebc73');
      } else if (kind === 'scrap') {
        R(g, 2, 3, 6, 5, '#547e64');
        R(g, 2, 3, 6, 1, '#92a984');
        R(g, 2, 7, 6, 1, '#374e4a');
        R(g, 5, 3, 1, 5, '#374e4a');
        R(g, 3, 4, 1, 1, '#625565');
        R(g, 6, 5, 1, 1, '#fb6b1d');
      } else {
        R(g, 3, 2, 4, 6, '#0b5e65');
        R(g, 3, 2, 2, 6, '#0b8a8f');
        R(g, 4, 3, 1, 4, '#0eaf9b');
        R(g, 5, 4, 1, 1, '#6ad1e3');
        R(g, 5, 3, 1, 1, '#ffffff'); // pure glint
      }
    },
    OUTLINE,
  );

// ─── Core FX (flat coded shapes; the pure accent only at the instant of action) ──

/** Mining shatter — rock chunks + dust + a pure-orange impact spark (24×24). */
export const fxShatterSprite = (P: Ramp = ROCKY): HTMLCanvasElement =>
  make(24, 24, (g) => {
    R(g, 10, 11, 4, 3, P[3]);
    const chunk = (x: number, y: number, c: string): void => {
      R(g, x, y, 2, 2, c);
      R(g, x, y, 2, 1, P[0]);
    };
    chunk(4, 6, P[2]);
    chunk(18, 5, P[1]);
    chunk(3, 15, P[3]);
    chunk(19, 16, P[2]);
    chunk(11, 3, P[1]);
    dither(g, 6, 9, 12, 9, P[1], 81, 0.12);
    dither(g, 8, 11, 8, 6, '#fdcbb0', 83, 0.1);
    // pure-orange impact spark — the one action accent, fixed regardless of biome
    R(g, 11, 10, 2, 1, '#f9c22b');
    R(g, 12, 9, 1, 2, '#fb6b1d');
    R(g, 10, 12, 1, 1, '#f79617');
    R(g, 13, 12, 1, 1, '#fbb954');
  });

/** Landing puff — low, wide dust cloud + kicked pebbles (24×18). */
export const fxDustSprite = (P: Ramp = ROCKY): HTMLCanvasElement =>
  make(24, 18, (g) => {
    blob(g, 12, 13, 10, 4, P[2], 77, 2);
    blob(g, 12, 12, 8, 3, P[1], 79, 1);
    dither(g, 3, 9, 18, 7, '#fdcbb0', 76, 0.16);
    R(g, 4, 8, 1, 1, P[3]);
    R(g, 19, 7, 1, 1, P[3]);
    R(g, 8, 6, 1, 1, P[2]);
    R(g, 15, 6, 1, 1, P[2]);
  });

// ─── Parallax cave-mouth backdrop (three depth layers, recolor-dimmed) ───────

// skyLayer uses index 0 (brightest) → index 5 (near-horizon) for the gradient,
// and the land ramp's lighter steps (indexes 1–2) for the distant mesas (atmospheric
// perspective: distant hills read lighter/desaturated). Sun stays a fixed warm disc.
const skyLayer = (g: Ctx, W: number, H: number, S: Ramp = ROCKY_SKY, P: Ramp = ROCKY): void => {
  for (let y = 0; y < H; y++) R(g, 0, y, W, 1, mix(S[0], S[2], y / H));
  // Sun — fixed warm disc; tinting by star colour is a later slice (star/space-bg generator).
  blob(g, W * 0.62, H * 0.3, 10, 7, mix('#fbff86', '#fbb954', 0.3), 3, 1);
  // Horizon mesas — use land ramp's lighter steps for atmospheric perspective.
  const mesa = (x: number, w: number, top: number): void => {
    R(g, x, top, w, H - top, mix(P[1], P[2], 0.4));
    R(g, x, top, w, 1, S[1]);
  };
  const s = W / 220;
  mesa(8 * s, 34 * s, H * 0.55);
  mesa(46 * s, 22 * s, H * 0.62);
  mesa(80 * s, 40 * s, H * 0.5);
  mesa(128 * s, 30 * s, H * 0.6);
  mesa(165 * s, 44 * s, H * 0.52);
};

const midLayer = (g: Ctx, W: number, H: number, P: Ramp): void => {
  const col = (x: number, w: number, top: number): void => {
    R(g, x, top, w, H - top, P[4]);
    R(g, x, top, w, 2, P[3]);
    R(g, x, top, 2, H - top, P[3]);
    R(g, x + w - 2, top, 2, H - top, P[5]);
  };
  const s = W / 220;
  col(14 * s, 18 * s, H * 0.4);
  col(50 * s, 14 * s, H * 0.55);
  col(92 * s, 22 * s, H * 0.35);
  col(140 * s, 16 * s, H * 0.5);
  col(176 * s, 20 * s, H * 0.45);
  R(g, 70 * s, H * 0.5, 20 * s, 4, P[5]);
};

const nearLayer = (g: Ctx, W: number, H: number, P: Ramp): void => {
  const r = rng(55);
  // Cave-frame darks derived from the biome's darkest ramp steps so the mouth matches the
  // planet; kept well below the ramp (mixed toward black) to stay a dark vignette frame.
  const frame = mix(P[5], '#000000', 0.5);
  const edge = mix(P[5], '#000000', 0.3);
  const lip = mix(P[4], '#000000', 0.25);
  R(g, 0, 0, W, H * 0.16, frame); // top lip
  R(g, 0, 0, W * 0.2, H, frame); // left
  R(g, W * 0.82, 0, W * 0.18, H, frame); // right
  for (let y = 0; y < H; y++) {
    const lx = (W * 0.2 + Math.sin(y * 0.3) * 4 + r() * 3) | 0;
    R(g, 0, y, lx, 1, edge);
    const rx = (W * 0.82 - Math.sin(y * 0.25) * 4 - r() * 3) | 0;
    R(g, rx, y, W - rx, 1, edge);
  }
  for (let x = 0; x < W; x++) {
    const ty = (H * 0.16 + Math.sin(x * 0.2) * 5 + r() * 3) | 0;
    R(g, x, 0, 1, ty, frame);
  }
  // bloom flecks on the near wall — the infestation reached the rock (Bloom signal, fixed)
  const flecks: Array<[number, number]> = [
    [10, 40],
    [14, 80],
    [6, 60],
    [W - 12, 30],
    [W - 8, 70],
    [W - 16, 95],
    [30, 12],
    [120, 10],
  ];
  for (const [x, y] of flecks) R(g, x, y % H, 1, 1, r() < 0.5 ? '#6b3e75' : '#1ebc73');
  // foreground ground ledge
  R(g, 0, H - 10, W, 10, edge);
  R(g, 0, H - 10, W, 1, lip);
};

/**
 * The full cave-mouth backdrop (sky + mid columns + near wall frame), composed at W×H.
 * `P` (the planet terrain ramp) recolours the rock layers (mid columns + near cave frame).
 * `S` (the sky ramp, from `skyRampFor`) recolours the sky gradient + horizon mesa lit tops;
 * the sun stays a fixed warm disc. Pass `ROCKY_SKY` / `ROCKY` for the warm-orange default.
 */
export const surfaceBackdrop = (
  W: number,
  H: number,
  P: Ramp = ROCKY,
  S: Ramp = ROCKY_SKY,
): HTMLCanvasElement =>
  make(W, H, (g) => {
    skyLayer(g, W, H, S, P);
    midLayer(g, W, H, P);
    nearLayer(g, W, H, P);
  });

/** A drifting-spore-mote field for the gloom — deterministic placement, animated in the renderer. */
export const moteField = (
  W: number,
  H: number,
  count: number,
): Array<{ x: number; y: number; green: boolean }> => {
  const r = rng(303);
  return Array.from({ length: count }, () => ({
    x: (r() * W) | 0,
    y: (r() * H) | 0,
    green: r() < 0.5,
  }));
};
