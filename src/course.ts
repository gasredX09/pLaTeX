/**
 * Tutorial Mode: a linear course for someone who has never written LaTeX.
 *
 * Naming, because it is genuinely confusing: this is what the interface calls
 * **Tutorial**. The thing called `tutorial` elsewhere in the code is the one-off
 * first-run exercise that the interface calls **Warm-up** (see onboarding.ts).
 *
 * The whole course lives here as data so the prose can be read and reviewed in
 * one place, and so the shape can be asserted in tests. Every stage past the
 * first carries a worked example and exactly one exercise.
 *
 * Authoring constraints, all enforced by scripts/verify-problems.ts:
 *   - example and exercise sources must fit the 80x32mm page and use only
 *     packages in BUNDLED_PACKAGES
 *   - exercise sources must not duplicate a Blaze or Practice problem
 *   - the worked examples are held to the same standard as the exercises: a
 *     lesson that shows a broken render teaches the wrong thing
 *
 * Prose is written in ordinary quoted strings rather than String.raw, because it
 * uses backticks for code spans. That means every literal backslash is doubled.
 */
import type { Problem } from './problems.js';

export interface CourseExercise extends Problem {
  /** A conceptual nudge, in the spirit of Practice Mode's hints. */
  hint: string;
}

export interface CourseStage {
  id: string;
  title: string;
  /** One line, shown on the map. */
  summary: string;
  /** Teaching prose. Backtick spans become code; see parseProse. */
  body: readonly string[];
  /**
   * Shown compiled, beside its own source. Absent on the opening stage.
   * `preamble` is for the rare lesson whose point is invisible under the shared
   * preamble, such as paragraph indentation.
   */
  example?: { caption: string; source: string; preamble?: string };
  /** Absent on the opening stage, which is prose only. */
  exercise?: CourseExercise;
}

