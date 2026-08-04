/**
 * Turns a stream of keystrokes into at most one useful compile at a time.
 *
 * Typing is far faster than TeX. Without debouncing and staleness tracking the
 * engine would fall progressively further behind the player and eventually
 * announce a match against text they had already moved past.
 */
import { normalize } from '../normalize.js';
import { compareBitmaps } from '../render/compare.js';
import { rasterizeFirstPage } from '../render/rasterize.js';
import type { TexEngine } from './engine.js';
import type { TexError } from './explainError.js';

/**
 * Quiet period before compiling. Long enough that mid-word keystrokes do not
 * each trigger a compile, short enough to feel responsive when the player stops.
 */
export const DEBOUNCE_MS = 350;

export type CheckStatus =
  | 'idle'
  | 'compiling'
  /** Valid so far as TeX is concerned, but not the target. */
  | 'mismatch'
  /** Does not compile: usually a half-typed command or an unclosed brace. */
  | 'invalid'
  | 'match'
  /** The snippet never finished compiling and the engine was restarted. */
  | 'timeout';

export interface CheckOutcome {
  status: CheckStatus;
  /** The attempt's render, for live preview. Absent when it did not compile. */
  image?: ImageData;
  /** Why it did not compile, restated for a player. Only set for 'invalid'. */
  error?: TexError | null;
}

export class AttemptChecker {
  private target: ImageData | null = null;
  private extraPreamble: string | undefined;
  /** Bumped whenever the input or the target changes; stale work is discarded. */
  private generation = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor(
    private readonly engine: TexEngine,
    private readonly onOutcome: (outcome: CheckOutcome) => void,
  ) {}

  /**
   * Compiles the target and keeps its pixels as the thing to beat. Resolves to
   * the rendered target so the caller can display it, or null if the problem
   * itself fails to compile (an authoring bug, surfaced rather than swallowed).
   */
  async setProblem(latex: string, extraPreamble?: string): Promise<ImageData | null> {
    this.cancel();
    this.target = null;
    this.extraPreamble = extraPreamble;

    const outcome = await this.engine.compile(normalize(latex), extraPreamble);
    if (outcome.status !== 'ok') return null;

    this.target = (await rasterizeFirstPage(outcome.pdf)).image;
    return this.target;
  }

  /** Records a keystroke. Compiles once the player pauses. */
  update(input: string): void {
    this.cancel();

    if (input.trim() === '') {
      this.onOutcome({ status: 'idle' });
      return;
    }

    const generation = ++this.generation;
    this.onOutcome({ status: 'compiling' });
    this.timer = setTimeout(() => void this.run(input, generation), DEBOUNCE_MS);
  }

  /** Drops any pending compile, so its result will be ignored when it lands. */
  cancel(): void {
    clearTimeout(this.timer);
    this.timer = undefined;
    this.generation++;
  }

  private async run(input: string, generation: number): Promise<void> {
    // The target and the attempt are normalized the same way, so a player who
    // writes `\not\in` matches a target written `\notin`, and vice versa.
    const outcome = await this.engine.compile(normalize(input), this.extraPreamble);
    if (generation !== this.generation) return;

    if (outcome.status === 'timeout') {
      this.onOutcome({ status: 'timeout' });
      return;
    }
    if (outcome.status === 'error') {
      this.onOutcome({ status: 'invalid', error: outcome.error });
      return;
    }

    const { image } = await rasterizeFirstPage(outcome.pdf);
    if (generation !== this.generation) return;

    if (!this.target) {
      this.onOutcome({ status: 'mismatch', image });
      return;
    }

    const comparison = compareBitmaps(this.target, image);
    this.onOutcome({ status: comparison.match ? 'match' : 'mismatch', image });
  }
}
