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
  DEATH_FADE_MS,
  GRAVITY,
  HIT_FLASH_MS,
  HIT_SHAKE_MS,
  HITSTUN_MS,
  IFRAMES_MS,
  JUMP_BUFFER_MS,
  JUMP_CUT_MULTIPLIER,
  JUMP_VELOCITY,
  KNOCKBACK_VX,
  KNOCKBACK_VY,
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
   * lost on a stranded launch, dropped at the death point as a corpse (3.4).
   * Capacity is enforced by surface.ts, not here — 3.3 makes it module-driven.
   */
  backpack: Resources;

  // ── Combat / survival (GDD §6.3, §6.10) ──
  /** Current hit points; death at 0. */
  hp: number;
  /** Maximum hit points from the Clone Bay matrix. */
  maxHp: number;
  /** Remaining invincibility (ms) — blocks damage, sprite blinks (GDD §6.3). */
  iframesMs: number;
  /** Remaining hit-stun input lock (ms) — knockback persists, input ignored. */
  hitstunMs: number;
  /** True once HP reaches 0 — sim freezes the clone until re-print/abandon. */
  dead: boolean;
  /** Remaining death fade-to-black (ms, cosmetic; sim-timed for determinism). */
  deathFadeMs: number;
  /** Remaining red-flash overlay (ms, cosmetic). */
  hitFlashMs: number;
  /** Remaining camera-shake (ms, cosmetic). */
  shakeMs: number;
  /** Accrued grounded time toward the next regen tick (Repair Matrix). */
  regenAccumMs: number;
  /** Shield Bubble live state, or null when no Shield Generator is projected. */
  shield: { ready: boolean; cooldownMs: number; rechargeMs: number } | null;
}

/** What a damageClone call resolved to — surface.ts/renderer react to it. */
export type DamageResult = 'ignored' | 'shielded' | 'damaged' | 'died';

/** Spawn the clone at the level's designated spawn point. */
export function createClone(
  map: Tilemap,
  capabilities: CloneCapabilities = BASELINE_CAPABILITIES,
  shieldCooldownMs: number | null = null,
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
    hp: capabilities.maxHp,
    maxHp: capabilities.maxHp,
    iframesMs: 0,
    hitstunMs: 0,
    dead: false,
    deathFadeMs: 0,
    hitFlashMs: 0,
    shakeMs: 0,
    regenAccumMs: 0,
    shield:
      shieldCooldownMs === null
        ? null
        : { ready: true, cooldownMs: 0, rechargeMs: shieldCooldownMs },
  };
}

/**
 * Respawn a printed clone at the pod (or spawn) for a re-print (GDD §6.4) —
 * resets position, HP, and all transient combat/movement state in place. The
 * corpse from the prior death is owned by surface.ts, not touched here.
 */
export function respawnClone(clone: CloneState, x: number, y: number): void {
  clone.body.x = x;
  clone.body.y = y;
  clone.body.vx = 0;
  clone.body.vy = 0;
  clone.facing = 1;
  clone.grounded = false;
  clone.coyoteMs = 0;
  clone.jumpBufferMs = 0;
  clone.jumpHeld = false;
  clone.attackElapsedMs = -1;
  clone.attackCooldownMs = 0;
  clone.airJumpsLeft = clone.capabilities.maxAirJumps;
  clone.dashCooldownMs = 0;
  clone.dashGhostMs = 0;
  clone.hp = clone.maxHp;
  clone.iframesMs = 0;
  clone.hitstunMs = 0;
  clone.dead = false;
  clone.deathFadeMs = 0;
  clone.hitFlashMs = 0;
  clone.shakeMs = 0;
  clone.regenAccumMs = 0;
  if (clone.shield !== null) {
    clone.shield.ready = true;
    clone.shield.cooldownMs = 0;
  }
}

