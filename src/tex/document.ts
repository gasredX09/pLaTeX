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

/*
 * Kept deliberately thin, because the shared preamble is a bandwidth decision as
 * much as a typesetting one. The engine fetches a whole package bundle for each
 * \usepackage it sees, on every player's first compile, so a package loaded here
 * "just in case" is paid for by everyone:
 *
 *   \usepackage{tikz}      pulls pgf-tikz, 30.6MB, wanted by 4 problems
 *   \usepackage{tabularx}  pulls tables,   15.8MB, wanted by none
 *
 * tikz therefore lives on the problems that use it, and tabularx is gone: the
 * table problems use plain tabular, and both tabular and array come from `core`,
 * which is loaded regardless. graphicx went the same way, unused.
 *
 * xcolor stays. It is 0.1MB, and its one dependency outside that (colortbl) sits
 * in tex-latex-misc, which `geometry` already brings in.
 *
 * lmodern with T1 encoding is here for a subtler reason than typography. Under
 * the default OT1 encoding, a text dollar sign (`\$`) is not in the deployed
 * Computer Modern fonts, so TeX reaches for cm-super — a 56.7MB bundle that is
 * fetched on demand and was not on the deploy list, which is how `\$` came to
 * fail in production while compiling perfectly here. Latin Modern is Computer
 * Modern's own successor and its T1 fonts are already deployed, so this fixes
 * the glyph without the download. T1 is better practice regardless.
 */
export const PREAMBLE = String.raw`
\usepackage[paperwidth=${PAGE_WIDTH_MM}mm,paperheight=${PAGE_HEIGHT_MM}mm,margin=3mm]{geometry}
\usepackage{lmodern}
\usepackage[T1]{fontenc}
\usepackage{amsmath}
\usepackage{amssymb}
\usepackage{array}
\usepackage{xcolor}
\pagestyle{empty}
\setlength{\parindent}{0pt}
`.trim();

/**
 * Packages a problem's optional extra preamble is allowed to load. Every entry
 * is verified present in the engine's bundles, so nothing here triggers a CTAN
 * fetch. scripts/check-packages.ts enforces this at build time.
 */
export const BUNDLED_PACKAGES = [
  'lmodern',
  'fontenc',
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

/**
 * Bundles worth fetching after a mode that needs them is selected. They are too
 * large to make every Practice Mode topic pay for them before the first compile.
 * pgf-tikz is 30.6MB and seven problems across both catalogs use it.
 */
export const PRELOAD_BUNDLES = ['pgf-tikz'];

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
