/**
 * Exercises the compile pipeline in a real browser: engine init, cross-origin
 * isolation, package availability, render determinism, and recovery from a
 * runaway macro.
 * Usage: npm run smoke
 */
import { chromium } from 'playwright';
import { startServer } from './server.js';

const TIMEOUT_MS = 300_000;

const server = process.env.SMOKE_URL ? null : await startServer();
const url = process.env.SMOKE_URL ?? `${server!.url}smoke.html`;

const browser = await chromium.launch();
const page = await browser.newPage();

let fatal: string | null = null;

page.on('console', (msg) => {
  const text = msg.text();
  // The engine is chatty about bundle fetches; only surface test output.
  if (!text.startsWith('[')) console.log(text);
});
page.on('pageerror', (err) => {
  console.error('PAGE ERROR:', err.message);
  fatal ??= err.message;
});
page.on('response', (res) => {
  if (res.status() >= 500) fatal ??= `${res.status()} on ${res.url()}`;
});

await page.goto(url, { waitUntil: 'domcontentloaded' });

let failed = 1;
try {
  await Promise.race([
    page.waitForFunction(() => window.smokeDone === true, null, { timeout: TIMEOUT_MS }),
    new Promise((_, reject) => {
      const poll = setInterval(() => {
        if (fatal) {
          clearInterval(poll);
          reject(new Error(fatal));
        }
      }, 200);
    }),
  ]);
  failed = await page.evaluate(() => window.smokeFailed ?? 1);
} catch {
  console.error(fatal ? `\nPage failed to load: ${fatal}` : '\nTimed out.');
  console.error('\nLast output:\n');
  console.error(await page.textContent('#log'));
}

await browser.close();
await server?.close();
process.exit(failed === 0 ? 0 : 1);
