/**
 * Peg (formation) sprite factory — a verbatim port of `_makePeg` from
 * `docs/design/mining-run-v2.dc.html`. Each of the 6 peg kinds has a distinct silhouette that
 * reads at gameplay zoom by shape alone; ore/crystal/rock/hard show progressive damage stages.
 *
 * The planet `Ramp` (lightest→darkest) maps onto the prototype's [L0,L1,M,MD,DK,DD] roles, so
 * mineral/ore/rock pegs recolour to the planet hue family while hard/crystal/bloom keep their
 * fixed signal palettes (steel/cyan/magenta) — readable across every planet.
 */

import type { Texture } from 'pixi.js';

import type { PegKind } from '@/game/surface/core-breaker';
import { PEG_STAGES } from '@/game/data/mining-run';

import type { Ramp } from '../palette';
import { type Ctx, R, mix, blob, make, canvasTexture, EDGE } from './sprite-toolkit';

/** Build one peg sprite canvas for (kind, stage) themed by the planet ramp. */
function makePeg(kind: PegKind, ramp: Ramp, stage: number): HTMLCanvasElement {
  const [L0, L1, M, MD, DK, DD] = ramp;

  // BIOMINERAL — rounded slab, planet face, green neon edge.
  if (kind === 'mineral') {
    return make(
      14,
      13,
      (g: Ctx) => {
        const x = 2,
          y = 2,
          w = 10,
          h = 9;
        R(g, x, y, w, h, M);
        g.clearRect(x, y, 1, 1);
        g.clearRect(x + w - 1, y, 1, 1);
        g.clearRect(x, y + h - 1, 1, 1);
        g.clearRect(x + w - 1, y + h - 1, 1, 1);
        R(g, x + 1, y, w - 2, 1, L1);
        R(g, x, y + 1, 1, h - 2, L1);
        R(g, x + 1, y + h - 1, w - 2, 1, DK);
        R(g, x + w - 1, y + 1, 1, h - 2, DK);
        R(g, x + 2, y + 2, 3, 2, L0);
        R(g, x + 5, y + 5, 2, 2, MD);
        R(g, x + 2, y + 6, 2, 1, '#cddf6c');
      },
      '#8ac926',
    );
  }

  // SCRAP — angular steel slab, rust rivets, steel neon edge (fixed signal palette).
  if (kind === 'hard') {
    const S0 = '#c4cbd2',
      S1 = '#8b939c',
      S2 = '#5c636e',
      S3 = '#3a3f48';
    return make(
      14,
      12,
      (g: Ctx) => {
        const x = 2,
          y = 2,
          w = 10,
          h = 8;
        R(g, x, y, w, h, S2);
        R(g, x, y, w, 1, S0);
        R(g, x, y + 1, 1, h - 1, S1);
        R(g, x, y + h - 1, w, 1, S3);
        R(g, x + w - 1, y + 1, 1, h - 1, S3);
        R(g, x + 1, y + 2, w - 2, 1, mix(S2, S1, 0.5));
        R(g, x + 2, y + 2, 1, 1, '#ff9e2c');
        R(g, x + w - 3, y + 2, 1, 1, '#ff9e2c');
        R(g, x + 2, y + h - 3, 1, 1, '#cd683d');
        R(g, x + w - 3, y + h - 3, 1, 1, '#cd683d');
        if (stage >= 1) {
          R(g, x + 5, y + 1, 1, h - 2, mix(S3, '#000', 0.4));
          R(g, x + 2, y + 4, w - 4, 1, mix(S3, '#000', 0.3));
          g.clearRect(x + w - 2, y + 1, 1, 1);
        }
      },
      '#9aa0ad',
    );
  }

  // DENSE VEIN — long horizontal bar, planet body, amber neon, cracks per hit.
  if (kind === 'ore') {
    return make(
      24,
      10,
      (g: Ctx) => {
        const x = 2,
          y = 2,
          w = 20,
          h = 6;
        R(g, x, y, w, h, MD);
        R(g, x, y, w, 1, L1);
        R(g, x, y + 1, 1, h - 1, mix(L1, M, 0.5));
        R(g, x, y + h - 1, w, 1, DK);
        R(g, x + w - 1, y + 1, 1, h - 1, DK);
        for (let i = 0; i < 5; i++) {
          const fx = x + 2 + i * 4;
          R(g, fx, y + 1, 1, 2, L0);
          R(g, fx + 1, y + 3, 1, 2, M);
        }
        if (stage < 1) {
          R(g, x + 5, y + 1, 1, 1, '#fbff86');
          R(g, x + 13, y + 2, 1, 1, '#fbff86');
        }
        if (stage >= 1) {
          R(g, x + 6, y, 1, h, mix(DK, '#000', 0.4));
        }
        if (stage >= 2) {
          R(g, x + 14, y, 1, h, mix(DK, '#000', 0.4));
          R(g, x + 3, y + 3, w - 6, 1, mix(DK, '#000', 0.3));
        }
      },
      '#ffb454',
    );
  }

  // CORE CRYSTAL — diamond, prismatic shell cracks to a bright cyan core (fixed signal palette).
  if (kind === 'crystal') {
    return make(
      16,
      16,
      (g: Ctx) => {
        const bx = 8,
          by = 8;
        if (stage < 2) {
          for (let dy = -5; dy <= 5; dy++) {
            const hw = 5 - Math.abs(dy);
            if (hw < 0) continue;
            R(g, bx - hw, by + dy, hw * 2 + 1, 1, dy < 0 ? mix(MD, L1, 0.35) : MD);
          }
          R(g, bx - 3, by - 3, 2, 1, L0);
        }
        const cr = 2 + stage;
        for (let dy = -cr; dy <= cr; dy++) {
          const hw = cr - Math.abs(dy);
          R(g, bx - hw, by + dy, hw * 2 + 1, 1, '#0b8a8f');
        }
        for (let dy = -(cr - 1); dy <= cr - 1; dy++) {
          const hw = cr - 1 - Math.abs(dy);
          R(g, bx - hw, by + dy, hw * 2 + 1, 1, '#6ad1e3');
        }
        R(g, bx - 1, by - 1, 2, 2, '#8ff8e2');
        if (stage >= 1) {
          R(g, bx + 2, by - 2, 1, 1, '#0b0d18');
          R(g, bx - 3, by + 1, 1, 1, '#0b0d18');
        }
      },
      '#6ad1e3',
    );
  }

  // INERT ROCK — triangle/wedge deflector, planet ramp, NO neon (dead rock).
  if (kind === 'rock') {
    return make(
      15,
      13,
      (g: Ctx) => {
        const bx = 7,
          top = 2,
          base = 10;
        for (let y = top; y <= base; y++) {
          const t = (y - top) / (base - top);
          const hw = Math.round(t * 6);
          R(g, bx - hw, y, hw * 2 + 1, 1, y < top + 2 ? M : MD);
          R(g, bx - hw, y, 1, 1, L1);
          R(g, bx + hw, y, 1, 1, DK);
        }
        R(g, bx - 6, base, 13, 1, DD);
        R(g, bx, top, 1, 2, L0);
        if (stage >= 1) {
          R(g, bx, top + 2, 1, base - top - 2, mix(DK, '#000', 0.4));
          g.clearRect(bx + 3, base - 1, 2, 1);
        }
      },
      EDGE,
    );
  }

  // BLOOM — fleshy magenta sac hazard, pale rib flecks, dark maw (fixed signal palette).
  return make(
    16,
    16,
    (g: Ctx) => {
      const cx = 8,
        cy = 8;
      blob(g, cx, cy, 6, 5.6, '#9c2f5e', 201, 1.0);
      blob(g, cx, cy, 5, 4.8, '#d6457a', 203, 0.8);
      blob(g, cx - 1, cy - 1, 3, 2.8, '#e85d8a', 205, 0.6);
      R(g, cx - 5, cy - 2, 1, 1, '#e8dcc8');
      R(g, cx + 4, cy - 3, 1, 1, '#e8dcc8');
      R(g, cx + 3, cy + 3, 1, 1, '#e8dcc8');
      R(g, cx - 4, cy + 2, 1, 1, '#e8dcc8');
      R(g, cx + 1, cy - 5, 1, 1, '#e8dcc8');
      blob(g, cx, cy + 1, 2.2, 1.9, '#3a1228', 207, 0.4);
      R(g, cx - 1, cy, 2, 1, '#160610');
    },
    '#ff5ca0',
  );
}

/** Build every (kind, stage) texture for a planet ramp. Call once per biome change. */
export function buildPegSprites(ramp: Ramp): Record<PegKind, Texture[]> {
  const out = {} as Record<PegKind, Texture[]>;
  for (const kind of Object.keys(PEG_STAGES) as PegKind[]) {
    const stages: Texture[] = [];
    for (let s = 0; s < PEG_STAGES[kind]; s++) {
      stages.push(canvasTexture(makePeg(kind, ramp, s)));
    }
    out[kind] = stages;
  }
  return out;
}
