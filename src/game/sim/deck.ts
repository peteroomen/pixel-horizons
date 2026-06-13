import { getModule } from '../data';
import type { CardId, ModuleId, ModuleInstance } from '../data';

/**
 * One card instance in a combat deck. `moduleIndex` indexes the run's module list —
 * not a ModuleId, because duplicate modules (Scout: 2× Thruster) are distinct
 * malfunction targets and only the index tells their card copies apart (GDD §5.6).
 * Null = the card came from no module (enemy-injected Infestations): it can never
 * present as a Malfunction, and a numeric sentinel would silently re-enter the
 * malfunction-membership logic — null can't.
 */
export interface CombatCard {
  cardId: CardId;
  moduleIndex: number | null;
}

function tierKey(tier: 1 | 2): 'mk1' | 'mk2' {
  return tier === 2 ? 'mk2' : 'mk1';
}

/**
 * Generates the combat deck from installed modules (GDD §5.3): each module's
 * cards are appended in module-list order — no curation, no shuffling (shuffling
 * is combat's job and consumes the combat RNG stream). Duplicate module ids
 * contribute duplicate card sets. At tier 2, uses mk2 cards if defined,
 * otherwise falls back to mk1.
 *
 * Throws on unknown module ids — a corrupt module list is a programming error,
 * not a recoverable input.
 */
export function generateCombatDeck(modules: readonly ModuleInstance[]): CombatCard[] {
  return modules.flatMap((mod, moduleIndex) => {
    const def = getModule(mod.id);
    const tier = def.tiers[tierKey(mod.tier)] ?? def.tiers.mk1;
    return tier.cards.map((cardId) => ({ cardId, moduleIndex }));
  });
}

/** The deck as bare CardIds — catalog assertions and anything indifferent to origin. */
export function generateDeck(modules: readonly ModuleInstance[]): CardId[] {
  return generateCombatDeck(modules).map((card) => card.cardId);
}

/** Convenience: wrap bare module ids as tier-1 instances. */
export function moduleIds(ids: readonly ModuleId[]): ModuleInstance[] {
  return ids.map((id) => ({ id, tier: 1 }));
}
