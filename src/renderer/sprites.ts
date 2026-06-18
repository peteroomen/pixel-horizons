/**
 * Pixel-art sprite factories for the space/combat renderer — a faithful port of the
 * "World Art Direction" design (`docs/design/foundry-world-art-direction.dc.html`).
 *
 * Each factory paints into an offscreen <canvas> with canvas-2D fillRect, then the
 * renderer wraps it in a nearest-neighbor PixiJS texture (see textures.ts). This is the
 * design's exact render path (integer-scaled, no anti-aliasing), so the art stays
 * pixel-perfect to the spec.
 *
 * Two palettes, one law (the design's thesis): the world is Resurrect 64, muted and
 * ramped; FOUNDRY's pure accents are reserved for signals (muzzle, organ cores) — the
 * only fully-saturated pixels allowed to touch the world.
 *
 * Browser-only: every factory calls document.createElement and must run client-side.
 */

import type { Ctx } from './sprite-primitives';
import { blob, dither, make, makeCanvas, mix, OUTLINE, R, rng } from './sprite-primitives';

export { mix } from './sprite-primitives';

// ─── Collective palette — Horizon Collective ramp (from the transitions design doc) ───

const LT = '#b2ba90';
const HL = '#92a984';
const MD = '#547e64';
const DK = '#374e4a';
const DD = '#313638';
const ST = '#625565';
const STL = '#9babb2';
const CY = '#0b8a8f';
const CYL = '#0eaf9b';
const CYB = '#30e1b9';
const CYH = '#8ff8e2';
const OR = '#fb6b1d';
const AMD = '#f79617';

// ─── Module sprites — small detail parts (8×8 / 12×8 / 13×7), bolted onto hulls ──

/** Forward weapon barrel (~13×7): pointed nose-right, turret base + riser + barrel. */
const moduleWeapon = (): HTMLCanvasElement =>
  make(
    13,
    7,
    (g) => {
      R(g, 0, 1, 7, 5, MD);
      R(g, 0, 1, 7, 1, HL);
      R(g, 0, 5, 7, 1, DK);
      R(g, 2, 0, 4, 2, HL);
      R(g, 2, 0, 4, 1, LT);
      R(g, 7, 2, 5, 2, DK);
      R(g, 7, 2, 5, 1, ST);
      R(g, 12, 2, 1, 2, STL);
      R(g, 3, 3, 1, 1, CY);
    },
    OUTLINE,
  );

/** Dorsal turret (~8×7): dome top, stub barrel pointing right. */
const moduleTurret = (): HTMLCanvasElement =>
  make(
    8,
    7,
    (g) => {
      R(g, 1, 3, 6, 3, MD);
      R(g, 1, 3, 6, 1, HL);
      R(g, 1, 5, 6, 1, DK);
      R(g, 2, 1, 4, 2, HL);
      R(g, 2, 1, 4, 1, LT);
      R(g, 6, 3, 2, 2, DK);
      R(g, 7, 3, 1, 1, ST);
      R(g, 3, 2, 1, 1, CYB);
    },
    OUTLINE,
  );

/** Thruster bell (~12×8): housing + bell nozzle with cyan throat glow. */
const moduleEngine = (): HTMLCanvasElement =>
  make(
    12,
    8,
    (g) => {
      R(g, 4, 1, 8, 6, DK);
      R(g, 4, 1, 8, 1, ST);
      R(g, 4, 6, 8, 1, DD);
      R(g, 9, 2, 3, 4, MD);
      R(g, 9, 2, 3, 1, HL);
      R(g, 1, 2, 3, 4, '#3e3546');
      R(g, 1, 2, 3, 1, ST);
      R(g, 0, 3, 1, 2, CYH);
      R(g, 1, 3, 2, 2, CYB);
      R(g, 5, 3, 4, 1, CY);
    },
    OUTLINE,
  );

/** Dish / scanner antenna (~8×8): mast, dish bowl, cyan tip. */
const moduleUtil = (): HTMLCanvasElement =>
  make(
    8,
    8,
    (g) => {
      R(g, 3, 4, 2, 4, ST);
      R(g, 3, 4, 2, 1, STL);
      R(g, 1, 1, 5, 1, STL);
      R(g, 2, 2, 3, 1, STL);
      R(g, 2, 0, 3, 1, '#7f708a');
      R(g, 0, 1, 1, 1, CYB);
      R(g, 2, 6, 4, 2, DK);
      R(g, 2, 6, 4, 1, ST);
    },
    OUTLINE,
  );

