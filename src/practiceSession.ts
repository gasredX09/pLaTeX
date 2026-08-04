import type { PracticeProblem } from './practiceProblems.js';

export type PracticeStatus = 'idle' | 'running' | 'complete';

/**
 * A finite, untimed pass through a set of items. Items skipped on the first pass
 * are offered once more at the end, then left for the next visit if skipped
 * again.
 *
 * Generic over the item because Fix-it Mode wants exactly this queue over broken
 * problems rather than practice exercises. Nothing here reads a field of the
 * item, so the only thing that had to change was the type.
 */
export class PracticeSession<T = PracticeProblem> {
  status: PracticeStatus = 'idle';
  readonly completed: T[] = [];
  readonly leftForLater: T[] = [];

  private queue: T[] = [];
  private deferred: T[] = [];
  private position = 0;
  private reviewing = false;

  constructor(private readonly problems: readonly T[]) {}

  start(): void {
    this.completed.length = 0;
    this.leftForLater.length = 0;
    this.queue = [...this.problems];
    this.deferred = [];
    this.position = 0;
    this.reviewing = false;
    this.status = this.queue.length > 0 ? 'running' : 'complete';
  }

  get current(): T {
    const problem = this.queue[this.position];
    if (!problem) throw new Error('no problem loaded');
    return problem;
  }

  solve(): void {
    if (this.status !== 'running') return;
    this.completed.push(this.current);
    this.advance();
  }

  skip(): void {
    if (this.status !== 'running') return;
    if (this.reviewing) this.leftForLater.push(this.current);
    else this.deferred.push(this.current);
    this.advance();
  }

  private advance(): void {
    this.position++;
    if (this.position < this.queue.length) return;

    if (!this.reviewing && this.deferred.length > 0) {
      this.queue = this.deferred;
      this.deferred = [];
      this.position = 0;
      this.reviewing = true;
      return;
    }

    this.status = 'complete';
  }
}
