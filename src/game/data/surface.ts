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

/**
 * Granularity of the dash landing-spot scan in px. The dash tries the farthest
 * spot first and walks back by this step until a free spot is found.
 */
export const DASH_SCAN_STEP_PX = 4;

/** How long the dash afterimage ghost stays visible (cosmetic, sim-timed). */
export const DASH_GHOST_MS = 150;

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

/** Pod launch window in sim-time ms — GDD §6.2 baseline (~5 min) before Engine extension. */
export const POD_WINDOW_MS = 5 * 60 * 1000;

/**
 * Engine-quality pod-window extension (GDD §6.2): each installed engine module
 * adds this much to the launch window. Applied by the loadout projection.
 */
export const POD_WINDOW_PER_ENGINE_MS = 45 * 1000;

/** Remaining-time threshold for the HUD/pod urgency cue. */
export const POD_WARNING_MS = 30 * 1000;

/** Pod AABB width — 2 tiles, big enough to overlap-deposit without precision walking. */
export const POD_WIDTH = 32;

/** Pod AABB height — 3 tiles, taller than the clone so it reads as a vehicle. */
export const POD_HEIGHT = 48;

/** Total resource units the clone can carry — forces return trips within one window. */
export const BACKPACK_CAPACITY = 20;

/** Biominerals per deposit tile — Rocky worlds are Biomineral-rich (GDD §6.5). */
export const BIOMINERAL_DEPOSIT_YIELD = 2;

/** Scrap per surface cache tile (GDD §6.5: Scrap found everywhere). */
export const SCRAP_CACHE_YIELD = 3;

/**
 * Biominerals per hidden deposit tile ('h') — richer than surface deposits;
 * invisible without a Resource Scanner but breakable like any rock.
 */
export const HIDDEN_DEPOSIT_YIELD = 4;

/** Core Crystals per crystal tile ('c') — the rare reactor-upgrade resource (GDD §6.5). */
export const CORE_CRYSTAL_YIELD = 1;

// ── Clone combat / death (GDD §6.3, §6.10) ────────────────────────────────────

/** Default printed-clone HP when no Clone Bay matrix overrides it (Standard = 3). */
export const CLONE_BASE_HP = 3;

/** Damage every Sector 1 enemy and hazard deals per hit (GDD §6.3). */
export const CONTACT_DAMAGE = 1;

/** Base melee damage of a clone swing before matrix bonuses (GDD §6.3). */
export const CLONE_BASE_MELEE = 1;

/** Invincibility window after taking a hit, in ms (GDD §6.3: 1.5 s). */
export const IFRAMES_MS = 1500;

/** Input-lock (hit-stun) after taking a hit, in ms (GDD §6.3: 0.20 s). */
export const HITSTUN_MS = 200;

/** Horizontal knockback impulse on hit, in px/s (≈4 tiles of travel). */
export const KNOCKBACK_VX = 220;

/** Upward knockback impulse on hit, in px/s (≈2-tile lift). */
export const KNOCKBACK_VY = -180;

/** Screen-shake duration after a hit, in ms (cosmetic; renderer reads it). */
export const HIT_SHAKE_MS = 200;

/** Red-flash overlay duration after a hit, in ms (cosmetic). */
export const HIT_FLASH_MS = 100;

/** Fade-to-black duration of the death sequence before the Cloning Bay overlay (GDD §6.10). */
export const DEATH_FADE_MS = 1500;

/** Scrap cost of a re-print after the free first one per planet visit (GDD §6.4/§6.10). */
export const REPRINT_SCRAP_COST = 15;

// ── Shield Bubble (GDD §6.10) ─────────────────────────────────────────────────

/** Default recharge time after a Shield Bubble pop when the module omits one. */
export const SHIELD_RECHARGE_MS = 8000;

/** Upward impulse applied to a Ceiling Dropper whose hit a Shield Bubble absorbs (GDD §6.7). */
export const DROPPER_SHIELD_FLING_VY = -260;

// ── World items & corpse (GDD §6.5/§6.10) ─────────────────────────────────────

/** Pickup magnetism radius for floor-bounced world items, in px (2.5 tiles). */
export const ITEM_MAGNET_RADIUS = 2.5 * TILE_SIZE;

/** Pickup radius for the corpse marker, in px (1.5 tiles, GDD §6.10). */
export const CORPSE_PICKUP_RADIUS = 1.5 * TILE_SIZE;

/** Distance past which the HUD shows the off-screen corpse beacon, in px (10 tiles). */
export const CORPSE_BEACON_RANGE = 10 * TILE_SIZE;

// ── Surface enemies (GDD §6.7) ────────────────────────────────────────────────

/** Bloom Hopper. */
export const HOPPER_HP = 1;
export const HOPPER_WIDTH = 14;
export const HOPPER_HEIGHT = 12;
/** Patrol speed in px/s. */
export const HOPPER_PATROL_SPEED = 40;
/** Patrol half-range from the spawn column, in px (3 tiles). */
export const HOPPER_PATROL_RANGE = 3 * TILE_SIZE;
/** Aggro range — leaps toward the clone within this distance, in px (5 tiles). */
export const HOPPER_AGGRO_RANGE = 5 * TILE_SIZE;
/** Leap velocities (px/s). */
export const HOPPER_LEAP_VX = 120;
export const HOPPER_LEAP_VY = -300;
/** Cooldown between leaps, in ms. */
export const HOPPER_LEAP_COOLDOWN_MS = 1200;
export const HOPPER_DROP_SCRAP = 1;

/** Scrap Grubber. */
export const GRUBBER_HP = 2;
export const GRUBBER_WIDTH = 16;
export const GRUBBER_HEIGHT = 12;
/** Idle wander speed in px/s. */
export const GRUBBER_WANDER_SPEED = 18;
/** Speed once provoked (cornered or attacked) in px/s. */
export const GRUBBER_CHASE_SPEED = 55;
export const GRUBBER_DROP_SCRAP = 2;

/** Ceiling Dropper. */
export const DROPPER_HP = 1;
export const DROPPER_WIDTH = 14;
export const DROPPER_HEIGHT = 12;
/** Horizontal trigger band beneath the dropper that releases it, in px (half-width). */
export const DROPPER_TRIGGER_HALF_WIDTH = TILE_SIZE;
/** Landing stun after a drop, in ms. */
export const DROPPER_STUN_MS = 700;
export const DROPPER_DROP_SCRAP = 1;

// ── Environmental hazards (GDD §6.8) ──────────────────────────────────────────

/** Crumbling Sandstone: time standing on it before it breaks, in ms (0.5 s). */
export const CRUMBLE_BREAK_MS = 500;
/** Crumbling Sandstone: time empty before it re-forms, in ms (8 s). */
export const CRUMBLE_REFORM_MS = 8000;

/** Sandstorm Vent: active and idle phase durations, in ms (telegraphed cycle). */
export const VENT_ACTIVE_MS = 2000;
export const VENT_IDLE_MS = 2000;
/** Sandstorm Vent: horizontal impulse applied while active, in px/s (±2 m/s ≈ tile scale). */
export const VENT_PUSH_VX = 90;
/** Sandstorm Vent: horizontal half-width of the push band, in px. */
export const VENT_PUSH_HALF_WIDTH = TILE_SIZE;
/** Sandstorm Vent: vertical reach of the push column above the vent, in px. */
export const VENT_PUSH_HEIGHT = 6 * TILE_SIZE;