/** Open U-bracket mount — shown when a slot is unfilled. */
const moduleEmpty = (): HTMLCanvasElement =>
  make(8, 8, (g) => {
    R(g, 1, 2, 6, 1, ST);
    R(g, 1, 2, 1, 5, ST);
    R(g, 6, 2, 1, 5, ST);
    R(g, 2, 3, 4, 3, '#161821');
    R(g, 2, 3, 4, 1, DD);
    R(g, 2, 6, 1, 1, STL);
    R(g, 5, 6, 1, 1, DK);
  });

// ─── Hull sprites — 64×32, nose pointing right ──────────────────────────────

/** Gunship bare hull (64×32): blunt nose, armored dorsal hump, twin turret mounts, belly hardpoint. */
const gunshipHullNew = (): HTMLCanvasElement =>
  make(
    64,
    32,
    (g) => {
      R(g, 4, 9, 11, 15, DK);
      R(g, 4, 9, 11, 1, ST);
      R(g, 4, 23, 11, 1, DD);
      R(g, 5, 11, 2, 11, DD);
      R(g, 8, 11, 1, 11, '#3e3546');
      R(g, 11, 11, 1, 11, '#3e3546');
      R(g, 12, 11, 40, 11, MD);
      R(g, 14, 10, 34, 1, LT);
      R(g, 12, 11, 40, 1, HL);
      R(g, 12, 21, 40, 1, DK);
      R(g, 12, 22, 40, 1, DD);
      R(g, 20, 6, 24, 6, MD);
      R(g, 21, 5, 22, 1, LT);
      R(g, 20, 6, 24, 1, HL);
      R(g, 20, 11, 24, 1, DK);
      R(g, 52, 12, 8, 9, MD);
      R(g, 52, 12, 8, 1, HL);
      R(g, 52, 20, 8, 1, DK);
      R(g, 60, 13, 3, 7, MD);
      R(g, 60, 13, 3, 1, HL);
      R(g, 63, 15, 1, 3, LT);
      R(g, 45, 8, 6, 3, CY);
      R(g, 46, 8, 4, 1, CYH);
      R(g, 45, 8, 1, 3, '#0b3a44');
      R(g, 26, 22, 18, 3, DK);
      R(g, 26, 22, 18, 1, '#3e3546');
      R(g, 26, 24, 18, 1, DD);
      R(g, 24, 12, 1, 9, DK);
      R(g, 32, 12, 1, 9, DK);
      R(g, 40, 12, 1, 9, DK);
      R(g, 18, 16, 28, 1, CY);
      R(g, 22, 16, 12, 1, CYL);
      R(g, 23, 5, 4, 2, ST);
      R(g, 35, 5, 4, 2, ST);
      R(g, 33, 24, 5, 2, ST);
      R(g, 16, 9, 4, 2, ST);
      R(g, 17, 19, 1, 1, OR);
      R(g, 38, 19, 1, 1, OR);
      R(g, 50, 18, 1, 1, OR);
    },
    OUTLINE,
  );

/** Scout bare hull (64×32): swept delta wings, 3-bell rear engine cluster, dart nose. */
const scoutHull = (): HTMLCanvasElement =>
  make(
    64,
    32,
    (g) => {
      R(g, 3, 9, 12, 14, DK);
      R(g, 3, 9, 12, 1, ST);
      R(g, 3, 22, 12, 1, DD);
      for (const ey of [10, 15, 19]) {
        R(g, 0, ey, 4, 3, '#3e3546');
        R(g, 0, ey + 1, 2, 1, CYB);
        R(g, 1, ey + 1, 2, 1, CYH);
      }
      R(g, 11, 11, 2, 10, MD);
      R(g, 11, 11, 2, 1, HL);
      R(g, 13, 14, 38, 5, MD);
      R(g, 15, 13, 30, 1, LT);
      R(g, 13, 14, 38, 1, HL);
      R(g, 13, 18, 38, 1, DK);
      R(g, 13, 19, 36, 1, DD);
      R(g, 22, 9, 16, 2, MD);
      R(g, 22, 9, 16, 1, HL);
      R(g, 20, 8, 6, 1, '#3e3546');
      R(g, 18, 10, 8, 1, DK);
      R(g, 16, 11, 6, 1, DD);
      R(g, 24, 21, 16, 2, MD);
      R(g, 24, 22, 16, 1, DK);
      R(g, 22, 21, 6, 1, '#3e3546');
      R(g, 18, 21, 8, 1, DK);
      R(g, 16, 21, 6, 1, DD);
      R(g, 49, 14, 9, 4, MD);
      R(g, 49, 14, 9, 1, HL);
      R(g, 49, 17, 9, 1, DK);
      R(g, 57, 15, 5, 2, MD);
      R(g, 57, 15, 5, 1, LT);
      R(g, 62, 15, 2, 1, LT);
      R(g, 44, 13, 5, 3, CY);
      R(g, 45, 13, 3, 1, CYH);
      R(g, 30, 15, 1, 4, DK);
      R(g, 40, 15, 1, 4, DK);
      R(g, 16, 16, 30, 1, CY);
      R(g, 20, 16, 14, 1, CYL);
      R(g, 46, 15, 1, 1, OR);
    },
    OUTLINE,
  );

