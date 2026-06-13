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
  DASH_GHOST_MS,
  DASH_SCAN_STEP_PX,
  GRAVITY,
  JUMP_BUFFER_MS,
  JUMP_CUT_MULTIPLIER,
  JUMP_VELOCITY,
  MAX_FALL_SPEED,
  MOVE_SPEED,
  TILE_SIZE,
} from '@/game/data/surface';
import type { Resources } from '@/game/sim/run-state';
import { BASELINE_CAPABILITIES } from './items';
import type { CloneCapabilities } from './items';
import { moveBody, rectOverlapsSolid } from './physics';
import { breakTile, maxEdgeTileIndex } from './tilemap';
import type { Tilemap } from './tilemap';

export interface InputState {
  left: boolean;
  right: boolean;
  jump: boolean;
  attack: boolean;
  dash: boolean;
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
  /** Dash button state last frame — used for rising-edge detection. */
  prevDash: boolean;
  /** Movement items projected from ship modules (GDD §6.3). Fixed at print time. */
  capabilities: CloneCapabilities;
  /** Mid-air jumps still available; refilled on landing. */
  airJumpsLeft: number;
  /** Remaining cooldown before another dash can fire (ms). */
  dashCooldownMs: number;
  /** Remaining lifetime of the dash afterimage (ms, cosmetic). */
  dashGhostMs: number;
  /** Body position the last dash departed from — afterimage anchor. */
  dashFromX: number;
  dashFromY: number;
  /**
   * Resources carried by the clone — banked only when deposited at the pod,
   * lost on a stranded launch (and dropped at the death point in 3.4).
   * Capacity is enforced by surface.ts, not here — 3.3 makes it module-driven.
   */
  backpack: Resources;
}

/** Spawn the clone at the level's designated spawn point. */
export function createClone(
  map: Tilemap,
  capabilities: CloneCapabilities = BASELINE_CAPABILITIES,
): CloneState {
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
    prevDash: false,
    capabilities,
    airJumpsLeft: capabilities.maxAirJumps,
    dashCooldownMs: 0,
    dashGhostMs: 0,
    dashFromX: 0,
    dashFromY: 0,
    backpack: { scrap: 0, biominerals: 0, coreCrystals: 0, blueprints: 0 },
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
 * Returns the tile types broken by this step's attack hitbox — surface.ts
 * resolves them into mining yields (clone.ts knows nothing about economy).
 *
 * Steps (in order per spec):
 * 1. Horizontal velocity from held buttons; update facing.
 * 1b. Phase dash: rising-edge blink in facing direction (through solids).
 * 2. Rising-edge jump → fill jump buffer; tick both timers.
 * 3. Apply gravity, clamp fall speed.
 * 4. Fire jump if buffer active and (grounded or coyote); else burn an air jump.
 * 5. Jump cut on button release while ascending.
 * 6. moveBody; update grounded / coyote; refill air jumps on landing.
 * 7. Attack: rising-edge start; tick elapsed; break tiles in hitbox window.
 */
export function updateClone(
  clone: CloneState,
  map: Tilemap,
  input: InputState,
  dtMs: number,
): { brokenTiles: number[] } {
  // 1. Horizontal movement (instant — no acceleration this slice)
  const dx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  clone.body.vx = dx * MOVE_SPEED * clone.capabilities.moveSpeedMultiplier;
  if (dx !== 0) {
    clone.facing = dx > 0 ? 1 : -1;
  }

  // 1b. Phase dash: blink to the farthest free spot within range, scanning
  // far-to-near — intervening solids are skipped, which IS the through-walls
  // behavior. Fully blocked = no-op without spending the cooldown.
  const dashRising = input.dash && !clone.prevDash;
  const dashConfig = clone.capabilities.dash;
  if (dashRising && dashConfig !== null && clone.dashCooldownMs <= 0) {
    for (let d = dashConfig.distancePx; d >= DASH_SCAN_STEP_PX; d -= DASH_SCAN_STEP_PX) {
      const targetX = clone.body.x + clone.facing * d;
      if (!rectOverlapsSolid(map, targetX, clone.body.y, clone.body.w, clone.body.h)) {
        clone.dashFromX = clone.body.x;
        clone.dashFromY = clone.body.y;
        clone.dashGhostMs = DASH_GHOST_MS;
        clone.body.x = targetX;
        clone.dashCooldownMs = dashConfig.cooldownMs;
        break;
      }
    }
  }
  clone.dashCooldownMs = Math.max(0, clone.dashCooldownMs - dtMs);
  clone.dashGhostMs = Math.max(0, clone.dashGhostMs - dtMs);

  // 2. Jump buffer: rising edge of jump button
  const jumpRising = input.jump && !clone.prevJump;
  if (jumpRising) {
    clone.jumpBufferMs = JUMP_BUFFER_MS;
  }
  clone.jumpBufferMs = Math.max(0, clone.jumpBufferMs - dtMs);
  clone.coyoteMs = Math.max(0, clone.coyoteMs - dtMs);

  // 3. Apply gravity
  clone.body.vy = Math.min(clone.body.vy + (GRAVITY * dtMs) / 1000, MAX_FALL_SPEED);

  // 4. Fire jump if buffer active and can jump; else burn an air jump on the
  // rising edge only (a buffered press still fires the ground jump on landing
  // when no air jumps remain).
  const canJump = clone.grounded || clone.coyoteMs > 0;
  if (clone.jumpBufferMs > 0 && canJump) {
    clone.body.vy = JUMP_VELOCITY * clone.capabilities.jumpVelocityMultiplier;
    clone.jumpBufferMs = 0;
    clone.coyoteMs = 0;
    clone.jumpHeld = true;
  } else if (jumpRising && !canJump && clone.airJumpsLeft > 0) {
    clone.body.vy = JUMP_VELOCITY * clone.capabilities.jumpVelocityMultiplier;
    clone.airJumpsLeft -= 1;
    clone.jumpBufferMs = 0;
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
    clone.airJumpsLeft = clone.capabilities.maxAirJumps;
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
  const brokenTiles: number[] = [];
  const hb = attackHitbox(clone);
  if (hb !== null) {
    const txLeft = Math.floor(hb.x / TILE_SIZE);
    const txRight = maxEdgeTileIndex(hb.x + hb.w);
    const tyTop = Math.floor(hb.y / TILE_SIZE);
    const tyBottom = maxEdgeTileIndex(hb.y + hb.h);
    for (let ty = tyTop; ty <= tyBottom; ty++) {
      for (let tx = txLeft; tx <= txRight; tx++) {
        const broken = breakTile(map, tx, ty);
        if (broken !== null) {
          brokenTiles.push(broken);
        }
      }
    }
  }

  // Save button state for next frame's rising-edge detection
  clone.prevJump = input.jump;
  clone.prevAttack = input.attack;
  clone.prevDash = input.dash;

  return { brokenTiles };
}
