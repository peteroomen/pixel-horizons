/**
 * Surface-run tunables (GDD §6). All values live here — zero magic numbers in
 * physics/clone logic per the no-balance-numbers-in-logic rule.
 */

/** Tile size in virtual pixels (grid granularity for AABB sweep). */
export const TILE_SIZE = 16;

/** Fixed timestep the surface sim advances per step — 60 Hz for determinism. */
export const FIXED_DT_MS = 1000 / 60;

/**
 * Maximum elapsed time consumed per rAF frame before clamping. Prevents the
 * "spiral of death" when the tab backgrounds or renders slowly.
 */
export const MAX_FRAME_MS = 250;

/** Downward acceleration in px/s² — tuned so 3-tile apex feels responsive. */
export const GRAVITY = 1500;

/** Terminal fall velocity in px/s — prevents instakill pits feeling unfair. */
export const MAX_FALL_SPEED = 420;

/** Horizontal run speed in px/s — feels snappy at tile scale. */
export const MOVE_SPEED = 140;

/** Initial Y velocity when a jump fires, negative = up in screen space (px/s). */
export const JUMP_VELOCITY = -380;

/**
 * Multiplier applied to vy on jump-cut (button released while ascending).
 * Keeps low-tap apexes ≈ 1 tile vs held-jump apexes ≈ 3 tiles.
 */
export const JUMP_CUT_MULTIPLIER = 0.45;

/**
 * Window after leaving a ledge where a jump is still allowed, in ms.
 * Prevents the frustrating "I pressed jump right at the edge" miss.
 */
export const COYOTE_TIME_MS = 80;

/**
 * Window before landing where a jump press is remembered, in ms.
 * Allows "buffer" inputs during fast runs so players don't have to time perfectly.
 */
export const JUMP_BUFFER_MS = 100;

/** Total attack animation duration in ms. */
export const ATTACK_DURATION_MS = 180;

/** Hitbox becomes active at this point in the attack animation (ms). */
export const ATTACK_ACTIVE_FROM_MS = 40;

/** Hitbox deactivates at this point in the attack animation (ms). */
export const ATTACK_ACTIVE_TO_MS = 140;

/** Minimum time between attacks in ms — limits spam. */
export const ATTACK_COOLDOWN_MS = 250;

/** Horizontal extent of the attack hitbox in px — one tile + a few px reach. */
export const ATTACK_RANGE = 18;

/** Vertical extent of the attack hitbox in px — hits things at torso height. */
export const ATTACK_HEIGHT = 16;

/** Clone collision body width in virtual px. */
export const CLONE_WIDTH = 12;

/** Clone collision body height in virtual px. */
export const CLONE_HEIGHT = 20;
