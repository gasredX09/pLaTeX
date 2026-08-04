import { describe, it, expect } from 'vitest';
import { MUTATORS, breakProblem, buildFixitRound, FIXIT_ROUND_SIZE } from './fixit.js';
import { blazeProblems } from './problems.js';
import { practiceProblems } from './practiceProblems.js';
import type { Problem } from './problems.js';

const mutator = (id: string) => {
  const found = MUTATORS.find((m) => m.id === id);
  if (!found) throw new Error(`no mutator ${id}`);
  return found;
};

const problem = (id: string, latex: string): Problem => ({
  id,
  title: id,
  description: '',
  latex,
});

describe('individual mutators', () => {
  it('strips inline maths delimiters', () => {
    expect(mutator('strip-inline-math').apply(String.raw`The ratio is $\frac{3}{4}$.`)).toBe(
      String.raw`The ratio is \frac{3}{4}.`,
    );
  });

  it('leaves an escaped dollar alone when stripping inline maths', () => {
    // \$ is a literal dollar sign, not a delimiter, so there is no pair here.
    expect(mutator('strip-inline-math').apply(String.raw`costs \$5 and \$6`)).toBeNull();
  });

  it('strips display maths delimiters', () => {
    expect(mutator('strip-display-math').apply(String.raw`\[ x = 1 \]`)).toBe(' x = 1 ');
  });

  it('drops a closing brace', () => {
    expect(mutator('drop-closing-brace').apply(String.raw`\textbf{bold}`)).toBe(
      String.raw`\textbf{bold`,
    );
  });

  it('misspells a command by swapping its last two letters', () => {
    expect(mutator('misspell-command').apply(String.raw`\textbf{bold}`)).toBe(
      String.raw`\textfb{bold}`,
    );
  });

  it('does not misspell begin or end, which is a different mistake', () => {
    // Mangling those reads as a mismatched environment, covered separately.
    const result = mutator('misspell-command').apply(
      String.raw`\begin{center}text\end{center}`,
    );
    expect(result).toBeNull();
  });

  it('unescapes a reserved character', () => {
    expect(mutator('unescape-reserved').apply(String.raw`100\% done`)).toBe('100% done');
  });

  it('closes an environment with the wrong name', () => {
    const result = mutator('mismatch-environment').apply(
      String.raw`\begin{itemize}\item a\end{itemize}`,
    );
    expect(result).toBe(String.raw`\begin{itemize}\item a\end{center}`);
  });

  it('picks a different wrong name when the environment is already center', () => {
    const result = mutator('mismatch-environment').apply(
      String.raw`\begin{center}hi\end{center}`,
    );
    expect(result).toBe(String.raw`\begin{center}hi\end{quote}`);
  });

  it('turns a superscript into a subscript', () => {
    expect(mutator('swap-script').apply(String.raw`$x^2$`)).toBe(String.raw`$x_2$`);
  });

  it('removes a tie rather than replacing it with a space', () => {
    // Replacing it would typeset identically, since a tie only differs from a
    // space where the line breaks.
    expect(mutator('drop-tie').apply('See Figure~1 here')).toBe('See Figure1 here');
  });

  it('drops a row break', () => {
    expect(mutator('drop-row-break').apply('a \\\\ b')).toBe('a  b');
  });

  it('drops a list item marker but keeps its text', () => {
    const result = mutator('drop-item').apply(String.raw`\begin{itemize}\item a\item b\end{itemize}`);
    expect(result).toBe(String.raw`\begin{itemize}\item a b\end{itemize}`);
  });

  it('returns null when a mutator has nothing to work on', () => {
    for (const m of MUTATORS) {
      // Plain prose has no delimiters, braces, commands or markers.
      expect(m.apply('just words here'), m.id).toBeNull();
    }
  });
});

describe('breakProblem', () => {
  it('always changes the source', () => {
    for (const p of blazeProblems) {
      const broken = breakProblem(p);
      if (!broken) continue;
      expect(broken.source, p.id).not.toBe(p.latex);
    }
  });

  it('is deterministic, so a problem breaks the same way every time', () => {
    for (const p of blazeProblems.slice(0, 20)) {
      const a = breakProblem(p);
      const b = breakProblem(p);
      expect(a?.source, p.id).toBe(b?.source);
      expect(a?.mutator.id, p.id).toBe(b?.mutator.id);
    }
  });

  it('can break every problem in both catalogs', () => {
    // If a problem cannot be broken it simply never appears in Fix-it, which is
    // a silent gap in the mode. Worth knowing about.
    const unbreakable = [...blazeProblems, ...practiceProblems].filter((p) => !breakProblem(p));
    expect(unbreakable.map((p) => p.id)).toEqual([]);
  });

  it('spreads work across mutators rather than always using the first', () => {
    const used = new Set(
      blazeProblems.map((p) => breakProblem(p)?.mutator.id).filter(Boolean),
    );
    // Not every mutator applies to every problem, but the choice should not
    // collapse onto one or two.
    expect(used.size).toBeGreaterThanOrEqual(5);
  });

  it('returns null when nothing applies', () => {
    expect(breakProblem(problem('prose', 'just words here'))).toBeNull();
  });
});

describe('buildFixitRound', () => {
  it('takes a round of the requested size', () => {
    expect(buildFixitRound(blazeProblems)).toHaveLength(FIXIT_ROUND_SIZE);
    expect(buildFixitRound(blazeProblems, 3)).toHaveLength(3);
  });

  it('preserves the order it is given, so the caller controls shuffling', () => {
    const round = buildFixitRound(blazeProblems, 4);
    expect(round.map((r) => r.problem.id)).toEqual(
      blazeProblems.slice(0, 4).map((p) => p.id),
    );
  });

  it('skips problems it cannot break', () => {
    const deck = [problem('prose', 'just words here'), ...blazeProblems.slice(0, 2)];
    const round = buildFixitRound(deck, 3);
    expect(round.map((r) => r.problem.id)).not.toContain('prose');
  });

  it('returns what it can when the deck is short', () => {
    expect(buildFixitRound(blazeProblems.slice(0, 2), 10)).toHaveLength(2);
  });
});