export const courseStages: readonly CourseStage[] = [
  {
    id: 'course-what-is-latex',
    title: 'What LaTeX is',
    summary: 'Where it came from, and why anyone bothers.',
    body: [
      'LaTeX is a typesetting system. You do not push text around a page the way you would in a word processor. You describe what the text is — a heading, an equation, a table — and LaTeX works out how it should look.',
      'It was built for the documents where that distinction matters most: mathematics, physics, engineering, computer science. Most research papers you have seen with equations in them were set in LaTeX, and a good number of journals will not accept anything else.',
      'What you get in return for learning it is consistency. Once a document is described properly, every equation is spaced the same way, every figure is numbered correctly, and a 300-page thesis reads as one document rather than three hundred separate decisions.',
      'The mechanics are simple: you write plain text with commands mixed into it, and a program called a TeX engine turns that into a finished page. This tutorial runs a real one, in your browser, so anything you type here is typeset exactly as it would be in a paper.',
      'Nine short stages follow. Each explains one idea, shows a worked example, then asks you to reproduce a single thing yourself. Your render has to match the target exactly — a strict test, but an honest one.',
    ],
  },

  {
    id: 'course-text',
    title: 'Text and paragraphs',
    summary: 'Why your spaces and line breaks are ignored.',
    body: [
      'Most of a LaTeX document is just text. Type a sentence and you get that sentence.',
      'Whitespace, though, does not survive the way you might expect. Several spaces in a row count as one. A single line break counts as a space, so you can wrap your source however you like without changing the output.',
      'A blank line is different. It starts a new paragraph, it is the only way to make one, and LaTeX indents each new paragraph for you.',
      'This is deliberate. You are describing structure, not appearance, so where a line happens to end in your editor is none of the reader’s business.',
    ],
    example: {
      caption: 'Two paragraphs. The blank line is doing all the work.',
      // The shared preamble sets \parindent to zero for deterministic layout,
      // which would make a paragraph break render identically to a line break
      // and this lesson invisible. Restored here so the indent can be seen.
      preamble: String.raw`\setlength{\parindent}{1em}`,
      source: String.raw`One paragraph of text.

A second, after a blank line.`,
    },
    exercise: {
      id: 'course-ex-text',
      title: 'Start a second paragraph',
      description: 'Two paragraphs. Notice the indent on the second.',
      hint: 'A blank line between them is what separates paragraphs.',
      // Without the indent restored, a line break would render identically and
      // the exercise would accept \\ as a correct answer.
      preamble: String.raw`\setlength{\parindent}{1em}`,
      latex: String.raw`Typesetting begins here.

And continues here.`,
    },
  },

  {
    id: 'course-commands',
    title: 'Commands and braces',
    summary: 'The backslash, and what the curly braces are for.',
    body: [
      'A command starts with a backslash: `\\textbf` sets text bold, `\\textit` sets it italic.',
      'Most commands act on something, and that something goes in curly braces immediately after: `\\textbf{like this}`. The braces mark where the command’s reach begins and ends, which is why `\\textbf{two words}` bolds both but `\\textbf{two} words` bolds only the first.',
      'Braces are the single most important piece of punctuation in LaTeX. Almost every mistake a beginner makes is a brace in the wrong place, or a missing one.',
      'Commands can be nested. `\\textbf{\\textit{both}}` is bold and italic at once, because the inner command applies to text that is already inside the outer one.',
    ],
    example: {
      caption: 'Two commands, each with its argument in braces.',
      source: String.raw`\texttt{monospace} and \textbf{bold}`,
    },
    exercise: {
      id: 'course-ex-commands',
      title: 'Bold one phrase',
      description: 'Only the phrase in braces should be bold.',
      hint: String.raw`\textbf takes its text in curly braces.`,
      latex: String.raw`Please \textbf{read this first} carefully.`,
    },
  },

  {
    id: 'course-reserved',
    title: 'Reserved characters',
    summary: 'Ten characters that mean something else.',
    body: [
      'A handful of characters are reserved, because LaTeX already uses them: `% $ & # _ { } ~ ^` and the backslash itself.',
      'To print one, put a backslash in front: `\\%` gives a per cent sign, `\\$` a dollar sign, `\\&` an ampersand.',
      'The one that catches everyone is `%`. On its own it starts a comment, and LaTeX ignores the rest of that line — so a stray per cent sign does not produce an error, it silently swallows your text. If half a line vanishes, look for an unescaped `%`.',
      'The backslash is the exception to its own rule. `\\\\` does not print a backslash; it breaks the line. Printing one needs `\\textbackslash`.',
    ],
    example: {
      caption: 'Each reserved character escaped with a backslash.',
      source: String.raw`A 10\% deposit \& the rest later`,
    },
    exercise: {
      id: 'course-ex-reserved',
      title: 'Escape two of them',
      description: 'A percentage and an amount of money.',
      hint: 'Both the per cent sign and the dollar sign need a backslash.',
      latex: String.raw`50\% of \$20`,
    },
  },

  {
    id: 'course-maths-mode',
    title: 'Maths mode',
    summary: 'The most common mistake in LaTeX, and how to avoid it.',
    body: [
      'Mathematics does not work in ordinary text. It has to be inside maths mode, and there are two kinds.',
      'Inline maths sits in a sentence, between dollar signs: `$x$`. Display maths stands on its own line, centred, between `\\[` and `\\]`.',
      'Outside maths mode, a maths command simply fails. Writing `\\frac{3}{4}` in a sentence produces the error `Missing $ inserted`, which is TeX telling you it expected maths mode and did not find it. If you see that message, this is almost always why.',
      'The difference is not only about position. Maths mode sets letters in italic as variables, spaces things by mathematical convention, and ignores your own spaces entirely.',
    ],
    example: {
      caption: 'The same symbol, inline in a sentence.',
      source: String.raw`The value $x$ is unknown.`,
    },
    exercise: {
      id: 'course-ex-maths-mode',
      title: 'Put a symbol in a sentence',
      description: 'One italic variable, inside running text.',
      hint: 'Wrap it in dollar signs so it is in maths mode.',
      latex: String.raw`Let $n$ be a whole number.`,
    },
  },

  {
    id: 'course-fractions',
    title: 'Fractions, powers and roots',
    summary: 'Building an expression out of pieces.',
    body: [
      'Inside maths mode, `^` raises and `_` lowers: `$x^2$` and `$x_1$`.',
      'Each takes exactly one character, which surprises people. `$x^12$` is x to the power 1, followed by a 2. For anything longer than a single character, brace it: `$x^{12}$`.',
      'Fractions take two arguments, numerator then denominator: `\\frac{1}{2}`. Roots take one, `\\sqrt{2}`, and an optional index in square brackets for cube roots and beyond.',
      'These nest freely, which is where the braces earn their keep: `\\frac{x^2}{\\sqrt{y}}` is perfectly readable to LaTeX, and each brace pair marks exactly one piece.',
    ],
    example: {
      caption: 'Display maths, with a power on each term.',
      source: String.raw`\[ x^2 + y^2 = z^2 \]`,
    },
    exercise: {
      id: 'course-ex-fractions',
      title: 'A fraction and a power',
      description: 'Display maths, standing on its own line.',
      hint: String.raw`\frac takes the top then the bottom; ^ raises what follows.`,
      latex: String.raw`\[ \frac{1}{2} x^2 \]`,
    },
  },

  {
    id: 'course-environments',
    title: 'Environments and lists',
    summary: 'Regions of a document, opened and closed by name.',
    body: [
      'Some things apply to a region rather than a phrase. Those are environments, and they come in pairs: `\\begin{name}` opens one and `\\end{name}` closes it.',
      'The names must match. Closing an `itemize` with `\\end{enumerate}` is an error, and a common one when environments are nested.',
      'Lists are the everyday example. `itemize` gives bullets, `enumerate` gives numbers, and inside either one `\\item` begins each entry. You never write the bullet or the number yourself — that is the point.',
      'Environments nest, and a list inside a list is indented and marked differently without you asking.',
    ],
    example: {
      caption: 'A numbered list. The numbers are not in the source.',
      source: String.raw`\begin{enumerate}
  \item Measure
  \item Cut
\end{enumerate}`,
    },
    exercise: {
      id: 'course-ex-environments',
      title: 'A bulleted list',
      description: 'Two entries, bullets supplied for you.',
      hint: String.raw`Open itemize, then start each entry with \item.`,
      latex: String.raw`\begin{itemize}
  \item Read
  \item Write
\end{itemize}`,
    },
  },

  {
    id: 'course-tables',
    title: 'Tables',
    summary: 'Columns, cells, and where the rules come from.',
    body: [
      'A table is the `tabular` environment, and it takes an extra argument describing its columns: `\\begin{tabular}{lc}` means a left-aligned column then a centred one. `r` aligns right.',
      'Inside, `&` separates one cell from the next and `\\\\` ends a row. The number of `&` in a row must fit the column spec, or LaTeX complains about an extra alignment tab.',
      'Rules are yours to ask for. A `|` in the column spec draws a vertical rule, and `\\hline` on its own line draws a horizontal one.',
      'Tables are the fiddliest thing in this tutorial, and worth the patience: `&` and `\\\\` in the right places is most of what there is to it.',
    ],
    example: {
      caption: 'Two columns, with a rule above and below the header.',
      source: String.raw`\begin{tabular}{|l|r|}
  \hline
  Item & Cost \\
  \hline
\end{tabular}`,
    },
    exercise: {
      id: 'course-ex-tables',
      title: 'A two-by-two table',
      description: 'Two columns, two rows, no rules.',
      hint: String.raw`& separates cells, \\ ends a row, and the spec sets the columns.`,
      latex: String.raw`\begin{tabular}{ll}
  north & south \\
  east & west
\end{tabular}`,
    },
  },

  {
    id: 'course-together',
    title: 'Putting it together',
    summary: 'One line using most of what you have learnt.',
    body: [
      'That is the whole mental model: text, commands with braced arguments, escaped reserved characters, maths mode, and environments opened and closed by name. Everything else in LaTeX is more of the same.',
      'This last exercise mixes a command with inline maths in one sentence, which is what most real writing actually looks like.',
      'After this, Practice Mode has forty-eight exercises grouped by topic, all untimed, with a hint and the source available on every one. Blaze Mode is the same idea against a three-minute clock, and Fix-it Mode hands you source that is already wrong and asks you to repair it.',
    ],
    example: {
      caption: 'A command and inline maths in the same sentence.',
      source: String.raw`The \textbf{radius} is $r$.`,
    },
    exercise: {
      id: 'course-ex-together',
      title: 'A sentence with both',
      description: 'One bold word, and one piece of inline maths.',
      hint: 'Bold the word in braces, and put the expression between dollar signs.',
      latex: String.raw`The area is $\pi r^2$, \textbf{always}.`,
    },
  },
];

