import { describe, expect, it } from 'vitest';
import { blazeProblems } from './problems.js';
import {
  PRACTICE_TOPIC_IDS,
  practiceProblems,
  practiceTopics,
  problemsForTopic,
} from './practiceProblems.js';

describe('separate mode catalogs', () => {
  it('keeps all Blaze and Practice problems distinct', () => {
    const blazeIds = new Set(blazeProblems.map((problem) => problem.id));
    const blazeSources = new Set(blazeProblems.map((problem) => problem.latex));

    for (const problem of practiceProblems) {
      expect(blazeIds.has(problem.id), problem.id).toBe(false);
      expect(blazeSources.has(problem.latex), problem.id).toBe(false);
    }
  });

  it('has three ordered exercises for every topic', () => {
    expect(practiceTopics.map((topic) => topic.id)).toEqual(PRACTICE_TOPIC_IDS);
    expect(practiceProblems).toHaveLength(PRACTICE_TOPIC_IDS.length * 3);
    for (const topic of PRACTICE_TOPIC_IDS) {
      expect(problemsForTopic(topic), topic).toHaveLength(3);
    }
  });

  it('uses unique practice IDs and sources', () => {
    expect(new Set(practiceProblems.map((problem) => problem.id)).size).toBe(
      practiceProblems.length,
    );
    expect(new Set(practiceProblems.map((problem) => problem.latex)).size).toBe(
      practiceProblems.length,
    );
  });
});
