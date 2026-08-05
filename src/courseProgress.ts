/**
 * Which tutorial stages are finished, and therefore which are open.
 *
 * Storage mirrors src/practiceProgress.ts exactly: a set of completed ids, a
 * store that may be absent, and corrupt contents treated as empty rather than as
 * an error. Losing progress is a disappointment; refusing to start is a bug.
 *
 * Gating is derived and never stored. Keeping only the completion set means the
 * rule can change without migrating anyone's saved data, and a hand-edited store
 * cannot put someone in a state the rule would not allow.
 */
import type { StorageLike } from './personalBest.js';
import type { CourseStage } from './course.js';

export const COURSE_PROGRESS_KEY = 'platex.course.v1';

export function readCourseProgress(storage: StorageLike | null): Set<string> {
  if (!storage) return new Set();
  try {
    const raw = storage.getItem(COURSE_PROGRESS_KEY);
    if (!raw) return new Set();
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((id): id is string => typeof id === 'string'));
  } catch {
    return new Set();
  }
}

export function completeCourseStage(
  storage: StorageLike | null,
  progress: ReadonlySet<string>,
  stageId: string,
): Set<string> {
  const next = new Set(progress);
  next.add(stageId);
  try {
    storage?.setItem(COURSE_PROGRESS_KEY, JSON.stringify([...next].sort()));
  } catch {
    // The session keeps the progress; persistence is optional.
  }
  return next;
}

/**
 * How many stages are open, counting from the start.
 *
 * The course is strictly ordered, so the frontier is the first incomplete stage:
 * everything before it is done, it is open, and everything after is locked. A
 * later stage being marked complete does not open its predecessors' successors,
 * which keeps a partially hand-edited store from unlocking the whole course.
 */
export function unlockedCount(
  stages: readonly CourseStage[],
  progress: ReadonlySet<string>,
): number {
  let open = 0;
  while (open < stages.length && progress.has(stages[open]!.id)) open++;
  // The first incomplete stage is itself open; a fully finished course has none.
  return Math.min(open + 1, stages.length);
}

export function isUnlocked(
  index: number,
  stages: readonly CourseStage[],
  progress: ReadonlySet<string>,
): boolean {
  return index >= 0 && index < unlockedCount(stages, progress);
}

/** The stage to offer next, or null when every stage is complete. */
export function nextStageIndex(
  stages: readonly CourseStage[],
  progress: ReadonlySet<string>,
): number | null {
  const index = stages.findIndex((stage) => !progress.has(stage.id));
  return index === -1 ? null : index;
}

export function isCourseComplete(
  stages: readonly CourseStage[],
  progress: ReadonlySet<string>,
): boolean {
  return stages.every((stage) => progress.has(stage.id));
}