/** Every exercise in the course, in stage order. */
export const courseExercises: readonly CourseExercise[] = courseStages
  .map((stage) => stage.exercise)
  .filter((exercise): exercise is CourseExercise => exercise !== undefined);

export type ProseSegment = { kind: 'text' | 'code'; text: string };

/**
 * Splits prose into plain and code runs on backtick delimiters.
 *
 * Pure, and returns segments rather than DOM nodes, for two reasons: the parsing
 * is then testable without a browser, and the caller builds text nodes and
 * elements directly, so nothing in the prose can ever be interpreted as markup.
 *
 * An unclosed backtick is treated as literal text rather than swallowing the
 * rest of the paragraph, since that is a typo in the prose, not an instruction.
 */
export function parseProse(text: string): ProseSegment[] {
  const segments: ProseSegment[] = [];
  let rest = text;

  while (rest.length > 0) {
    const open = rest.indexOf('`');
    if (open === -1) break;

    const close = rest.indexOf('`', open + 1);
    if (close === -1) break;

    if (open > 0) segments.push({ kind: 'text', text: rest.slice(0, open) });
    segments.push({ kind: 'code', text: rest.slice(open + 1, close) });
    rest = rest.slice(close + 1);
  }

  if (rest.length > 0) segments.push({ kind: 'text', text: rest });
  return segments;
}
