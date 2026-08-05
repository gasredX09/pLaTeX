/**
 * Plays a problem through the *production* build.
 *
 * The dev server and the bundled build resolve modules, workers and the blake3
 * alias differently, so a green dev run says nothing about what ships. This
 * serves dist/ the way `vite preview` does and drives a real solve, with the
 * browser cache cold.
 *
 * Usage: npm run build && npm run verify:build
 */
import { chromium } from 'playwright';
import { preview } from 'vite';
import { TUTORIAL } from '../src/onboarding.js';
import { practiceProblems, practiceTopics } from '../src/practiceProblems.js';

/** Exercises in the maths topic. Derived, so growing the catalog cannot stale
 *  these expectations the way a hardcoded count did. */
const MATHS_TOTAL = practiceProblems.filter((problem) => problem.topic === 'math').length;

const server = await preview({
  configFile: new URL('../vite.config.ts', import.meta.url).pathname,
  preview: { port: 0 },
});

const url = server.resolvedUrls?.local[0];
if (!url) throw new Error('preview server did not report a URL');
console.log(`serving dist at ${url}`);

const browser = await chromium.launch();
const context = await browser.newContext();
const page = await context.newPage();

const failures: string[] = [];
page.on('pageerror', (err) => failures.push(`page error: ${err.message}`));
page.on('response', (res) => {
  if (res.status() >= 400) failures.push(`${res.status()} on ${res.url()}`);
});

function check(name: string, ok: boolean, detail = ''): void {
  if (!ok) failures.push(`${name}${detail ? `: ${detail}` : ''}`);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
}

try {
  await page.goto(url, { waitUntil: 'domcontentloaded' });

  check('page is cross-origin isolated', await page.evaluate(() => crossOriginIsolated));

  const warmStart = Date.now();
  await page.waitForSelector('#blaze-mode:not([disabled])', { timeout: 180_000 });
  check('engine warms from a cold cache', true, `${Date.now() - warmStart}ms`);

  await page.click('#blaze-mode');
  if (await page.locator('#tutorial').isVisible()) {
    await page.waitForFunction(
      () => (document.getElementById('tutorial-target-canvas') as HTMLCanvasElement).width > 0,
      null,
      { timeout: 60_000 },
    );
    check('tutorial target renders', true);
    await page.fill('#tutorial-input', TUTORIAL.latex);
    await page.waitForFunction(
      () => document.getElementById('tutorial-status')?.className.includes('match') ?? false,
      null,
      { timeout: 60_000 },
    );
    check('tutorial accepts the suggested source', true);
    await page.click('#tutorial-continue');
  }

  await page.waitForFunction(
    () => (document.getElementById('target-canvas') as HTMLCanvasElement).width > 0,
    null,
    { timeout: 60_000 },
  );
  check('target renders', true);

  // Type the answer for whichever problem came up, then require a match.
  const title = await page.textContent('#problem-title');
  const { blazeProblems } = await import('../src/problems.js');
  const answer = blazeProblems.find((p) => p.title === title)?.latex;
  check('problem is one from the set', !!answer, title ?? '(none)');

  if (answer) {
    await page.fill('#input', answer);
    await page.waitForFunction(
      () => document.getElementById('status')?.className.includes('match') ?? false,
      null,
      { timeout: 60_000 },
    );
    const score = await page.textContent('#score');
    check('correct answer scores', Number(score) > 0, `${score} points`);
  }

  const practicePage = await context.newPage();
  practicePage.on('pageerror', (err) => failures.push(`practice page error: ${err.message}`));
  await practicePage.goto(url, { waitUntil: 'domcontentloaded' });
  await practicePage.waitForSelector('#practice-mode:not([disabled])', { timeout: 180_000 });
  await practicePage.click('#practice-mode');
  // A Blaze run must be leavable. The only other exit lives in the practice
  // rail, which Blaze hides, so for a while the mode was a three-minute trap.
  check('the Blaze rail offers a way out', await page.locator('#blaze-exit').isVisible());
  await page.click('#blaze-exit');
  await page.waitForSelector('#end:not([hidden])', { timeout: 20_000 });
  check('ending early reaches the end sheet without waiting for the clock', true);
  check(
    'the score earned so far is kept',
    Number(await page.textContent('#final-score')) > 0,
    (await page.textContent('#final-score')) ?? '',
  );
  await page.click('#end-home');
  await page.waitForSelector('#intro:not([hidden])', { timeout: 20_000 });

  check('Practice Mode opens topic selection', await practicePage.locator('#topics').isVisible());
  check(
    'all practice topics are offered',
    (await practicePage.locator('.topic-card').count()) === practiceTopics.length,
  );

  await practicePage.click('[data-topic="math"]');
  await practicePage.waitForFunction(
    () => (document.getElementById('target-canvas') as HTMLCanvasElement).width > 0,
    null,
    { timeout: 60_000 },
  );
  check('Practice Mode hides the Blaze clock', await practicePage.locator('#blaze-rail').isHidden());
  check('Practice Mode shows topic progress', await practicePage.locator('#practice-rail').isVisible());

  await practicePage.click('#practice-hint');
  check('practice hint can be shown', await practicePage.locator('#practice-hint-text').isVisible());
  await practicePage.click('#practice-reveal');
  check('practice source can be revealed', await practicePage.locator('#practice-solution').isVisible());

  const practiceTitle = await practicePage.textContent('#problem-title');
  const practiceAnswer = practiceProblems.find((problem) => problem.title === practiceTitle)?.latex;
  check('practice target comes from its separate catalog', !!practiceAnswer, practiceTitle ?? '(none)');
  if (practiceAnswer) {
    await practicePage.fill('#input', practiceAnswer);
    await practicePage.waitForFunction(
      () => document.getElementById('status')?.className.includes('match') ?? false,
      null,
      { timeout: 60_000 },
    );
    await practicePage.waitForFunction(
      (total: number) =>
        document
          .getElementById('practice-progress-text')
          ?.textContent?.startsWith(`1 of ${total}`) ?? false,
      MATHS_TOTAL,
      { timeout: 10_000 },
    );
    check('practice completion updates without a score', true);
  }

  await practicePage.click('#practice-exit');
  check(
    'practice progress appears on topic selection',
    (await practicePage.locator('[data-topic="math"] .topic-card-progress').textContent()) ===
      `1/${MATHS_TOTAL}`,
  );

  await practicePage.reload({ waitUntil: 'domcontentloaded' });
  await practicePage.waitForSelector('#practice-mode:not([disabled])', { timeout: 180_000 });
  await practicePage.click('#practice-mode');
  check(
    'practice progress survives a reload',
    (await practicePage.locator('[data-topic="math"] .topic-card-progress').textContent()) ===
      `1/${MATHS_TOTAL}`,
  );
} catch (err) {
  failures.push(err instanceof Error ? err.message : String(err));
}

await browser.close();
await server.close();

if (failures.length > 0) {
  console.error(`\n${failures.length} problem(s) with the production build:`);
  for (const f of failures) console.error(`  ${f}`);
  process.exit(1);
}
console.log('\nProduction build OK');
