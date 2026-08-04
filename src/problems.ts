/**
 * The problem set.
 *
 * Each `latex` is a document *body*, compiled inside the template in
 * tex/document.ts. Authoring rules:
 *
 *  - It must fit a 100x60mm page with 4mm margins (roughly 45 characters wide
 *    by 8 lines at 11pt). Only page one is compared, so overflow is invisible
 *    and confusing.
 *  - It may only use packages listed in BUNDLED_PACKAGES. In particular
 *    `booktabs`, `enumitem`, `ulem`, `cancel` and `stmaryrd` are NOT available:
 *    they are absent from the engine's bundles and would need a network fetch.
 *  - Prefer the canonical spelling of anything normalize.ts rewrites, so the
 *    target reads naturally.
 *
 * scripts/verify-problems.ts compiles every entry, so a violation of any of
 * this fails the build rather than surfacing mid-game.
 */

export interface Problem {
  id: string;
  title: string;
  description: string;
  /** The document body the player must reproduce. */
  latex: string;
  /** Extra preamble lines, restricted to BUNDLED_PACKAGES. */
  preamble?: string;
}

export const problems: Problem[] = [
  // ---------------------------------------------------------------- math ---
  {
    id: 'quadratic',
    title: 'Quadratic Formula',
    description: 'Classic.',
    latex: String.raw`\[ x = \frac{-b \pm \sqrt{b^2-4ac}}{2a} \]`,
  },
  {
    id: 'euler-identity',
    title: "Euler's Identity",
    description: 'The most beautiful equation in mathematics.',
    latex: String.raw`\[ e^{\pi i} + 1 = 0 \]`,
  },
  {
    id: 'sum-squares',
    title: 'Sum of the First $n$ Squares',
    description: 'Watch the limits.',
    latex: String.raw`\[ \sum_{i=1}^n i^2 = \frac{n(n+1)(2n+1)}{6} \]`,
  },
  {
    id: 'gaussian-integral',
    title: 'Gaussian Integral',
    description: 'Mind the thin space before the differential.',
    latex: String.raw`\[ \int_{-\infty}^{\infty} e^{-x^2} \, dx = \sqrt{\pi} \]`,
  },
  {
    id: 'pmatrix',
    title: 'A 2x2 Matrix',
    description: 'Rows end with a double backslash.',
    latex: String.raw`\[ A = \begin{pmatrix} a & b \\ c & d \end{pmatrix} \]`,
  },
  {
    id: 'cases',
    title: 'Piecewise Definition',
    description: 'The cases environment lines up on the ampersand.',
    latex: String.raw`\[ |x| = \begin{cases} x & x \ge 0 \\ -x & x < 0 \end{cases} \]`,
  },
  {
    id: 'binomial-theorem',
    title: 'Binomial Theorem',
    description: 'Binomials, not fractions.',
    latex: String.raw`\[ (x+y)^n = \sum_{k=0}^n \binom{n}{k} x^k y^{n-k} \]`,
  },
  {
    id: 'limit-e',
    title: 'A Definition of $e$',
    description: 'Limits go underneath.',
    latex: String.raw`\[ e = \lim_{n \to \infty} \left( 1 + \frac{1}{n} \right)^n \]`,
  },
  {
    id: 'aligned',
    title: 'Aligned Equations',
    description: 'Two lines, aligned on the equals sign.',
    latex: String.raw`\begin{align*}
  (a+b)^2 &= a^2 + 2ab + b^2 \\
  (a-b)^2 &= a^2 - 2ab + b^2
\end{align*}`,
  },
  {
    id: 'set-builder',
    title: 'Set-Builder Notation',
    description: 'Braces need escaping.',
    latex: String.raw`\[ S = \{ x \in \mathbb{R} : x^2 < 2 \} \]`,
  },
  {
    id: 'de-morgan',
    title: "De Morgan's Law",
    description: 'Overlines stretch to fit.',
    latex: String.raw`\[ \overline{A \cup B} = \overline{A} \cap \overline{B} \]`,
  },
  {
    id: 'partial-derivative',
    title: 'Partial Derivatives',
    description: 'Not the same slash as an ordinary d.',
    latex: String.raw`\[ \frac{\partial^2 f}{\partial x \, \partial y} = f_{xy} \]`,
  },

  // ------------------------------------------------------ text formatting ---
  {
    id: 'bold-italic',
    title: 'Bold and Italic',
    description: 'Any spelling that typesets the same counts.',
    latex: String.raw`This is \textbf{bold} and this is \textit{italic}.`,
  },
  {
    id: 'typewriter-smallcaps',
    title: 'Typewriter and Small Caps',
    description: 'Two more font families.',
    latex: String.raw`Type \texttt{code} in \textsc{Small Caps}.`,
  },
  {
    id: 'quotes',
    title: 'Proper Quotation Marks',
    description: 'Straight quotes will not do. Look closely at the marks.',
    // Not String.raw: LaTeX's opening quotes are backticks, which would end the
    // template literal. There are no backslashes here, so a plain string is fine.
    latex: "He said ``hello'' and she said `goodbye'.",
  },
  {
    id: 'dashes',
    title: 'Three Kinds of Dash',
    description: 'Hyphen, en dash, em dash. Count the hyphens.',
    latex: String.raw`well-known, pages 1--10, a pause---then more.`,
  },
  {
    id: 'escaped-characters',
    title: 'Reserved Characters',
    description: 'Every one of these needs a backslash.',
    latex: String.raw`100\% of \$5 \& more \#1 \_here\_`,
  },
  {
    id: 'font-sizes',
    title: 'Font Sizes',
    description: 'Size commands are declarations, not arguments.',
    latex: String.raw`{\large Large} then {\small small} then normal.`,
  },
  {
    id: 'emph-nested',
    title: 'Nested Emphasis',
    description: 'Emphasis inside emphasis flips back upright.',
    latex: String.raw`\emph{outer \emph{inner} outer}`,
  },
  {
    id: 'underline',
    title: 'Underlined Text',
    description: 'The kernel command, no extra package.',
    latex: String.raw`Please \underline{sign here} today.`,
  },
  {
    id: 'centered',
    title: 'Centered Text',
    description: 'An environment, not a command.',
    latex: String.raw`\begin{center}
  Centered on the page
\end{center}`,
  },
  {
    id: 'verbatim',
    title: 'Verbatim',
    description: 'Where backslashes stop meaning anything.',
    latex: String.raw`\begin{verbatim}
\textbf{not bold}
\end{verbatim}`,
  },

  // ------------------------------------------------ accents and symbols ---
  {
    id: 'accents',
    title: 'Accented Letters',
    description: 'Four different accent commands.',
    latex: String.raw`caf\'e, na\"ive, \^etre, se\~nor`,
  },
  {
    id: 'more-accents',
    title: 'Cedilla and Breve',
    description: 'Accents that take a braced argument.',
    latex: String.raw`Fran\c{c}ois, \v{S}koda, Erd\H{o}s`,
  },
  {
    id: 'text-symbols',
    title: 'Text Symbols',
    description: 'Section, paragraph, dagger, copyright.',
    latex: String.raw`\S 3, \P 2, \dag, \copyright{} 2026`,
  },
  {
    id: 'greek',
    title: 'Greek Letters',
    description: 'Capitals are not all italic.',
    latex: String.raw`\[ \alpha, \beta, \gamma, \Gamma, \Delta, \omega, \Omega \]`,
  },
  {
    id: 'ligatures',
    title: 'Ellipsis and Ligature',
    description: 'Do not type three periods.',
    latex: String.raw`Wait\ldots{} the office file is fine.`,
  },

  // --------------------------------------------------------------- lists ---
  {
    id: 'itemize',
    title: 'Bulleted List',
    description: 'The everyday list.',
    latex: String.raw`\begin{itemize}
  \item Bread
  \item Butter
\end{itemize}`,
  },
  {
    id: 'enumerate',
    title: 'Numbered List',
    description: 'The numbers come for free.',
    latex: String.raw`\begin{enumerate}
  \item First
  \item Second
  \item Third
\end{enumerate}`,
  },
  {
    id: 'description',
    title: 'Description List',
    description: 'The optional argument becomes the label.',
    latex: String.raw`\begin{description}
  \item[TeX] A typesetting system.
  \item[LaTeX] A set of macros for it.
\end{description}`,
  },
  {
    id: 'nested-list',
    title: 'Nested List',
    description: 'The inner bullet changes shape by itself.',
    latex: String.raw`\begin{itemize}
  \item Outer
  \begin{itemize}
    \item Inner
  \end{itemize}
\end{itemize}`,
  },

  // -------------------------------------------------------------- tables ---
  {
    id: 'tabular-basic',
    title: 'A Simple Table',
    description: 'Three columns, no rules.',
    latex: String.raw`\begin{tabular}{lcr}
  left & center & right \\
  a & b & c
\end{tabular}`,
  },
  {
    id: 'tabular-rules',
    title: 'Table with Rules',
    description: 'Vertical bars in the spec, horizontal lines in the body.',
    latex: String.raw`\begin{tabular}{|l|r|}
  \hline
  Item & Qty \\
  \hline
  Pens & 12 \\
  \hline
\end{tabular}`,
  },
  {
    id: 'multicolumn',
    title: 'Spanning a Column',
    description: 'One cell, two columns.',
    latex: String.raw`\begin{tabular}{|c|c|}
  \hline
  \multicolumn{2}{|c|}{Total} \\
  \hline
  7 & 9 \\
  \hline
\end{tabular}`,
  },

  // ------------------------------------------------------ boxes and space ---
  {
    id: 'fbox',
    title: 'A Framed Box',
    description: 'A rule around its contents.',
    latex: String.raw`\fbox{Handle with care}`,
  },
  {
    id: 'hfill',
    title: 'Pushed Apart',
    description: 'Rubber length between two words.',
    latex: String.raw`\noindent Left \hfill Right`,
  },
  {
    id: 'vspace',
    title: 'Vertical Gap',
    description: 'A measured space between two lines.',
    latex: String.raw`Above

\vspace{1cm}

Below`,
  },
  {
    id: 'minipage',
    title: 'Two Columns Side by Side',
    description: 'Two minipages, each a third of the width.',
    latex: String.raw`\begin{minipage}{0.4\linewidth}
  Left side
\end{minipage}
\begin{minipage}{0.4\linewidth}
  Right side
\end{minipage}`,
  },

  // ---------------------------------------------------------------- tikz ---
  {
    id: 'tikz-circle',
    title: 'A Red Circle',
    description: 'Options go in brackets.',
    latex: String.raw`\begin{tikzpicture}
  \draw[thick, red] (0,0) circle (1cm);
\end{tikzpicture}`,
  },
  {
    id: 'tikz-arrow',
    title: 'An Arrow',
    description: 'The arrow tip is an option on the path.',
    latex: String.raw`\begin{tikzpicture}
  \draw[->] (0,0) -- (3,0);
\end{tikzpicture}`,
  },
  {
    id: 'tikz-rectangle',
    title: 'A Filled Rectangle',
    description: 'Fill and draw at once.',
    latex: String.raw`\begin{tikzpicture}
  \draw[fill=blue!30] (0,0) rectangle (2,1);
\end{tikzpicture}`,
  },
  {
    id: 'tikz-node',
    title: 'A Labelled Node',
    description: 'Nodes carry text.',
    latex: String.raw`\begin{tikzpicture}
  \node[draw, circle] at (0,0) {$x$};
\end{tikzpicture}`,
  },

  // ----------------------------------------------------------- structure ---
  {
    id: 'section-star',
    title: 'An Unnumbered Section',
    description: 'The star suppresses the number.',
    latex: String.raw`\section*{Introduction}
Some opening text.`,
  },
  {
    id: 'colored-text',
    title: 'Coloured Text',
    description: 'Two arguments: the colour, then the text.',
    latex: String.raw`Roses are \textcolor{red}{red} and violets are \textcolor{blue}{blue}.`,
  },
  {
    id: 'quote-environment',
    title: 'A Block Quotation',
    description: 'Indented on both sides.',
    latex: String.raw`\begin{quote}
  Less is more.
\end{quote}`,
  },
];
