import { describe, expect, it } from 'vitest';

import type { StringStorage } from './save';
import { createSaveStore } from './save';
import { createRunState } from './sim/run-state';

function memoryStorage(): StringStorage & { dump(): Map<string, string> } {
  const data = new Map<string, string>();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
    dump: () => data,
  };
}

describe('createSaveStore', () => {
  it('round-trips a run state', () => {
    const store = createSaveStore(memoryStorage());
    const state = createRunState('saved-run');
    state.resources.scrap = 9;
    store.save(state);
    expect(store.load()).toEqual(state);
  });

  it('returns null when nothing is saved', () => {
    expect(createSaveStore(memoryStorage()).load()).toBeNull();
  });

  it('returns null on a corrupt payload and leaves the stored value untouched', () => {
    const storage = memoryStorage();
    const store = createSaveStore(storage);
    store.save(createRunState('victim'));

    const [key] = [...storage.dump().keys()];
    storage.setItem(key, '{"version":1,corrupt');

    expect(store.load()).toBeNull();
    expect(storage.getItem(key)).toBe('{"version":1,corrupt');
  });

  it('overwrites the previous save', () => {
    const store = createSaveStore(memoryStorage());
    store.save(createRunState('first'));
    store.save(createRunState('second'));
    expect(store.load()?.seed).toBe('second');
  });

  it('clear removes the save', () => {
    const store = createSaveStore(memoryStorage());
    store.save(createRunState('gone'));
    store.clear();
    expect(store.load()).toBeNull();
  });
});
