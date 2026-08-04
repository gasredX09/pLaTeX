import { describe, it, expect } from 'vitest';
import { explainTexError } from './explainError.js';

/** Log lines arrive from the engine with a `[TeX]` prefix. */
const tex = (...lines: string[]) => lines.map((l) => `[TeX] ${l}`);

describe('explainTexError', () => {
  it('returns null when nothing is diagnosable', () => {
    expect(explainTexError([])).toBeNull();
    expect(explainTexError(tex('This is pdfTeX', 'Output written to out.pdf'))).toBeNull();
  });

  it('ignores the engine noise that accompanies a failure', () => {
    // These lines are always present when a compile fails and explain nothing.
    const noise = tex(
      '! program exited (with status: 1), but keepRuntimeAlive() is set',
      '!  ==> Fatal error occurred, no output PDF file produced!',
    );
    expect(explainTexError(noise)).toBeNull();
  });

  it('explains a maths command used in a sentence', () => {
    // The exact log from `The ratio is \frac{3}{4}.`, which is what prompted this.
    const result = explainTexError(
      tex('! Missing $ inserted.', '<inserted text>', '                $', 'l.9 The ratio is \\frac'),
    );
    expect(result?.message).toBe('Maths outside maths mode. Wrap it in $…$ or \\[…\\].');
    expect(result?.raw).toBe('Missing $ inserted.');
    expect(result?.line).toBe(9);
  });

  it('names an unknown command', () => {
    const result = explainTexError(
      tex('! Undefined control sequence.', 'l.9 \\textbfx', '            ...'),
    );
    expect(result?.message).toContain('\\textbfx');
    expect(result?.message).toContain('Check the spelling');
  });

  it('falls back gracefully when the command is not on the context line', () => {
    const result = explainTexError(tex('! Undefined control sequence.'));
    expect(result?.message).toBe('Unknown command. Check the spelling.');
  });

  it('explains brace trouble', () => {
    expect(explainTexError(tex('! Too many }\'s.'))?.message).toBe('One closing brace too many.');
    expect(explainTexError(tex('! Missing } inserted.'))?.message).toBe(
      'A closing brace is missing.',
    );
  });

  it('explains a mismatched environment', () => {
    const result = explainTexError(
      tex('! LaTeX Error: \\begin{itemize} on input line 9 ended by \\end{enumerate}.'),
    );
    expect(result?.message).toBe(
      '\\begin{itemize} is closed by \\end{enumerate}. The names must match.',
    );
  });

  it('explains an unknown environment', () => {
    expect(explainTexError(tex('! LaTeX Error: Environment tikzpicture undefined.'))?.message).toBe(
      'There is no tikzpicture environment here.',
    );
  });

  it('explains table trouble', () => {
    expect(explainTexError(tex('! Extra alignment tab has been changed to \\cr.'))?.message).toBe(
      'More & in a row than the column spec allows.',
    );
    expect(explainTexError(tex('! Misplaced alignment tab character &.'))?.message).toBe(
      '& only separates cells inside a table.',
    );
  });

  it('explains stacked scripts', () => {
    expect(explainTexError(tex('! Double superscript.'))?.message).toContain('x^{2^3}');
    expect(explainTexError(tex('! Double subscript.'))?.message).toContain('x_{1_2}');
  });

  it('explains an unfinished argument', () => {
    const result = explainTexError(tex('! File ended while scanning use of \\frac.'));
    expect(result?.message).toBe('\\frac is missing an argument, or a brace is unclosed.');
  });

  it('explains a paragraph break inside an argument', () => {
    const result = explainTexError(tex('! Paragraph ended before \\textbf was complete.'));
    expect(result?.message).toContain('blank line interrupted \\textbf');
  });

  it('explains a list with no items', () => {
    const result = explainTexError(
      tex("! LaTeX Error: Something's wrong--perhaps a missing \\item."),
    );
    expect(result?.message).toBe('A list needs at least one \\item.');
  });

  it('explains a missing unit', () => {
    expect(explainTexError(tex('! Illegal unit of measure (pt inserted).'))?.message).toBe(
      'A length needs a unit, such as 1cm or 2pt.',
    );
  });

  it("keeps TeX's own wording when the error is unrecognised", () => {
    const result = explainTexError(tex('! Some entirely novel complaint.', 'l.4 x'));
    expect(result?.message).toBe('Some entirely novel complaint.');
    expect(result?.raw).toBe('Some entirely novel complaint.');
    expect(result?.line).toBe(4);
  });

  it('reports the first real error, not a later one', () => {
    const result = explainTexError(
      tex('! Missing $ inserted.', 'l.9 x', '! Double superscript.'),
    );
    expect(result?.raw).toBe('Missing $ inserted.');
  });

  it('omits the line number when TeX did not give one', () => {
    expect(explainTexError(tex('! Missing $ inserted.'))?.line).toBeUndefined();
  });

  it('handles lines with the error prefix variant', () => {
    expect(explainTexError(['[TeX ERR] ! Missing $ inserted.'])?.message).toContain(
      'Maths outside maths mode',
    );
  });
});
