/**
 * Fix-it Mode: breaking a correct source so a player can repair it.
 *
 * The breakage is generated rather than authored. Every problem already carries
 * a correct source, and each mutator below is a mistake people actually make, so
 * one mutator plus one problem is a puzzle at no authoring cost — and the whole
 * catalog becomes Fix-it content at once.
 *
 * What makes that safe is the win condition, which is unchanged from the other
 * modes: the player's render must match the target pixel for pixel. So a
 * mutation only has to be *wrong*; it does not have to be wrong in a way this
 * module understands. A mutation that still produced the target render would be
 * a pre-solved puzzle, and scripts/verify-problems.ts compiles every mutant to
 * prove none of them do.
 *
 * Mutators must therefore be render-affecting or compile-breaking. Some break
 * the compile (an unbalanced brace), and some compile perfectly but typeset
 * something else (a subscript where a superscript belongs) — the second kind is
 * the more interesting puzzle, because the error message cannot help.
 */
import type { Problem } from './problems.js';

export interface Mutator {
  id: string;
  /** What the player will be repairing, for tests and diagnostics. */
  summary: string;
  apply(source: string): string | null;
}

/** True when the character at `index` is escaped by an odd run of backslashes. */
function isEscaped(source: string, index: number): boolean {
  let backslashes = 0;
  for (let i = index - 1; i >= 0 && source[i] === '\\'; i--) backslashes++;
  return backslashes % 2 === 1;
}

function indexOfUnescaped(source: string, char: string, from = 0): number {
  for (let i = from; i < source.length; i++) {
    if (source[i] === char && !isEscaped(source, i)) return i;
  }
  return -1;
}

/** Removes the substring at [from, to), keeping the rest intact. */
function cut(source: string, from: number, to: number): string {
  return source.slice(0, from) + source.slice(to);
}

