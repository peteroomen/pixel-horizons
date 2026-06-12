import { Application, Container, Graphics } from 'pixi.js';

import {
  DASH_GHOST_MS,
  POD_HEIGHT,
  POD_WARNING_MS,
  POD_WIDTH,
  TILE_SIZE,
} from '@/game/data/surface';
import { attackHitbox } from '@/game/surface/clone';
import {
  TILE_BREAKABLE,
  TILE_CORE_CRYSTAL,
  TILE_DEPOSIT_BIOMINERAL,
  TILE_DEPOSIT_HIDDEN,
  TILE_EMPTY,
  TILE_SCRAP_CACHE,
  TILE_SOLID,
  tileAt,
} from '@/game/surface/tilemap';
import type { SurfaceState } from '@/game/surface/surface';
import { VIRTUAL_HEIGHT, VIRTUAL_WIDTH } from './pixel-scale';

/** Rocky biome tile colors. */
const COLOR_SOLID = 0x6b5a4a;
const COLOR_BREAKABLE = 0xa07a3a;
const COLOR_DEPOSIT = 0x3a8a6a;
const COLOR_DEPOSIT_FLECK = 0x6fd0a8;
const COLOR_CACHE = 0x8a8a92;
const COLOR_CACHE_SEAM = 0x55555e;
const COLOR_SCANNER_RING = 0xffd24a;
const COLOR_CRYSTAL = 0xd070f0;
const COLOR_CRYSTAL_FACET = 0xf0b8ff;
const COLOR_SKY = 0x1a1a2e;
const COLOR_CLONE = 0xc8d8e8;
const COLOR_VISOR = 0x4fc3f7;
const COLOR_SLASH = 0xffffff;
const COLOR_POD_HULL = 0xb0b8c0;
const COLOR_POD_HULL_WARN = 0xe94560;
const COLOR_POD_WINDOW = 0x4fc3f7;
const COLOR_POD_BASE = 0x55555e;

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

  // ── Drop pod ──────────────────────────────────────────────────────────────
  // Two hull variants (normal / warning tint) so the urgency flash is a
  // visibility toggle, not a per-frame Graphics rebuild.
  const buildPodGfx = (hullColor: number): Graphics =>
    new Graphics()
      // landing skids
      .rect(0, POD_HEIGHT - 4, POD_WIDTH, 4)
      .fill(COLOR_POD_BASE)
      // capsule hull
      .rect(2, 4, POD_WIDTH - 4, POD_HEIGHT - 8)
      .fill(hullColor)
      // nose cap
      .rect(6, 0, POD_WIDTH - 12, 4)
      .fill(hullColor)
      // viewport window
      .rect(8, 12, POD_WIDTH - 16, 10)
      .fill(COLOR_POD_WINDOW);
  const podGfx = buildPodGfx(COLOR_POD_HULL);
  const podWarnGfx = buildPodGfx(COLOR_POD_HULL_WARN);
  world.addChild(podGfx);
  world.addChild(podWarnGfx);

  // ── Clone sprite ──────────────────────────────────────────────────────────
  const cloneBody = new Graphics()
    .rect(0, 0, 12, 20)
    .fill(COLOR_CLONE)
    .rect(1, 2, 10, 6)
    .fill(COLOR_VISOR);
  world.addChild(cloneBody);

  // ── Dash afterimage ghost ─────────────────────────────────────────────────
  const ghostGfx = new Graphics();
  world.addChild(ghostGfx);

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
            } else if (tile === TILE_DEPOSIT_BIOMINERAL) {
              // Crystal flecks read as "minable" against the plain rock ochre
              tileGfx
                .rect(px, py, TILE_SIZE, TILE_SIZE)
                .fill(COLOR_DEPOSIT)
                .rect(px + 3, py + 4, 3, 3)
                .fill(COLOR_DEPOSIT_FLECK)
                .rect(px + 9, py + 8, 3, 3)
                .fill(COLOR_DEPOSIT_FLECK)
                .rect(px + 5, py + 11, 2, 2)
                .fill(COLOR_DEPOSIT_FLECK);
            } else if (tile === TILE_SCRAP_CACHE) {
              // Metallic block with a seam line
              tileGfx
                .rect(px, py, TILE_SIZE, TILE_SIZE)
                .fill(COLOR_CACHE)
                .rect(px + 2, py + 7, TILE_SIZE - 4, 2)
                .fill(COLOR_CACHE_SEAM);
            } else if (tile === TILE_DEPOSIT_HIDDEN) {
              if (state.loadout.scanner) {
                // Revealed: rich vein with a scanner ring marker
                tileGfx
                  .rect(px, py, TILE_SIZE, TILE_SIZE)
                  .fill(COLOR_DEPOSIT)
                  .rect(px + 4, py + 4, 4, 4)
                  .fill(COLOR_DEPOSIT_FLECK)
                  .rect(px + 9, py + 9, 3, 3)
                  .fill(COLOR_DEPOSIT_FLECK);
                tileGfx
                  .rect(px + 1, py + 1, TILE_SIZE - 2, TILE_SIZE - 2)
                  .stroke({ color: COLOR_SCANNER_RING, width: 1 });
              } else {
                // Unscanned: indistinguishable from plain breakable rock
                tileGfx.rect(px, py, TILE_SIZE, TILE_SIZE).fill(COLOR_BREAKABLE);
                tileGfx
                  .moveTo(px + 4, py + 3)
                  .lineTo(px + 8, py + 13)
                  .stroke({ color: 0x6b4a1a, width: 1 });
                tileGfx
                  .moveTo(px + 8, py + 3)
                  .lineTo(px + 5, py + 10)
                  .stroke({ color: 0x6b4a1a, width: 1 });
              }
            } else if (tile === TILE_CORE_CRYSTAL) {
              // Faceted crystal — visibly rarer than anything else on the level
              tileGfx
                .rect(px, py, TILE_SIZE, TILE_SIZE)
                .fill(COLOR_CRYSTAL)
                .rect(px + 3, py + 3, 4, 6)
                .fill(COLOR_CRYSTAL_FACET)
                .rect(px + 9, py + 7, 4, 5)
                .fill(COLOR_CRYSTAL_FACET);
            }
          }
        }
      }

      // Pod position + urgency flash (derived from sim time — deterministic)
      const { pod } = state;
      if (pod === null || pod.launched) {
        podGfx.visible = false;
        podWarnGfx.visible = false;
      } else {
        const flashWarn =
          pod.remainingMs <= POD_WARNING_MS && Math.floor(pod.remainingMs / 250) % 2 === 0;
        podGfx.visible = !flashWarn;
        podWarnGfx.visible = flashWarn;
        podGfx.x = pod.x;
        podGfx.y = pod.y;
        podWarnGfx.x = pod.x;
        podWarnGfx.y = pod.y;
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

      // Dash afterimage — fades over DASH_GHOST_MS of sim time
      ghostGfx.clear();
      if (clone.dashGhostMs > 0) {
        ghostGfx
          .rect(clone.dashFromX, clone.dashFromY, clone.body.w, clone.body.h)
          .fill({ color: COLOR_VISOR, alpha: 0.4 * (clone.dashGhostMs / DASH_GHOST_MS) });
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
