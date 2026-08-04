/**
 * The player's best run, kept in the browser.
 *
 * Storage is passed in rather than reached for, so the rules can be tested
 * without a DOM and so a browser that refuses storage degrades quietly instead
 * of taking the game down with it.
 */

/** The slice of the Storage API this needs. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface BestRun {
  score: number;
  solved: number;
  /** ISO 8601, so it survives the round trip through JSON unambiguously. */
  at: string;
}

export const STORAGE_KEY = 'platex.best';

/**
 * localStorage is not merely absent in some contexts, it *throws* on access:
 * Safari with cookies blocked raises a SecurityError on the property itself.
 * Returns null when unavailable, and callers treat that as "no history".
 */
export function browserStorage(): StorageLike | null {
  try {
    const storage = globalThis.localStorage;
    // Writing is the only real proof: Safari private mode exposes the object
    // and then rejects setItem once the quota is zero.
    const probe = `${STORAGE_KEY}.probe`;
    storage.setItem(probe, '1');
    storage.removeItem(probe);
    return storage;
  } catch {
    return null;
  }
}

function isBestRun(value: unknown): value is BestRun {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.score === 'number' &&
    Number.isFinite(candidate.score) &&
    candidate.score >= 0 &&
    typeof candidate.solved === 'number' &&
    Number.isFinite(candidate.solved) &&
    typeof candidate.at === 'string'
  );
}

/**
 * Reads the stored best. Anything unparseable or the wrong shape is treated as
 * absent: a corrupt entry should cost the player their record, not the game.
 */
export function readBest(storage: StorageLike | null): BestRun | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isBestRun(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export interface RunResult {
  /** The record after this run, or null if there is still nothing to show. */
  best: BestRun | null;
  /** True when this run set the record, so the end screen can say so. */
  isNewBest: boolean;
}

/**
 * Records a finished run if it beat the stored one.
 *
 * A scoreless run is never stored. It is not an achievement, and showing
 * "best: 0 points" to someone who has not scored yet is just noise.
 *
 * Ties do not count as a new best, so replaying to the same score does not
 * re-trigger the celebration.
 */
export function submitRun(
  storage: StorageLike | null,
  run: { score: number; solved: number },
  now: () => Date = () => new Date(),
): RunResult {
  const previous = readBest(storage);

  if (run.score <= 0 || (previous && run.score <= previous.score)) {
    return { best: previous, isNewBest: false };
  }

  const best: BestRun = { score: run.score, solved: run.solved, at: now().toISOString() };
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(best));
  } catch {
    // Out of quota or storage revoked mid-session. The player still gets told
    // they beat their record; it just will not survive a reload.
  }
  return { best, isNewBest: true };
}

/** "12 points from 3 problems, 4 Aug" */
export function describeBest(best: BestRun): string {
  const points = `${best.score} ${best.score === 1 ? 'point' : 'points'}`;
  const problems = `${best.solved} ${best.solved === 1 ? 'problem' : 'problems'}`;
  const when = formatDate(best.at);
  return when ? `${points} from ${problems}, ${when}` : `${points} from ${problems}`;
}

function formatDate(iso: string): string | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}
