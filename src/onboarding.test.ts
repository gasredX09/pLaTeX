import { describe, expect, it } from 'vitest';
import {
  completeTutorial,
  hasCompletedTutorial,
  TUTORIAL_STORAGE_KEY,
} from './onboarding.js';
import type { StorageLike } from './personalBest.js';

function fakeStorage(initial: Record<string, string> = {}): StorageLike & {
  data: Record<string, string>;
} {
  const data = { ...initial };
  return {
    data,
    getItem: (key) => data[key] ?? null,
    setItem: (key, value) => {
      data[key] = value;
    },
  };
}

describe('tutorial completion', () => {
  it('starts incomplete and records completion', () => {
    const storage = fakeStorage();
    expect(hasCompletedTutorial(storage)).toBe(false);
    completeTutorial(storage);
    expect(storage.data[TUTORIAL_STORAGE_KEY]).toBe('1');
    expect(hasCompletedTutorial(storage)).toBe(true);
  });

  it('degrades quietly without storage', () => {
    expect(hasCompletedTutorial(null)).toBe(false);
    expect(() => completeTutorial(null)).not.toThrow();
  });

  it('survives storage that throws', () => {
    const hostile: StorageLike = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(hasCompletedTutorial(hostile)).toBe(false);
    expect(() => completeTutorial(hostile)).not.toThrow();
  });
});
