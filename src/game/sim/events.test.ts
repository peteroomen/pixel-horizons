import { describe, expect, it } from 'vitest';

import { EVENT_DEFS } from '../data';
import { applyEventChoice, eventChoiceNeedsModule, pickEvent } from './events';
import { createRunState, deserializeRunState, serializeRunState } from './run-state';

describe('pickEvent (deterministic per node, ADR 005)', () => {
  it('is stable for a given (seed, sector, nodeId)', () => {
    const a = pickEvent('seed-x', 1, 'node-3');
    const b = pickEvent('seed-x', 1, 'node-3');
    expect(a.id).toBe(b.id);
  });

  it('survives a save/resume — the same node yields the same event', () => {
    const run = createRunState('resume-seed');
    const before = pickEvent(run.seed, 1, 'node-7').id;
    const resumed = deserializeRunState(serializeRunState(run));
    const after = pickEvent(resumed!.seed, 1, 'node-7').id;
    expect(after).toBe(before);
  });

  it('different nodes can surface different events', () => {
    const ids = new Set(
      Array.from({ length: 12 }, (_, i) => pickEvent('spread', 1, `node-${i}`).id),
    );
    expect(ids.size).toBeGreaterThan(1);
  });

  it('only ever returns catalog events', () => {
    const valid = new Set(EVENT_DEFS.map((e) => e.id));
    for (let i = 0; i < 30; i++) {
      expect(valid.has(pickEvent('any', 1, `n${i}`).id)).toBe(true);
    }
  });
});

describe('applyEventChoice', () => {
  it('applies resource gains and losses, clamping at 0', () => {
    const run = createRunState('res');
    run.resources.scrap = 6;
    // Derelict Freighter, "Strip it for scrap": +6 scrap.
    applyEventChoice(run, 'event-derelict-freighter', 1);
    expect(run.resources.scrap).toBe(12);

    // Tinkerer "wave off" is nothing; "tune" costs 5 scrap + needs a module.
    applyEventChoice(run, 'event-tinkerer', 0, 0);
    expect(run.resources.scrap).toBe(7);
  });

  it('gain-module-to-cargo and damage-hull resolve together', () => {
    const run = createRunState('salvage');
    run.hullHp = 50;
    applyEventChoice(run, 'event-derelict-freighter', 0); // salvage: module + -8 hull
    expect(run.cargo.at(-1)?.id).toBe('mod-autocannon');
    expect(run.hullHp).toBe(42);
  });

  it('repair-hull caps at the hull max', () => {
    const run = createRunState('patch');
    run.hullHp = 95;
    applyEventChoice(run, 'event-bloom-bloom', 1); // patch: +10 hull
    expect(run.hullHp).toBe(100);
  });

  it('attach-modifier bolts the modifier onto the chosen module', () => {
    const run = createRunState('tinker');
    run.resources.scrap = 10;
    expect(eventChoiceNeedsModule('event-tinkerer', 0)).toBe(true);
    applyEventChoice(run, 'event-tinkerer', 0, 1);
    expect(run.modules[1].modifiers).toEqual(['modifier-tuned-capacitors']);
    expect(run.resources.scrap).toBe(5);
  });

  it('does not duplicate a modifier already attached', () => {
    const run = createRunState('dupe');
    run.resources.scrap = 100;
    applyEventChoice(run, 'event-tinkerer', 0, 0);
    applyEventChoice(run, 'event-tinkerer', 0, 0);
    expect(run.modules[0].modifiers).toEqual(['modifier-tuned-capacitors']);
  });

  it('throws on a bad event/choice and on a missing module target', () => {
    const run = createRunState('bad');
    expect(() => applyEventChoice(run, 'event-nope', 0)).toThrow('event-nope');
    expect(() => applyEventChoice(run, 'event-tinkerer', 9)).toThrow('no choice');
    expect(() => applyEventChoice(run, 'event-tinkerer', 0)).toThrow('needs a valid module');
    expect(() => applyEventChoice(run, 'event-tinkerer', 0, 99)).toThrow('needs a valid module');
  });
});
