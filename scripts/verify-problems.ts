/**
 * Compiles every problem in a real browser and reports any that are unplayable.
 * Usage: npm run verify:problems
 */
import { chromium } from 'playwright';
import { startServer } from './server.js';

const TIMEOUT_MS = 600_000;

const server = process.env.VERIFY_URL ? null : await startServer();
const url = process.env.VERIFY_URL ?? `${server!.url}verify-problems.html`;

const browser = await chromium.launch();
const page = await browser.newPage();

/** Set when the page cannot even load, so we fail fast rather than wait out
 *  the full timeout on a module that will never run. */
let fatal: string | null = null;

page.on('console', (msg) => {
  const text = msg.text();
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
    page.waitForFunction(() => window.verifyDone === true, null, { timeout: TIMEOUT_MS }),
    new Promise((_, reject) => {
      const poll = setInterval(() => {
        if (fatal) {
          clearInterval(poll);
          reject(new Error(fatal));
        }
      }, 200);
    }),
  ]);
  failed = await page.evaluate(() => window.verifyFailed ?? 1);
} catch {
  console.error(fatal ? `\nPage failed to load: ${fatal}` : '\nTimed out.');
  console.error('\nLast output:\n');
  console.error(await page.textContent('#log'));
}

await browser.close();
await server?.close();
process.exit(failed === 0 ? 0 : 1);