/** Freighter bare hull (64×32): wide boxy body, stacked cargo containers, stubby nose. */
const freighterHull = (): HTMLCanvasElement =>
  make(
    64,
    32,
    (g) => {
      R(g, 7, 7, 44, 20, MD);
      R(g, 7, 7, 44, 1, HL);
      R(g, 9, 6, 38, 1, LT);
      R(g, 7, 26, 44, 1, DD);
      R(g, 7, 25, 44, 1, DK);
      R(g, 7, 7, 1, 20, HL);
      R(g, 50, 7, 1, 20, DK);
      // cargo containers: body + top highlight + bottom shadow + vertical corrugation
      const cont = (
        x: number,
        y: number,
        w: number,
        h: number,
        c: string,
        cl: string,
        cd: string,
      ): void => {
        R(g, x, y, w, h, c);
        R(g, x, y, w, 1, cl);
        R(g, x, y + h - 1, w, 1, cd);
        for (let i = x + 2; i < x + w - 1; i += 3) R(g, i, y + 1, 1, h - 2, cd);
      };
      cont(10, 8, 13, 8, '#7a6a55', '#ab947a', '#4c3e24');
      cont(24, 8, 12, 8, '#5e6450', '#92a984', '#374e4a');
      cont(37, 8, 11, 8, '#6e5a55', '#9b7e6a', '#45293f');
      cont(13, 17, 14, 8, '#5e6450', '#92a984', '#374e4a');
      cont(28, 17, 13, 8, '#7a6a55', '#ab947a', '#4c3e24');
      R(g, 51, 11, 8, 12, MD);
      R(g, 51, 11, 8, 1, HL);
      R(g, 51, 22, 8, 1, DK);
      R(g, 59, 13, 2, 8, MD);
      R(g, 53, 13, 5, 3, CY);
      R(g, 54, 13, 3, 1, CYH);
      R(g, 3, 11, 5, 5, DK);
      R(g, 2, 12, 1, 3, CYB);
      R(g, 3, 17, 5, 5, DK);
      R(g, 2, 18, 1, 3, CYB);
      R(g, 9, 16, 38, 1, '#4c3e24');
      R(g, 12, 24, 1, 1, OR);
      R(g, 40, 24, 1, 1, OR);
    },
    OUTLINE,
  );

// ─── Hull-aware compositor ───────────────────────────────────────────────────

/** A module slot type — maps to a set of mount points on a hull. */
export type HullSlot = 'weapon' | 'engine' | 'utility';

interface MountPoint {
  slot: HullSlot;
  /** X in the 72×40 composite field. */
  x: number;
  /** Y in the 72×40 composite field. */
  y: number;
  sprite: 'weapon' | 'turret' | 'engine' | 'util';
}

// Hull offset within the 72×40 composite (matches the design doc's buildOn convention).
const HULL_X = 4;
const HULL_Y = 5;

