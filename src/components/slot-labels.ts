import type { ModuleSlot } from '@/game/main';

/** Display labels for module slots, shared by the workbench and station screens. */
export const SLOT_LABELS: Record<ModuleSlot, string> = {
  weapon: 'WEAPONS',
  utility: 'UTILITY',
  engine: 'ENGINES',
  shield: 'SHIELD',
  'clone-bay': 'CLONE BAY',
};

export const SLOT_ORDER: readonly ModuleSlot[] = [
  'weapon',
  'utility',
  'engine',
  'shield',
  'clone-bay',
];
