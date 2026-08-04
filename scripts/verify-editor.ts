/**
 * Exercises the editor with real keystrokes in a real browser.
 *
 * The planner is unit tested, but the parts that matter to a player are DOM
 * behaviour the tests cannot see: that synthetic edits still fire `input` so the
 * render recompiles, and above all that the native undo stack survives. An
 * auto-inserted bracket that quietly destroys Cmd-Z would be worse than no
 * auto-pairing at all.
 *
 * Usage: npm run verify:editor
 */
import { chromium, type Page } from 'playwright';
import { startServer } from './server.js';
import { blazeProblems } from '../src/problems.js';

const server = process.env.EDITOR_URL ? null : await startServer();
const base = process.env.EDITOR_URL ?? server!.url;

const browser = await chromium.launch();
const page = await browser.newPage();
const failures: string[] = [];
page.on('pageerror', (e) => failures.push('page error: ' + e.message));

function check(name: string, actual: unknown, expected: unknown): void {
  const ok = actual === expected;
  if (!ok) failures.push(`${name}: got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)}`);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  got ${JSON.stringify(actual)}`}`);
}

/** Clears the editor, types `keys`, and returns the value with the caret marked. */
async function typeInto(sel: string, keys: string): Promise<string> {
  await page.click(sel);
  await page.evaluate((s) => {
    const t = document.querySelector(s) as HTMLTextAreaElement;
    t.value = '';
  }, sel);
  await page.keyboard.type(keys, { delay: 8 });
  return page.evaluate((s) => {
    const t = document.querySelector(s) as HTMLTextAreaElement;
    return `${t.value.slice(0, t.selectionStart)}|${t.value.slice(t.selectionStart)}`;
  }, sel);
}

async function valueOf(sel: string): Promise<string> {
  return page.evaluate((s) => (document.querySelector(s) as HTMLTextAreaElement).value, sel);
}

/** Presses the platform undo chord, trying both so this runs anywhere. */
async function undo(page: Page): Promise<void> {
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+z' : 'Control+z');
}

try {
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#blaze-mode:not([disabled])', { timeout: 180_000 });
  await page.click('#blaze-mode');
  await page.waitForSelector('#tutorial:not([hidden])', { timeout: 30_000 });
  const ed = '#tutorial-input';

  console.log('\n-- closing delimiters');
  check('brace closes', await typeInto(ed, '{'), '{|}');
  check('paren closes', await typeInto(ed, '('), '(|)');
  check('bracket closes', await typeInto(ed, '['), '[|]');
  check('dollar closes', await typeInto(ed, '$'), '$|$');

  console.log('\n-- LaTeX-aware pairs');
  check('escaped brace pairs with escaped brace', await typeInto(ed, '\\{'), '\\{|\\}');
  check('display maths pairs', await typeInto(ed, '\\['), '\\[|\\]');
  check('inline maths pairs', await typeInto(ed, '\\('), '\\(|\\)');
  check('escaped dollar has no partner', await typeInto(ed, '\\$'), '\\$|');
  check('doubled backslash leaves brace ordinary', await typeInto(ed, 'a\\\\{'), 'a\\\\{|}');

  console.log('\n-- stepping over closers');
  check('typed closer steps over', await typeInto(ed, '{x}'), '{x}|');
  check('typed dollar steps over', await typeInto(ed, '$x$'), '$x$|');
  check('nested closers step over', await typeInto(ed, '\\frac{a}{b}'), '\\frac{a}{b}|');

  console.log('\n-- backspace');
  await typeInto(ed, '{');
  await page.keyboard.press('Backspace');
  check('backspace clears an empty pair', await valueOf(ed), '');
  await typeInto(ed, '\\{');
  await page.keyboard.press('Backspace');
  check('backspace clears an empty escaped pair', await valueOf(ed), '');

  console.log('\n-- wrapping a selection');
  await typeInto(ed, 'abc');
  await page.keyboard.down('Shift');
  for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowLeft');
  await page.keyboard.up('Shift');
  await page.keyboard.press('{');
  check('selection is wrapped', await valueOf(ed), '{abc}');

  console.log('\n-- undo history survives');
  await typeInto(ed, 'abc');
  await page.keyboard.press('{');
  check('pair inserted before undo', await valueOf(ed), 'abc{}');
  await undo(page);
  const afterUndo = await valueOf(ed);
  // The insertion is undone; what remains must still be the earlier typing.
  check('undo removes only the pair', afterUndo, 'abc');

  console.log('\n-- a failed compile explains itself');
  // The mistake that prompted this: a maths command in a sentence. "Does not
  // compile" alone left a player with nowhere to go.
  await typeInto(ed, 'The ratio is \\frac{3}{4}.');
  await page.waitForFunction(
    () => document.getElementById('tutorial-status')?.className.includes('invalid') ?? false,
    null,
    { timeout: 60_000 },
  );
  const shown = (await page.textContent('#tutorial-status-text'))?.trim() ?? '';
  check(
    'the status names the cause',
    shown,
    'Does not compile: Maths outside maths mode. Wrap it in $…$ or \\[…\\].',
  );
  check(
    "TeX's own wording is kept on hover",
    await page.getAttribute('#tutorial-status-text', 'title'),
    'Missing $ inserted.',
  );

  console.log('\n-- the render still recompiles');
  await typeInto(ed, '\\textbf{Hello, TeX!');
  // Typed without the final brace: auto-close supplies it, so this should match.
  await page.waitForFunction(
    () => document.getElementById('tutorial-status')?.className.includes('match') ?? false,
    null,
    { timeout: 60_000 },
  );
  check('auto-closed source matches the target', await valueOf(ed), '\\textbf{Hello, TeX!}');

  console.log('\n-- a real problem, typed key by key');
  await page.waitForSelector('#tutorial-continue:not([disabled])', { timeout: 30_000 });
  await page.click('#tutorial-continue');
  await page.waitForSelector('#play:not([hidden])', { timeout: 30_000 });
  await page.waitForFunction(
    () => !(document.getElementById('input') as HTMLTextAreaElement).disabled,
    null,
    { timeout: 60_000 },
  );
  const title = (await page.textContent('#problem-title'))?.trim() ?? '';
  const answer = blazeProblems.find((p) => p.title === title)?.latex;
  if (!answer) {
    failures.push(`no answer known for "${title}"`);
  } else {
    await page.click('#input');
    await page.keyboard.type(answer, { delay: 4 });
    check('typing the source verbatim reproduces it', await valueOf('#input'), answer);
    await page.waitForFunction(
      () => document.getElementById('status')?.className.includes('match') ?? false,
      null,
      { timeout: 60_000 },
    );
    console.log(`PASS  solved "${title}" by typing`);
  }
} catch (err) {
  failures.push(err instanceof Error ? err.message : String(err));
}

await browser.close();
await server?.close();

if (failures.length > 0) {
  console.error(`\n${failures.length} failure(s):`);
  for (const f of failures) console.error(`  ${f}`);
  process.exit(1);
}
console.log('\nEditor OK');
