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
  {
    id: 'practice-math-nested-fraction',
    topic: 'math',
    title: 'A Fraction Inside a Fraction',
    description: 'Nest one fraction in the numerator of another.',
    hint: String.raw`The first argument of \frac can itself be a \frac.`,
    latex: String.raw`\[ \frac{\frac{a}{b}}{c} \]`,
  },
  {
    id: 'practice-math-binomial',
    topic: 'math',
    title: 'A Binomial Coefficient',
    description: 'Stack two values inside brackets, without a rule between them.',
    hint: String.raw`\binom takes the top then the bottom.`,
    latex: String.raw`\[ \binom{m}{k} = \frac{m!}{k!(m-k)!} \]`,
  },
  {
    id: 'practice-math-subscript-limit',
    topic: 'math',
    title: 'A Limit at Infinity',
    description: 'Put a condition under the limit operator.',
    hint: String.raw`\lim_{...} takes the approach below it; \infty is the symbol.`,
    latex: String.raw`\[ \lim_{t \to \infty} \frac{1}{t} = 0 \]`,
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
  {
    id: 'practice-text-monospace',
    topic: 'text-formatting',
    title: 'Code in a Sentence',
    description: 'Set one word in a typewriter face.',
    hint: String.raw`\texttt is the monospaced family.`,
    latex: String.raw`Run \texttt{make} to build it.`,
  },
  {
    id: 'practice-text-size-shift',
    topic: 'text-formatting',
    title: 'A Change of Size',
    description: 'Make part of a line larger, then return to normal.',
    hint: String.raw`Size commands are declarations: {\large ...} scopes the change.`,
    latex: String.raw`A {\large larger} word here.`,
  },
  {
    id: 'practice-text-break',
    topic: 'text-formatting',
    title: 'Breaking a Line',
    description: 'Split one sentence across two lines without a new paragraph.',
    hint: String.raw`Two backslashes end a line inside a paragraph.`,
    latex: String.raw`Above the break \\
below the break`,
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
  {
    id: 'practice-symbols-tilde-ring',
    topic: 'accents-symbols',
    title: 'Tilde and Ring',
    description: 'Two accents that sit above their letter.',
    hint: String.raw`\~ places a tilde; \r places a ring.`,
    latex: String.raw`ma\~nana and \r{u}`,
  },
  {
    id: 'practice-symbols-arrows',
    topic: 'accents-symbols',
    title: 'Two Arrows',
    description: 'A short arrow and a long double one, in math.',
    hint: String.raw`\to is short; \Longrightarrow is long and doubled.`,
    latex: String.raw`\[ p \to q \implies r \]`,
  },
  {
    id: 'practice-symbols-sets',
    topic: 'accents-symbols',
    title: 'A Set of Numbers',
    description: 'Name a number set in blackboard bold.',
    hint: String.raw`\mathbb{...} gives the doubled-stroke letters.`,
    latex: String.raw`\[ x \in \mathbb{R} \setminus \mathbb{Q} \]`,
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
  {
    id: 'practice-lists-nested',
    topic: 'lists',
    title: 'A List Within a List',
    description: 'Indent a second level of bullets.',
    hint: String.raw`Open a second itemize inside an \item.`,
    latex: String.raw`\begin{itemize}
  \item Fruit
  \begin{itemize}
    \item Pear
  \end{itemize}
\end{itemize}`,
  },
  {
    id: 'practice-lists-custom-marker',
    topic: 'lists',
    title: 'Choosing the Marker',
    description: 'Replace the bullet with a character of your own.',
    hint: String.raw`\item takes an optional argument in square brackets.`,
    latex: String.raw`\begin{itemize}
  \item[+] Added
  \item[-] Removed
\end{itemize}`,
  },
  {
    id: 'practice-lists-numbered-steps',
    topic: 'lists',
    title: 'Three Numbered Steps',
    description: 'A longer ordered list, numbered automatically.',
    hint: String.raw`Each \item advances the counter on its own.`,
    latex: String.raw`\begin{enumerate}
  \item Measure
  \item Cut
  \item Fit
\end{enumerate}`,
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
  {
    id: 'practice-tables-three-columns',
    topic: 'tables',
    title: 'Three Columns',
    description: 'Mix left, centred, and right alignment in one table.',
    hint: String.raw`The spec letters l, c and r set each column in turn.`,
    latex: String.raw`\begin{tabular}{lcr}
  one & two & three \\
  x & y & z
\end{tabular}`,
  },
  {
    id: 'practice-tables-full-rules',
    topic: 'tables',
    title: 'A Fully Ruled Table',
    description: 'Put a rule around and between every row.',
    hint: String.raw`Bars in the spec draw vertical rules; \hline draws horizontal ones.`,
    latex: String.raw`\begin{tabular}{|c|c|}
  \hline
  A & B \\
  \hline
  1 & 2 \\
  \hline
\end{tabular}`,
  },
  {
    id: 'practice-tables-spanning',
    topic: 'tables',
    title: 'A Heading Across Two Columns',
    description: 'Make one cell span the full width of the table.',
    hint: String.raw`\multicolumn takes a count, a spec, and the contents.`,
    latex: String.raw`\begin{tabular}{|l|l|}
  \hline
  \multicolumn{2}{|c|}{Summary} \\
  \hline
  x & y \\
  \hline
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
  {
    id: 'practice-boxes-parbox',
    topic: 'boxes-spacing',
    title: 'Text Wrapped to a Width',
    description: 'Confine a sentence to a narrow column.',
    hint: String.raw`\parbox takes a width, then the text.`,
    latex: String.raw`\parbox{25mm}{A narrow column of text.}`,
  },
  {
    id: 'practice-boxes-rule',
    topic: 'boxes-spacing',
    title: 'Drawing a Rule',
    description: 'Place a solid line of a given size in running text.',
    hint: String.raw`\rule takes the width first, then the height.`,
    latex: String.raw`signed \rule{25mm}{0.4pt}`,
  },
  {
    id: 'practice-boxes-math-space',
    topic: 'boxes-spacing',
    title: 'Space Inside Math',
    description: 'Separate two symbols by a wide math space.',
    hint: String.raw`\quad is one em of space; \, is much thinner.`,
    latex: String.raw`\[ f(x) \quad g(x) \]`,
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
  {
    id: 'practice-tikz-dashed',
    topic: 'tikz',
    title: 'A Dashed Segment',
    description: 'Draw a straight path with a broken line style.',
    hint: String.raw`Options go in brackets on \draw, before the coordinates.`,
    latex: String.raw`\begin{tikzpicture}
  \draw[dashed] (0,0) -- (2,0);
\end{tikzpicture}`,
    preamble: String.raw`\usepackage{tikz}`,
  },
  {
    id: 'practice-tikz-arrow-tip',
    topic: 'tikz',
    title: 'A Path with an Arrow',
    description: 'Put an arrow tip on the end of a line.',
    hint: String.raw`The option -> places a tip at the far end.`,
    latex: String.raw`\begin{tikzpicture}
  \draw[->] (0,0) -- (2,1);
\end{tikzpicture}`,
    preamble: String.raw`\usepackage{tikz}`,
  },
  {
    id: 'practice-tikz-rectangle-outline',
    topic: 'tikz',
    title: 'An Outlined Rectangle',
    description: 'Draw a rectangle from two opposite corners.',
    hint: String.raw`rectangle joins the current point to the one given.`,
    latex: String.raw`\begin{tikzpicture}
  \draw (0,0) rectangle (2.5,1);
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
  {
    id: 'practice-structure-subheading',
    topic: 'document-structure',
    title: 'A Subheading',
    description: 'Add an unnumbered heading one level down.',
    hint: String.raw`\subsection* is a level below \section*.`,
    latex: String.raw`\subsection*{Details}
Text beneath it.`,
  },
  {
    id: 'practice-structure-paragraphs',
    topic: 'document-structure',
    title: 'Two Paragraphs',
    description: 'Start a new paragraph, and notice the indent.',
    hint: String.raw`A blank line begins a paragraph; \\ does not.`,
    latex: String.raw`Opening thought.

Following thought.`,
  },
  {
    id: 'practice-structure-right',
    topic: 'document-structure',
    title: 'Ranged Right',
    description: 'Push a line against the right margin.',
    hint: String.raw`flushright is an environment, like center.`,
    latex: String.raw`\begin{flushright}
  Signed, the author
\end{flushright}`,
  },
];

export function problemsForTopic(topic: PracticeTopicId): readonly PracticeProblem[] {
  return practiceProblems.filter((problem) => problem.topic === topic);
}

export function findPracticeTopic(id: string): PracticeTopic | null {
  return practiceTopics.find((topic) => topic.id === id) ?? null;
}
