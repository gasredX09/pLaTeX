import type { PracticeProblem } from './practiceProblems.js';

export type PracticeStatus = 'idle' | 'running' | 'complete';

/**
 * A finite, untimed pass through a topic. Items skipped on the first pass are
 * offered once more at the end, then left for the next visit if skipped again.
 */
export class PracticeSession {
  status: PracticeStatus = 'idle';
  readonly completed: PracticeProblem[] = [];
  readonly leftForLater: PracticeProblem[] = [];

  private queue: PracticeProblem[] = [];
  private deferred: PracticeProblem[] = [];
  private position = 0;
  private reviewing = false;

  constructor(private readonly problems: readonly PracticeProblem[]) {}

  start(): void {
    this.completed.length = 0;
    this.leftForLater.length = 0;
    this.queue = [...this.problems];
    this.deferred = [];
    this.position = 0;
    this.reviewing = false;
    this.status = this.queue.length > 0 ? 'running' : 'complete';
  }

  get current(): PracticeProblem {
    const problem = this.queue[this.position];
    if (!problem) throw new Error('no practice problem loaded');
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
