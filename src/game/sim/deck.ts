import { getModule } from '../data';
import type { CardId, ModuleId } from '../data';

/**
 * One card instance in a combat deck. `moduleIndex` indexes the run's module list —
 * not a ModuleId, because duplicate modules (Scout: 2× Thruster) are distinct
 * malfunction targets and only the index tells their card copies apart (GDD §5.6).
 */
export interface CombatCard {
  cardId: CardId;
  moduleIndex: number;
}

/**
 * Generates the combat deck from installed modules (GDD §5.3): each module's
 * cards are appended in module-list order — no curation, no shuffling (shuffling
 * is combat's job and consumes the combat RNG stream). Duplicate module ids
 * contribute duplicate card sets. Mk I only until RunState tracks tiers (4.2).
 *
 * Throws on unknown module ids — a corrupt module list is a programming error,
 * not a recoverable input.
 */
export function generateCombatDeck(moduleIds: readonly ModuleId[]): CombatCard[] {
  return moduleIds.flatMap((id, moduleIndex) =>
    getModule(id).tiers.mk1.cards.map((cardId) => ({ cardId, moduleIndex })),
  );
}

/** The deck as bare CardIds — catalog assertions and anything indifferent to origin. */
export function generateDeck(moduleIds: readonly ModuleId[]): CardId[] {
  return generateCombatDeck(moduleIds).map((card) => card.cardId);
}
