import { describe, expect, it } from 'vitest';

import { createRunState } from './sim/run-state';
import { slotUsage } from './sim/economy';
import { buildShipView } from './ship-view';

describe('buildShipView', () => {
  it('exposes the slot picture matching slotUsage', () => {
    const run = createRunState('test-ship-view');
    const view = buildShipView(run);
    expect(view.slots).toEqual(slotUsage(run.hullId, run.modules));
  });

  it('projects each installed module with its generated cards', () => {
    const view = buildShipView(createRunState('test-ship-view'));
    expect(view.modules.length).toBeGreaterThan(0);
    for (const mod of view.modules) {
      // Every catalog module contributes at least one card (GDD §5.3).
      expect(mod.cards.length).toBeGreaterThan(0);
      expect(mod.cards[0]).toHaveProperty('text');
    }
  });
});
