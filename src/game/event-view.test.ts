import { describe, expect, it } from 'vitest';

import { getEvent } from './data';
import { buildEventView } from './event-view';
import { createRunState } from './sim/run-state';

describe('buildEventView', () => {
  it('projects title, body, and choice previews', () => {
    const run = createRunState('view');
    run.resources.scrap = 20;
    const view = buildEventView(run, getEvent('event-tinkerer'));
    expect(view.title).toBe('The Tinkerer');
    expect(view.choices[0].requiresModuleTarget).toBe(true);
    expect(view.choices[0].outcomes).toContain('−5 Scrap');
    expect(view.choices[0].outcomes).toContain('Attach Tuned Capacitors');
  });

  it('marks a choice unaffordable when the player lacks the resource', () => {
    const run = createRunState('poor');
    run.resources.scrap = 2; // Tinkerer tune costs 5
    const view = buildEventView(run, getEvent('event-tinkerer'));
    expect(view.choices[0].affordable).toBe(false);
    expect(view.choices[2].affordable).toBe(true); // "wave off" costs nothing
  });

  it('describes module and hull outcomes', () => {
    const run = createRunState('desc');
    const view = buildEventView(run, getEvent('event-derelict-freighter'));
    expect(view.choices[0].outcomes).toEqual(['Gain Autocannon', '−8 hull']);
  });
});
