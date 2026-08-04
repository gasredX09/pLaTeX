/**
 * Points for a problem, carried over verbatim from TeXnique:
 *
 *   problemPoints = Math.ceil(target.latex.length / 10.0)
 *
 * Longer snippets are worth more, which is a crude but effective proxy for
 * difficulty and keeps the scale familiar to anyone who has played the original.
 */
export const POINTS_PER_CHARS = 10;

export function pointsFor(latex: string): number {
  return Math.ceil(latex.length / POINTS_PER_CHARS);
}

/** "(1 point)" / "(7 points)" — pluralization matches the original too. */
export function formatPoints(points: number): string {
  return `(${points} ${points === 1 ? 'point' : 'points'})`;
}