const HULL_MOUNTS: Record<string, readonly MountPoint[]> = {
  'hull-gunship': [
    { slot: 'weapon', x: HULL_X + 22, y: HULL_Y + 0, sprite: 'turret' },
    { slot: 'weapon', x: HULL_X + 34, y: HULL_Y + 0, sprite: 'turret' },
    { slot: 'weapon', x: HULL_X + 42, y: HULL_Y + 22, sprite: 'weapon' },
    { slot: 'engine', x: HULL_X - 2, y: HULL_Y + 11, sprite: 'engine' },
    { slot: 'utility', x: HULL_X + 15, y: HULL_Y + 2, sprite: 'util' },
  ],
  'hull-scout': [
    { slot: 'weapon', x: HULL_X + 40, y: HULL_Y + 13, sprite: 'weapon' },
    { slot: 'engine', x: HULL_X - 3, y: HULL_Y + 9, sprite: 'engine' },
    { slot: 'engine', x: HULL_X - 3, y: HULL_Y + 17, sprite: 'engine' },
    { slot: 'utility', x: HULL_X + 24, y: HULL_Y + 4, sprite: 'util' },
    { slot: 'utility', x: HULL_X + 30, y: HULL_Y + 22, sprite: 'util' },
  ],
  'hull-freighter': [
    { slot: 'weapon', x: HULL_X + 50, y: HULL_Y + 6, sprite: 'weapon' },
    { slot: 'engine', x: HULL_X - 3, y: HULL_Y + 9, sprite: 'engine' },
    { slot: 'engine', x: HULL_X - 3, y: HULL_Y + 18, sprite: 'engine' },
    { slot: 'utility', x: HULL_X + 22, y: HULL_Y + 1, sprite: 'util' },
  ],
  // hull-tactical uses gunship hull as a placeholder; 2W/2U/1E layout
  'hull-tactical': [
    { slot: 'weapon', x: HULL_X + 22, y: HULL_Y + 0, sprite: 'turret' },
    { slot: 'weapon', x: HULL_X + 34, y: HULL_Y + 0, sprite: 'turret' },
    { slot: 'engine', x: HULL_X - 2, y: HULL_Y + 11, sprite: 'engine' },
    { slot: 'utility', x: HULL_X + 15, y: HULL_Y + 2, sprite: 'util' },
    { slot: 'utility', x: HULL_X + 42, y: HULL_Y + 22, sprite: 'util' },
  ],
};

const MOUNT_SPRITE: Record<'weapon' | 'turret' | 'engine' | 'util', () => HTMLCanvasElement> = {
  weapon: moduleWeapon,
  turret: moduleTurret,
  engine: moduleEngine,
  util: moduleUtil,
};

const HULL_SPRITE: Record<string, () => HTMLCanvasElement> = {
  'hull-gunship': gunshipHullNew,
  'hull-scout': scoutHull,
  'hull-freighter': freighterHull,
  'hull-tactical': gunshipHullNew,
};

/**
 * Composites a 72×40 player-ship sprite: bare hull + module sprites at each
 * mount point. Filled mounts show the correct module art; empty mounts show
 * the open U-bracket placeholder, so a half-built ship reads intentional.
 */
export const compositeShipForHull = (
  hullId: string,
  slotCounts: Record<HullSlot, number>,
): HTMLCanvasElement => {
  const hull = (HULL_SPRITE[hullId] ?? HULL_SPRITE['hull-gunship'])();
  const mounts = HULL_MOUNTS[hullId] ?? HULL_MOUNTS['hull-gunship'];
  const { canvas, g } = makeCanvas(72, 40);
  g.drawImage(hull, HULL_X, HULL_Y);
  const filled: Record<HullSlot, number> = { weapon: 0, engine: 0, utility: 0 };
  for (const mount of mounts) {
    const isFilled = filled[mount.slot] < slotCounts[mount.slot];
    const sprite = isFilled ? MOUNT_SPRITE[mount.sprite]() : moduleEmpty();
    g.drawImage(sprite, mount.x, mount.y);
    if (isFilled) filled[mount.slot]++;
  }
  return canvas;
};

// ─── Module overlays (Collective: mechanical, ruler-drawn) ──────────────────
// Legacy overlay system — kept for reference; superseded by compositeShipForHull above.

export type ShipModuleKind = 'cannon' | 'shield' | 'engine' | 'armor';

/** Maps an installed module's name to the overlay category bolted onto the composited hull. */
export const shipModuleKind = (name: string): ShipModuleKind => {
  const n = name.toLowerCase();
  if (/flak|cannon|missile|laser|railgun|gun/.test(n)) return 'cannon';
  if (n.includes('shield')) return 'shield';
  if (/thruster|engine|hauler|drive/.test(n)) return 'engine';
  return 'armor'; // matrices, scanners, phase shifter → a generic plate
};

