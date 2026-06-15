import type { EventDef } from './types';

/**
 * Event catalog (GDD §4.4 / §6.6) — text nodes that inject modules, modifiers, and
 * resources mid-run, so the deck you reach the gate with is one *you* assembled. Pure
 * data; sim/events.ts picks one deterministically per node and applies the choice.
 *
 * The Tinkerer (GDD §4.4) is the marquee event: its choice attaches a modifier to a
 * module the player picks.
 */
export const EVENT_DEFS: readonly EventDef[] = [
  {
    id: 'event-tinkerer',
    title: 'The Tinkerer',
    body: "A scavenger hails you from a patched-together skiff. 'I can tune a module of yours — for a price in scrap. Or I'll just sell you the parts.'",
    choices: [
      {
        label: 'Tune a module (5 scrap)',
        description: 'Attach Tuned Capacitors to a module — its cards cost 1 less AP.',
        outcomes: [
          { kind: 'lose-resources', resource: 'scrap', amount: 5 },
          { kind: 'attach-modifier', modifierId: 'modifier-tuned-capacitors' },
        ],
        requiresModuleTarget: true,
      },
      {
        label: 'Buy a feedback loop (8 scrap)',
        description: 'Attach Feedback Loop to a module — its cards draw 1 when played.',
        outcomes: [
          { kind: 'lose-resources', resource: 'scrap', amount: 8 },
          { kind: 'attach-modifier', modifierId: 'modifier-feedback-loop' },
        ],
        requiresModuleTarget: true,
      },
      {
        label: 'Wave them off',
        description: 'Nothing ventured.',
        outcomes: [{ kind: 'nothing' }],
      },
    ],
  },
  {
    id: 'event-derelict-freighter',
    title: 'Derelict Freighter',
    body: 'A dead hauler drifts in the lane, hull split open. A salvageable module glints inside — but prying it loose means venting your own plating to the cold.',
    choices: [
      {
        label: 'Salvage the module',
        description: 'Take an Autocannon into cargo; lose 8 hull.',
        outcomes: [
          { kind: 'gain-module-to-cargo', moduleId: 'mod-autocannon' },
          { kind: 'damage-hull', amount: 8 },
        ],
      },
      {
        label: 'Strip it for scrap',
        description: 'Safer: pull what comes free.',
        outcomes: [{ kind: 'gain-resources', resource: 'scrap', amount: 6 }],
      },
    ],
  },
  {
    id: 'event-bloom-bloom',
    title: 'Spore Bloom',
    body: 'A vein of biomineral-rich Bloom growth clings to an asteroid. Harvesting it is lucrative — and it bites back.',
    choices: [
      {
        label: 'Harvest the vein',
        description: 'Gain 8 biominerals; the spores cost you 5 hull.',
        outcomes: [
          { kind: 'gain-resources', resource: 'biominerals', amount: 8 },
          { kind: 'damage-hull', amount: 5 },
        ],
      },
      {
        label: 'Patch your hull instead',
        description: 'Ignore the vein; weld the plates. Restore 10 hull.',
        outcomes: [{ kind: 'repair-hull', amount: 10 }],
      },
    ],
  },
];
