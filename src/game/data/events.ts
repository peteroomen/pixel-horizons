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
  {
    id: 'event-weapons-cache',
    title: 'Sealed Weapons Cache',
    body: 'A capital-ship debris field hides a sealed ordnance pod, still pressurized. Cracking the seal trips a security charge — but the rack inside is intact.',
    choices: [
      {
        label: 'Crack the seal',
        description: 'Take a Kinetic Railgun into cargo; the charge costs you 6 hull.',
        outcomes: [
          { kind: 'gain-module-to-cargo', moduleId: 'mod-kinetic-railgun' },
          { kind: 'damage-hull', amount: 6 },
        ],
      },
      {
        label: 'Bypass the rack for parts',
        description: 'Leave the ordnance; strip the loose plating. Gain 7 scrap.',
        outcomes: [{ kind: 'gain-resources', resource: 'scrap', amount: 7 }],
      },
    ],
  },
  {
    id: 'event-drifting-prospector',
    title: 'Drifting Prospector',
    body: "A long-dead prospector's rig tumbles past, its mining gear cold but undamaged. The salvage clamps will hold — if you spend the scrap to fire them.",
    choices: [
      {
        label: 'Fire the salvage clamps (4 scrap)',
        description: 'Pull a Mining Laser into cargo.',
        outcomes: [
          { kind: 'lose-resources', resource: 'scrap', amount: 4 },
          { kind: 'gain-module-to-cargo', moduleId: 'mod-mining-laser' },
        ],
      },
      {
        label: 'Vent its tanks',
        description: 'Skip the rig; harvest the biomineral residue. Gain 6 biominerals.',
        outcomes: [{ kind: 'gain-resources', resource: 'biominerals', amount: 6 }],
      },
    ],
  },
  {
    id: 'event-abandoned-relay',
    title: 'Abandoned Relay Station',
    body: 'A derelict comms relay hangs dark in the lane. Its maintenance bay still cradles a stowed module — yours for the taking, no strings, if you can dock the clamps.',
    choices: [
      {
        label: 'Dock and strip the bay',
        description: 'Take a Phase Shifter into cargo. No cost.',
        outcomes: [{ kind: 'gain-module-to-cargo', moduleId: 'mod-phase-shifter' }],
      },
      {
        label: 'Scrap the relay array',
        description: 'Ignore the module; gut the dish for parts. Gain 5 scrap.',
        outcomes: [{ kind: 'gain-resources', resource: 'scrap', amount: 5 }],
      },
    ],
  },
];
