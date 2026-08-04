import { describe, expect, it } from 'vitest';
import type { StorageLike } from './personalBest.js';
import { practiceProblems } from './practiceProblems.js';
import {
  completePracticeProblem,
  PRACTICE_PROGRESS_KEY,
  progressForTopic,
  readPracticeProgress,
} from './practiceProgress.js';

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

describe('practice progress', () => {
  it('stores completed problem IDs', () => {
    const storage = fakeStorage();
    const first = practiceProblems[0]!;
    const progress = completePracticeProblem(storage, new Set(), first.id);
    expect(progress.has(first.id)).toBe(true);
    expect(readPracticeProgress(storage)).toEqual(progress);
  });

  it('reports progress within one topic only', () => {
    const math = practiceProblems.filter((problem) => problem.topic === 'math');
    const lists = practiceProblems.filter((problem) => problem.topic === 'lists');
    const progress = new Set([math[0]!.id, math[1]!.id]);
    // Totals come from the catalog rather than a literal, so growing a topic
    // does not require editing this expectation.
    expect(progressForTopic('math', progress, practiceProblems)).toEqual({
      completed: 2,
      total: math.length,
    });
    // Completing maths exercises must not count towards another topic.
    expect(progressForTopic('lists', progress, practiceProblems)).toEqual({
      completed: 0,
      total: lists.length,
    });
  });

  it('treats missing, corrupt, or unavailable storage as empty', () => {
    expect(readPracticeProgress(null)).toEqual(new Set());
    expect(readPracticeProgress(fakeStorage())).toEqual(new Set());
    expect(
      readPracticeProgress(fakeStorage({ [PRACTICE_PROGRESS_KEY]: '{broken' })),
    ).toEqual(new Set());
  });

  it('keeps in-memory progress when persistence fails', () => {
    const storage: StorageLike = {
      getItem: () => null,
      setItem: () => {
        throw new Error('blocked');
      },
    };
    const result = completePracticeProblem(storage, new Set(), 'practice-example');
    expect(result.has('practice-example')).toBe(true);
  });
});
