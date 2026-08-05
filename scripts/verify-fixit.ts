/**
 * Plays Fix-it Mode in a real browser.
 *
 * The mutation rules are unit tested and the problem verifier proves every
 * problem has a playable mutation, but neither covers the thing a player meets:
 * that the editor arrives pre-filled with something genuinely wrong, that
 * repairing it registers, and that a repair skipped for later comes back.
 *
 * Usage: npm run verify:fixit
 */
import { chromium } from 'playwright';
import { startServer } from './server.js';
import { blazeProblems } from '../src/problems.js';
import { FIXIT_ROUND_SIZE } from '../src/fixit.js';

const server = process.env.FIXIT_URL ? null : await startServer();
const base = process.env.FIXIT_URL ?? server!.url;

const browser = await chromium.launch();
const page = await browser.newPage();
const failures: string[] = [];
page.on('pageerror', (e) => failures.push('page error: ' + e.message));

function check(name: string, ok: boolean, detail = ''): void {
  if (!ok) failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
}

function checkEq(name: string, actual: string, expected: string): void {
  check(name, actual === expected, actual === expected ? actual : `got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)}`);
}

const text = async (sel: string) => (await page.textContent(sel))?.trim() ?? '';

/** Names what a wait was for, so a timeout is diagnosable rather than anonymous. */
async function waiting<T>(what: string, action: () => Promise<T>): Promise<T> {
  try {
    return await action();
  } catch (error) {
    throw new Error(`${what}: ${error instanceof Error ? error.message : String(error)}`);
  }
}
const value = () =>
  page.evaluate(() => (document.getElementById('input') as HTMLTextAreaElement).value);

/** Waits until the editor is live and carries its pre-filled broken source. */
async function waitForRepair(label = 'a repair loads'): Promise<void> {
  await waiting(label, () =>
    page.waitForFunction(
    () => {
      const editor = document.getElementById('input') as HTMLTextAreaElement;
        return !!editor && !editor.disabled && editor.value.length > 0;
      },
      null,
      { timeout: 90_000 },
    ),
  );
}

/** The correct source for whichever problem is on screen. */
async function correctSource(): Promise<string | undefined> {
  const title = await text('#problem-title');
  return blazeProblems.find((problem) => problem.title === title)?.latex;
}

try {
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#fixit-mode:not([disabled])', { timeout: 180_000 });
  await page.click('#fixit-mode');

  // Clear the one-off warm-up.
  await page.waitForSelector('#tutorial:not([hidden])', { timeout: 30_000 });
  check('warm-up says Fix-it is untimed', (await text('#tutorial-note')).includes('no timer'));
  await page.fill('#tutorial-input', '\\textbf{Hello, TeX!}');
  await page.waitForSelector('#tutorial-continue:not([disabled])', { timeout: 60_000 });
  checkEq('continue names the mode', await text('#tutorial-continue'), 'Begin Fix-it Mode');
  await page.click('#tutorial-continue');

  await page.waitForSelector('#play:not([hidden])', { timeout: 30_000 });
  check('the timed rail is hidden', await page.locator('#blaze-rail').isHidden());
  checkEq('the untimed rail is relabelled', await text('#practice-topic-label'), 'Fix-it');
  checkEq(
    'the round is sized',
    await text('#practice-progress-text'),
    `0 of ${FIXIT_ROUND_SIZE} repaired`,
  );
  // Fix-it has no topics, so the shared rail's exit must not offer them.
  checkEq('the exit does not offer topics', await text('#practice-exit'), 'Choose a mode');

  await waitForRepair();
  const broken = await value();
  const correct = await correctSource();
  check('the problem is from the Blaze catalog', !!correct, await text('#problem-title'));
  check('the editor is pre-filled', broken.length > 0);
  check('the pre-fill is not already correct', broken !== correct, broken);

  // The broken source must be visibly wrong: either it fails to compile, or it
  // renders something other than the target. Anything else is a solved puzzle.
  await page.waitForFunction(
    () => {
      const cls = document.getElementById('status')?.className ?? '';
      return cls.includes('invalid') || cls.includes('mismatch');
    },
    null,
    { timeout: 60_000 },
  );
  check('the pre-fill does not match the target', true, await text('#status-text'));

  // The hint describes the fault without saying where it is.
  await page.click('#practice-hint');
  const hint = await text('#practice-hint-text');
  check('a hint describes the fault', hint.length > 0, hint);

  if (correct) {
    await page.fill('#input', correct);
    await page.waitForFunction(
      () => document.getElementById('status')?.className.includes('match') ?? false,
      null,
      { timeout: 60_000 },
    );
    await page.waitForFunction(
      () => document.getElementById('practice-progress-text')?.textContent?.startsWith('1 of '),
      null,
      { timeout: 15_000 },
    );
    check('repairing counts towards the round', true, await text('#practice-progress-text'));
  }

  // Leaving one for later must bring it back rather than lose it.
  await waitForRepair();
  const deferred = await text('#problem-title');
  await page.click('#skip');
  // Waiting on the title rather than the editor: the hand-over leaves the
  // previous broken source in place for a beat, so an editor-based wait would
  // resolve before the next repair had loaded.
  await page.waitForFunction(
    (previous: string) => document.getElementById('problem-title')?.textContent?.trim() !== previous,
    deferred,
    { timeout: 60_000 },
  );
  await waitForRepair();
  check('skipping moves on', (await text('#problem-title')) !== deferred);

  // Repair the rest of the round, expecting the deferred one to reappear.
  let seenAgain = false;
  for (let i = 0; i < FIXIT_ROUND_SIZE * 2; i++) {
    if (await page.locator('#practice-end').isVisible()) break;
    await waitForRepair(`repair ${i + 1} loads`);
    const onScreen = await text('#problem-title');
    if (onScreen === deferred) seenAgain = true;
    const answer = await correctSource();
    if (!answer) {
      failures.push(`no answer for "${await text('#problem-title')}"`);
      break;
    }
    await page.fill('#input', answer);
    await waiting(`"${onScreen}" registers as repaired`, () =>
      page.waitForFunction(
        () => document.getElementById('status')?.className.includes('match') ?? false,
        null,
        { timeout: 60_000 },
      ),
    );
    await page.waitForTimeout(700);
  }
  check('a repair left for later comes back', seenAgain);

  await page.waitForSelector('#practice-end:not([hidden])', { timeout: 60_000 });
  check('the round ends on the untimed sheet', true, await text('#practice-final-title'));
  checkEq('the sheet offers another round', await text('#practice-again'), 'Repair another round');
  check('the sheet hides the topic route', await page.locator('#practice-another').isHidden());
} catch (err) {
  failures.push(err instanceof Error ? err.message : String(err));
}

await browser.close();
await server?.close();

if (failures.length > 0) {
  console.error(`\n${failures.length} failure(s):`);
  for (const failure of failures) console.error(`  ${failure}`);
  process.exit(1);
}
console.log('\nFix-it OK');
