import type { Problem } from './problems.js';

export const PRACTICE_TOPIC_IDS = [
  'math',
  'text-formatting',
  'accents-symbols',
  'lists',
  'tables',
  'boxes-spacing',
  'tikz',
  'document-structure',
] as const;

export type PracticeTopicId = (typeof PRACTICE_TOPIC_IDS)[number];

export interface PracticeTopic {
  id: PracticeTopicId;
  title: string;
  description: string;
}

export interface PracticeProblem extends Problem {
  topic: PracticeTopicId;
  /** A conceptual nudge that does not give away the complete source. */
  hint: string;
}

export const practiceTopics: readonly PracticeTopic[] = [
  {
    id: 'math',
    title: 'Math',
    description: 'Fractions, roots, powers, and larger display equations.',
  },
  {
    id: 'text-formatting',
    title: 'Text formatting',
    description: 'Weight, shape, size, and type styles in running text.',
  },
  {
    id: 'accents-symbols',
    title: 'Accents and symbols',
    description: 'Accented letters, reserved characters, and mathematical symbols.',
  },
  {
    id: 'lists',
    title: 'Lists',
    description: 'Bullets, numbering, and labelled descriptions.',
  },
  {
    id: 'tables',
    title: 'Tables',
    description: 'Columns, alignment, and ruled tabular layouts.',
  },
  {
    id: 'boxes-spacing',
    title: 'Boxes and spacing',
    description: 'Frames and deliberate horizontal or vertical space.',
  },
  {
    id: 'tikz',
    title: 'TikZ',
    description: 'Paths, closed shapes, and filled drawings.',
  },
  {
    id: 'document-structure',
    title: 'Document structure',
    description: 'Headings, paragraphs, alignment, and quotations.',
  },
] as const;

/**
 * Practice Mode uses targets that never appear in Blaze Mode. Problems are
 * grouped in teaching order within each topic, from one command to a small
 * composition of commands.
 */
