/**
 * Combat rule tunables (GDD §4.3, §5.5). They live in data/ — not in combat logic —
 * per the no-balance-numbers-in-logic rule.
 */

/** Baseline reactor level = AP per turn (GDD §4.3). Reactor upgrades add to this. */
export const BASELINE_AP = 3;

/** Fixed hand size drawn each turn (GDD §5.5). */
export const HAND_SIZE = 5;

/**
 * AP cost to play any Malfunction card, regardless of the card's printed cost
 * (GDD §5.6 — "Damaged Flak Array — 1 AP: field-repair the Flak Array").
 */
export const MALFUNCTION_REPAIR_AP = 1;

/**
 * Lane length band in turns (GDD §5.1: 6–12 depending on path). Map generation
 * rolls each edge's lane inside this band — short safe hops and long gauntlets
 * both exist on every map.
 */
export const LANE_DISTANCE_MIN = 6;
export const LANE_DISTANCE_MAX = 12;

/** Encounter-count band rolled per map edge — the lane "danger" axis (GDD §7.1). */
export const LANE_ENCOUNTERS_MIN = 1;
export const LANE_ENCOUNTERS_MAX = 3;

/** Sector map shape (GDD §7.1): START + middle columns + GATE. */
export const MAP_MIDDLE_COLUMNS = 4;
export const MAP_COLUMN_NODES_MIN = 2;
export const MAP_COLUMN_NODES_MAX = 3;

/**
 * Relative weights for middle-column node types. Nodes are realspace
 * destinations — combat happens only on lanes (GDD §2/§5.1).
 */
export const MAP_NODE_WEIGHTS = { planet: 4, cache: 1, shop: 2, engineer: 2, event: 2 } as const;

/** Scrap band for cache nodes — a free find, placeholder for events/shops (4.3/4.4). */
export const CACHE_SCRAP_MIN = 5;
export const CACHE_SCRAP_MAX = 10;
