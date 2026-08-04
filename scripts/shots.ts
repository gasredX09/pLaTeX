/**
 * Captures each screen and state for design review.
 * Usage: npm run dev &  then  npx tsx scripts/shots.ts
 */
import { chromium, type Page } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { startServer } from './server.js';
import { TUTORIAL } from '../src/onboarding.js';

const server = process.env.SHOT_URL ? null : await startServer();
const BASE = process.env.SHOT_URL ?? server!.url;
const OUT = process.env.SHOT_DIR ?? '/tmp/shots';
const width = Number(process.env.SHOT_WIDTH ?? 1200);
const height = Number(process.env.SHOT_HEIGHT ?? 1050);

await mkdir(OUT, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width, height } });
page.on('pageerror', (err) => console.error('PAGE ERROR:', err.message));

async function waitForStatus(page: Page, state: string): Promise<void> {
  // The predicate is serialized into the page, so `state` has to travel as an
  // argument rather than through a closure.
  await page.waitForFunction(
    (want: string) => document.getElementById('status')?.className.includes(want) ?? false,
    state,
    { timeout: 60_000 },
  );
}

/** The body of the problem currently on screen, looked up by its title. */
async function currentAnswer(page: Page): Promise<string> {
  return page.evaluate(async () => {
    // Resolved by the dev server at runtime; the indirection keeps TypeScript
    // from trying to resolve a browser URL as a module path.
    const specifier = '/src/problems.ts';
    const mod = (await import(/* @vite-ignore */ specifier)) as {
      problems: { title: string; latex: string }[];
    };
    const title = document.getElementById('problem-title')?.textContent ?? '';
    return mod.problems.find((p) => p.title === title)?.latex ?? '';
  });
}

// Run a 20 second round so the end screen is reachable without a long wait.
await page.goto(`${BASE}?seconds=20`, { waitUntil: 'domcontentloaded' });

await page.screenshot({ path: `${OUT}/1-intro-loading.png` });
await page.waitForSelector('#start:not([disabled])', { timeout: 120_000 });
await page.screenshot({ path: `${OUT}/2-intro-ready.png` });

await page.click('#start');
await page.waitForFunction(
  () => (document.getElementById('tutorial-target-canvas') as HTMLCanvasElement).width > 0,
  null,
  { timeout: 60_000 },
);
await page.screenshot({ path: `${OUT}/3-tutorial-fresh.png` });

await page.fill('#tutorial-input', 'Hello');
await page.waitForFunction(
  () => document.getElementById('tutorial-status')?.className.includes('mismatch') ?? false,
  null,
  { timeout: 60_000 },
);
await page.screenshot({ path: `${OUT}/4-tutorial-mismatch.png` });

await page.fill('#tutorial-input', '\\frac{1');
await page.waitForFunction(
  () => document.getElementById('tutorial-status')?.className.includes('invalid') ?? false,
  null,
  { timeout: 60_000 },
);
await page.screenshot({ path: `${OUT}/5-tutorial-invalid.png` });

await page.fill('#tutorial-input', TUTORIAL.latex);
await page.waitForFunction(
  () => document.getElementById('tutorial-status')?.className.includes('match') ?? false,
  null,
  { timeout: 60_000 },
);
await page.screenshot({ path: `${OUT}/6-tutorial-match.png` });

await page.click('#tutorial-continue');
await page.waitForFunction(
  () => (document.getElementById('target-canvas') as HTMLCanvasElement).width > 0,
  null,
  { timeout: 60_000 },
);
await page.screenshot({ path: `${OUT}/7-play-fresh.png` });

await page.fill('#input', 'Hello');
await waitForStatus(page, 'mismatch');
await page.screenshot({ path: `${OUT}/8-play-mismatch.png` });

await page.fill('#input', '\\frac{1');
await waitForStatus(page, 'invalid');
await page.screenshot({ path: `${OUT}/9-play-invalid.png` });

await page.fill('#input', await currentAnswer(page));
await waitForStatus(page, 'match');
await page.screenshot({ path: `${OUT}/10-play-match.png` });

await page.setViewportSize({ width: 430, height: 950 });
await page.screenshot({ path: `${OUT}/11-play-narrow.png` });
await page.setViewportSize({ width, height });

await page.waitForSelector('#end:not([hidden])', { timeout: 40_000 });
// Let the screen's entrance animation finish, or the shot catches it mid-fade.
await page.waitForTimeout(600);
await page.screenshot({ path: `${OUT}/12-end.png` });

await browser.close();
await server?.close();
console.log(`shots written to ${OUT}`);
