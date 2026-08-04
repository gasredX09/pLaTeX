/**
 * Rewrites that map cosmetically-different LaTeX onto a single canonical form,
 * so a player who writes `\not\in` still matches a target written as `\notin`.
 *
 * Ported from TeXnique's normalizations.js (MIT). Its rule for inclusion is
 * worth repeating, because it is what keeps the game honest:
 *
 *   - the two forms must produce a nearly visually identical result
 *     (`\not\exists` vs `\nexists` look different, so they do NOT qualify)
 *   - the two forms must be equivalently "correct"
 *     (`\binom` vs `\begin{pmatrix}` mean different things, so no)
 *
 * As a rule of thumb: if the only difference between two commands is the
 * spacing they produce, a rule may collapse them.
 *
 * We need fewer of these than TeXnique did. It rendered with KaTeX, where
 * different-but-equivalent markup often produced subtly different boxes. Real
 * TeX is deterministic, so `\textbf{x}` and `{\bfseries x}` already emit
 * identical output and need no rule. What still needs rules are genuine
 * spacing differences, like `\mid` (a relation) versus `|` (an ordinary symbol).
 *
 * Unlike TeXnique, we apply these to BOTH the target and the player's input.
 * TeXnique normalized only the input while rendering the target raw, which
 * means a target authored with `\mid` could never be matched by any input.
 * Normalizing symmetrically costs nothing and removes that trap.
 */

type Rule = { rule: RegExp; replacement: string };

const rules: Rule[] = [
  { rule: /\\not\s*\\in(?!\w)/g, replacement: String.raw`\notin` },
  { rule: /\\not\s*=/g, replacement: String.raw`\neq` },
  { rule: /\\mid(?!\w)/g, replacement: '|' },
  { rule: /\\Longleftrightarrow(?!\w)/g, replacement: String.raw`\iff ` },
  { rule: /\\Longrightarrow(?!\w)/g, replacement: String.raw`\implies` },
  // A backslash-space is just an interword space, but only when the backslash
  // is not itself escaped. The lookbehind keeps `\\ ` (a line break followed by
  // a space) from being mangled.
  { rule: /(?<!\\)\\ /g, replacement: ' ' },
];

export function normalize(input: string): string {
  return rules.reduce((acc, { rule, replacement }) => acc.replace(rule, replacement), input);
}
