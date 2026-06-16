import { Application, Container, Graphics } from 'pixi.js';

import {
  CORPSE_BEACON_RANGE,
  DASH_GHOST_MS,
  DEATH_FADE_MS,
  HIT_FLASH_MS,
  POD_HEIGHT,
  POD_WARNING_MS,
  POD_WIDTH,
  TILE_SIZE,
  VENT_PUSH_HEIGHT,
} from '@/game/data/surface';
import { attackHitbox } from '@/game/surface/clone';
import { ventsActive } from '@/game/surface/hazards';
import {
  TILE_BREAKABLE,
  TILE_CORE_CRYSTAL,
  TILE_CRUMBLING,
  TILE_DEPOSIT_BIOMINERAL,
  TILE_DEPOSIT_HIDDEN,
  TILE_EMPTY,
  TILE_SCRAP_CACHE,
  TILE_SOLID,
  TILE_SPIKE_BRAMBLE,
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
// 3.4 threats + feedback
const COLOR_BRAMBLE = 0x7a5a3a;
const COLOR_BRAMBLE_SPIKE = 0xd0b070;
const COLOR_CRUMBLE = 0xc2a060;
const COLOR_CRUMBLE_CRACK = 0x6b4a1a;
const COLOR_VENT = 0x5a4a6a;
const COLOR_VENT_DUST = 0xc9b8e8;
const COLOR_HOPPER = 0x6fd06f;
const COLOR_GRUBBER = 0x9a8a6a;
const COLOR_DROPPER = 0xb060d0;
const COLOR_ENEMY_EYE = 0x1a1a2e;
const COLOR_WORLD_ITEM = 0xc8c8d0;
const COLOR_CORPSE = 0x6fff9f;
const COLOR_SHIELD = 0x4fc3f7;
const COLOR_HIT_FLASH = 0xe94560;

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

  // ── Dynamic world entities (enemies, drops, corpse, shield) ─────────────────
  // Redrawn each sync — small counts, simpler than diffed sprite pools.
  const sandstormGfx = new Graphics();
  world.addChild(sandstormGfx);
  const enemyGfx = new Graphics();
  world.addChild(enemyGfx);
  const itemGfx = new Graphics();
  world.addChild(itemGfx);
  const corpseGfx = new Graphics();
  world.addChild(corpseGfx);
  const shieldGfx = new Graphics();
  world.addChild(shieldGfx);

  // ── Screen-space overlays (not camera-offset): hit flash, death fade, beacon.
  const overlay = new Container();
  app.stage.addChild(overlay);
  const flashGfx = new Graphics();
  overlay.addChild(flashGfx);
  const fadeGfx = new Graphics();
  overlay.addChild(fadeGfx);
  const beaconGfx = new Graphics();
  overlay.addChild(beaconGfx);

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
            } else if (tile === TILE_SPIKE_BRAMBLE) {
              // Non-solid hazard: a low spiky bed sitting on the tile floor
              tileGfx.rect(px, py + 10, TILE_SIZE, 6).fill(COLOR_BRAMBLE);
              tileGfx
                .moveTo(px + 2, py + 10)
                .lineTo(px + 5, py + 2)
                .lineTo(px + 8, py + 10)
                .lineTo(px + 11, py + 3)
                .lineTo(px + 14, py + 10)
                .fill(COLOR_BRAMBLE_SPIKE);
            } else if (tile === TILE_CRUMBLING) {
              // Sandstone block with a crack — looks load-bearing but isn't
              tileGfx.rect(px, py, TILE_SIZE, TILE_SIZE).fill(COLOR_CRUMBLE);
              tileGfx
                .moveTo(px + 5, py)
                .lineTo(px + 8, py + 8)
                .lineTo(px + 5, py + TILE_SIZE)
                .stroke({ color: COLOR_CRUMBLE_CRACK, width: 1 });
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
      // i-frame blink (~10 Hz) and a fade-out during the death sequence.
      const blink = clone.iframesMs > 0 && Math.floor(clone.iframesMs / 50) % 2 === 0 ? 0.35 : 1;
      cloneBody.alpha = clone.dead ? Math.max(0, clone.deathFadeMs / DEATH_FADE_MS) : blink;

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

      // Sandstorm Vent: a floor grate that puffs a widening dust plume while
      // active (telegraphed). The plume matches the push zone height so the
      // hazard reads as a vent, not a stray marker.
      sandstormGfx.clear();
      for (const vent of map.vents) {
        // Floor grate with slats, flush to the bottom of the vent tile
        const gy = vent.y + TILE_SIZE - 4;
        sandstormGfx.rect(vent.x + 1, gy, TILE_SIZE - 2, 4).fill(COLOR_VENT);
        for (let sx = vent.x + 3; sx < vent.x + TILE_SIZE - 2; sx += 4) {
          sandstormGfx.rect(sx, gy + 1, 1, 2).fill(0x0d0d18);
        }
      }
      if (ventsActive(state.ventPhaseMs)) {
        for (const vent of map.vents) {
          const cx = vent.x + TILE_SIZE / 2;
          const baseY = vent.y + TILE_SIZE - 4;
          // Plume: trapezoid widening upward over the push zone
          sandstormGfx
            .poly([
              cx - 4,
              baseY,
              cx + 4,
              baseY,
              cx + 9,
              baseY - VENT_PUSH_HEIGHT,
              cx - 9,
              baseY - VENT_PUSH_HEIGHT,
            ])
            .fill({ color: COLOR_VENT_DUST, alpha: 0.22 });
          // A few rising puffs for life
          for (let p = 0; p < 3; p++) {
            const py = baseY - ((state.ventPhaseMs / 12 + p * 26) % VENT_PUSH_HEIGHT);
            sandstormGfx.rect(cx - 2, py, 4, 3).fill({ color: COLOR_VENT_DUST, alpha: 0.5 });
          }
        }
      }

      // Enemies — redrawn each frame (small counts)
      enemyGfx.clear();
      for (const enemy of state.enemies) {
        if (!enemy.alive) continue;
        const color =
          enemy.type === 'hopper'
            ? COLOR_HOPPER
            : enemy.type === 'grubber'
              ? COLOR_GRUBBER
              : COLOR_DROPPER;
        const { x, y, w, h } = enemy.body;
        enemyGfx.rect(x, y, w, h).fill(color);
        // Eye toward facing — a little life cue
        const eyeX = enemy.facing === 1 ? x + w - 4 : x + 2;
        enemyGfx.rect(eyeX, y + 3, 2, 2).fill(COLOR_ENEMY_EYE);
      }

      // World items (floor-bounced drops)
      itemGfx.clear();
      for (const item of state.worldItems) {
        itemGfx.rect(item.x + 5, item.y + 9, 6, 5).fill(COLOR_WORLD_ITEM);
      }

      // Corpse marker (neon-green beacon block)
      corpseGfx.clear();
      if (state.corpse !== null) {
        corpseGfx
          .rect(state.corpse.x + 1, state.corpse.y + 8, 10, 10)
          .fill({ color: COLOR_CORPSE, alpha: 0.85 });
      }

      // Shield Bubble ring around the clone (bright = ready, dim = recharging)
      shieldGfx.clear();
      if (clone.shield !== null && !clone.dead) {
        const cx = clone.body.x + clone.body.w / 2;
        const cy = clone.body.y + clone.body.h / 2;
        shieldGfx
          .circle(cx, cy, clone.body.h / 2 + 3)
          .stroke({ color: COLOR_SHIELD, width: 1, alpha: clone.shield.ready ? 0.8 : 0.2 });
      }

      // Camera: follow clone center, integer-rounded, clamped to level bounds,
      // plus a short hit-shake jitter (deterministic from the shake clock).
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

      const shake = clone.shakeMs > 0 ? (Math.floor(clone.shakeMs / 33) % 2 === 0 ? 2 : -2) : 0;
      world.x = -camX + shake;
      world.y = -camY;

      // ── Screen-space overlays ──
      // Red hit flash
      flashGfx.clear();
      if (clone.hitFlashMs > 0) {
        flashGfx
          .rect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT)
          .fill({ color: COLOR_HIT_FLASH, alpha: 0.35 * (clone.hitFlashMs / HIT_FLASH_MS) });
      }
      // Death fade-to-black
      fadeGfx.clear();
      if (clone.dead) {
        const t = 1 - clone.deathFadeMs / DEATH_FADE_MS;
        fadeGfx.rect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT).fill({ color: 0x000000, alpha: 0.7 * t });
      }
      // Off-screen corpse beacon: an edge marker pointing toward a distant corpse
      beaconGfx.clear();
      if (state.corpse !== null) {
        const dx = state.corpse.x - cloneCenterX;
        const dy = state.corpse.y - cloneCenterY;
        if (Math.hypot(dx, dy) > CORPSE_BEACON_RANGE) {
          const ex = Math.max(4, Math.min(VIRTUAL_WIDTH - 8, VIRTUAL_WIDTH / 2 + dx));
          const ey = Math.max(4, Math.min(VIRTUAL_HEIGHT - 8, VIRTUAL_HEIGHT / 2 + dy));
          beaconGfx.rect(ex, ey, 4, 4).fill(COLOR_CORPSE);
        }
      }
    },
    destroy(): void {
      overlay.destroy({ children: true });
      world.destroy({ children: true });
    },
  };
}
