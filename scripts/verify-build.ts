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
  await page.waitForSelector('#start:not([disabled])', { timeout: 180_000 });
  check('engine warms from a cold cache', true, `${Date.now() - warmStart}ms`);

  await page.click('#start');
  await page.waitForFunction(
    () => (document.getElementById('target-canvas') as HTMLCanvasElement).width > 0,
    null,
    { timeout: 60_000 },
  );
  check('target renders', true);

  // Type the answer for whichever problem came up, then require a match.
  const title = await page.textContent('#problem-title');
  const { problems } = await import('../src/problems.js');
  const answer = problems.find((p) => p.title === title)?.latex;
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
