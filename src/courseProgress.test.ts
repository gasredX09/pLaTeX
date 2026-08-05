import { describe, it, expect } from 'vitest';
import {
  COURSE_PROGRESS_KEY,
  completeCourseStage,
  isCourseComplete,
  isUnlocked,
  nextStageIndex,
  readCourseProgress,
  unlockedCount,
} from './courseProgress.js';
import { courseStages } from './course.js';
import type { CourseStage } from './course.js';
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

/** Three stages is enough to show the frontier moving. */
const stages = [
  { id: 'a', title: 'A', summary: '', body: ['x'] },
  { id: 'b', title: 'B', summary: '', body: ['x'] },
  { id: 'c', title: 'C', summary: '', body: ['x'] },
] as const satisfies readonly CourseStage[];

describe('readCourseProgress', () => {
  it('starts empty', () => {
    expect(readCourseProgress(fakeStorage()).size).toBe(0);
    expect(readCourseProgress(null).size).toBe(0);
  });

  it('reads back what was stored', () => {
    const storage = fakeStorage();
    completeCourseStage(storage, new Set(), 'a');
    expect([...readCourseProgress(storage)]).toEqual(['a']);
  });

  it('treats unparseable or wrongly shaped data as empty', () => {
    for (const bad of ['not json{', '{}', '42', '"a"', 'null']) {
      expect(readCourseProgress(fakeStorage({ [COURSE_PROGRESS_KEY]: bad })).size).toBe(0);
    }
  });

  it('ignores non-string entries', () => {
    const storage = fakeStorage({ [COURSE_PROGRESS_KEY]: '["a", 7, null, "b"]' });
    expect([...readCourseProgress(storage)].sort()).toEqual(['a', 'b']);
  });
});

describe('completeCourseStage', () => {
  it('adds without disturbing what is there', () => {
    const storage = fakeStorage();
    const first = completeCourseStage(storage, new Set(), 'a');
    const second = completeCourseStage(storage, first, 'b');
    expect([...second].sort()).toEqual(['a', 'b']);
  });

  it('does not mutate the set it is given', () => {
    const before = new Set(['a']);
    completeCourseStage(fakeStorage(), before, 'b');
    expect([...before]).toEqual(['a']);
  });

  it('still reports progress when the write fails', () => {
    const hostile: StorageLike = {
      getItem: () => null,
      setItem: () => {
        throw new Error('quota');
      },
    };
    expect([...completeCourseStage(hostile, new Set(), 'a')]).toEqual(['a']);
  });
});

describe('gating', () => {
  it('opens only the first stage to begin with', () => {
    expect(unlockedCount(stages, new Set())).toBe(1);
    expect(isUnlocked(0, stages, new Set())).toBe(true);
    expect(isUnlocked(1, stages, new Set())).toBe(false);
    expect(isUnlocked(2, stages, new Set())).toBe(false);
  });

  it('opens the next stage when the one before it is finished', () => {
    const progress = new Set(['a']);
    expect(unlockedCount(stages, progress)).toBe(2);
    expect(isUnlocked(1, stages, progress)).toBe(true);
    expect(isUnlocked(2, stages, progress)).toBe(false);
  });

  it('keeps finished stages open for revisiting', () => {
    const progress = new Set(['a', 'b']);
    expect(isUnlocked(0, stages, progress)).toBe(true);
    expect(isUnlocked(1, stages, progress)).toBe(true);
  });

  it('does not open the whole course from a gap in the middle', () => {
    // A hand-edited store claiming the last stage is done must not skip ahead.
    const progress = new Set(['c']);
    expect(unlockedCount(stages, progress)).toBe(1);
    expect(isUnlocked(2, stages, progress)).toBe(false);
  });

  it('reports every stage open once the course is finished', () => {
    const progress = new Set(['a', 'b', 'c']);
    expect(unlockedCount(stages, progress)).toBe(3);
    expect(isUnlocked(2, stages, progress)).toBe(true);
    expect(isUnlocked(3, stages, progress)).toBe(false);
  });

  it('rejects a negative index', () => {
    expect(isUnlocked(-1, stages, new Set())).toBe(false);
  });
});

describe('nextStageIndex and isCourseComplete', () => {
  it('points at the first unfinished stage', () => {
    expect(nextStageIndex(stages, new Set())).toBe(0);
    expect(nextStageIndex(stages, new Set(['a']))).toBe(1);
    expect(nextStageIndex(stages, new Set(['a', 'b']))).toBe(2);
  });

  it('returns null and reports completion when nothing is left', () => {
    const done = new Set(['a', 'b', 'c']);
    expect(nextStageIndex(stages, done)).toBeNull();
    expect(isCourseComplete(stages, done)).toBe(true);
  });

  it('does not report completion with a gap', () => {
    expect(isCourseComplete(stages, new Set(['a', 'c']))).toBe(false);
  });
});

describe('against the real course', () => {
  it('starts a new player on the opening stage only', () => {
    expect(unlockedCount(courseStages, new Set())).toBe(1);
    expect(nextStageIndex(courseStages, new Set())).toBe(0);
  });

  it('walks the whole course one stage at a time', () => {
    let progress = new Set<string>();
    for (const [index, stage] of courseStages.entries()) {
      expect(nextStageIndex(courseStages, progress), stage.id).toBe(index);
      expect(isUnlocked(index, courseStages, progress), stage.id).toBe(true);
      // The stage after the current one stays shut until this one is finished.
      expect(isUnlocked(index + 1, courseStages, progress), stage.id).toBe(false);
      progress = completeCourseStage(null, progress, stage.id);
    }
    expect(isCourseComplete(courseStages, progress)).toBe(true);
  });
});
