/**
 * Turns a TeX error log into one sentence a player can act on.
 *
 * TeX's diagnostics are precise and almost useless to someone learning: the
 * reason `\frac{3}{4}` fails in a sentence is reported as "Missing $ inserted",
 * which describes TeX's recovery rather than the mistake. Since this is a
 * teaching game, each recognised error is restated as the thing to change.
 *
 * Pure, so the mapping can be tested against real log text without a browser.
 */

export interface TexError {
  /** Plain-language guidance, or the raw TeX line when nothing matched. */
  message: string;
  /** The `! ...` line as TeX wrote it, for anyone who wants the real thing. */
  raw: string;
  /** Source line TeX was reading, from its `l.NNN` marker. */
  line?: number;
}

/**
 * Ordered, so a more specific pattern can win over a general one. `explain`
 * receives the capture groups from `pattern`.
 */
const RULES: { pattern: RegExp; explain: (m: RegExpMatchArray) => string }[] = [
  {
    // By far the most common mistake here: a maths command in a sentence.
    pattern: /Missing \$ inserted/i,
    explain: () => 'Maths outside maths mode. Wrap it in $…$ or \\[…\\].',
  },
  {
    pattern: /Undefined control sequence/i,
    explain: (m) => {
      const command = m.groups?.command;
      return command
        ? `Unknown command \\${command}. Check the spelling.`
        : 'Unknown command. Check the spelling.';
    },
  },
  {
    pattern: /Too many \}/i,
    explain: () => 'One closing brace too many.',
  },
  {
    pattern: /Missing \} inserted/i,
    explain: () => 'A closing brace is missing.',
  },
  {
    pattern: /Missing \{ inserted/i,
    explain: () => 'An opening brace is missing.',
  },
  {
    pattern: /\\begin\{(?<opened>[^}]*)\} on input line \d+ ended by \\end\{(?<closed>[^}]*)\}/i,
    explain: (m) =>
      `\\begin{${m.groups?.opened ?? '?'}} is closed by \\end{${m.groups?.closed ?? '?'}}. The names must match.`,
  },
  {
    pattern: /Environment (?<name>\S+) undefined/i,
    explain: (m) => `There is no ${m.groups?.name ?? 'such'} environment here.`,
  },
  {
    pattern: /Extra alignment tab/i,
    explain: () => 'More & in a row than the column spec allows.',
  },
  {
    pattern: /Misplaced alignment tab character/i,
    explain: () => '& only separates cells inside a table.',
  },
  {
    pattern: /Double superscript/i,
    explain: () => 'Two superscripts in a row. Brace them, as in x^{2^3}.',
  },
  {
    pattern: /Double subscript/i,
    explain: () => 'Two subscripts in a row. Brace them, as in x_{1_2}.',
  },
  {
    // The command name must be matched precisely: TeX writes `\frac.` with a
    // sentence-ending period, and \S+ would fold that into the name.
    pattern: /File ended while scanning use of \\(?<command>[A-Za-z@]+)/i,
    explain: (m) => `\\${m.groups?.command ?? ''} is missing an argument, or a brace is unclosed.`,
  },
  {
    pattern: /Paragraph ended before \\(?<command>[A-Za-z@]+) was complete/i,
    explain: (m) =>
      `A blank line interrupted \\${m.groups?.command ?? ''}. Its argument cannot span a paragraph break.`,
  },
  {
    pattern: /Something's wrong--perhaps a missing \\item/i,
    explain: () => 'A list needs at least one \\item.',
  },
  {
    pattern: /Missing number, treated as zero/i,
    explain: () => 'A length or count is missing where one was expected.',
  },
  {
    pattern: /Illegal unit of measure/i,
    explain: () => 'A length needs a unit, such as 1cm or 2pt.',
  },
  {
    pattern: /Missing \\endcsname/i,
    explain: () => 'A command name is malformed.',
  },
  {
    pattern: /Display math should end with \$\$/i,
    explain: () => 'Display maths is not closed. Prefer \\[…\\].',
  },
  {
    pattern: /Underfull|Overfull/i,
    // These are warnings TeX prints alongside real errors; never the cause.
    explain: () => 'Content does not fit the line.',
  },
];

/** TeX's own noise, which never explains anything to a player. */
const IGNORED = [
  /program exited/i,
  /keepRuntimeAlive/i,
  /Fatal error occurred/i,
  /no output PDF file produced/i,
  /^\s*$/,
];

/** Strips the engine's `[TeX]` / `[TeX ERR]` prefixes. */
function clean(line: string): string {
  return line.replace(/^\[TeX(?:\s+ERR)?\]\s*/, '').trimEnd();
}

/**
 * Finds the first real error in a TeX log and restates it.
 * Returns null when the log holds nothing diagnosable.
 */
export function explainTexError(logLines: readonly string[]): TexError | null {
  const lines = logLines.map(clean);

  const index = lines.findIndex(
    (line) => line.startsWith('!') && !IGNORED.some((pattern) => pattern.test(line)),
  );
  if (index === -1) return null;

  const raw = lines[index]!.replace(/^!\s*/, '');
  // TeX prints the offending source below the error: `l.5 \frac{3}{4}`.
  const context = lines.slice(index, index + 6);
  const marker = context.find((line) => /^l\.\d+/.test(line));
  const line = marker ? Number(/^l\.(\d+)/.exec(marker)?.[1]) : undefined;

  // An undefined command is named on the context line, not in the error itself.
  const command = marker ? /\\([A-Za-z@]+)\s*$/.exec(marker)?.[1] : undefined;

  for (const rule of RULES) {
    const match = rule.pattern.exec(raw) ?? rule.pattern.exec(context.join('\n'));
    if (!match) continue;
    const groups = { ...(match.groups ?? {}) };
    if (command && groups.command === undefined) groups.command = command;
    return {
      message: rule.explain({ ...match, groups } as RegExpMatchArray),
      raw,
      ...(Number.isFinite(line) ? { line } : {}),
    };
  }

  // Unrecognised: TeX's own wording beats a vague placeholder.
  return { raw, message: raw, ...(Number.isFinite(line) ? { line } : {}) };
}
