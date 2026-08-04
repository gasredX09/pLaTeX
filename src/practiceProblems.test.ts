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

  it('gives every topic the same number of ordered exercises', () => {
    // The invariant is balance, not a particular count: the topic cards show
    // "n of N complete", so a topic left a exercise short reads as broken
    // progress rather than as a shorter topic. Deriving N from the first topic
    // means the catalog can grow without editing this expectation.
    expect(practiceTopics.map((topic) => topic.id)).toEqual(PRACTICE_TOPIC_IDS);

    const perTopic = problemsForTopic(PRACTICE_TOPIC_IDS[0]!).length;
    expect(perTopic).toBeGreaterThanOrEqual(3);
    for (const topic of PRACTICE_TOPIC_IDS) {
      expect(problemsForTopic(topic), topic).toHaveLength(perTopic);
    }
    expect(practiceProblems).toHaveLength(PRACTICE_TOPIC_IDS.length * perTopic);
  });

  it('groups each topic contiguously, so the file order is the teaching order', () => {
    // problemsForTopic preserves array order and Practice Mode walks it, so a
    // topic split across the file would interleave its tiers for the player.
    for (const topic of PRACTICE_TOPIC_IDS) {
      const indices = practiceProblems
        .map((problem, index) => (problem.topic === topic ? index : -1))
        .filter((index) => index !== -1);
      const span = indices[indices.length - 1]! - indices[0]! + 1;
      expect(span, `${topic} is not contiguous`).toBe(indices.length);
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
