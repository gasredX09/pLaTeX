/**
 * The Blaze Mode problem set.
 *
 * Each `latex` is a document *body*, compiled inside the template in
 * tex/document.ts. Authoring rules:
 *
 *  - It must fit an 80x32mm page with 3mm margins (roughly 45 characters wide
 *    by 6 lines at 11pt). Only page one is compared, so overflow is invisible
 *    and confusing.
 *  - It may only use packages listed in BUNDLED_PACKAGES. In particular
 *    `booktabs`, `enumitem`, `ulem`, `cancel` and `stmaryrd` are NOT available:
 *    they are absent from the engine's bundles and would need a network fetch.
 *  - Anything beyond the shared preamble goes in this problem's own `preamble`,
 *    not into the shared one. The engine downloads a whole package bundle per
 *    \usepackage on a player's first compile, so a package in the shared
 *    preamble is paid for by every player. `tikz` alone is 30.6MB, which is why
 *    the four TikZ problems declare it themselves.
 *  - Prefer the canonical spelling of anything normalize.ts rewrites, so the
 *    target reads naturally.
 *  - `title` and `description` are plain text, not LaTeX. They are set with
 *    textContent, so `$n$` renders as literal dollar signs.
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

export const blazeProblems: Problem[] = [
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
    // Titles are plain text, not LaTeX: they are set with textContent, so any
    // $…$ would show as literal dollar signs.
    title: 'Sum of the First n Squares',
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
    title: 'A Definition of e',
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
    preamble: String.raw`\usepackage{tikz}`,
  },
  {
    id: 'tikz-arrow',
    title: 'An Arrow',
    description: 'The arrow tip is an option on the path.',
    latex: String.raw`\begin{tikzpicture}
  \draw[->] (0,0) -- (3,0);
\end{tikzpicture}`,
    preamble: String.raw`\usepackage{tikz}`,
  },
  {
    id: 'tikz-rectangle',
    title: 'A Filled Rectangle',
    description: 'Fill and draw at once.',
    latex: String.raw`\begin{tikzpicture}
  \draw[fill=blue!30] (0,0) rectangle (2,1);
\end{tikzpicture}`,
    preamble: String.raw`\usepackage{tikz}`,
  },
  {
    id: 'tikz-node',
    title: 'A Labelled Node',
    description: 'Nodes carry text.',
    latex: String.raw`\begin{tikzpicture}
  \node[draw, circle] at (0,0) {$x$};
\end{tikzpicture}`,
    preamble: String.raw`\usepackage{tikz}`,
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

  // ------------------------------------------------- second wave: math ---
  {
    id: 'sum-cubes',
    title: 'Sum of the First n Cubes',
    description: 'A square of a sum.',
    latex: String.raw`\[ \sum_{i=1}^n i^3 = \left( \frac{n(n+1)}{2} \right)^2 \]`,
  },
  {
    id: 'derivative-limit',
    title: 'The Derivative',
    description: 'A limit of a difference quotient.',
    latex: String.raw`\[ f'(x) = \lim_{h \to 0} \frac{f(x+h) - f(x)}{h} \]`,
  },
  {
    id: 'bayes',
    title: "Bayes' Theorem",
    description: 'Conditional bars all the way down.',
    latex: String.raw`\[ P(A \mid B) = \frac{P(B \mid A) P(A)}{P(B)} \]`,
  },
  {
    id: 'triangle-inequality',
    title: 'Triangle Inequality',
    description: 'Absolute values around a sum.',
    latex: String.raw`\[ |x + y| \le |x| + |y| \]`,
  },
  {
    id: 'bmatrix',
    title: 'A Bracketed Matrix',
    description: 'Square brackets, not parentheses.',
    latex: String.raw`\[ \begin{bmatrix} 1 & 0 \\ 0 & 1 \end{bmatrix} \]`,
  },
  {
    id: 'determinant',
    title: 'A Determinant',
    description: 'Vertical bars delimit this one.',
    latex: String.raw`\[ \begin{vmatrix} a & b \\ c & d \end{vmatrix} = ad - bc \]`,
  },
  {
    id: 'nth-root',
    title: 'An nth Root',
    description: 'The root takes an optional argument.',
    latex: String.raw`\[ \sqrt[3]{x^2 + 1} \]`,
  },
  {
    id: 'integral-bounds',
    title: 'A Definite Integral',
    description: 'Bounds sit on the integral sign.',
    latex: String.raw`\[ \int_0^1 x^2 \, dx = \frac{1}{3} \]`,
  },
  {
    id: 'product-notation',
    title: 'A Product',
    description: 'Like a sum, with a different operator.',
    latex: String.raw`\[ n! = \prod_{k=1}^n k \]`,
  },
  {
    id: 'union-intersection',
    title: 'Indexed Union',
    description: 'Big operators take limits too.',
    latex: String.raw`\[ \bigcup_{i=1}^{\infty} A_i \subseteq X \]`,
  },
  {
    id: 'vector-arrow',
    title: 'A Vector',
    description: 'An arrow accent, and a dot product.',
    latex: String.raw`\[ \vec{a} \cdot \vec{b} = |\vec{a}| |\vec{b}| \cos \theta \]`,
  },
  {
    id: 'congruence',
    title: 'Modular Congruence',
    description: 'A relation with a parenthetical modulus.',
    latex: String.raw`\[ a \equiv b \pmod{n} \]`,
  },

  // --------------------------------------- second wave: text formatting ---
  {
    id: 'slanted-text',
    title: 'Slanted, Not Italic',
    description: 'Two different oblique shapes.',
    latex: String.raw`\textsl{slanted} beside \textit{italic}`,
  },
  {
    id: 'bold-italic-nested',
    title: 'Bold and Italic Together',
    description: 'One command inside the other.',
    latex: String.raw`\textbf{\textit{both at once}}`,
  },
  {
    id: 'footnote-size',
    title: 'Two Smaller Sizes',
    description: 'Between small and tiny.',
    latex: String.raw`{\footnotesize footnotesize} then {\tiny tiny}`,
  },
  {
    id: 'huge-text',
    title: 'The Largest Sizes',
    description: 'Two steps above large.',
    latex: String.raw`{\Large Large} {\huge huge}`,
  },
  {
    id: 'flush-right',
    title: 'Ranged Right',
    description: 'An environment, like center.',
    latex: String.raw`\begin{flushright}
  Against the margin
\end{flushright}`,
  },
  {
    id: 'flush-left',
    title: 'Ranged Left',
    description: 'The opposite of the last one.',
    latex: String.raw`\begin{flushleft}
  Against the left
\end{flushleft}`,
  },
  {
    id: 'line-break',
    title: 'A Forced Line Break',
    description: 'Two backslashes end a line.',
    latex: String.raw`First line \\
Second line`,
  },
  {
    id: 'nonbreaking-space',
    title: 'A Space That Will Not Break',
    description: 'A tie between a name and a number.',
    latex: String.raw`See Figure~1 on page~7.`,
  },
  {
    id: 'texttt-url',
    title: 'A Path in Monospace',
    description: 'Underscores still need escaping.',
    latex: String.raw`\texttt{/usr/local/my\_file.tex}`,
  },
  {
    id: 'roman-upright',
    title: 'Upright Inside Italics',
    description: 'A command to escape the surrounding shape.',
    latex: String.raw`\textit{italic with \textup{upright} inside}`,
  },

  // ---------------------------------- second wave: accents and symbols ---
  {
    id: 'ring-macron',
    title: 'Ring and Macron',
    description: 'Two more accent commands.',
    latex: String.raw`\r{A}ngstr\"om, \=o`,
  },
  {
    id: 'dotless-i',
    title: 'A Dotless i',
    description: 'The dot would collide with the accent.',
    latex: String.raw`\'{\i} and \^{\j}`,
  },
  {
    id: 'special-letters',
    title: 'Letters Beyond ASCII',
    description: 'Whole letters, not accents.',
    latex: String.raw`\ae, \oe, \o, \ss, \AA`,
  },
  {
    id: 'math-relations',
    title: 'Relation Symbols',
    description: 'Four relations in a row.',
    latex: String.raw`\[ \approx, \sim, \propto, \equiv \]`,
  },
  {
    id: 'arrows-math',
    title: 'Arrows',
    description: 'Short and long, both directions.',
    latex: String.raw`\[ \to, \gets, \mapsto, \leftrightarrow \]`,
  },
  {
    id: 'blackboard-bold',
    title: 'Number Sets',
    description: 'Blackboard bold needs amssymb.',
    latex: String.raw`\[ \mathbb{N} \subset \mathbb{Z} \subset \mathbb{Q} \subset \mathbb{R} \]`,
  },
  {
    id: 'calligraphic',
    title: 'Script and Fraktur',
    description: 'Two decorative maths alphabets.',
    latex: String.raw`\[ \mathcal{F}, \mathfrak{g} \]`,
  },
  {
    id: 'degrees-percent',
    title: 'Degrees and Ordinals',
    description: 'Text symbols from textcomp.',
    latex: String.raw`23\textdegree C, 5\textperthousand`,
  },

  // ----------------------------------------------- second wave: lists ---
  {
    id: 'enumerate-nested',
    title: 'Numbered Inside Numbered',
    description: 'The inner labels change style.',
    latex: String.raw`\begin{enumerate}
  \item Outer
  \begin{enumerate}
    \item Inner
  \end{enumerate}
\end{enumerate}`,
  },
  {
    id: 'itemize-in-enumerate',
    title: 'Bullets Inside Numbers',
    description: 'Two list kinds, one inside the other.',
    latex: String.raw`\begin{enumerate}
  \item Step
  \begin{itemize}
    \item Detail
  \end{itemize}
\end{enumerate}`,
  },
  {
    id: 'itemize-custom-label',
    title: 'A Chosen Bullet',
    description: 'The optional argument overrides the marker.',
    latex: String.raw`\begin{itemize}
  \item[--] Dashed
  \item[*] Starred
\end{itemize}`,
  },
  {
    id: 'description-two-lines',
    title: 'A Longer Description',
    description: 'Three labelled entries.',
    latex: String.raw`\begin{description}
  \item[One] First
  \item[Two] Second
  \item[Three] Third
\end{description}`,
  },

  // ---------------------------------------------- second wave: tables ---
  {
    id: 'tabular-centered-cols',
    title: 'All Columns Centred',
    description: 'Three centred columns with a rule.',
    latex: String.raw`\begin{tabular}{ccc}
  \hline
  a & b & c \\
  \hline
\end{tabular}`,
  },
  {
    id: 'tabular-cline',
    title: 'A Partial Rule',
    description: 'A rule under some columns only.',
    latex: String.raw`\begin{tabular}{|c|c|}
  \hline
  1 & 2 \\
  \cline{2-2}
  3 & 4 \\
  \hline
\end{tabular}`,
  },
  {
    id: 'tabular-fixed-width',
    title: 'A Wrapping Column',
    description: 'The p column takes a width.',
    latex: String.raw`\begin{tabular}{|p{2cm}|c|}
  \hline
  Wraps onto lines & 7 \\
  \hline
\end{tabular}`,
  },
  {
    id: 'tabular-double-rule',
    title: 'A Doubled Rule',
    description: 'Two bars in the column spec.',
    latex: String.raw`\begin{tabular}{c||c}
  a & b \\
  c & d
\end{tabular}`,
  },

  // ------------------------------------ second wave: boxes and spacing ---
  {
    id: 'framebox-width',
    title: 'A Box of Fixed Width',
    description: 'A framed box with a set width.',
    latex: String.raw`\framebox[3cm]{centred}`,
  },
  {
    id: 'parbox',
    title: 'A Paragraph Box',
    description: 'Text wrapped to a given width.',
    latex: String.raw`\parbox{3cm}{This text wraps inside the box.}`,
  },
  {
    id: 'raisebox',
    title: 'Lifted Off the Baseline',
    description: 'A box raised by a length.',
    latex: String.raw`base \raisebox{2mm}{lifted} base`,
  },
  {
    id: 'rule-line',
    title: 'A Drawn Rule',
    description: 'Width then height.',
    latex: String.raw`before \rule{2cm}{1pt} after`,
  },
  {
    id: 'quad-spacing',
    title: 'Quad Spaces',
    description: 'Two sizes of maths space.',
    latex: String.raw`\[ a \quad b \qquad c \]`,
  },
  {
    id: 'thin-negative-space',
    title: 'Thin and Negative Space',
    description: 'One nudges apart, one pulls together.',
    latex: String.raw`\[ a\,b \quad c\!d \]`,
  },

  // ------------------------------------------------ second wave: tikz ---
  {
    id: 'tikz-dashed-line',
    title: 'A Dashed Path',
    description: 'A line style option.',
    latex: String.raw`\begin{tikzpicture}
  \draw[dashed] (0,0) -- (3,0);
\end{tikzpicture}`,
    preamble: String.raw`\usepackage{tikz}`,
  },
  {
    id: 'tikz-double-arrow',
    title: 'An Arrow Both Ways',
    description: 'Tips at each end.',
    latex: String.raw`\begin{tikzpicture}
  \draw[<->] (0,0) -- (3,0);
\end{tikzpicture}`,
    preamble: String.raw`\usepackage{tikz}`,
  },
  {
    id: 'tikz-grid',
    title: 'A Grid',
    description: 'One path operation draws it all.',
    latex: String.raw`\begin{tikzpicture}
  \draw[step=5mm] (0,0) grid (2,1);
\end{tikzpicture}`,
    preamble: String.raw`\usepackage{tikz}`,
  },
  {
    id: 'tikz-arc',
    title: 'An Arc',
    description: 'Start angle, end angle, radius.',
    latex: String.raw`\begin{tikzpicture}
  \draw (0,0) arc (0:90:1cm);
\end{tikzpicture}`,
    preamble: String.raw`\usepackage{tikz}`,
  },
  {
    id: 'tikz-two-nodes',
    title: 'Two Joined Nodes',
    description: 'Nodes named, then connected.',
    latex: String.raw`\begin{tikzpicture}
  \node (a) at (0,0) {A};
  \node (b) at (2,0) {B};
  \draw[->] (a) -- (b);
\end{tikzpicture}`,
    preamble: String.raw`\usepackage{tikz}`,
  },

  // ------------------------------------- second wave: document structure ---
  {
    id: 'subsection-star',
    title: 'A Subsection',
    description: 'One level below a section.',
    latex: String.raw`\subsection*{Method}
A line of text.`,
  },
  {
    id: 'paragraph-break',
    title: 'Two Paragraphs',
    description: 'A blank line separates them, and the second indents.',
    // The shared preamble zeroes \parindent, which would make this render
    // identically to a line break and let \\ pass as a correct answer.
    preamble: String.raw`\setlength{\parindent}{1em}`,
    latex: String.raw`First paragraph here.

Second paragraph here.`,
  },
  {
    id: 'noindent-paragraph',
    title: 'An Unindented Paragraph',
    description: 'Suppress the indent on the second.',
    // \noindent has nothing to suppress unless the indent exists.
    preamble: String.raw`\setlength{\parindent}{1em}`,
    latex: String.raw`First paragraph.

\noindent Second, flush left.`,
  },
  {
    id: 'quotation-environment',
    title: 'A Longer Quotation',
    description: 'Like quote, but it indents each paragraph.',
    latex: String.raw`\begin{quotation}
  A longer passage set in from both margins.
\end{quotation}`,
  },
  {
    id: 'verse-environment',
    title: 'Verse',
    description: 'For poetry; lines break explicitly.',
    latex: String.raw`\begin{verse}
  One line \\
  Another line
\end{verse}`,
  },
  {
    id: 'colored-box-text',
    title: 'Colour on a Box',
    description: 'A coloured frame around coloured text.',
    latex: String.raw`\fcolorbox{red}{yellow}{\textcolor{blue}{warning}}`,
  },
];
