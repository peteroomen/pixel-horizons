import { Application, Container, Graphics, Ticker } from 'pixi.js';

import type { CombatView } from '@/game/combat-view';
import { VIRTUAL_HEIGHT, VIRTUAL_WIDTH } from './pixel-scale';

const FLASH_MS = 160;
const PLAYER_X = 120;
const ENEMY_X = VIRTUAL_WIDTH - 140;
const CENTER_Y = VIRTUAL_HEIGHT / 2;

/**
 * Placeholder battle viewport (Slice 2.2): starfield, mechanical player ship vs organic
 * Bloom enemy, red hit-flash when either side loses HP, enemy fades on death, shield
 * ring while layers are up. All numbers/intents live in the DOM HUD — this layer is
 * scenery. `sync` is called once per combat event, never per frame; the only ticker
 * work is decaying the hit flashes.
 */
export interface SpaceRenderer {
  sync(view: CombatView): void;
  destroy(): void;
}

export function createSpaceRenderer(app: Application): SpaceRenderer {
  const scene = new Container();
  app.stage.addChild(scene);

  scene.addChild(buildStarfield());

  const playerShip = buildPlayerShip();
  playerShip.position.set(PLAYER_X, CENTER_Y);
  scene.addChild(playerShip);

  const shieldRing = new Graphics().ellipse(0, 0, 46, 30).stroke({ width: 2, color: 0x4fc3f7 });
  shieldRing.position.set(PLAYER_X, CENTER_Y);
  scene.addChild(shieldRing);

  const enemyShip = buildEnemyShip();
  enemyShip.position.set(ENEMY_X, CENTER_Y);
  scene.addChild(enemyShip);

  let prevHullHp: number | null = null;
  let prevEnemyHp: number | null = null;
  let playerFlashMs = 0;
  let enemyFlashMs = 0;
  let isBoss = false;
  let bossPhase = -1;

  const tick = (ticker: Ticker) => {
    playerFlashMs = Math.max(0, playerFlashMs - ticker.deltaMS);
    enemyFlashMs = Math.max(0, enemyFlashMs - ticker.deltaMS);
    playerShip.tint = playerFlashMs > 0 ? 0xff4444 : 0xffffff;
    if (enemyFlashMs > 0) {
      enemyShip.tint = 0xff4444;
    } else if (isBoss && bossPhase >= 0) {
      enemyShip.tint = 0xff6688;
    } else {
      enemyShip.tint = 0xffffff;
    }
  };
  app.ticker.add(tick);

  return {
    sync(view: CombatView): void {
      if (prevHullHp !== null && view.hullHp < prevHullHp) {
        playerFlashMs = FLASH_MS;
      }
      if (prevEnemyHp !== null && view.enemyHp < prevEnemyHp) {
        enemyFlashMs = FLASH_MS;
      }
      prevHullHp = view.hullHp;
      prevEnemyHp = view.enemyHp;

      isBoss = view.boss;
      bossPhase = view.bossPhase ?? -1;
      enemyShip.scale.set(view.boss ? 1.6 : 1);

      const layersUp = view.shields.filter((layer) => layer.up).length + view.tempShieldLayers;
      shieldRing.visible = layersUp > 0;
      shieldRing.alpha = Math.min(0.25 + layersUp * 0.2, 0.85);

      enemyShip.alpha = view.enemyHp > 0 ? 1 : 0.15;
      playerShip.alpha = view.hullHp > 0 ? 1 : 0.15;
    },
    destroy(): void {
      app.ticker.remove(tick);
      scene.destroy({ children: true });
    },
  };
}

/** Fixed pseudo-random star placement — deterministic math, no RNG stream consumed. */
function buildStarfield(): Graphics {
  const stars = new Graphics();
  for (let i = 0; i < 110; i++) {
    const x = (i * 131 + 47) % VIRTUAL_WIDTH;
    const y = (i * 73 + 29) % VIRTUAL_HEIGHT;
    const size = i % 7 === 0 ? 2 : 1;
    const dim = i % 3 === 0;
    stars.rect(x, y, size, size).fill({ color: dim ? 0x4a4a6a : 0x9a9ac0 });
  }
  return stars;
}

/** Chunky mechanical Collective ship, nose pointing right. Origin at its center. */
function buildPlayerShip(): Graphics {
  const ship = new Graphics()
    .rect(-32, -10, 48, 20)
    .fill(0x7a8a99)
    .rect(16, -6, 12, 12)
    .fill(0xaabbcc)
    .rect(-32, -16, 16, 6)
    .fill(0x5a6a79)
    .rect(-32, 10, 16, 6)
    .fill(0x5a6a79)
    .rect(-38, -4, 6, 8)
    .fill(0x4fc3f7)
    .rect(4, -4, 8, 8)
    .fill(0x223344);
  return ship;
}

/** Fleshy organic Bloom mass, maw pointing left. Origin at its center. */
function buildEnemyShip(): Graphics {
  const blob = new Graphics()
    .rect(-16, -18, 36, 36)
    .fill(0x8a3a5a)
    .rect(-24, -10, 8, 20)
    .fill(0xa44a6a)
    .rect(-30, -4, 6, 8)
    .fill(0xd06a8a)
    .rect(20, -12, 8, 24)
    .fill(0x6a2a4a)
    .rect(-12, -8, 6, 6)
    .fill(0xffd0e0)
    .rect(-12, 4, 6, 6)
    .fill(0xffd0e0);
  return blob;
}
