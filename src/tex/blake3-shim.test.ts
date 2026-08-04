import { describe, it, expect } from 'vitest';
import { hash } from './blake3-shim.js';
import { problems } from '../problems.js';
import { buildDocument } from './document.js';

const hex = (input: string, length?: number) =>
  hash(input, length === undefined ? undefined : { length }).toString('hex');

describe('blake3 shim', () => {
  it('is deterministic', () => {
    expect(hex('the quick brown fox')).toBe(hex('the quick brown fox'));
  });

  it('produces a 64-bit digest by default', () => {
    expect(hex('anything')).toMatch(/^[0-9a-f]{16}$/);
  });

  it('honours the byte length the engine asks for', () => {
    const full = hex('anything');
    expect(hex('anything', 8)).toBe(full);
    expect(hex('anything', 4)).toBe(full.slice(0, 8));
    expect(hex('anything', 1)).toBe(full.slice(0, 2));
  });

  it('separates inputs that differ by one character', () => {
    expect(hex('document a')).not.toBe(hex('document b'));
    expect(hex(String.raw`\textbf{x}`)).not.toBe(hex(String.raw`\textbf{y}`));
  });

  it('separates inputs that differ only by order', () => {
    expect(hex('ab')).not.toBe(hex('ba'));
  });

  it('separates the empty string from a null byte', () => {
    expect(hex('')).not.toBe(hex('\0'));
  });

  it('accepts bytes as well as strings', () => {
    expect(hash(new TextEncoder().encode('abc')).toString('hex')).toBe(hex('abc'));
  });

  it('does not collide across the documents this game actually compiles', () => {
    // The cache these hashes key returns a compiled PDF. A collision would show
    // the player someone else's render and misjudge their answer, so the real
    // corpus is worth checking directly.
    const digests = new Set<string>();
    let count = 0;
    for (const problem of problems) {
      for (const body of [problem.latex, `${problem.latex} `, problem.latex.slice(0, -1)]) {
        digests.add(hex(buildDocument(body, problem.preamble)));
        count++;
      }
    }
    expect(digests.size).toBe(count);
  });

  it('does not collide across many near-identical inputs', () => {
    const digests = new Set<string>();
    for (let i = 0; i < 20_000; i++) digests.add(hex(`\\[ x_{${i}} = ${i} \\]`));
    expect(digests.size).toBe(20_000);
  });
});
