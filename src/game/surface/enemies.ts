import {
  CONTACT_DAMAGE,
  DROPPER_DROP_SCRAP,
  DROPPER_HEIGHT,
  DROPPER_HP,
  DROPPER_SHIELD_FLING_VY,
  DROPPER_STUN_MS,
  DROPPER_TRIGGER_HALF_WIDTH,
  DROPPER_WIDTH,
  GRAVITY,
  GRUBBER_CHASE_SPEED,
  GRUBBER_DROP_SCRAP,
  GRUBBER_HEIGHT,
  GRUBBER_HP,
  GRUBBER_WANDER_SPEED,
  GRUBBER_WIDTH,
  HOPPER_AGGRO_RANGE,
  HOPPER_DROP_SCRAP,
  HOPPER_HEIGHT,
  HOPPER_HP,
  HOPPER_LEAP_COOLDOWN_MS,
  HOPPER_LEAP_VX,
  HOPPER_LEAP_VY,
  HOPPER_PATROL_RANGE,
  HOPPER_PATROL_SPEED,
  HOPPER_WIDTH,
  MAX_FALL_SPEED,
  TILE_SIZE,
} from '@/game/data/surface';
import type { Resources } from '@/game/sim/run-state';
import { attackHitbox, damageClone } from './clone';
import type { CloneState } from './clone';
import { moveBody } from './physics';
import type { Body } from './physics';
import type { EnemySpawn, SurfaceEnemyType, Tilemap } from './tilemap';

/** Live Sector-1 surface enemy (GDD §6.7). Spawn-driven, no RNG. */
export interface EnemyState {
  type: SurfaceEnemyType;
  body: Body;
  hp: number;
  alive: boolean;
  facing: 1 | -1;
  grounded: boolean;
  /** Spawn column anchor (px) — patrol range is measured from here. */
  homeX: number;
  /** Grubber: provoked (attacked or cornered) → chases and deals contact damage. */
  provoked: boolean;
  /** Dropper: still clinging to the ceiling (no gravity until released). */
  clinging: boolean;
  /** Multi-purpose timer: Hopper leap cooldown, Dropper landing-stun (ms). */
  cooldownMs: number;
  /** Brief window after a melee hit during which this enemy can't be re-hit (ms). */
  hitCooldownMs: number;
}

/** A resource bundle dropped at a world position when an enemy dies (GDD §6.5). */
export interface EnemyDrop {
  resources: Resources;
  x: number;
  y: number;
}

/** Per-swing window an enemy is immune to re-hits — one swing = one hit. */
const MELEE_HIT_COOLDOWN_MS = 300;
/** Knockback applied to an enemy struck by melee (px/s). */
const ENEMY_KNOCKBACK_VX = 80;
/** Range within which an un-provoked Grubber flees the clone (px). */
const GRUBBER_FLEE_RANGE = 2 * TILE_SIZE;

function scrap(amount: number): Resources {
  return { scrap: amount, biominerals: 0, coreCrystals: 0, blueprints: 0 };
}

function dimensions(type: SurfaceEnemyType): { w: number; h: number; hp: number } {
  switch (type) {
    case 'hopper':
      return { w: HOPPER_WIDTH, h: HOPPER_HEIGHT, hp: HOPPER_HP };
    case 'grubber':
      return { w: GRUBBER_WIDTH, h: GRUBBER_HEIGHT, hp: GRUBBER_HP };
    case 'dropper':
      return { w: DROPPER_WIDTH, h: DROPPER_HEIGHT, hp: DROPPER_HP };
  }
}

/** Build live enemies from the level's spawn tokens. */
export function createEnemies(map: Tilemap): EnemyState[] {
  return map.enemySpawns.map((spawn: EnemySpawn) => {
    const { w, h, hp } = dimensions(spawn.type);
    return {
      type: spawn.type,
      body: { x: spawn.x, y: spawn.y, w, h, vx: 0, vy: 0 },
      hp,
      alive: true,
      facing: 1,
      grounded: false,
      homeX: spawn.x,
      provoked: false,
      clinging: spawn.type === 'dropper',
      cooldownMs: 0,
      hitCooldownMs: 0,
    };
  });
}

function overlaps(a: Body, b: { x: number; y: number; w: number; h: number }): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function centerX(body: Body): number {
  return body.x + body.w / 2;
}

function applyGravity(body: Body, dtMs: number): void {
  body.vy = Math.min(body.vy + (GRAVITY * dtMs) / 1000, MAX_FALL_SPEED);
}

/**
 * Advance all enemies one fixed step (GDD §6.7). Resolves clone melee → enemy
 * damage/death, runs per-type AI + physics, then enemy → clone contact damage.
 * Mutates enemies and the clone in place; returns drops from kills this step.
 */