const cannonOverlay = (): HTMLCanvasElement =>
  make(
    16,
    10,
    (g) => {
      R(g, 0, 5, 7, 4, '#3e3546');
      R(g, 0, 5, 7, 1, '#625565');
      R(g, 3, 2, 6, 6, '#547e64');
      R(g, 3, 2, 6, 1, '#92a984');
      R(g, 3, 7, 6, 1, '#374e4a');
      R(g, 5, 4, 2, 2, '#0b8a8f');
      R(g, 9, 4, 6, 2, '#374e4a');
      R(g, 9, 4, 6, 1, '#547e64');
      R(g, 15, 4, 1, 2, '#f9c22b');
      R(g, 14, 4, 1, 2, '#fb6b1d');
    },
    OUTLINE,
  );

const shieldOverlay = (): HTMLCanvasElement =>
  make(
    14,
    12,
    (g) => {
      R(g, 2, 8, 8, 3, '#3e3546');
      R(g, 2, 8, 8, 1, '#625565');
      R(g, 5, 5, 3, 3, '#625565');
      R(g, 3, 2, 8, 3, '#0b8a8f');
      R(g, 3, 2, 8, 1, '#8ff8e2');
      R(g, 3, 4, 8, 1, '#0b5e65');
      R(g, 11, 3, 1, 1, '#30e1b9');
      R(g, 12, 5, 1, 1, '#8ff8e2');
      R(g, 11, 7, 1, 1, '#30e1b9');
    },
    OUTLINE,
  );

const engineOverlay = (): HTMLCanvasElement =>
  make(
    14,
    12,
    (g) => {
      R(g, 4, 3, 8, 6, '#374e4a');
      R(g, 4, 3, 8, 1, '#547e64');
      R(g, 4, 8, 8, 1, '#313638');
      R(g, 10, 4, 2, 4, '#625565');
      R(g, 5, 5, 4, 1, '#0b8a8f');
      R(g, 2, 4, 2, 4, '#3e3546');
      R(g, 0, 5, 2, 2, '#30e1b9');
      R(g, 1, 5, 1, 2, '#8ff8e2');
    },
    OUTLINE,
  );

const armorOverlay = (): HTMLCanvasElement =>
  make(
    14,
    12,
    (g) => {
      R(g, 2, 2, 10, 8, '#547e64');
      R(g, 2, 2, 10, 1, '#92a984');
      R(g, 2, 9, 10, 1, '#374e4a');
      R(g, 2, 2, 1, 8, '#92a984');
      R(g, 11, 2, 1, 8, '#374e4a');
      R(g, 2, 5, 10, 1, '#fbb954');
      R(g, 4, 4, 1, 1, '#313638');
      R(g, 9, 4, 1, 1, '#313638');
      R(g, 4, 7, 1, 1, '#313638');
      R(g, 9, 7, 1, 1, '#313638');
    },
    OUTLINE,
  );

const OVERLAY: Record<ShipModuleKind, () => HTMLCanvasElement> = {
  cannon: cannonOverlay,
  shield: shieldOverlay,
  engine: engineOverlay,
  armor: armorOverlay,
};

// Mount-slot offsets within the composite canvas (from the spec's composite demo).
const HULL_AT: [number, number] = [4, 5];
const SLOT: Record<ShipModuleKind, [number, number]> = {
  cannon: [16, 1],
  shield: [32, 2],
  engine: [0, 9],
  armor: [16, 22],
};

