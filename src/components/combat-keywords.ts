/**
 * Plain-language definitions for the card keywords (GDD §5.9) the UI surfaces as
 * tappable glossary chips. Keys match the keyword labels the combat view emits
 * (`CardView.keywords`) plus `EXHAUST` (derived from `CardView.exhaust`). UI copy,
 * not game data — the mechanics live in the sim.
 */
export const KEYWORD_GLOSSARY: Record<string, string> = {
  EXHAUST: 'Once played, this card is removed for the rest of the fight — a one-shot, not a stack.',
  RETAIN: 'Stays in your hand at the end of the turn instead of being discarded.',
  JETTISON: 'Tap ⤓ to discard this card for a small bonus (Draw or AP) instead of playing it.',
  CLEAVE: 'Hits the enemy core and every living organ at once.',
};