export const practiceProblems: readonly PracticeProblem[] = [
  // Math
  {
    id: 'practice-math-inline-fraction',
    topic: 'math',
    title: 'An Inline Fraction',
    description: 'Put a compact fraction inside a sentence.',
    hint: String.raw`Use $...$ for inline math and \frac for the fraction.`,
    latex: String.raw`The ratio is $\frac{3}{4}$.`,
  },
  {
    id: 'practice-math-root-power',
    topic: 'math',
    title: 'Roots and Powers',
    description: 'Combine a superscript with a square root in display math.',
    hint: String.raw`Use ^ for the power and \sqrt{...} for the root.`,
    latex: String.raw`\[ y = x^3 + \sqrt{x+1} \]`,
  },
  {
    id: 'practice-math-geometric-sum',
    topic: 'math',
    title: 'A Geometric Sum',
    description: 'Build a sum with limits, powers, and a fraction.',
    hint: String.raw`Give \sum both a lower _{...} and upper ^{...} limit.`,
    latex: String.raw`\[ \sum_{j=0}^{m} r^j = \frac{1-r^{m+1}}{1-r} \]`,
  },

  // Text formatting
  {
    id: 'practice-text-bold',
    topic: 'text-formatting',
    title: 'One Bold Phrase',
    description: 'Change the weight of only the words inside the braces.',
    hint: String.raw`Wrap the phrase with \textbf{...}.`,
    latex: String.raw`Make \textbf{this phrase} bold.`,
  },
  {
    id: 'practice-text-italic',
    topic: 'text-formatting',
    title: 'A Word in Italics',
    description: 'Change one word to an italic shape.',
    hint: String.raw`The text command for italics is \textit{...}.`,
    latex: String.raw`A word in \textit{italics}.`,
  },
  {
    id: 'practice-text-styles',
    topic: 'text-formatting',
    title: 'Two Type Styles',
    description: 'Combine small capitals and monospaced text.',
    hint: String.raw`Use \textsc for small capitals and \texttt for typewriter text.`,
    latex: String.raw`\textsc{Draft} by \texttt{typesetter}`,
  },

  // Accents and symbols
  {
    id: 'practice-symbols-accents',
    topic: 'accents-symbols',
    title: 'A Pair of Accents',
    description: 'Add a grave accent and a circumflex.',
    hint: String.raw`The accent commands are \` and \^, each followed by its letter.`,
    latex: String.raw`cr\`eme and h\^otel`,
  },
  {
    id: 'practice-symbols-reserved',
    topic: 'accents-symbols',
    title: 'Percent and Ampersand',
    description: 'Print two characters that normally have special meaning.',
    hint: String.raw`Escape both characters with a backslash.`,
    latex: String.raw`Save 20\% on tea \& coffee.`,
  },
  {
    id: 'practice-symbols-greek',
    topic: 'accents-symbols',
    title: 'Three Greek Letters',
    description: 'Set lowercase Greek letters in display math.',
    hint: String.raw`Their command names are \theta, \lambda, and \mu.`,
    latex: String.raw`\[ \theta + \lambda = \mu \]`,
  },

  // Lists
  {
    id: 'practice-lists-bullets',
    topic: 'lists',
    title: 'A Short Checklist',
    description: 'Create two bullet points.',
    hint: String.raw`Use an itemize environment and begin each row with \item.`,
    latex: String.raw`\begin{itemize}
  \item Paper
  \item Ink
\end{itemize}`,
  },
  {
    id: 'practice-lists-numbered',
    topic: 'lists',
    title: 'Two Ordered Steps',
    description: 'Let LaTeX supply the step numbers.',
    hint: String.raw`An enumerate environment numbers each \item automatically.`,
    latex: String.raw`\begin{enumerate}
  \item Draft
  \item Revise
\end{enumerate}`,
  },
  {
    id: 'practice-lists-labelled',
    topic: 'lists',
    title: 'Labelled Terms',
    description: 'Give each list item its own visible label.',
    hint: String.raw`Use description, with the label in brackets after \item.`,
    latex: String.raw`\begin{description}
  \item[Ink] Black
  \item[Paper] White
\end{description}`,
  },

  // Tables
  {
    id: 'practice-tables-pair',
    topic: 'tables',
    title: 'A Two-Column Pair',
    description: 'Separate two cells and end the row.',
    hint: String.raw`Use a tabular with two columns, & between cells, and \\ after the row.`,
    latex: String.raw`\begin{tabular}{ll}
  Name & Ada \\
  Role & Editor
\end{tabular}`,
  },
  {
    id: 'practice-tables-alignment',
    topic: 'tables',
    title: 'Opposite Alignment',
    description: 'Align labels left and values right.',
    hint: String.raw`The column specification {lr} gives left then right alignment.`,
    latex: String.raw`\begin{tabular}{lr}
  Apples & 4 \\
  Pears & 12
\end{tabular}`,
  },
  {
    id: 'practice-tables-ruled',
    topic: 'tables',
    title: 'A Ruled Header',
    description: 'Add a horizontal rule below a table heading.',
    hint: String.raw`Place \hline after the heading row.`,
    latex: String.raw`\begin{tabular}{lc}
  Item & Qty \\
  \hline
  Clips & 8
\end{tabular}`,
  },

  // Boxes and spacing
  {
    id: 'practice-boxes-frame',
    topic: 'boxes-spacing',
    title: 'A Framed Label',
    description: 'Draw a simple box around text.',
    hint: String.raw`The command is \fbox{...}.`,
    latex: String.raw`Status: \fbox{Approved}`,
  },
  {
    id: 'practice-boxes-horizontal-gap',
    topic: 'boxes-spacing',
    title: 'A Measured Gap',
    description: 'Insert exactly one centimetre between two letters.',
    hint: String.raw`Put \hspace{1cm} between the letters.`,
    latex: String.raw`A\hspace{1cm}B`,
  },
  {
    id: 'practice-boxes-vertical-gap',
    topic: 'boxes-spacing',
    title: 'Space Between Lines',
    description: 'Separate two lines with a measured vertical gap.',
    hint: String.raw`End the first paragraph, add \vspace{6mm}, then begin the second.`,
    latex: String.raw`Top

\vspace{6mm}

Bottom`,
  },

  // TikZ
  {
    id: 'practice-tikz-line',
    topic: 'tikz',
    title: 'A Line Segment',
    description: 'Draw a straight path between two coordinates.',
    hint: String.raw`Inside tikzpicture, use \draw (0,0) -- (2,0);`,
    latex: String.raw`\begin{tikzpicture}
  \draw (0,0) -- (2,0);
\end{tikzpicture}`,
    preamble: String.raw`\usepackage{tikz}`,
  },
  {
    id: 'practice-tikz-triangle',
    topic: 'tikz',
    title: 'A Closed Triangle',
    description: 'Join three coordinates and close the path.',
    hint: String.raw`Connect the points with -- and finish the path with -- cycle.`,
    latex: String.raw`\begin{tikzpicture}
  \draw (0,0) -- (1,1.4) -- (2,0) -- cycle;
\end{tikzpicture}`,
    preamble: String.raw`\usepackage{tikz}`,
  },
  {
    id: 'practice-tikz-filled-circle',
    topic: 'tikz',
    title: 'A Filled Circle',
    description: 'Fill a circular path with colour.',
    hint: String.raw`Use \fill[orange] followed by a coordinate and circle radius.`,
    latex: String.raw`\begin{tikzpicture}
  \fill[orange] (0,0) circle (0.7cm);
\end{tikzpicture}`,
    preamble: String.raw`\usepackage{tikz}`,
  },

  // Document structure
  {
    id: 'practice-structure-heading',
    topic: 'document-structure',
    title: 'A Small Heading',
    description: 'Create an unnumbered subsection followed by text.',
    hint: String.raw`Use the starred form \subsection*{...}.`,
    latex: String.raw`\subsection*{Notes}
A short paragraph.`,
  },
  {
    id: 'practice-structure-centered',
    topic: 'document-structure',
    title: 'A Centred Line',
    description: 'Centre one line using an environment.',
    hint: String.raw`Place the line inside \begin{center} and \end{center}.`,
    latex: String.raw`\begin{center}
  Practice sheet
\end{center}`,
  },
  {
    id: 'practice-structure-quotation',
    topic: 'document-structure',
    title: 'An Indented Quotation',
    description: 'Set a short quotation apart from the surrounding page.',
    hint: String.raw`The quote environment supplies the indentation.`,
    latex: String.raw`\begin{quote}
  Begin with the page.
\end{quote}`,
  },
];

export function problemsForTopic(topic: PracticeTopicId): readonly PracticeProblem[] {
  return practiceProblems.filter((problem) => problem.topic === topic);
}

export function findPracticeTopic(id: string): PracticeTopic | null {
  return practiceTopics.find((topic) => topic.id === id) ?? null;
}