const gunshipHullFn = (g: Ctx): void => {
  // engine block
  R(g, 2, 8, 5, 12, '#374e4a');
  R(g, 2, 8, 5, 2, '#547e64');
  R(g, 2, 18, 5, 2, '#313638');
  R(g, 3, 10, 3, 1, '#0b8a8f');
  // thruster nozzles
  R(g, 0, 10, 2, 3, '#3e3546');
  R(g, 0, 11, 1, 1, '#30e1b9');
  R(g, 0, 15, 2, 3, '#3e3546');
  R(g, 0, 16, 1, 1, '#30e1b9');
  // fuselage
  R(g, 6, 10, 30, 8, '#547e64');
  R(g, 6, 10, 30, 2, '#92a984');
  R(g, 8, 10, 26, 1, '#b2ba90');
  R(g, 6, 16, 30, 2, '#374e4a');
  // nose taper
  R(g, 36, 11, 3, 6, '#547e64');
  R(g, 36, 11, 3, 1, '#92a984');
  R(g, 39, 12, 2, 4, '#92a984');
  R(g, 41, 13, 1, 2, '#b2ba90');
  // bridge
  R(g, 14, 6, 12, 4, '#547e64');
  R(g, 14, 6, 12, 1, '#b2ba90');
  R(g, 14, 9, 12, 1, '#374e4a');
  // cockpit
  R(g, 21, 7, 4, 2, '#0b8a8f');
  R(g, 22, 7, 3, 1, '#8ff8e2');
  // fins
  R(g, 8, 3, 4, 7, '#625565');
  R(g, 8, 3, 4, 1, '#9babb2');
  R(g, 9, 18, 5, 5, '#374e4a');
  R(g, 9, 22, 5, 1, '#313638');
  // panel seams
  R(g, 16, 11, 1, 5, '#374e4a');
  R(g, 24, 11, 1, 5, '#374e4a');
  R(g, 30, 11, 1, 5, '#374e4a');
  // side vent
  R(g, 10, 13, 4, 3, '#3e3546');
  R(g, 10, 13, 4, 1, '#625565');
  // energy conduit
  R(g, 17, 12, 9, 1, '#0b5e65');
  R(g, 19, 12, 4, 1, '#0eaf9b');
  // running lights
  R(g, 13, 17, 1, 1, '#fb6b1d');
  R(g, 21, 17, 1, 1, '#fb6b1d');
  R(g, 29, 17, 1, 1, '#fb6b1d');
};

/** Bare Gunship hull silhouette (44×28), nose pointing right. */
export const gunshipHull = (): HTMLCanvasElement => make(44, 28, gunshipHullFn, OUTLINE);

/**
 * The player ship as base hull + per-category module overlays composited onto mount
 * slots (the core fantasy: what you installed is what you see). 52×36, nose right.
 */
export const compositeShip = (kinds: readonly ShipModuleKind[]): HTMLCanvasElement => {
  const { canvas, g } = makeCanvas(52, 36);
  g.drawImage(gunshipHull(), HULL_AT[0], HULL_AT[1]);
  // One overlay per present category, stamped at its slot.
  for (const kind of ['cannon', 'shield', 'engine', 'armor'] as ShipModuleKind[]) {
    if (kinds.includes(kind)) {
      const [sx, sy] = SLOT[kind];
      g.drawImage(OVERLAY[kind](), sx, sy);
    }
  }
  return canvas;
};

/** Pure-orange muzzle flash (72×40, aligned to the compositeShipForHull nose) — a signal. */
export const muzzleFlash = (): HTMLCanvasElement =>
  make(72, 40, (g) => {
    R(g, 67, 20, 3, 1, '#f9c22b');
    R(g, 70, 19, 2, 3, OR);
    R(g, 71, 20, 1, 1, AMD);
  });

// ─── The Bloom (organic: sponge-drawn, breaks the grid) ─────────────────────

/** Mawling grunt (28×26): asymmetric biter, one sick-green eye, wet maw, shed spores. */
export const bloomGrunt = (): HTMLCanvasElement =>
  make(
    28,
    26,
    (g) => {
      blob(g, 14, 13, 9, 9, '#905ea9', 7, 2);
      blob(g, 13, 11, 4, 4, '#a884f3', 11, 1);
      blob(g, 15, 16, 4, 4, '#6b3e75', 13, 1);
      R(g, 9, 6, 8, 1, '#eaaded');
      // maw (left)
      R(g, 4, 11, 7, 6, '#831c5d');
      R(g, 5, 12, 5, 4, '#c32454');
      R(g, 5, 11, 1, 1, '#fca790');
      R(g, 7, 11, 1, 1, '#fca790');
      R(g, 9, 11, 1, 1, '#fca790');
      R(g, 6, 16, 1, 1, '#fca790');
      R(g, 8, 16, 1, 1, '#fca790');
      // eye
      R(g, 17, 9, 3, 3, '#165a4c');
      R(g, 18, 9, 2, 2, '#91db69');
      R(g, 18, 9, 1, 1, '#cddf6c');
      // spore spots
      R(g, 21, 13, 2, 2, '#1ebc73');
      R(g, 19, 17, 1, 1, '#91db69');
      R(g, 15, 20, 2, 1, '#a2a947');
      dither(g, 8, 8, 14, 10, '#a24b6f', 7, 0.12);
      // shed pixels (break the grid)
      R(g, 26, 11, 1, 1, '#905ea9');
      R(g, 2, 18, 1, 1, '#6b3e75');
      R(g, 24, 5, 1, 1, '#d5e04b');
      R(g, 3, 8, 1, 1, '#c32454');
    },
    OUTLINE,
  );

