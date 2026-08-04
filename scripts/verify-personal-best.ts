/**
 * Drives several short runs to check the personal best behaves across runs and
 * survives a reload.
 *
 * Worth automating rather than clicking through: the interesting cases are the
 * transitions (first record, beaten record, missed record) and persistence, and
 * they are tedious to reach by hand three minutes at a time.
 *
 * Usage: npm run verify:best
 */
import { chromium } from 'playwright';
import { startServer } from './server.js';
import { problems } from '../src/problems.js';
import { pointsFor } from '../src/scoring.js';

const server = process.env.BEST_URL ? null : await startServer();
const base = process.env.BEST_URL ?? server!.url;

const browser = await chromium.launch();
// One context throughout: localStorage is per-origin per-context, and
// persistence is the thing under test.
const context = await browser.newContext();
const page = await context.newPage();

const failures: string[] = [];
page.on('pageerror', (err) => failures.push(`page error: ${err.message}`));

function check(name: string, ok: boolean, detail = ''): void {
  if (!ok) failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
}

async function text(selector: string): Promise<string> {
  return (await page.textContent(selector))?.trim() ?? '';
}

async function isHidden(selector: string): Promise<boolean> {
  return page.locator(selector).isHidden();
}

/** Loads a fresh round of `seconds`, then solves `count` problems. */
async function playRound(seconds: number, count: number): Promise<void> {
  await page.goto(`${base}?seconds=${seconds}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#start:not([disabled])', { timeout: 180_000 });
  await page.click('#start');

  for (let i = 0; i < count; i++) {
    await page.waitForFunction(
      () => !(document.getElementById('input') as HTMLTextAreaElement).disabled,
      null,
      { timeout: 60_000 },
    );
    const title = await text('#problem-title');
    const answer = problems.find((p) => p.title === title)?.latex;
    if (!answer) {
      failures.push(`no answer known for "${title}"`);
      return;
    }
    await page.fill('#input', answer);
    await page.waitForFunction(
      () => document.getElementById('status')?.className.includes('match') ?? false,
      null,
      { timeout: 60_000 },
    );
  }

  await page.waitForSelector('#end:not([hidden])', { timeout: 60_000 });
}

/** The score the page reports at the end of a round. */
async function finalScore(): Promise<number> {
  return Number(await text('#final-score'));
}

try {
  // --- A clean slate shows no record anywhere -----------------------------
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  check('no record shown before the first run', await isHidden('#intro-best'));

  // --- First scoring run sets the record ---------------------------------
  await playRound(8, 1);
  const first = await finalScore();
  check('first run scored', first > 0, `${first} points`);
  check('first record is announced', (await text('#final-eyebrow')) === 'New personal best');
  check(
    'nothing to compare against on a first record',
    await isHidden('#final-best'),
    await text('#final-best'),
  );

  // --- It survives a reload ----------------------------------------------
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  check('record survives a reload', !(await isHidden('#intro-best')));
  const shown = await text('#intro-best-value');
  check('record names the score', shown.startsWith(`${first} point`), shown);

  // --- A worse run leaves it standing ------------------------------------
  // Solve nothing, so the run scores zero and cannot beat anything.
  await page.goto(`${base}?seconds=6`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#start:not([disabled])', { timeout: 180_000 });
  await page.click('#start');
  await page.waitForSelector('#end:not([hidden])', { timeout: 60_000 });
  check('a scoreless run does not claim the record', (await text('#final-eyebrow')) === 'Time up');
  check('the standing record is shown instead', !(await isHidden('#final-best')));
  check('it is labelled as the standing best', (await text('#final-best-label')) === 'Your best');
  check(
    'a scoreless run did not overwrite the record',
    (await text('#final-best-value')).startsWith(`${first} point`),
  );

  // --- Beating it reports what was beaten --------------------------------
  // Two solves must outscore one, whichever problems come up: the cheapest
  // problem in the set is worth at least one point.
  const cheapest = Math.min(...problems.map((p) => pointsFor(p.latex)));
  check('two solves can outscore one', cheapest > 0);

  await playRound(25, 3);
  const third = await finalScore();
  if (third > first) {
    check('beating the record is announced', (await text('#final-eyebrow')) === 'New personal best');
    check('the beaten record is shown', !(await isHidden('#final-best')));
    check('it is labelled as the previous best', (await text('#final-best-label')) === 'Previous best');
    check(
      'the previous figure is the old record, not the new one',
      (await text('#final-best-value')).startsWith(`${first} point`),
      await text('#final-best-value'),
    );

    // --- And the new figure is what persists -----------------------------
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    check(
      'the new record is the one stored',
      (await text('#intro-best-value')).startsWith(`${third} point`),
      await text('#intro-best-value'),
    );
  } else {
    check('three solves outscored one', false, `${third} vs ${first}`);
  }

  // --- The rail shows the target during play -----------------------------
  await page.goto(`${base}?seconds=30`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#start:not([disabled])', { timeout: 180_000 });
  await page.click('#start');
  check('the rail shows the record to beat', !(await isHidden('#rail-best')));
  check('the rail figure is the record', (await text('#rail-best')) === String(third));
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
console.log('\nPersonal best OK');
