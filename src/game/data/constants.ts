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
