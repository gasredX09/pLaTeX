import { describe, it, expect } from 'vitest';
import {
  readBest,
  submitRun,
  describeBest,
  STORAGE_KEY,
  type StorageLike,
  type BestRun,
} from './personalBest.js';

function fakeStorage(initial: Record<string, string> = {}): StorageLike & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem: (key) => data[key] ?? null,
    setItem: (key, value) => {
      data[key] = value;
    },
  };
}

/** Storage that rejects writes, as Safari does with cookies blocked. */
function hostileStorage(): StorageLike {
  return {
    getItem: () => null,
    setItem: () => {
      throw new Error('quota exceeded');
    },
  };
}

const at = () => new Date('2026-08-04T12:00:00.000Z');

describe('readBest', () => {
  it('returns null when there is nothing stored', () => {
    expect(readBest(fakeStorage())).toBeNull();
  });

  it('returns null when storage is unavailable', () => {
    expect(readBest(null)).toBeNull();
  });

  it('reads back what was stored', () => {
    const best: BestRun = { score: 12, solved: 3, at: at().toISOString() };
    expect(readBest(fakeStorage({ [STORAGE_KEY]: JSON.stringify(best) }))).toEqual(best);
  });

  it('treats unparseable data as absent', () => {
    expect(readBest(fakeStorage({ [STORAGE_KEY]: 'not json{' }))).toBeNull();
  });

  it('treats the wrong shape as absent', () => {
    for (const bad of ['null', '42', '"12"', '{}', '{"score":"12"}', '{"score":12}', '{"score":12,"solved":3}']) {
      expect(readBest(fakeStorage({ [STORAGE_KEY]: bad }))).toBeNull();
    }
  });

  it('rejects a negative or non-finite score', () => {
    for (const bad of [
      '{"score":-1,"solved":1,"at":"x"}',
      '{"score":null,"solved":1,"at":"x"}',
    ]) {
      expect(readBest(fakeStorage({ [STORAGE_KEY]: bad }))).toBeNull();
    }
  });
});

describe('submitRun', () => {
  it('records a first scoring run', () => {
    const storage = fakeStorage();
    const result = submitRun(storage, { score: 7, solved: 2 }, at);
    expect(result.isNewBest).toBe(true);
    expect(result.best).toEqual({ score: 7, solved: 2, at: at().toISOString() });
    expect(readBest(storage)).toEqual(result.best);
  });

  it('never records a scoreless run', () => {
    const storage = fakeStorage();
    const result = submitRun(storage, { score: 0, solved: 0 }, at);
    expect(result).toEqual({ best: null, isNewBest: false });
    expect(storage.data[STORAGE_KEY]).toBeUndefined();
  });

  it('replaces a lower record', () => {
    const storage = fakeStorage();
    submitRun(storage, { score: 7, solved: 2 }, at);
    const result = submitRun(storage, { score: 9, solved: 3 }, at);
    expect(result.isNewBest).toBe(true);
    expect(result.best?.score).toBe(9);
  });

  it('keeps the record when the run is worse', () => {
    const storage = fakeStorage();
    submitRun(storage, { score: 9, solved: 3 }, at);
    const result = submitRun(storage, { score: 4, solved: 1 }, at);
    expect(result.isNewBest).toBe(false);
    expect(result.best?.score).toBe(9);
  });

  it('does not treat a tie as a new best', () => {
    const storage = fakeStorage();
    submitRun(storage, { score: 9, solved: 3 }, at);
    const result = submitRun(storage, { score: 9, solved: 5 }, at);
    expect(result.isNewBest).toBe(false);
    expect(result.best?.solved).toBe(3);
  });

  it('still reports a new best when the write fails', () => {
    // The player earned it; it just will not outlive the session.
    const result = submitRun(hostileStorage(), { score: 5, solved: 1 }, at);
    expect(result.isNewBest).toBe(true);
    expect(result.best?.score).toBe(5);
  });

  it('works with no storage at all', () => {
    const result = submitRun(null, { score: 5, solved: 1 }, at);
    expect(result.isNewBest).toBe(true);
    expect(result.best?.score).toBe(5);
  });

  it('overwrites a corrupt record rather than being blocked by it', () => {
    const storage = fakeStorage({ [STORAGE_KEY]: 'garbage' });
    const result = submitRun(storage, { score: 3, solved: 1 }, at);
    expect(result.isNewBest).toBe(true);
    expect(readBest(storage)?.score).toBe(3);
  });
});

describe('describeBest', () => {
  it('pluralizes both counts', () => {
    expect(describeBest({ score: 1, solved: 1, at: at().toISOString() })).toMatch(
      /^1 point from 1 problem, /,
    );
    expect(describeBest({ score: 12, solved: 3, at: at().toISOString() })).toMatch(
      /^12 points from 3 problems, /,
    );
  });

  it('omits the date when it is unusable', () => {
    expect(describeBest({ score: 12, solved: 3, at: 'not a date' })).toBe(
      '12 points from 3 problems',
    );
  });
});
