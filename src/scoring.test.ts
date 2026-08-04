import { describe, it, expect } from 'vitest';
import { pointsFor, formatPoints } from './scoring.js';

describe('pointsFor', () => {
  // Verified against TeXnique's own problems.js, which scores with the same
  // Math.ceil(latex.length / 10) formula. These are real entries from it.
  it('matches TeXnique on known problems', () => {
    expect(pointsFor(String.raw`c = \sqrt{a^2+b^2}`)).toBe(2); // 18 chars
    expect(pointsFor(String.raw`e^{\pi i} + 1 = 0`)).toBe(2); // 17 chars
    expect(pointsFor(String.raw`x = \dfrac{-b\pm\sqrt{b^2-4ac}}{2a}`)).toBe(4); // 35 chars
  });

  it('rounds up, so any non-empty snippet is worth at least one point', () => {
    expect(pointsFor('x')).toBe(1);
    expect(pointsFor('123456789')).toBe(1);
    expect(pointsFor('1234567890')).toBe(1);
    expect(pointsFor('12345678901')).toBe(2);
  });

  it('scores the empty string as zero', () => {
    expect(pointsFor('')).toBe(0);
  });
});

describe('formatPoints', () => {
  it('pluralizes', () => {
    expect(formatPoints(1)).toBe('(1 point)');
    expect(formatPoints(2)).toBe('(2 points)');
    expect(formatPoints(0)).toBe('(0 points)');
  });
});
