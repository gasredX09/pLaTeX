import { describe, it, expect } from 'vitest';
import { normalize } from './normalize.js';

describe('normalize', () => {
  it('collapses the negation spellings', () => {
    expect(normalize(String.raw`a \not\in B`)).toBe(String.raw`a \notin B`);
    expect(normalize(String.raw`a \not \in B`)).toBe(String.raw`a \notin B`);
    expect(normalize(String.raw`a \not= b`)).toBe(String.raw`a \neq b`);
  });

  it('collapses the long arrow spellings', () => {
    expect(normalize(String.raw`p \Longrightarrow q`)).toBe(String.raw`p \implies q`);
    expect(normalize(String.raw`p \Longleftrightarrow q`)).toBe(String.raw`p \iff  q`);
  });

  it('rewrites \\mid to a bare bar', () => {
    expect(normalize(String.raw`a \mid b`)).toBe(String.raw`a | b`);
  });

  it('does not rewrite a command that merely starts with a rule name', () => {
    // The (?!\w) guards exist so \midxyz and \notinfty survive untouched.
    expect(normalize(String.raw`\midrule`)).toBe(String.raw`\midrule`);
    expect(normalize(String.raw`\Longrightarrowfoo`)).toBe(String.raw`\Longrightarrowfoo`);
  });

  it('turns an escaped space into a plain space', () => {
    expect(normalize(String.raw`a\ b`)).toBe('a b');
  });

  it('leaves a line break followed by a space alone', () => {
    // `\\ ` is a row break plus a space, not an escaped space. The lookbehind
    // is what protects it, and tabular problems depend on this.
    expect(normalize(String.raw`a \\ b`)).toBe(String.raw`a \\ b`);
  });

  it('is idempotent', () => {
    const input = String.raw`a \not\in B, p \Longrightarrow q, x\ y`;
    expect(normalize(normalize(input))).toBe(normalize(input));
  });

  it('leaves ordinary input untouched', () => {
    const input = String.raw`\frac{n(n+1)}{2}`;
    expect(normalize(input)).toBe(input);
  });
});