/**
 * Anchormaw lane boss (64×54), maw pointing left. Targetable organs read as distinct,
 * attackable growths fused to the body: a green Spore-Sac (upper right) and a rectilinear
 * amber Armor-Node (lower right — "co-opted Collective wreckage"). The pure-accent organ
 * cores are the only non-ramped pixels on the creature.
 */
export const anchormawBoss = (): HTMLCanvasElement =>
  make(
    64,
    54,
    (g) => {
      // main mass
      blob(g, 34, 28, 22, 22, '#6b3e75', 23, 3);
      blob(g, 29, 21, 13, 12, '#905ea9', 29, 2);
      blob(g, 38, 38, 15, 12, '#45293f', 31, 2);
      blob(g, 27, 19, 6, 5, '#a24b6f', 37, 1);
      // wet rim
      R(g, 22, 8, 14, 1, '#eaaded');
      R(g, 20, 9, 3, 1, '#a884f3');
      // maw (center-left)
      R(g, 8, 22, 16, 12, '#831c5d');
      R(g, 10, 24, 12, 8, '#45293f');
      R(g, 12, 26, 8, 4, '#c32454');
      // teeth
      for (const tx of [9, 12, 15, 18, 21]) R(g, tx, 21, 1, 2, '#fdcbb0');
      for (const tx of [10, 13, 16, 19]) R(g, tx, 33, 1, 2, '#fdcbb0');
      R(g, 7, 25, 2, 1, '#fca790');
      R(g, 7, 30, 2, 1, '#fca790');
      // SPORE-SAC (upper right) — flat green core = targetable
      blob(g, 46, 16, 9, 8, '#165a4c', 41, 1);
      blob(g, 46, 16, 7, 6, '#1ebc73', 43, 1);
      blob(g, 45, 15, 4, 3, '#91db69', 45, 1);
      R(g, 45, 15, 2, 2, '#cddf6c');
      R(g, 48, 18, 1, 1, '#fbff86');
      R(g, 44, 18, 1, 1, '#d5e04b');
      // ARMOR-NODE (lower right) — rectilinear amber shell
      R(g, 44, 34, 15, 12, '#753c54');
      R(g, 45, 35, 13, 10, '#9e4539');
      R(g, 45, 35, 13, 1, '#e6904e');
      R(g, 46, 36, 5, 4, '#fbb954');
      R(g, 52, 36, 5, 4, '#f79617');
      R(g, 46, 41, 11, 3, '#e6904e');
      R(g, 46, 36, 5, 1, '#f9c22b');
      R(g, 48, 38, 1, 1, '#4c3e24');
      R(g, 54, 38, 1, 1, '#4c3e24');
      // coral roots (anchor to lane)
      R(g, 20, 48, 2, 6, '#45293f');
      R(g, 28, 49, 2, 5, '#6b3e75');
      R(g, 36, 48, 2, 6, '#45293f');
      R(g, 44, 49, 1, 5, '#6b3e75');
      R(g, 15, 46, 2, 5, '#45293f');
      // spore motes
      R(g, 58, 12, 1, 1, '#cddf6c');
      R(g, 6, 18, 1, 1, '#91db69');
      R(g, 60, 40, 1, 1, '#a2a947');
      R(g, 5, 40, 1, 1, '#1ebc73');
      dither(g, 16, 12, 38, 32, '#a24b6f', 17, 0.07);
    },
    OUTLINE,
  );

// ─── Infested hyperspace lane backdrop ──────────────────────────────────────

/**
 * The lane: deep void → cool realspace beacon (the TRAVEL goal) → diagonal current →
 * Bloom coral creeping in the top & bottom edges → drifting spore motes. Parallax by
 * recolor (far coral dimmed toward void). A coded backdrop, exactly the spec's drawLane.
 */
