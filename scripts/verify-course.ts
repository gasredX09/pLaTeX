/**
 * Walks the whole of Tutorial Mode in a real browser.
 *
 * The content and the gating rules are unit tested, and the problem verifier
 * proves every exercise and worked example compiles. What is left is the thing a
 * beginner actually meets: that locked stages cannot be entered, that the worked
 * example renders, that finishing a stage opens the next one, and that progress
 * is still there tomorrow.
 *
 * Usage: npm run verify:course
 */
import { chromium } from 'playwright';
import { startServer } from './server.js';
import { courseStages } from '../src/course.js';

const server = process.env.COURSE_URL ? null : await startServer();
const base = process.env.COURSE_URL ?? server!.url;

const browser = await chromium.launch();
// One context throughout: progress lives in localStorage and is under test.
const context = await browser.newContext();
const page = await context.newPage();
const failures: string[] = [];
page.on('pageerror', (error) => failures.push('page error: ' + error.message));

function check(name: string, ok: boolean, detail = ''): void {
  if (!ok) failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
}

function checkEq(name: string, actual: string, expected: string): void {
  const ok = actual === expected;
  check(name, ok, ok ? actual : `got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)}`);
}

const text = async (selector: string) => (await page.textContent(selector))?.trim() ?? '';

/**
 * Wraps a wait so a timeout says what it was waiting for. Without this a failure
 * is an anonymous "Timeout 90000ms exceeded" and says nothing about where.
 */
async function waiting<T>(what: string, action: () => Promise<T>): Promise<T> {
  try {
    return await action();
  } catch (error) {
    throw new Error(`${what}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/** Which stage buttons are enabled, in order. */
const openStages = () =>
  page.evaluate(() =>
    [...document.querySelectorAll('#stage-list .stage-card')].map(
      (button) => !(button as HTMLButtonElement).disabled,
    ),
  );

async function openMap(): Promise<void> {
  await page.waitForSelector('#course-mode:not([disabled])', { timeout: 180_000 });
  await page.click('#course-mode');
  await page.waitForSelector('#course-map:not([hidden])', { timeout: 30_000 });
}

try {
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await openMap();

  // --- the map opens gated ------------------------------------------------
  const initial = await openStages();
  check('every stage is on the map', initial.length === courseStages.length, `${initial.length}`);
  check('only the first stage is open', initial.filter(Boolean).length === 1);
  check(
    'the state is on the button for assistive tech',
    (await page.getAttribute('#stage-list .stage-card', 'aria-label'))?.includes('available') ??
      false,
  );

  // A locked stage must be genuinely unreachable, not merely styled as locked.
  const lockedReached = await page.evaluate(() => {
    const locked = [...document.querySelectorAll('#stage-list .stage-card')].find(
      (button) => (button as HTMLButtonElement).disabled,
    ) as HTMLButtonElement | undefined;
    locked?.click();
    return !document.getElementById('lesson')?.hidden;
  });
  check('a locked stage cannot be entered', !lockedReached);

  // --- the opening stage is prose only ------------------------------------
  await page.click('#stage-list .stage-card');
  await page.waitForSelector('#lesson:not([hidden])', { timeout: 20_000 });
  check('the opening stage is prose only', await page.locator('#lesson-example').isHidden());
  check('its prose is rendered as paragraphs', (await page.locator('#lesson-body p').count()) > 2);
  checkEq('it reads on rather than into an exercise', await text('#lesson-continue'), 'Next');
  checkEq('the stage is numbered', await text('#lesson-stage'), `Stage 1 of ${courseStages.length}`);

  // Leaving without finishing must not mark it complete.
  await page.click('#lesson-back');
  await page.waitForSelector('#course-map:not([hidden])', { timeout: 20_000 });
  check('backing out does not complete a stage', (await openStages()).filter(Boolean).length === 1);

  // --- walk every stage ---------------------------------------------------
  for (const [index, stage] of courseStages.entries()) {
    await page.evaluate((n) => {
      const buttons = document.querySelectorAll('#stage-list .stage-card');
      (buttons[n] as HTMLButtonElement).click();
    }, index);
    await page.waitForSelector('#lesson:not([hidden])', { timeout: 20_000 });

    if (stage.example) {
      // A caption promising a render must be accompanied by one.
      await waiting(`stage ${index + 1} worked example renders`, () =>
        page.waitForFunction(
          () => (document.getElementById('lesson-example-canvas') as HTMLCanvasElement).width > 0,
          null,
          { timeout: 90_000 },
        ),
      );
      const shown = await text('#lesson-example-source');
      if (shown !== stage.example.source) {
        failures.push(`stage ${index + 1}: example source on screen does not match the content`);
      }
    }

    await page.click('#lesson-continue');

    if (stage.exercise) {
      await page.waitForSelector('#play:not([hidden])', { timeout: 20_000 });
      if (index === 1) {
        check('the timed rail is hidden', await page.locator('#blaze-rail').isHidden());
        checkEq('the rail names the mode', await text('#practice-topic-label'), 'Tutorial');
        // Deferring makes no sense in a locked linear course.
        checkEq('skip leaves for the map', await text('#skip'), 'Back to the map');
        await page.click('#practice-hint');
        check('a hint is available', (await text('#practice-hint-text')).length > 0);
      }
      await waiting(`stage ${index + 1} exercise becomes editable`, () =>
        page.waitForFunction(
          () => !(document.getElementById('input') as HTMLTextAreaElement).disabled,
          null,
          { timeout: 90_000 },
        ),
      );
      await page.fill('#input', stage.exercise.latex);
      await waiting(`stage ${index + 1} answer registers`, () =>
        page.waitForFunction(
          () => document.getElementById('status')?.className.includes('match') ?? false,
          null,
          { timeout: 60_000 },
        ),
      );
    }

    if (index < courseStages.length - 1) {
      await waiting(`stage ${index + 1} returns to the map`, () =>
        page.waitForSelector('#course-map:not([hidden])', { timeout: 30_000 }),
      );
      const open = (await openStages()).filter(Boolean).length;
      check(`finishing stage ${index + 1} opens stage ${index + 2}`, open === index + 2, `${open}`);
    }
  }

  // --- the finish ---------------------------------------------------------
  await page.waitForSelector('#practice-end:not([hidden])', { timeout: 30_000 });
  checkEq('the course ends on its own sheet', await text('#practice-final-title'), 'Tutorial complete');
  checkEq('it points onward to Practice', await text('#practice-again'), 'Start Practice Mode');

  // --- progress persists --------------------------------------------------
  await page.reload({ waitUntil: 'domcontentloaded' });
  await openMap();
  const afterReload = await openStages();
  check('progress survives a reload', afterReload.every(Boolean), `${afterReload.filter(Boolean).length}`);

  // --- the warm-up is never shown from here -------------------------------
  // Tutorial Mode supersedes it, so a player who came through the course should
  // go straight into Blaze rather than being sent back to a one-line exercise.
  await page.click('#course-home');
  await page.waitForSelector('#intro:not([hidden])', { timeout: 20_000 });
  await page.click('#blaze-mode');
  await page.waitForSelector('#play:not([hidden])', { timeout: 30_000 });
  check('finishing the tutorial also clears the warm-up', await page.locator('#tutorial').isHidden());
} catch (error) {
  failures.push(error instanceof Error ? error.message : String(error));
}

await browser.close();
await server?.close();

if (failures.length > 0) {
  console.error(`\n${failures.length} failure(s):`);
  for (const failure of failures) console.error(`  ${failure}`);
  process.exit(1);
}
console.log('\nTutorial OK');
