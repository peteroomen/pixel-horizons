/**
 * Ball (probe) sprite factory — a verbatim port of `_makeBall` / `_ballColors` from
 * `docs/design/mining-run-v2.dc.html`. Five ball types with distinct silhouettes (shape reads
 * before hue): standard round, heavy with rivet studs, split twin half-spheres, drill (the only
 * non-circular — elongated point), and ghost (translucent, dashed).
 */

import type { Texture } from 'pixi.js';

import type { BallType } from '@/game/surface/core-breaker';

import { type Ctx, R, blob, make, canvasTexture, EDGE } from './sprite-toolkit';

interface BallColors {
  body: string;
  lite: string;
  core: string;
  acc: string;
}

const BALL_COLORS: Record<BallType, BallColors> = {
  standard: { body: '#e6904e', lite: '#fbb954', core: '#fbff86', acc: '#ff9e2c' },
  heavy: { body: '#cd683d', lite: '#e6904e', core: '#ffb454', acc: '#ff9e2c' },
  split: { body: '#9aa6c9', lite: '#dbe2f2', core: '#ffffff', acc: '#aab6e0' },
  drill: { body: '#239aa6', lite: '#6ad1e3', core: '#8ff8e2', acc: '#6ad1e3' },
  ghost: { body: '#1f5a52', lite: '#0b8a8f', core: '#8ff8e2', acc: '#30e1b9' },
};

export function ballColors(type: BallType): BallColors {
  return BALL_COLORS[type];
}

function makeBall(type: BallType): HTMLCanvasElement {
  const c = BALL_COLORS[type];

  // STANDARD — clean small round sphere.
  if (type === 'standard') {
    return make(
      10,
      10,
      (g: Ctx) => {
        blob(g, 5, 5, 3.2, 3.2, c.body, 61, 0.3);
        blob(g, 4.2, 4.1, 1.8, 1.8, c.lite, 63, 0.3);
        R(g, 4, 4, 1, 1, c.core);
      },
      EDGE,
    );
  }

  // HEAVY — visibly bigger, rivet studs at cardinals, dense.
  if (type === 'heavy') {
    return make(
      13,
      13,
      (g: Ctx) => {
        blob(g, 6.5, 6.5, 5, 5, c.body, 71, 0.4);
        blob(g, 5.6, 5.6, 2.8, 2.8, c.lite, 73, 0.3);
        R(g, 6, 6, 2, 2, c.core);
        R(g, 0, 5, 2, 3, c.acc);
        R(g, 11, 5, 2, 3, c.acc);
        R(g, 5, 0, 3, 2, c.acc);
        R(g, 5, 11, 3, 2, c.acc);
        R(g, 0, 6, 1, 1, '#fbe6c0');
        R(g, 12, 6, 1, 1, '#fbe6c0');
        R(g, 6, 0, 1, 1, '#fbe6c0');
        R(g, 6, 12, 1, 1, '#fbe6c0');
      },
      '#5a2f18',
    );
  }

  // SPLIT — two half-spheres with a clear seam gap down the middle.
  if (type === 'split') {
    return make(
      11,
      10,
      (g: Ctx) => {
        blob(g, 3, 5, 2.5, 3, c.body, 81, 0.3);
        blob(g, 8, 5, 2.5, 3, c.body, 83, 0.3);
        blob(g, 2.6, 4.2, 1.2, 1.4, c.lite, 85, 0.3);
        blob(g, 7.6, 4.2, 1.2, 1.4, c.lite, 87, 0.3);
        R(g, 2, 4, 1, 1, c.core);
        R(g, 7, 4, 1, 1, c.core);
        g.clearRect(5, 1, 1, 8);
        R(g, 5, 2, 1, 6, c.acc);
      },
      EDGE,
    );
  }

  // DRILL — the only non-circular ball: elongated vertical, pointed tip.
  if (type === 'drill') {
    return make(
      8,
      13,
      (g: Ctx) => {
        R(g, 3, 0, 2, 1, c.lite);
        R(g, 2, 1, 4, 2, c.body);
        R(g, 1, 3, 6, 6, c.body);
        R(g, 1, 9, 6, 2, c.body);
        R(g, 2, 11, 4, 1, c.body);
        R(g, 3, 1, 2, 9, c.lite);
        R(g, 3, 2, 2, 2, c.core);
        R(g, 1, 4, 1, 4, '#11525a');
        R(g, 6, 4, 1, 4, '#11525a');
        R(g, 3, 10, 2, 1, c.core);
      },
      EDGE,
    );
  }

  // GHOST — translucent, dashed outline (rendered at reduced alpha), wisp tail.
  return make(11, 11, (g: Ctx) => {
    blob(g, 5.5, 5, 3.6, 3.4, c.body, 91, 0.6);
    blob(g, 5.5, 4.6, 2.2, 2, c.lite, 93, 0.5);
    g.clearRect(4, 4, 2, 2);
    g.clearRect(7, 3, 1, 1);
    g.clearRect(3, 6, 1, 1);
    R(g, 4, 2, 1, 1, c.core);
    R(g, 8, 7, 1, 1, c.core);
    R(g, 3, 9, 1, 1, c.body);
    R(g, 6, 9, 1, 1, c.body);
    R(g, 8, 9, 1, 1, c.body);
  });
}

/** Build every ball-type texture. Type-keyed; planet-independent (fixed probe palettes). */
export function buildBallSprites(): Record<BallType, Texture> {
  const out = {} as Record<BallType, Texture>;
  for (const type of Object.keys(BALL_COLORS) as BallType[]) {
    out[type] = canvasTexture(makeBall(type));
  }
  return out;
}
