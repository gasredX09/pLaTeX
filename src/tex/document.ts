/**
 * The document template every problem is compiled inside.
 *
 * Players write only a body snippet; this wraps it. That is what keeps problems
 * bite-sized while still exercising real LaTeX (tables, lists, TikZ, spacing)
 * rather than just math mode.
 *
 * Why a fixed page instead of the `standalone` class, which would crop the page
 * to the content: `standalone.cls` is not present in the engine's package
 * bundles. Reaching it would mean a runtime CTAN fetch, which would stall a
 * timed run and break offline play. `booktabs`, `enumitem`, `varwidth`, `ulem`,
 * `cancel` and `stmaryrd` are missing for the same reason, so problems must not
 * use them. See BUNDLED_PACKAGES below for what is actually available.
 *
 * The fixed page costs us the "different canvas size means instant reject"
 * shortcut, since every render is now the same size. That shortcut is not
 * missed: comparing the full bitmap is about 190k pixels, roughly a millisecond.
 */

/**
 * Page geometry, sized snugly around the problems rather than generously.
 *
 * A roomy page is worse than it sounds: the render is displayed in a fixed-width
 * card, so every unused millimetre shrinks the type the player is trying to read.
 * These dimensions fit the largest problems in the set (a 2cm TikZ circle, a
 * four-line nested list) with little to spare. Changing them changes every
 * render, so re-run scripts/verify-problems.ts afterwards.
 */
export const PAGE_WIDTH_MM = 80;
export const PAGE_HEIGHT_MM = 32;

export const PREAMBLE = String.raw`
\usepackage[paperwidth=${PAGE_WIDTH_MM}mm,paperheight=${PAGE_HEIGHT_MM}mm,margin=3mm]{geometry}
\usepackage{amsmath}
\usepackage{amssymb}
\usepackage{array}
\usepackage{tabularx}
\usepackage{graphicx}
\usepackage{xcolor}
\usepackage{tikz}
\pagestyle{empty}
\setlength{\parindent}{0pt}
`.trim();

/**
 * Packages a problem's optional extra preamble is allowed to load. Every entry
 * is verified present in the engine's bundles, so nothing here triggers a CTAN
 * fetch. scripts/check-packages.ts enforces this at build time.
 */
export const BUNDLED_PACKAGES = [
  'amsmath',
  'amssymb',
  'amsfonts',
  'array',
  'tabularx',
  'graphicx',
  'xcolor',
  'tikz',
  'geometry',
  'microtype',
  'textcomp',
  'mathtools',
  'siunitx',
  'pifont',
] as const;

export function buildDocument(body: string, extraPreamble?: string): string {
  return [
    String.raw`\documentclass[11pt]{article}`,
    PREAMBLE,
    extraPreamble ?? '',
    String.raw`\begin{document}`,
    body,
    String.raw`\end{document}`,
  ]
    .filter((line) => line !== '')
    .join('\n');
}
