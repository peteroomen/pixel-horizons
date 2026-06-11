import { Application, Container, Graphics } from 'pixi.js';

import { TILE_SIZE } from '@/game/data/surface';
import { attackHitbox } from '@/game/surface/clone';
import { TILE_BREAKABLE, TILE_EMPTY, TILE_SOLID, tileAt } from '@/game/surface/tilemap';
import type { SurfaceState } from '@/game/surface/surface';
import { VIRTUAL_HEIGHT, VIRTUAL_WIDTH } from './pixel-scale';

/** Rocky biome tile colors. */
const COLOR_SOLID = 0x6b5a4a;
const COLOR_BREAKABLE = 0xa07a3a;
const COLOR_SKY = 0x1a1a2e;
const COLOR_CLONE = 0xc8d8e8;
const COLOR_VISOR = 0x4fc3f7;
const COLOR_SLASH = 0xffffff;

/** Backdrop rock sizes/positions — deterministic math, no RNG consumed. */
const BACKDROP_ROCKS = Array.from({ length: 24 }, (_, i) => ({
  x: (i * 137 + 31) % (VIRTUAL_WIDTH * 3),
  y: 20 + ((i * 97 + 13) % (VIRTUAL_HEIGHT - 80)),
  w: 4 + (i % 4) * 2,
  h: 3 + (i % 3),
}));

export interface SurfaceRenderer {
  sync(state: SurfaceState): void;
  destroy(): void;
}

export function createSurfaceRenderer(app: Application): SurfaceRenderer {
  const world = new Container();
  app.stage.addChild(world);

  // ── Sky backdrop ─────────────────────────────────────────────────────────
  const sky = new Graphics().rect(0, 0, VIRTUAL_WIDTH * 5, VIRTUAL_HEIGHT * 5).fill(COLOR_SKY);
  world.addChild(sky);

  // Backdrop silhouette rocks (static, drawn once)
  const bgRocks = new Graphics();
  for (const r of BACKDROP_ROCKS) {
    bgRocks.rect(r.x, r.y, r.w, r.h).fill(0x2a2a40);
  }
  world.addChild(bgRocks);

  // ── Tile layer ────────────────────────────────────────────────────────────
  const tileGfx = new Graphics();
  world.addChild(tileGfx);
  let lastTileVersion = -1;

  // ── Clone sprite ──────────────────────────────────────────────────────────
  const cloneBody = new Graphics()
    .rect(0, 0, 12, 20)
    .fill(COLOR_CLONE)
    .rect(1, 2, 10, 6)
    .fill(COLOR_VISOR);
  world.addChild(cloneBody);

  // ── Attack slash flash ────────────────────────────────────────────────────
  const slashGfx = new Graphics();
  world.addChild(slashGfx);

  return {
    sync(state: SurfaceState): void {
      const { map, clone } = state;

      // Rebuild tile layer only when version changes (a breakable was broken)
      if (map.version !== lastTileVersion) {
        lastTileVersion = map.version;
        tileGfx.clear();
        for (let ty = 0; ty < map.height; ty++) {
          for (let tx = 0; tx < map.width; tx++) {
            const tile = tileAt(map, tx, ty);
            if (tile === TILE_EMPTY) continue;

            const px = tx * TILE_SIZE;
            const py = ty * TILE_SIZE;

            if (tile === TILE_SOLID) {
              tileGfx.rect(px, py, TILE_SIZE, TILE_SIZE).fill(COLOR_SOLID);
            } else if (tile === TILE_BREAKABLE) {
              tileGfx.rect(px, py, TILE_SIZE, TILE_SIZE).fill(COLOR_BREAKABLE);
              // Crack mark — two diagonal lines
              tileGfx
                .moveTo(px + 4, py + 3)
                .lineTo(px + 8, py + 13)
                .stroke({ color: 0x6b4a1a, width: 1 });
              tileGfx
                .moveTo(px + 8, py + 3)
                .lineTo(px + 5, py + 10)
                .stroke({ color: 0x6b4a1a, width: 1 });
            }
          }
        }
      }

      // Clone position + flip for facing direction
      cloneBody.x = clone.body.x;
      cloneBody.y = clone.body.y;
      // Scale -1 on X mirrors the sprite; adjust pivot to keep position correct
      if (clone.facing === -1) {
        cloneBody.scale.x = -1;
        cloneBody.x = clone.body.x + clone.body.w;
      } else {
        cloneBody.scale.x = 1;
      }

      // Attack slash flash
      const hb = attackHitbox(clone);
      slashGfx.clear();
      if (hb !== null) {
        slashGfx.rect(hb.x, hb.y, hb.w, hb.h).fill({ color: COLOR_SLASH, alpha: 0.7 });
      }

      // Camera: follow clone center, integer-rounded, clamped to level bounds
      const levelW = map.width * TILE_SIZE;
      const levelH = map.height * TILE_SIZE;
      const cloneCenterX = clone.body.x + clone.body.w / 2;
      const cloneCenterY = clone.body.y + clone.body.h / 2;

      const camX = Math.round(
        Math.max(0, Math.min(cloneCenterX - VIRTUAL_WIDTH / 2, levelW - VIRTUAL_WIDTH)),
      );
      const camY = Math.round(
        Math.max(0, Math.min(cloneCenterY - VIRTUAL_HEIGHT / 2, levelH - VIRTUAL_HEIGHT)),
      );

      world.x = -camX;
      world.y = -camY;
    },
    destroy(): void {
      world.destroy({ children: true });
    },
  };
}
