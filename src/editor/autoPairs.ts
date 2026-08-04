/**
 * Auto-closing delimiters for the LaTeX editor.
 *
 * Pure: every rule is a function of the text and the caret, so the awkward
 * cases can be tested without a DOM. The DOM half lives in textareaEdit.ts.
 *
 * LaTeX makes this less obvious than it looks in a normal code editor:
 *
 *   - A backslash changes what the next character *is*. `\{` is a literal brace
 *     whose partner is `\}`, not `}`. `\[` opens display maths, closed by `\]`.
 *     So a preceding backslash does not disable pairing, it selects a different
 *     pair. Counting matters too: in `\\{` the `\\` is a line break and the
 *     brace is ordinary, so only an odd run of backslashes escapes.
 *   - `\$` is a literal dollar sign and has no partner at all.
 *   - `$` is its own closer, so whether to open a pair or close one depends on
 *     how many unescaped `$` already sit before the caret.
 */

export interface EditorState {
  value: string;
  selectionStart: number;
  selectionEnd: number;
}

/** A replacement plus where the selection should end up afterwards. */
export interface Edit {
  from: number;
  to: number;
  text: string;
  /** Absolute offsets in the value *after* the replacement. */
  selectFrom: number;
  selectTo: number;
}

/** Ordinary pairs, when the delimiter is not preceded by a backslash. */
const PAIRS: Record<string, string> = { '{': '}', '(': ')', '[': ']' };

/**
 * Pairs when a single backslash precedes the delimiter. `\(` and `\[` are the
 * maths delimiters; `\{` is an escaped brace. All three take a backslashed
 * closer.
 */
const ESCAPED_PAIRS: Record<string, string> = { '{': '\\}', '(': '\\)', '[': '\\]' };

const CLOSERS = new Set(['}', ')', ']']);

/** True when the character at `index` would be escaped by what precedes it. */
function isEscaped(value: string, index: number): boolean {
  let backslashes = 0;
  for (let i = index - 1; i >= 0 && value[i] === '\\'; i--) backslashes++;
  return backslashes % 2 === 1;
}

/** Unescaped `$` before `caret`. An odd count means the caret sits inside maths. */
function dollarsBefore(value: string, caret: number): number {
  let count = 0;
  for (let i = 0; i < caret; i++) {
    if (value[i] === '$' && !isEscaped(value, i)) count++;
  }
  return count;
}

function insertPair(caret: number, open: string, close: string): Edit {
  const inner = caret + open.length;
  return { from: caret, to: caret, text: open + close, selectFrom: inner, selectTo: inner };
}

function wrap(state: EditorState, open: string, close: string): Edit {
  const { value, selectionStart: from, selectionEnd: to } = state;
  const selected = value.slice(from, to);
  return {
    from,
    to,
    text: open + selected + close,
    // Keep the wrapped text selected, so wrapping can be repeated or undone by eye.
    selectFrom: from + open.length,
    selectTo: from + open.length + selected.length,
  };
}

function moveCaret(to: number): Edit {
  return { from: to, to, text: '', selectFrom: to, selectTo: to };
}

/**
 * What to do about `key`, or null to let the browser insert it normally.
 * Handles the printable delimiters and Backspace.
 */
export function planKey(state: EditorState, key: string): Edit | null {
  const { value, selectionStart: start, selectionEnd: end } = state;
  const hasSelection = start !== end;

  if (key === 'Backspace') return hasSelection ? null : planBackspace(value, start);
  if (key === '$') return planDollar(state);

  const escaped = isEscaped(value, start);

  // Openers. A backslash before the delimiter selects the backslashed closer.
  const open = escaped ? ESCAPED_PAIRS[key] : PAIRS[key];
  if (open !== undefined) {
    return hasSelection ? wrap(state, key, open) : insertPair(start, key, open);
  }

  // Closers: step over one the editor already inserted rather than doubling it.
  if (!hasSelection && CLOSERS.has(key)) {
    if (value[start] === key) return moveCaret(start + 1);
    // Typing `\}` where an auto-inserted `\}` already sits: drop the backslash
    // just typed and step over the existing pair, instead of leaving `\}\}`.
    if (escaped && value.startsWith(`\\${key}`, start)) {
      return { from: start - 1, to: start + 2, text: `\\${key}`, selectFrom: start + 1, selectTo: start + 1 };
    }
  }

  return null;
}

function planDollar(state: EditorState): Edit | null {
  const { value, selectionStart: start, selectionEnd: end } = state;

  // `\$` is a literal dollar sign; it has no partner.
  if (isEscaped(value, start)) return null;

  if (start !== end) return wrap(state, '$', '$');

  // Step over the closer of a pair we inserted.
  if (value[start] === '$') return moveCaret(start + 1);

  // Inside maths already, so this `$` is closing it: insert one, not a pair.
  if (dollarsBefore(value, start) % 2 === 1) return null;

  return insertPair(start, '$', '$');
}

/** Backspace between the halves of an empty pair removes both. */
function planBackspace(value: string, caret: number): Edit | null {
  if (caret === 0) return null;

  // Backslashed pairs first, since `\{\}` also ends in a plain-looking `{`.
  const beforeTwo = value.slice(caret - 2, caret);
  for (const [open, close] of Object.entries(ESCAPED_PAIRS)) {
    if (beforeTwo === `\\${open}` && value.startsWith(close, caret)) {
      const from = caret - 2;
      return { from, to: caret + close.length, text: '', selectFrom: from, selectTo: from };
    }
  }

  const previous = value[caret - 1];
  const next = value[caret];
  if (previous === undefined || next === undefined) return null;
  if (isEscaped(value, caret - 1)) return null;

  const closes = previous === '$' ? '$' : PAIRS[previous];
  if (closes !== undefined && next === closes) {
    const from = caret - 1;
    return { from, to: caret + 1, text: '', selectFrom: from, selectTo: from };
  }
  return null;
}

/** Inserts a soft tab. Shares Edit so it goes through the same undo-safe path. */
export function planIndent(state: EditorState, width = 2): Edit {
  const spaces = ' '.repeat(width);
  const caret = state.selectionStart + width;
  return {
    from: state.selectionStart,
    to: state.selectionEnd,
    text: spaces,
    selectFrom: caret,
    selectTo: caret,
  };
}

/** Applies an Edit to a plain string. Used by tests and for previewing. */
export function applyToString(value: string, edit: Edit): string {
  return value.slice(0, edit.from) + edit.text + value.slice(edit.to);
}