export function updateEnemies(
  enemies: EnemyState[],
  clone: CloneState,
  map: Tilemap,
  dtMs: number,
): EnemyDrop[] {
  const drops: EnemyDrop[] = [];
  const hb = attackHitbox(clone);

  for (const enemy of enemies) {
    if (!enemy.alive) continue;
    enemy.hitCooldownMs = Math.max(0, enemy.hitCooldownMs - dtMs);

    // ── Clone melee → enemy (one hit per swing via hitCooldown) ──
    if (hb !== null && enemy.hitCooldownMs <= 0 && overlaps(enemy.body, hb)) {
      enemy.hp -= clone.capabilities.meleeDamage;
      enemy.hitCooldownMs = MELEE_HIT_COOLDOWN_MS;
      enemy.provoked = true;
      enemy.clinging = false;
      enemy.body.vx = clone.facing * ENEMY_KNOCKBACK_VX;
      if (enemy.hp <= 0) {
        enemy.alive = false;
        drops.push({ resources: scrap(dropScrap(enemy.type)), x: enemy.body.x, y: enemy.body.y });
        continue;
      }
    }

    // ── Per-type AI ──
    switch (enemy.type) {
      case 'hopper':
        stepHopper(enemy, clone, dtMs);
        break;
      case 'grubber':
        stepGrubber(enemy, clone, dtMs);
        break;
      case 'dropper':
        stepDropper(enemy, clone, dtMs);
        break;
    }

    // ── Physics (clinging droppers float; everyone else falls) ──
    if (!(enemy.type === 'dropper' && enemy.clinging)) {
      applyGravity(enemy.body, dtMs);
      const result = moveBody(enemy.body, map, dtMs);
      const wasGrounded = enemy.grounded;
      enemy.grounded = result.onGround;
      if (result.hitWall) {
        enemy.facing = enemy.facing === 1 ? -1 : 1;
        // A fleeing Grubber pinned against a wall near the clone is cornered.
        if (
          enemy.type === 'grubber' &&
          !enemy.provoked &&
          Math.abs(centerX(clone.body) - centerX(enemy.body)) <= GRUBBER_FLEE_RANGE
        ) {
          enemy.provoked = true;
        }
      }
      if (enemy.type === 'dropper' && !wasGrounded && result.onGround) {
        enemy.cooldownMs = DROPPER_STUN_MS; // landing stun
      }
    }

    // ── Enemy → clone contact damage ──
    const harmful = enemy.type !== 'grubber' || enemy.provoked;
    if (harmful && overlaps(enemy.body, clone.body)) {
      const result = damageClone(clone, CONTACT_DAMAGE, centerX(enemy.body));
      // Shield Bubble flings a Ceiling Dropper upward on absorb (GDD §6.7).
      if (result === 'shielded' && enemy.type === 'dropper') {
        enemy.clinging = false;
        enemy.grounded = false;
        enemy.body.vy = DROPPER_SHIELD_FLING_VY;
      }
    }
  }

  return drops;
}

function dropScrap(type: SurfaceEnemyType): number {
  switch (type) {
    case 'hopper':
      return HOPPER_DROP_SCRAP;
    case 'grubber':
      return GRUBBER_DROP_SCRAP;
    case 'dropper':
      return DROPPER_DROP_SCRAP;
  }
}

function stepHopper(enemy: EnemyState, clone: CloneState, dtMs: number): void {
  enemy.cooldownMs = Math.max(0, enemy.cooldownMs - dtMs);
  if (!enemy.grounded) return; // mid-leap: keep the arc velocity

  const dx = centerX(clone.body) - centerX(enemy.body);
  if (Math.abs(dx) <= HOPPER_AGGRO_RANGE && enemy.cooldownMs <= 0) {
    // Leap toward the clone
    enemy.facing = dx >= 0 ? 1 : -1;
    enemy.body.vx = enemy.facing * HOPPER_LEAP_VX;
    enemy.body.vy = HOPPER_LEAP_VY;
    enemy.cooldownMs = HOPPER_LEAP_COOLDOWN_MS;
    return;
  }

  // Patrol within ±range of home
  if (enemy.body.x <= enemy.homeX - HOPPER_PATROL_RANGE) enemy.facing = 1;
  else if (enemy.body.x >= enemy.homeX + HOPPER_PATROL_RANGE) enemy.facing = -1;
  enemy.body.vx = enemy.facing * HOPPER_PATROL_SPEED;
}

function stepGrubber(enemy: EnemyState, clone: CloneState, dtMs: number): void {
  void dtMs;
  if (!enemy.grounded) return;
  const dx = centerX(clone.body) - centerX(enemy.body);

  if (enemy.provoked) {
    enemy.facing = dx >= 0 ? 1 : -1;
    enemy.body.vx = enemy.facing * GRUBBER_CHASE_SPEED;
    return;
  }

  if (Math.abs(dx) <= GRUBBER_FLEE_RANGE) {
    // Flee away from the clone; the post-move wall check below provokes it
    // if it's cornered (GDD §6.7 — "attacks only if cornered or attacked").
    enemy.facing = dx >= 0 ? -1 : 1;
    enemy.body.vx = enemy.facing * GRUBBER_WANDER_SPEED;
    return;
  }

  // Idle wander within patrol range
  if (enemy.body.x <= enemy.homeX - HOPPER_PATROL_RANGE) enemy.facing = 1;
  else if (enemy.body.x >= enemy.homeX + HOPPER_PATROL_RANGE) enemy.facing = -1;
  enemy.body.vx = enemy.facing * GRUBBER_WANDER_SPEED;
}

function stepDropper(enemy: EnemyState, clone: CloneState, dtMs: number): void {
  enemy.cooldownMs = Math.max(0, enemy.cooldownMs - dtMs);
  if (enemy.clinging) {
    // Release when the clone passes beneath (aligned horizontally, lower on screen)
    const aligned =
      Math.abs(centerX(clone.body) - centerX(enemy.body)) <= DROPPER_TRIGGER_HALF_WIDTH;
    const below = clone.body.y > enemy.body.y;
    if (aligned && below) enemy.clinging = false;
    return;
  }
  // Grounded + stunned: hold still (the stun timer ticks down above).
  if (enemy.grounded && enemy.cooldownMs > 0) enemy.body.vx = 0;
}
