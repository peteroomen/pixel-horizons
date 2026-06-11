import {
  ATTACK_ACTIVE_FROM_MS,
  ATTACK_ACTIVE_TO_MS,
  ATTACK_COOLDOWN_MS,
  ATTACK_DURATION_MS,
  ATTACK_HEIGHT,
  ATTACK_RANGE,
  CLONE_HEIGHT,
  CLONE_WIDTH,
  COYOTE_TIME_MS,
  GRAVITY,
  JUMP_BUFFER_MS,
  JUMP_CUT_MULTIPLIER,
  JUMP_VELOCITY,
  MAX_FALL_SPEED,
  MOVE_SPEED,
  TILE_SIZE,
} from '@/game/data/surface';
import { moveBody } from './physics';
import { breakTile, maxEdgeTileIndex } from './tilemap';
import type { Tilemap } from './tilemap';

export interface InputState {
  left: boolean;
  right: boolean;
  jump: boolean;
  attack: boolean;
}

export interface CloneState {
  body: {
    x: number;
    y: number;
    w: number;
    h: number;
    vx: number;
    vy: number;
  };
  /** 1 = facing right, -1 = facing left. */
  facing: 1 | -1;
  grounded: boolean;
  /** Remaining window for a coyote jump (ms). Zero when on ground or expired. */
  coyoteMs: number;
  /** Remaining buffer window for a jump press before landing (ms). */
  jumpBufferMs: number;
  /** True while a jump is in progress and the button is still held. */
  jumpHeld: boolean;
  /**
   * Elapsed time in the current attack animation (ms). -1 means idle (no attack).
   */
  attackElapsedMs: number;
  /** Remaining cooldown before another attack can start (ms). */
  attackCooldownMs: number;
  /** Jump button state last frame — used for rising-edge detection. */
  prevJump: boolean;
  /** Attack button state last frame — used for rising-edge detection. */
  prevAttack: boolean;
}

/** Spawn the clone at the level's designated spawn point. */
export function createClone(map: Tilemap): CloneState {
  return {
    body: {
      x: map.spawnX,
      y: map.spawnY,
      w: CLONE_WIDTH,
      h: CLONE_HEIGHT,
      vx: 0,
      vy: 0,
    },
    facing: 1,
    grounded: false,
    coyoteMs: 0,
    jumpBufferMs: 0,
    jumpHeld: false,
    attackElapsedMs: -1,
    attackCooldownMs: 0,
    prevJump: false,
    prevAttack: false,
  };
}

/**
 * Returns the attack hitbox rect (x, y, w, h in world space) while the
 * attack animation is in its active window, or null otherwise. Used by
 * the renderer for the slash flash and by updateClone for tile breaking.
 */
export function attackHitbox(
  clone: CloneState,
): { x: number; y: number; w: number; h: number } | null {
  if (
    clone.attackElapsedMs < 0 ||
    clone.attackElapsedMs < ATTACK_ACTIVE_FROM_MS ||
    clone.attackElapsedMs > ATTACK_ACTIVE_TO_MS
  ) {
    return null;
  }
  const torsoY = clone.body.y + clone.body.h / 2 - ATTACK_HEIGHT / 2;
  const hbX =
    clone.facing === 1
      ? clone.body.x + clone.body.w // hitbox starts at body right
      : clone.body.x - ATTACK_RANGE; // hitbox starts at body left - range
  return { x: hbX, y: torsoY, w: ATTACK_RANGE, h: ATTACK_HEIGHT };
}

/**
 * Advance the clone one fixed timestep. Mutates clone and map in place.
 *
 * Steps (in order per spec):
 * 1. Horizontal velocity from held buttons; update facing.
 * 2. Rising-edge jump → fill jump buffer; tick both timers.
 * 3. Apply gravity, clamp fall speed.
 * 4. Fire jump if buffer active and (grounded or coyote).
 * 5. Jump cut on button release while ascending.
 * 6. moveBody; update grounded / coyote.
 * 7. Attack: rising-edge start; tick elapsed; break tiles in hitbox window.
 */
export function updateClone(
  clone: CloneState,
  map: Tilemap,
  input: InputState,
  dtMs: number,
): void {
  // 1. Horizontal movement (instant — no acceleration this slice)
  const dx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  clone.body.vx = dx * MOVE_SPEED;
  if (dx !== 0) {
    clone.facing = dx > 0 ? 1 : -1;
  }

  // 2. Jump buffer: rising edge of jump button
  const jumpRising = input.jump && !clone.prevJump;
  if (jumpRising) {
    clone.jumpBufferMs = JUMP_BUFFER_MS;
  }
  clone.jumpBufferMs = Math.max(0, clone.jumpBufferMs - dtMs);
  clone.coyoteMs = Math.max(0, clone.coyoteMs - dtMs);

  // 3. Apply gravity
  clone.body.vy = Math.min(clone.body.vy + (GRAVITY * dtMs) / 1000, MAX_FALL_SPEED);

  // 4. Fire jump if buffer active and can jump
  const canJump = clone.grounded || clone.coyoteMs > 0;
  if (clone.jumpBufferMs > 0 && canJump) {
    clone.body.vy = JUMP_VELOCITY;
    clone.jumpBufferMs = 0;
    clone.coyoteMs = 0;
    clone.jumpHeld = true;
  }

  // 5. Jump cut: release while ascending
  if (clone.jumpHeld && !input.jump && clone.body.vy < 0) {
    clone.body.vy *= JUMP_CUT_MULTIPLIER;
    clone.jumpHeld = false;
  }

  // 6. Move body + update grounded / coyote
  const wasGrounded = clone.grounded;
  const moveResult = moveBody(clone.body, map, dtMs);
  clone.grounded = moveResult.onGround;

  if (moveResult.onGround) {
    // Landed — reset coyote (will be set fresh next frame if we step off)
    clone.coyoteMs = 0;
    // Clear jumpHeld once landed
    clone.jumpHeld = false;
  } else if (wasGrounded && !moveResult.onGround) {
    // Just walked off a ledge without jumping — start coyote window
    clone.coyoteMs = COYOTE_TIME_MS;
  }

  // 7. Attack: rising-edge starts swing; tick elapsed; break tiles in window
  const attackRising = input.attack && !clone.prevAttack;
  if (attackRising && clone.attackCooldownMs <= 0 && clone.attackElapsedMs < 0) {
    clone.attackElapsedMs = 0;
    clone.attackCooldownMs = ATTACK_COOLDOWN_MS;
  }

  if (clone.attackElapsedMs >= 0) {
    clone.attackElapsedMs += dtMs;
    if (clone.attackElapsedMs > ATTACK_DURATION_MS) {
      clone.attackElapsedMs = -1; // swing complete
    }
  }
  clone.attackCooldownMs = Math.max(0, clone.attackCooldownMs - dtMs);

  // Break any breakable tiles overlapping the active hitbox
  const hb = attackHitbox(clone);
  if (hb !== null) {
    const txLeft = Math.floor(hb.x / TILE_SIZE);
    const txRight = maxEdgeTileIndex(hb.x + hb.w);
    const tyTop = Math.floor(hb.y / TILE_SIZE);
    const tyBottom = maxEdgeTileIndex(hb.y + hb.h);
    for (let ty = tyTop; ty <= tyBottom; ty++) {
      for (let tx = txLeft; tx <= txRight; tx++) {
        breakTile(map, tx, ty);
      }
    }
  }

  // Save button state for next frame's rising-edge detection
  clone.prevJump = input.jump;
  clone.prevAttack = input.attack;
}