/**
 * Apply one hit to the clone (GDD §6.3, §6.10). No-op during i-frames or death.
 * A ready Shield Bubble absorbs the hit (pops, recharges) without HP loss or
 * knockback. Otherwise: HP loss, i-frames, hit-stun, and knockback away from
 * sourceX. Returns what happened so callers drive feedback / Dropper fling.
 */
export function damageClone(clone: CloneState, amount: number, sourceX: number): DamageResult {
  if (clone.dead || clone.iframesMs > 0) return 'ignored';

  clone.iframesMs = IFRAMES_MS;
  clone.hitFlashMs = HIT_FLASH_MS;
  clone.shakeMs = HIT_SHAKE_MS;
  clone.regenAccumMs = 0;

  if (clone.shield !== null && clone.shield.ready) {
    clone.shield.ready = false;
    clone.shield.cooldownMs = clone.shield.rechargeMs;
    return 'shielded';
  }

  clone.hp -= amount;
  clone.hitstunMs = HITSTUN_MS;
  const dir = clone.body.x + clone.body.w / 2 >= sourceX ? 1 : -1;
  clone.body.vx = dir * KNOCKBACK_VX;
  clone.body.vy = KNOCKBACK_VY;

  if (clone.hp <= 0) {
    clone.hp = 0;
    clone.dead = true;
    clone.deathFadeMs = DEATH_FADE_MS;
    return 'died';
  }
  return 'damaged';
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
  /** Environmental horizontal impulse (px/s) for this step — e.g. a Sandstorm Vent. */
  externalVx = 0,
): { brokenTiles: number[] } {
  // 0. Tick combat timers (i-frames, hit-stun, hit-feedback, shield recharge)
  clone.iframesMs = Math.max(0, clone.iframesMs - dtMs);
  clone.hitstunMs = Math.max(0, clone.hitstunMs - dtMs);
  clone.hitFlashMs = Math.max(0, clone.hitFlashMs - dtMs);
  clone.shakeMs = Math.max(0, clone.shakeMs - dtMs);
  if (clone.shield !== null && !clone.shield.ready) {
    clone.shield.cooldownMs = Math.max(0, clone.shield.cooldownMs - dtMs);
    if (clone.shield.cooldownMs <= 0) clone.shield.ready = true;
  }

  // Hit-stun ignores input but preserves knockback velocity (set in damageClone).
  const locked = clone.hitstunMs > 0;

  // 1. Horizontal movement (instant — no acceleration this slice). During
  // hit-stun the knockback vx persists untouched; otherwise input drives it.
  const dx = locked ? 0 : (input.right ? 1 : 0) - (input.left ? 1 : 0);
  if (!locked) {
    clone.body.vx = dx * MOVE_SPEED * clone.capabilities.moveSpeedMultiplier;
    if (dx !== 0) {
      clone.facing = dx > 0 ? 1 : -1;
    }
  }

  // 1b. Phase dash: blink to the farthest free spot within range, scanning
  // far-to-near — intervening solids are skipped, which IS the through-walls
  // behavior. Fully blocked = no-op without spending the cooldown.
  const dashRising = input.dash && !clone.prevDash && !locked;
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
  const jumpRising = input.jump && !clone.prevJump && !locked;
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

  // 6. Move body + update grounded / coyote. Environmental impulses (vents)
  // ride on vx so the AABB sweep still resolves collisions against them.
  clone.body.vx += externalVx;
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

  // Regen (Repair Matrix): accrue grounded time; heal 1 HP per regenMsPerHp.
  const regen = clone.capabilities.regenMsPerHp;
  if (regen !== null && clone.grounded && clone.hp > 0 && clone.hp < clone.maxHp) {
    clone.regenAccumMs += dtMs;
    if (clone.regenAccumMs >= regen) {
      clone.hp += 1;
      clone.regenAccumMs -= regen;
    }
  }

  // 7. Attack: rising-edge starts swing; tick elapsed; break tiles in window
  const attackRising = input.attack && !clone.prevAttack && !locked;
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
