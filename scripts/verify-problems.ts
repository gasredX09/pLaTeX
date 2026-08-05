/**
 * Compiles every problem in a real browser and reports any that are unplayable.
 * Usage: npm run verify:problems
 */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { startServer } from './server.js';

const TIMEOUT_MS = 600_000;

const server = process.env.VERIFY_URL ? null : await startServer();
const url = process.env.VERIFY_URL ?? `${server!.url}verify-problems.html`;

const browser = await chromium.launch();
const page = await browser.newPage();

/*
 * Which package bundles the run actually touches.
 *
 * Locally every bundle is present, so a document that quietly needs a deferred
 * one still compiles; the deploy only ships the bundles in required-bundles.txt,
 * so the same document 404s in production. That is exactly how `\$` in text
 * shipped broken: it pulls cm-super, which was not on the list. Recording the
 * fetches here and comparing them to the list closes that gap.
 */
const fetchedBundles = new Set<string>();
page.on('request', (request) => {
  const match = /\/tex\/bundles\/([^/?]+)\.data\.gz/.exec(request.url());
  if (match) fetchedBundles.add(match[1]!);
});

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

// Any bundle the content needs but the deploy does not ship would 404 live.
const listed = new Set(
  readFileSync(new URL('./required-bundles.txt', import.meta.url), 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '' && !line.startsWith('#')),
);
const missingBundles = [...fetchedBundles].filter((name) => !listed.has(name)).sort();
if (missingBundles.length > 0) {
  console.error(
    `\n${missingBundles.length} bundle(s) are needed by the content but missing from ` +
      'scripts/required-bundles.txt, so they would 404 in production:',
  );
  for (const name of missingBundles) console.error(`  ${name}`);
  failed += missingBundles.length;
} else {
  console.log(`\nAll ${fetchedBundles.size} bundles used are on the deploy list.`);
}

// The other direction is not a failure, only deploy weight worth knowing about.
const unused = [...listed].filter((name) => !fetchedBundles.has(name)).sort();
if (unused.length > 0) {
  console.log(`Listed but never fetched by any problem: ${unused.join(', ')}`);
}

process.exit(failed === 0 ? 0 : 1);
