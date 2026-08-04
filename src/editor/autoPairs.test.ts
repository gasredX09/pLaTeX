import { describe, it, expect } from 'vitest';
import { planKey, planIndent, applyToString, type EditorState } from './autoPairs.js';

/**
 * Types `key` at a caret marked `|` (or around a `|…|` selection) and returns the
 * resulting text with the new caret/selection marked the same way. Reads close to
 * what a player would see, which is the point of testing this way.
 */
function type(marked: string, key: string): string {
  const state = parse(marked);
  const edit = planKey(state, key);
  if (!edit) return 'PASS_THROUGH';
  const value = applyToString(state.value, edit);
  return mark(value, edit.selectFrom, edit.selectTo);
}

function parse(marked: string): EditorState {
  const first = marked.indexOf('|');
  const rest = marked.indexOf('|', first + 1);
  if (rest === -1) {
    return {
      value: marked.replace('|', ''),
      selectionStart: first,
      selectionEnd: first,
    };
  }
  return {
    value: marked.slice(0, first) + marked.slice(first + 1, rest) + marked.slice(rest + 1),
    selectionStart: first,
    selectionEnd: rest - 1,
  };
}

function mark(value: string, from: number, to: number): string {
  return from === to
    ? `${value.slice(0, from)}|${value.slice(from)}`
    : `${value.slice(0, from)}|${value.slice(from, to)}|${value.slice(to)}`;
}

describe('ordinary pairs', () => {
  it('closes braces, parens and brackets', () => {
    expect(type('|', '{')).toBe('{|}');
    expect(type('|', '(')).toBe('(|)');
    expect(type('|', '[')).toBe('[|]');
  });

  it('closes mid-text', () => {
    expect(type(String.raw`\frac|`, '{')).toBe(String.raw`\frac{|}`);
  });

  it('steps over a closer instead of doubling it', () => {
    expect(type('{|}', '}')).toBe('{}|');
    expect(type('(|)', ')')).toBe('()|');
  });

  it('inserts a closer normally when there is nothing to step over', () => {
    expect(type('x|', '}')).toBe('PASS_THROUGH');
  });
});

describe('backslashed delimiters', () => {
  it('pairs an escaped brace with an escaped brace', () => {
    // \{ is a literal brace; its partner is \}, not }.
    expect(type('\\|', '{')).toBe(String.raw`\{|\}`);
  });

  it('pairs the display and inline maths delimiters', () => {
    expect(type('\\|', '[')).toBe(String.raw`\[|\]`);
    expect(type('\\|', '(')).toBe(String.raw`\(|\)`);
  });

  it('treats a doubled backslash as a line break, so the brace is ordinary', () => {
    // In `\\{` the \\ is a row break and the brace is not escaped.
    expect(type('a \\\\|', '{')).toBe('a \\\\{|}');
  });

  it('steps over an escaped closer rather than leaving a duplicate', () => {
    // Player typed `\` then `}` where the auto-inserted `\}` already sits.
    expect(type('\\{ x \\|\\}', '}')).toBe(String.raw`\{ x \}|`);
  });
});

describe('dollar signs', () => {
  it('opens a pair outside maths', () => {
    expect(type('|', '$')).toBe('$|$');
    expect(type('cost |', '$')).toBe('cost $|$');
  });

  it('steps over the closing dollar', () => {
    expect(type('$x|$', '$')).toBe('$x$|');
  });

  it('inserts a single dollar when already inside maths', () => {
    // One unescaped $ before the caret, so this one closes rather than opens.
    expect(type('$x|', '$')).toBe('PASS_THROUGH');
  });

  it('opens a fresh pair after a closed one', () => {
    expect(type('$x$ and |', '$')).toBe('$x$ and $|$');
  });

  it('leaves an escaped dollar alone', () => {
    // \$ is a literal dollar sign and has no partner.
    expect(type('costs \\|', '$')).toBe('PASS_THROUGH');
  });

  it('does not count an escaped dollar as opening maths', () => {
    expect(type('\\$5 |', '$')).toBe('\\$5 $|$');
  });
});

describe('wrapping a selection', () => {
  it('wraps in braces and keeps the text selected', () => {
    expect(type('a |bc| d', '{')).toBe('a {|bc|} d');
  });

  it('wraps in dollars', () => {
    expect(type('|x+y|', '$')).toBe('$|x+y|$');
  });

  it('wraps in an escaped brace when a backslash precedes', () => {
    expect(type('\\|x|', '{')).toBe('\\{|x|\\}');
  });
});

describe('backspace', () => {
  it('removes both halves of an empty pair', () => {
    expect(type('{|}', 'Backspace')).toBe('|');
    expect(type('a (|)', 'Backspace')).toBe('a |');
    expect(type('$|$', 'Backspace')).toBe('|');
  });

  it('removes both halves of an empty escaped pair', () => {
    expect(type('\\{|\\}', 'Backspace')).toBe('|');
    expect(type('\\[|\\]', 'Backspace')).toBe('|');
  });

  it('leaves a non-empty pair to the browser', () => {
    expect(type('{x|}', 'Backspace')).toBe('PASS_THROUGH');
  });

  it('leaves a lone delimiter to the browser', () => {
    expect(type('{|', 'Backspace')).toBe('PASS_THROUGH');
    expect(type('|', 'Backspace')).toBe('PASS_THROUGH');
  });

  it('does not pair-delete an escaped dollar', () => {
    expect(type('\\$|$', 'Backspace')).toBe('PASS_THROUGH');
  });
});

describe('typing a real problem end to end', () => {
  /** Feeds every character through the planner, as a player's keystrokes would. */
  function typeAll(source: string): string {
    let state: EditorState = { value: '', selectionStart: 0, selectionEnd: 0 };
    for (const ch of source) {
      const edit = planKey(state, ch);
      if (edit) {
        const value = applyToString(state.value, edit);
        state = { value, selectionStart: edit.selectFrom, selectionEnd: edit.selectTo };
      } else {
        const { value, selectionStart: s, selectionEnd: e } = state;
        const next = value.slice(0, s) + ch + value.slice(e);
        state = { value: next, selectionStart: s + 1, selectionEnd: s + 1 };
      }
    }
    return state.value;
  }

  // The whole point: a player who types the source verbatim must end up with
  // exactly that source, or auto-pairing would make problems unsolvable.
  const sources = [
    String.raw`\[ x = \frac{-b \pm \sqrt{b^2-4ac}}{2a} \]`,
    String.raw`\[ S = \{ x \in \mathbb{R} : x^2 < 2 \} \]`,
    String.raw`This is \textbf{bold} and this is \textit{italic}.`,
    String.raw`100\% of \$5 \& more \#1 \_here\_`,
    String.raw`\begin{tikzpicture}
  \draw[thick, red] (0,0) circle (1cm);
\end{tikzpicture}`,
    String.raw`\begin{tabular}{|l|r|}
  \hline
  Item & Qty \\
  \hline
\end{tabular}`,
  ];

  for (const source of sources) {
    it(`reproduces ${JSON.stringify(source.slice(0, 34))}…`, () => {
      expect(typeAll(source)).toBe(source);
    });
  }
});

describe('planIndent', () => {
  it('inserts two spaces at the caret', () => {
    const state = parse('a|b');
    const edit = planIndent(state);
    expect(applyToString(state.value, edit)).toBe('a  b');
    expect(edit.selectFrom).toBe(3);
  });

  it('replaces a selection', () => {
    const state = parse('a|XY|b');
    expect(applyToString(state.value, planIndent(state))).toBe('a  b');
  });
});
