/**
 * Run state: the clock, the score, and which problem is on screen.
 *
 * Deliberately free of DOM and of the TeX engine so the rules can be tested
 * directly. The caller drives the clock by calling tick().
 */
import { pointsFor } from './scoring.js';
import type { Problem } from './problems.js';

export const ROUND_SECONDS = 180;

export type GameStatus = 'idle' | 'running' | 'over';

export interface Solved {
  problem: Problem;
  points: number;
}

/** Fisher-Yates. Returns a new array; the caller's order is left alone. */
export function shuffled<T>(items: readonly T[], random: () => number = Math.random): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

export class Game {
  status: GameStatus = 'idle';
  secondsLeft = ROUND_SECONDS;
  /** Length of a run. Overridable so a short round can be driven in testing. */
  roundSeconds = ROUND_SECONDS;
  score = 0;
  readonly solved: Solved[] = [];
  readonly skipped: Problem[] = [];

  private order: Problem[] = [];
  /** Counts problems served, so the deck can wrap without repeating a shuffle. */
  private position = 0;

  constructor(
    private readonly problems: readonly Problem[],
    private readonly random: () => number = Math.random,
  ) {}

  start(): void {
    this.status = 'running';
    this.secondsLeft = this.roundSeconds;
    this.score = 0;
    this.solved.length = 0;
    this.skipped.length = 0;
    this.order = shuffled(this.problems, this.random);
    this.position = 0;
  }

  /**
   * The problem on screen. The deck wraps rather than ending the run, so a fast
   * player never runs out of problems before the clock runs out.
   */
  get current(): Problem {
    const problem = this.order[this.position % this.order.length];
    if (!problem) throw new Error('no problems loaded');
    return problem;
  }

  /** One-based, and keeps counting past the end of the deck. */
  get problemNumber(): number {
    return this.position + 1;
  }

  get currentPoints(): number {
    return pointsFor(this.current.latex);
  }

  /** Banks the current problem's points and deals the next one. */
  solve(): void {
    if (this.status !== 'running') return;
    const problem = this.current;
    const points = this.currentPoints;
    this.score += points;
    this.solved.push({ problem, points });
    this.position++;
  }

  /** Passes on the current problem. No penalty beyond the time already spent. */
  skip(): void {
    if (this.status !== 'running') return;
    this.skipped.push(this.current);
    this.position++;
  }

  /** Advances the clock. Returns true when this tick ended the run. */
  tick(seconds = 1): boolean {
    if (this.status !== 'running') return false;
    this.secondsLeft = Math.max(0, this.secondsLeft - seconds);
    if (this.secondsLeft === 0) {
      this.status = 'over';
      return true;
    }
    return false;
  }
}

/** m:ss, the way a clock counting down should read. */
export function formatClock(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}
