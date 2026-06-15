import type { ModifierDef } from './types';

/**
 * Module-modifier catalog (GDD §6.6) — the "draw 1 when played" / "−1 AP" hacks that
 * events (and the Tinkerer) bolt onto an installed module. deck.ts applies them as
 * per-instance overrides at generation time; balance lives here, never in logic.
 *
 * `starts-in-hand` from the GDD is deliberately deferred — it needs opening-hand seeding
 * in createCombat; these two are the first shippable modifiers.
 */
export const MODIFIER_DEFS: readonly ModifierDef[] = [
  {
    id: 'modifier-tuned-capacitors',
    name: 'Tuned Capacitors',
    description: "−1 AP on this module's cards.",
    apCostReduction: 1,
  },
  {
    id: 'modifier-feedback-loop',
    name: 'Feedback Loop',
    description: "Draw 1 when this module's cards are played.",
    bonusEffects: [{ kind: 'draw', count: 1 }],
  },
];