export const laneBackdrop = (W: number, H: number, seed: number): HTMLCanvasElement =>
  make(W, H, (g) => {
    const r = rng(seed);
    // void gradient (top cool -> bottom faintly infected)
    for (let y = 0; y < H; y++) R(g, 0, y, W, 1, mix('#0b0d18', '#17111f', y / H));
    // far stars
    const starCols = ['#3e3546', '#484a77', '#625565', '#374e4a'];
    for (let i = 0; i < W * H * 0.03; i++) {
      R(g, (r() * W) | 0, (r() * H) | 0, 1, 1, starCols[(r() * starCols.length) | 0]);
    }
    for (let i = 0; i < W * 0.08; i++) {
      R(g, (r() * W) | 0, (r() * H) | 0, 1, 1, r() < 0.5 ? '#8fd3ff' : '#9babb2');
    }
    // realspace beacon (cool, far) upper-right-ish
    const bx = (W * 0.66) | 0;
    const by = (H * 0.26) | 0;
    blob(g, bx, by, 5, 4, mix('#323353', '#0b0d18', 0.3), 4, 1);
    blob(g, bx, by, 3, 2, '#4d65b4', 6, 1);
    R(g, bx - 1, by - 1, 2, 2, '#8fd3ff');
    R(g, bx, by, 1, 1, '#c7dcd0');
    for (const [dx, dy] of [
      [-4, -3],
      [4, -2],
      [3, 3],
      [-3, 3],
    ]) {
      R(g, bx + dx, by + dy, 1, 1, '#4d9be6');
    }
    // diagonal lane current
    for (let t = 0; t <= 1; t += 1 / (W * 1.4)) {
      const x = (t * W) | 0;
      const y = (H * 0.18 + t * H * 0.6) | 0;
      if (r() < 0.5) R(g, x, y, 1, 1, mix('#17111f', '#3a2740', 0.5));
      if (r() < 0.18) R(g, x, y - 1, 1, 1, '#45293f');
    }
    // coral infestation along the edges (depth by recolor toward the void)
    const coral = (cx: number, cy: number, sc: number, depth: number, sd: number): void => {
      const dim = (c: string): string => mix(c, '#0b0d18', depth * 0.62);
      blob(g, cx, cy, 3 + sc, 2 + sc * 0.8, dim('#6b3e75'), sd, 1 + sc * 0.3);
      blob(g, cx, cy - sc * 0.3, 2 + sc * 0.6, 1 + sc * 0.5, dim('#905ea9'), sd + 5, 1);
      R(g, cx, cy - 2 - sc, 1, 1, dim('#91db69'));
      R(g, cx + sc, cy - 1, 1, 1, dim('#1ebc73'));
      R(g, cx - sc, cy, 1, 1, dim('#a2a947'));
      const dir = cy < H / 2 ? 1 : -1;
      R(g, cx - 1, cy + dir * 2, 1, 2 + sc, dim('#45293f'));
      R(g, cx + 2, cy + dir, 1, 1 + sc, dim('#6b3e75'));
    };
    const sx = W / 220;
    const sy = H / 120;
    // top edge clusters
    coral(18 * sx, 6 * sy, 4, 0.0, 21);
    coral(70 * sx, 4 * sy, 3, 0.3, 22);
    coral(120 * sx, 8 * sy, 5, 0.0, 23);
    coral(165 * sx, 3 * sy, 2, 0.5, 24);
    coral(205 * sx, 7 * sy, 4, 0.15, 25);
    // bottom edge clusters
    coral(30 * sx, H - 6 * sy, 5, 0.0, 31);
    coral(95 * sx, H - 4 * sy, 3, 0.35, 32);
    coral(150 * sx, H - 8 * sy, 5, 0.0, 33);
    coral(190 * sx, H - 5 * sy, 4, 0.2, 34);
    coral(60 * sx, H - 3 * sy, 2, 0.5, 35);
    // mid-depth drifting growths
    coral(108 * sx, 64 * sy, 2, 0.55, 41);
    coral(48 * sx, 80 * sy, 2, 0.5, 42);
    // spore motes
    for (let i = 0; i < W * 0.27; i++) {
      const near = r();
      const c = near < 0.5 ? mix('#1ebc73', '#0b0d18', 0.4) : near < 0.8 ? '#91db69' : '#cddf6c';
      R(g, (r() * W) | 0, (r() * H) | 0, 1, 1, c);
    }
  });