export const MUTATORS: readonly Mutator[] = [
  {
    id: 'strip-inline-math',
    summary: 'the $ delimiters around inline maths are gone',
    apply(source) {
      const open = indexOfUnescaped(source, '$');
      if (open === -1) return null;
      const close = indexOfUnescaped(source, '$', open + 1);
      if (close === -1) return null;
      return cut(cut(source, close, close + 1), open, open + 1);
    },
  },
  {
    id: 'strip-display-math',
    summary: 'the \\[ \\] delimiters around display maths are gone',
    apply(source) {
      const open = source.indexOf('\\[');
      const close = source.lastIndexOf('\\]');
      if (open === -1 || close <= open) return null;
      return cut(cut(source, close, close + 2), open, open + 2);
    },
  },
  {
    id: 'drop-closing-brace',
    summary: 'a closing brace is missing',
    apply(source) {
      const index = source.lastIndexOf('}');
      if (index === -1) return null;
      return cut(source, index, index + 1);
    },
  },
  {
    id: 'misspell-command',
    summary: 'a command name is misspelt',
    apply(source) {
      // Swap the last two letters of the first command with at least two.
      // Environment names are skipped: mangling one there reads as a mismatched
      // environment, which another mutator covers properly. A swap that lands on
      // a real command (\pm to \mp, \in to \ni) is still a fine puzzle, since it
      // typesets something else.
      const pattern = /\\([A-Za-z]{2,})/g;
      for (let match = pattern.exec(source); match; match = pattern.exec(source)) {
        const name = match[1]!;
        if (name === 'begin' || name === 'end') continue;
        const swapped = `${name.slice(0, -2)}${name.at(-1)!}${name.at(-2)!}`;
        if (swapped === name) continue;
        const at = match.index + 1;
        return source.slice(0, at) + swapped + source.slice(at + name.length);
      }
      return null;
    },
  },
  {
    id: 'unescape-reserved',
    summary: 'a reserved character has lost its backslash',
    apply(source) {
      const match = /\\([%&#_$])/.exec(source);
      if (!match) return null;
      return source.slice(0, match.index) + match[1]! + source.slice(match.index + 2);
    },
  },
  {
    id: 'mismatch-environment',
    summary: 'an environment is closed with the wrong name',
    apply(source) {
      const open = /\\begin\{([^}]+)\}/.exec(source);
      if (!open) return null;
      const name = open[1]!;
      const closing = `\\end{${name}}`;
      const at = source.lastIndexOf(closing);
      if (at === -1) return null;
      // `center` is a real environment, so this fails on the mismatch rather
      // than on an unknown name, which is the mistake worth teaching.
      const wrong = name === 'center' ? 'quote' : 'center';
      return `${source.slice(0, at)}\\end{${wrong}}${source.slice(at + closing.length)}`;
    },
  },
  {
    id: 'swap-script',
    summary: 'a superscript has become a subscript',
    apply(source) {
      const index = indexOfUnescaped(source, '^');
      if (index === -1) return null;
      return `${source.slice(0, index)}_${source.slice(index + 1)}`;
    },
  },
  {
    id: 'drop-row-break',
    summary: 'a line or row break is missing',
    apply(source) {
      const index = source.indexOf('\\\\');
      if (index === -1) return null;
      return cut(source, index, index + 2);
    },
  },
  /*
   * The four below exist for the problems made entirely of prose, which none of
   * the structural mutators can touch: dash lengths, ties, paragraph breaks,
   * accents and quotation marks. All of them compile perfectly and typeset
   * something subtly different, which makes them the hardest puzzles in the mode
   * — the error message cannot help, only reading the target can.
   */
  {
    id: 'shorten-dash',
    summary: 'a dash is the wrong length',
    apply(source) {
      // Longest first: shortening --- to -- must win over turning -- into -.
      for (const [long, short] of [
        ['---', '--'],
        ['--', '-'],
      ] as const) {
        const index = source.indexOf(long);
        if (index !== -1) {
          return source.slice(0, index) + short + source.slice(index + long.length);
        }
      }
      return null;
    },
  },
  {
    id: 'drop-tie',
    summary: 'a non-breaking space is missing entirely',
    apply(source) {
      const index = indexOfUnescaped(source, '~');
      if (index === -1) return null;
      // The tie is removed rather than replaced by a space. Replacing it typesets
      // identically — a tie only differs from a space at a line break — so that
      // mutation was invisible, and for `See Figure~1 on page~7.` it was the only
      // mutation available, leaving the problem with no playable puzzle at all.
      return cut(source, index, index + 1);
    },
  },
  {
    id: 'join-paragraphs',
    summary: 'a paragraph break has been lost',
    apply(source) {
      const index = source.indexOf('\n\n');
      if (index === -1) return null;
      return cut(source, index, index + 1);
    },
  },
  {
    id: 'straighten-quote',
    summary: 'a quotation mark is the straight typewriter kind',
    apply(source) {
      // LaTeX makes opening quotes from backticks and closing ones from
      // apostrophes; a straight " typesets as two wrong-facing marks.
      for (const mark of ['``', "''", '`']) {
        const index = source.indexOf(mark);
        if (index !== -1) {
          return `${source.slice(0, index)}"${source.slice(index + mark.length)}`;
        }
      }
      return null;
    },
  },
  {
    id: 'strip-accent',
    summary: 'an accent is missing from a letter',
    apply(source) {
      // Braced form first (\r{u}), then the bare form (\'e).
      const braced = /\\(['"^~=.`rvHcu])\{(\w)\}/.exec(source);
      if (braced) {
        return source.slice(0, braced.index) + braced[2]! + source.slice(braced.index + braced[0].length);
      }
      const bare = /\\(['"^~=.`])(\w)/.exec(source);
      if (bare) {
        return source.slice(0, bare.index) + bare[2]! + source.slice(bare.index + bare[0].length);
      }
      return null;
    },
  },
  {
    id: 'drop-item',
    summary: 'a list item marker is missing',
    apply(source) {
      const index = source.lastIndexOf('\\item');
      if (index === -1) return null;
      // Leave the text; only the marker goes, so the entry merges into the one
      // before it rather than vanishing.
      return cut(source, index, index + '\\item'.length);
    },
  },
];

/** Small stable hash, so a problem always breaks the same way. */
function hash(text: string): number {
  let value = 5381;
  for (let i = 0; i < text.length; i++) value = ((value * 33) ^ text.charCodeAt(i)) >>> 0;
  return value;
}

export interface BrokenProblem {
  problem: Problem;
  /** The source the player is given, already wrong. */
  source: string;
  /** Which mutator produced it. */
  mutator: Mutator;
}

/**
 * Every mutation that applies to a problem, best candidate first.
 *
 * Whether a mutation is a real puzzle cannot be decided from the text alone.
 * Dropping the final `}` of `{\huge huge}` leaves a group that closes at the end
 * of the document, and `Figure~1` typesets exactly like `Figure 1` unless the
 * line happens to break there — both compile, and both render the target. Four
 * of the catalog's problems had that property, so the caller compiles candidates
 * in this order and keeps the first whose render actually differs.
 *
 * The order is rotated by a hash of the problem id, so different problems lead
 * with different mutators while any one problem stays stable.
 */
export function candidateBreaks(problem: Problem): BrokenProblem[] {
  const applicable = MUTATORS.map((mutator) => ({ mutator, source: mutator.apply(problem.latex) }))
    .filter((candidate): candidate is { mutator: Mutator; source: string } =>
      // A mutation that changed nothing is not a puzzle.
      candidate.source !== null && candidate.source !== problem.latex,
    )
    .map(({ mutator, source }) => ({ problem, source, mutator }));

  if (applicable.length === 0) return [];
  const offset = hash(problem.id) % applicable.length;
  return [...applicable.slice(offset), ...applicable.slice(0, offset)];
}

/**
 * The preferred mutation for a problem, without compiling anything. Useful for
 * tests and for reasoning about coverage; play uses candidateBreaks so it can
 * reject a mutation that turns out to render the target anyway.
 */
export function breakProblem(problem: Problem): BrokenProblem | null {
  return candidateBreaks(problem)[0] ?? null;
}

/** How many repairs make up one Fix-it round. */
export const FIXIT_ROUND_SIZE = 10;

/**
 * Picks a round's worth of breakable problems, in the order given. The caller
 * shuffles; this only filters out anything no mutator can break.
 */
export function buildFixitRound(
  problems: readonly Problem[],
  size: number = FIXIT_ROUND_SIZE,
): BrokenProblem[] {
  const round: BrokenProblem[] = [];
  for (const problem of problems) {
    const broken = breakProblem(problem);
    if (broken) round.push(broken);
    if (round.length === size) break;
  }
  return round;
}
