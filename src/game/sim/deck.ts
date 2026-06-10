import { getModule } from '../data';
import type { CardId, ModuleId } from '../data';

/**
 * Generates the combat deck from installed modules (GDD §5.3): each module's
 * cards are appended in module-list order — no curation, no shuffling (shuffling
 * is combat's job and consumes the combat RNG stream). Duplicate module ids
 * contribute duplicate card sets. Mk I only until RunState tracks tiers (4.2).
 *
 * Throws on unknown module ids — a corrupt module list is a programming error,
 * not a recoverable input.
 */
export function generateDeck(moduleIds: readonly ModuleId[]): CardId[] {
  return moduleIds.flatMap((id) => [...getModule(id).tiers.mk1.cards]);
}
