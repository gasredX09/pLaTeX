import type { StorageLike } from './personalBest.js';
import type { PracticeProblem, PracticeTopicId } from './practiceProblems.js';

export const PRACTICE_PROGRESS_KEY = 'platex.practice.v1';

export function readPracticeProgress(storage: StorageLike | null): Set<string> {
  if (!storage) return new Set();
  try {
    const raw = storage.getItem(PRACTICE_PROGRESS_KEY);
    if (!raw) return new Set();
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((id): id is string => typeof id === 'string'));
  } catch {
    return new Set();
  }
}

export function completePracticeProblem(
  storage: StorageLike | null,
  progress: ReadonlySet<string>,
  problemId: string,
): Set<string> {
  const next = new Set(progress);
  next.add(problemId);
  try {
    storage?.setItem(PRACTICE_PROGRESS_KEY, JSON.stringify([...next].sort()));
  } catch {
    // Progress remains available for this session even if persistence fails.
  }
  return next;
}

export function progressForTopic(
  topic: PracticeTopicId,
  progress: ReadonlySet<string>,
  problems: readonly PracticeProblem[],
): { completed: number; total: number } {
  const topicProblems = problems.filter((problem) => problem.topic === topic);
  return {
    completed: topicProblems.filter((problem) => progress.has(problem.id)).length,
    total: topicProblems.length,
  };
}
