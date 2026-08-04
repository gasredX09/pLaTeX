import type { StorageLike } from './personalBest.js';

/**
 * A first-run exercise that teaches the interaction without spending clock time.
 * The answer is shown as a hint because the lesson is the compile-and-match loop,
 * not whether a new player already knows the command.
 */
export const TUTORIAL = {
  title: 'A Bold Hello',
  description: 'Type the suggested source, then watch your render lock onto the target.',
  latex: String.raw`\textbf{Hello, TeX!}`,
} as const;

export const TUTORIAL_STORAGE_KEY = 'platex.tutorial.v1';

export function hasCompletedTutorial(storage: StorageLike | null): boolean {
  if (!storage) return false;
  try {
    return storage.getItem(TUTORIAL_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function completeTutorial(storage: StorageLike | null): void {
  try {
    storage?.setItem(TUTORIAL_STORAGE_KEY, '1');
  } catch {
    // The current session still remembers completion. Persistence is optional.
  }
}
