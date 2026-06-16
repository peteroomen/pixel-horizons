import { Application, Container, Graphics, Sprite, Texture, Ticker } from 'pixi.js';

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
import type { CloneState } from '@/game/surface/clone';
import type { WorldItem } from '@/game/surface/drops';
import type { EnemyState } from '@/game/surface/enemies';
import { ventsActive } from '@/game/surface/hazards';
import {
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
import {
  bedrockTile,
  biomineralTile,
  brambleTile,
  type ClonePose,
  cloneSprite,
  coreTile,
  corpseSprite,
  crumbleTile,
  fxDustSprite,
  fxShatterSprite,
  hiddenTile,
  type ItemKind,
  itemSprite,
  moteField,
  rockFillTile,
  rockSurfaceTile,
  scannedTile,
  scrapCacheTile,
  hopperSprite,
  grubberSprite,
  dropperSprite,
  podCampSprite,
  podLaunchSprite,
  surfaceBackdrop,
} from './surface-sprites';
import { nearestTexture } from './textures';

/** FOUNDRY accents used by the live (non-sprite) signal layers. */
const ACCENT_CYAN = 0x6ad1e3;
const ACCENT_RED = 0xff4757;
const ACCENT_GREEN = 0x8ac926;
const ACCENT_AMBER = 0xffb454;
const VENT_DUST = 0xfdcbb0; // tan plume (Resurrect 64 light sand)

/** Mining shatter / landing puff lifetimes (cosmetic, ms). */
const SHATTER_MS = 260;
const DUST_MS = 220;

const tex = (canvas: HTMLCanvasElement): Texture => nearestTexture(canvas);

export interface SurfaceRenderer {
  sync(state: SurfaceState): void;
  destroy(): void;
}

/** A short-lived world-space effect sprite that fades and is culled by the FX ticker. */
interface Effect {
  sprite: Sprite;
  ageMs: number;
  lifeMs: number;
}

/** Pick the clone pose sprite from sim state (no sim coupling — pure derivation). */
function poseFor(clone: CloneState): ClonePose {
  if (clone.attackElapsedMs >= 0) return 'melee';
  if (!clone.grounded) return clone.body.vy < 0 ? 'jump' : 'air';
  return clone.body.vx !== 0 ? 'run' : 'idle';
}

/** Dominant resource decides a dropped item's tint (the design's "tint = source"). */
function itemKindFor(item: WorldItem): ItemKind {
  if (item.resources.coreCrystals > 0) return 'core';
  if (item.resources.biominerals > 0) return 'biomineral';
  return 'scrap';
}

export function createSurfaceRenderer(app: Application): SurfaceRenderer {
  // ── Static textures, built once (client-side) and shared across all sprites ──
  const TILE_TEX = {
    fill: tex(rockFillTile()),
    surface: tex(rockSurfaceTile()),
    bedrock: tex(bedrockTile()),
    biomineral: tex(biomineralTile()),
    scrap: tex(scrapCacheTile()),
    scanned: tex(scannedTile()),
    hidden: tex(hiddenTile()),
    core: tex(coreTile()),
    bramble: tex(brambleTile()),
    crumble: tex(crumbleTile()),
  };
  const POSE_TEX: Record<ClonePose, Texture> = {
    idle: tex(cloneSprite('idle')),
    run: tex(cloneSprite('run')),
    jump: tex(cloneSprite('jump')),
    air: tex(cloneSprite('air')),
    melee: tex(cloneSprite('melee')),
  };
  const POD_CAMP_TEX = tex(podCampSprite());
  const POD_LAUNCH_TEX = tex(podLaunchSprite());
  const ENEMY_TEX: Record<EnemyState['type'], Texture> = {
    hopper: tex(hopperSprite()),
    grubber: tex(grubberSprite()),
    dropper: tex(dropperSprite()),
  };
  const ITEM_TEX: Record<ItemKind, Texture> = {
    biomineral: tex(itemSprite('biomineral')),
    scrap: tex(itemSprite('scrap')),
    core: tex(itemSprite('core')),
  };
  const CORPSE_TEX = tex(corpseSprite());
  const SHATTER_TEX = tex(fxShatterSprite());
  const DUST_TEX = tex(fxDustSprite());

  // ── Layer 0: cave-mouth backdrop (screen-fixed) + drifting spore motes ──────
  const bg = new Container();
  app.stage.addChildAt(bg, 0);
  const backdrop = new Sprite(tex(surfaceBackdrop(VIRTUAL_WIDTH, VIRTUAL_HEIGHT)));
  bg.addChild(backdrop);
  const motes = moteField(VIRTUAL_WIDTH, VIRTUAL_HEIGHT, 44);
  const moteGfx = new Graphics();
  bg.addChild(moteGfx);

  // ── Layer 1: world (camera-offset) ─────────────────────────────────────────
  const world = new Container();
  app.stage.addChild(world);

  const tileLayer = new Container();
  world.addChild(tileLayer);
  let lastTileVersion = -1;

  const sandstormGfx = new Graphics();
  world.addChild(sandstormGfx);

  const podSprite = new Sprite(POD_CAMP_TEX);
  podSprite.anchor.set(0.5, 1);
  world.addChild(podSprite);

  const corpse = new Sprite(CORPSE_TEX);
  corpse.anchor.set(0.5, 1);
  corpse.visible = false;
  world.addChild(corpse);

  const enemyLayer = new Container();
  world.addChild(enemyLayer);
  const enemySprites: Sprite[] = [];

  const itemLayer = new Container();
  world.addChild(itemLayer);
  const itemSprites: Sprite[] = [];

  const ghostGfx = new Graphics();
  world.addChild(ghostGfx);

  const shieldGfx = new Graphics();
  world.addChild(shieldGfx);

  const cloneSpr = new Sprite(POSE_TEX.idle);
  cloneSpr.anchor.set(0, 0);
  world.addChild(cloneSpr);

  const slashGfx = new Graphics();
  world.addChild(slashGfx);

  const fxLayer = new Container();
  world.addChild(fxLayer);
  const effects: Effect[] = [];

  // ── Layer 2: screen-space overlays (ambient gloom, flash, fade, beacon) ─────
  const overlay = new Container();
  app.stage.addChild(overlay);
  const ambientGfx = new Graphics();
  overlay.addChild(ambientGfx);
  const flashGfx = new Graphics();
  overlay.addChild(flashGfx);
  const fadeGfx = new Graphics();
  overlay.addChild(fadeGfx);
  const beaconGfx = new Graphics();
  overlay.addChild(beaconGfx);

  // Spawn a one-shot world-space effect at (x, y).
  const spawnEffect = (texture: Texture, x: number, y: number, lifeMs: number): void => {
    const s = new Sprite(texture);
    s.anchor.set(0.5, 0.5);
    s.x = x;
    s.y = y;
    fxLayer.addChild(s);
    effects.push({ sprite: s, ageMs: 0, lifeMs });
  };

  // Cosmetic animation clock (renderer-local — the space-renderer precedent). Drives
  // mote drift + effect fade. Game state never updates here.
  let motePhase = 0;
  const animate = (ticker: Ticker): void => {
    motePhase += ticker.deltaMS;
    moteGfx.clear();
    for (let i = 0; i < motes.length; i++) {
      const m = motes[i];
      const drift = (motePhase * 0.006 + i * 13) % (VIRTUAL_HEIGHT + 8);
      const y = (m.y + drift) % (VIRTUAL_HEIGHT + 8);
      const x = m.x + Math.sin((motePhase * 0.0008 + i) * Math.PI) * 3;
      moteGfx.rect(x, y - 4, 1, 1).fill({ color: m.green ? 0x1ebc73 : 0xcddf6c, alpha: 0.5 });
    }
    for (let i = effects.length - 1; i >= 0; i--) {
      const fx = effects[i];
      fx.ageMs += ticker.deltaMS;
      const t = fx.ageMs / fx.lifeMs;
      if (t >= 1) {
        fx.sprite.destroy();
        effects.splice(i, 1);
      } else {
        fx.sprite.alpha = 1 - t;
      }
    }
  };
  app.ticker.add(animate);

  // Land-detection + tile-break (mining) edges, for FX spawning.
  let wasGrounded = false;
  let prevVy = 0;

  return {
    sync(state: SurfaceState): void {
      const { map, clone } = state;

      // ── Tile layer — rebuilt only on version change (a breakable was mined) ──
      if (map.version !== lastTileVersion) {
        // A version bump means a tile just broke → mining shatter at the hitbox.
        if (lastTileVersion !== -1) {
          const hb = attackHitbox(clone);
          if (hb !== null) {
            spawnEffect(SHATTER_TEX, hb.x + hb.w / 2, hb.y + hb.h / 2, SHATTER_MS);
          }
        }
        lastTileVersion = map.version;
        tileLayer.removeChildren();
        for (let ty = 0; ty < map.height; ty++) {
          for (let tx = 0; tx < map.width; tx++) {
            const t = tileAt(map, tx, ty);
            if (t === TILE_EMPTY) continue;
            const exposed = tileAt(map, tx, ty - 1) === TILE_EMPTY;
            let texture: Texture;
            if (t === TILE_SOLID) texture = TILE_TEX.bedrock;
            else if (t === TILE_DEPOSIT_BIOMINERAL) texture = TILE_TEX.biomineral;
            else if (t === TILE_SCRAP_CACHE) texture = TILE_TEX.scrap;
            else if (t === TILE_CORE_CRYSTAL) texture = TILE_TEX.core;
            else if (t === TILE_SPIKE_BRAMBLE) texture = TILE_TEX.bramble;
            else if (t === TILE_CRUMBLING) texture = TILE_TEX.crumble;
            else if (t === TILE_DEPOSIT_HIDDEN) {
              // Scanner reveals the cyan vein; otherwise it reads as plain rock.
              texture = state.loadout.scanner
                ? TILE_TEX.scanned
                : exposed
                  ? TILE_TEX.surface
                  : TILE_TEX.hidden;
            } else {
              // TILE_BREAKABLE: sunlit crust if its top is exposed to air.
              texture = exposed ? TILE_TEX.surface : TILE_TEX.fill;
            }
            const s = new Sprite(texture);
            s.x = tx * TILE_SIZE;
            s.y = ty * TILE_SIZE;
            tileLayer.addChild(s);
          }
        }
      }

      // ── Drop pod: open base-camp normally, orange burn on launch ──
      const { pod } = state;
      if (pod === null) {
        podSprite.visible = false;
      } else {
        podSprite.visible = true;
        podSprite.texture = pod.launched ? POD_LAUNCH_TEX : POD_CAMP_TEX;
        podSprite.x = pod.x + POD_WIDTH / 2;
        podSprite.y = pod.y + POD_HEIGHT;
        // Amber urgency pulse in the final window (the HUD countdown is the main clock).
        const warn =
          !pod.launched &&
          pod.remainingMs <= POD_WARNING_MS &&
          Math.floor(pod.remainingMs / 250) % 2 === 0;
        podSprite.tint = warn ? ACCENT_AMBER : 0xffffff;
      }

      // ── Clone: pose + facing flip + i-frame blink + death fade ──
      cloneSpr.texture = POSE_TEX[poseFor(clone)];
      cloneSpr.scale.x = clone.facing;
      cloneSpr.x = clone.facing === 1 ? clone.body.x : clone.body.x + clone.body.w;
      cloneSpr.y = clone.body.y;
      const blink = clone.iframesMs > 0 && Math.floor(clone.iframesMs / 50) % 2 === 0 ? 0.35 : 1;
      cloneSpr.alpha = clone.dead ? Math.max(0, clone.deathFadeMs / DEATH_FADE_MS) : blink;

      // ── Dash afterimage ──
      ghostGfx.clear();
      if (clone.dashGhostMs > 0) {
        ghostGfx
          .rect(clone.dashFromX, clone.dashFromY, clone.body.w, clone.body.h)
          .fill({ color: ACCENT_CYAN, alpha: 0.4 * (clone.dashGhostMs / DASH_GHOST_MS) });
      }

      // ── Melee slash — a cyan signal over the active hitbox ──
      const hb = attackHitbox(clone);
      slashGfx.clear();
      if (hb !== null) {
        slashGfx.rect(hb.x, hb.y + 2, hb.w, hb.h - 4).fill({ color: ACCENT_CYAN, alpha: 0.5 });
        slashGfx.rect(hb.x + hb.w - 2, hb.y, 2, hb.h).fill({ color: 0xffffff, alpha: 0.8 });
      }

      // ── Sandstorm vents: grate + amber chevrons + telegraphed tan plume ──
      sandstormGfx.clear();
      for (const vent of map.vents) {
        const gy = vent.y + TILE_SIZE - 4;
        sandstormGfx.rect(vent.x + 2, gy, TILE_SIZE - 4, 4).fill(0x374e4a);
        sandstormGfx.rect(vent.x + 2, gy, TILE_SIZE - 4, 1).fill(0x547e64);
        for (let sx = vent.x + 3; sx < vent.x + TILE_SIZE - 2; sx += 2) {
          sandstormGfx.rect(sx, gy + 1, 1, 3).fill(0x2e222f);
        }
        // amber warning chevrons on the lip
        for (let cx = vent.x + 3; cx < vent.x + TILE_SIZE - 2; cx += 4) {
          sandstormGfx.rect(cx, gy - 1, 2, 1).fill(ACCENT_AMBER);
        }
      }
      if (ventsActive(state.ventPhaseMs)) {
        for (const vent of map.vents) {
          const cx = vent.x + TILE_SIZE / 2;
          const baseY = vent.y + TILE_SIZE - 4;
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
            .fill({ color: VENT_DUST, alpha: 0.18 });
          for (let p = 0; p < 3; p++) {
            const py = baseY - ((state.ventPhaseMs / 12 + p * 26) % VENT_PUSH_HEIGHT);
            sandstormGfx.rect(cx - 2, py, 4, 3).fill({ color: VENT_DUST, alpha: 0.5 });
          }
        }
      }

      // ── Enemies (sprite pool, keyed by index) ──
      for (let i = 0; i < state.enemies.length; i++) {
        let s = enemySprites[i];
        if (s === undefined) {
          s = new Sprite(Texture.EMPTY);
          enemyLayer.addChild(s);
          enemySprites[i] = s;
        }
        const enemy = state.enemies[i];
        if (!enemy.alive) {
          s.visible = false;
          continue;
        }
        s.visible = true;
        s.texture = ENEMY_TEX[enemy.type];
        const { x, y, w, h } = enemy.body;
        if (enemy.type === 'dropper') {
          s.anchor.set(0.5, 0);
          s.x = x + w / 2;
          s.y = y;
        } else {
          s.anchor.set(0.5, 1);
          s.x = x + w / 2;
          s.y = y + h;
        }
        s.scale.x = enemy.facing;
      }

      // ── World items (sprite pool, tinted by source) ──
      for (let i = 0; i < state.worldItems.length; i++) {
        let s = itemSprites[i];
        if (s === undefined) {
          s = new Sprite(Texture.EMPTY);
          s.anchor.set(0.5, 0.5);
          itemLayer.addChild(s);
          itemSprites[i] = s;
        }
        const item = state.worldItems[i];
        s.visible = true;
        s.texture = ITEM_TEX[itemKindFor(item)];
        s.x = item.x + 8;
        s.y = item.y + 8;
      }
      for (let i = state.worldItems.length; i < itemSprites.length; i++) {
        itemSprites[i].visible = false;
      }

      // ── Corpse husk + beacon ──
      if (state.corpse !== null) {
        corpse.visible = true;
        corpse.x = state.corpse.x + 0.5;
        corpse.y = state.corpse.y + TILE_SIZE;
      } else {
        corpse.visible = false;
      }

      // ── Shield bubble ring (bright = ready, dim = recharging) ──
      shieldGfx.clear();
      if (clone.shield !== null && !clone.dead) {
        const cx = clone.body.x + clone.body.w / 2;
        const cy = clone.body.y + clone.body.h / 2;
        shieldGfx
          .circle(cx, cy, clone.body.h / 2 + 3)
          .stroke({ color: ACCENT_CYAN, width: 1, alpha: clone.shield.ready ? 0.8 : 0.2 });
      }

      // ── Landing puff on the grounded false→true edge (only from a real fall) ──
      if (clone.grounded && !wasGrounded && prevVy > 120) {
        spawnEffect(
          DUST_TEX,
          clone.body.x + clone.body.w / 2,
          clone.body.y + clone.body.h,
          DUST_MS,
        );
      }
      wasGrounded = clone.grounded;
      prevVy = clone.body.vy;

      // ── Camera follow + hit-shake (deterministic) ──
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
      // Ambient descent gloom — cooler/darker the deeper the clone is.
      ambientGfx.clear();
      const depthT = levelH > VIRTUAL_HEIGHT ? camY / (levelH - VIRTUAL_HEIGHT) : 0;
      if (depthT > 0.02) {
        ambientGfx
          .rect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT)
          .fill({ color: 0x0b0d18, alpha: 0.28 * Math.min(1, depthT) });
      }
      // Red hit flash
      flashGfx.clear();
      if (clone.hitFlashMs > 0) {
        flashGfx
          .rect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT)
          .fill({ color: ACCENT_RED, alpha: 0.35 * (clone.hitFlashMs / HIT_FLASH_MS) });
      }
      // Death fade-to-black
      fadeGfx.clear();
      if (clone.dead) {
        const t = 1 - clone.deathFadeMs / DEATH_FADE_MS;
        fadeGfx.rect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT).fill({ color: 0x000000, alpha: 0.7 * t });
      }
      // Off-screen corpse beacon — a green edge marker toward a distant corpse.
      beaconGfx.clear();
      if (state.corpse !== null) {
        const dx = state.corpse.x - cloneCenterX;
        const dy = state.corpse.y - cloneCenterY;
        if (Math.hypot(dx, dy) > CORPSE_BEACON_RANGE) {
          const ex = Math.max(6, Math.min(VIRTUAL_WIDTH - 10, VIRTUAL_WIDTH / 2 + dx));
          const ey = Math.max(6, Math.min(VIRTUAL_HEIGHT - 10, VIRTUAL_HEIGHT / 2 + dy));
          beaconGfx.rect(ex, ey, 5, 5).fill(ACCENT_GREEN);
        }
      }
    },
    destroy(): void {
      app.ticker.remove(animate);
      for (const fx of effects) fx.sprite.destroy();
      effects.length = 0;
      overlay.destroy({ children: true });
      world.destroy({ children: true });
      bg.destroy({ children: true });
    },
  };
}
