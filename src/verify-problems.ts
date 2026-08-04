/**
 * Compiles every problem and checks it is actually playable.
 *
 * A bad problem is worse than a missing one: it appears mid-run, cannot be
 * solved, and burns the player's clock. Driven headlessly by
 * scripts/verify-problems.ts.
 */
import { TexEngine } from './tex/engine.js';
import { rasterizeFirstPage } from './render/rasterize.js';
import { blazeProblems } from './problems.js';
import { practiceProblems } from './practiceProblems.js';
import { normalize } from './normalize.js';
import { BUNDLED_PACKAGES } from './tex/document.js';
import { candidateBreaks } from './fixit.js';
import { compareBitmaps } from './render/compare.js';

const out = document.getElementById('log')!;
const lines: string[] = [];
function log(msg: string): void {
  lines.push(msg);
  out.textContent = lines.join('\n');
  console.log(msg);
}

declare global {
  interface Window {
    verifyDone?: boolean;
    verifyFailed?: number;
  }
}

/**
 * Ink within this many pixels of the page edge means the content is running off
 * the page. The template leaves a 4mm margin (~23px at 2x), so anything in the
 * outermost few pixels has overflowed.
 */
const EDGE_MARGIN_PX = 3;

interface Ink {
  any: boolean;
  touchesEdge: boolean;
}

function inspectInk(image: ImageData): Ink {
  const { width, height, data } = image;
  let any = false;
  let touchesEdge = false;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      // Anything appreciably darker than the white page counts as ink.
      if (data[i]! < 240 || data[i + 1]! < 240 || data[i + 2]! < 240) {
        any = true;
        if (
          x < EDGE_MARGIN_PX ||
          y < EDGE_MARGIN_PX ||
          x >= width - EDGE_MARGIN_PX ||
          y >= height - EDGE_MARGIN_PX
        ) {
          touchesEdge = true;
          return { any, touchesEdge };
        }
      }
    }
  }
  return { any, touchesEdge };
}

async function main(): Promise<void> {
  const engine = new TexEngine();
  await engine.warm();
  const problems = [...blazeProblems, ...practiceProblems];
  log(`Verifying ${problems.length} problems\n`);

  let failed = 0;
  const seen = new Set<string>();
  const allowed = new Set<string>(BUNDLED_PACKAGES);
  const timings: number[] = [];
  /** Problems whose leading mutation renders the target and is skipped at run time. */
  const fellThrough: string[] = [];

  for (const problem of problems) {
    const issues: string[] = [];

    if (seen.has(problem.id)) issues.push('duplicate id');
    seen.add(problem.id);

    // A problem's extra preamble may only pull in packages that are bundled;
    // anything else would trigger a network fetch mid-run.
    for (const match of (problem.preamble ?? '').matchAll(/\\usepackage(?:\[[^\]]*\])?\{([^}]*)\}/g)) {
      for (const pkg of match[1]!.split(',').map((s) => s.trim())) {
        if (!allowed.has(pkg)) issues.push(`unbundled package: ${pkg}`);
      }
    }

    const started = performance.now();
    const result = await engine.compile(normalize(problem.latex), problem.preamble);
    const elapsed = performance.now() - started;
    timings.push(elapsed);

    if (result.status !== 'ok') {
      const detail = result.status === 'error' ? firstTexError(result.log) : result.status;
      issues.push(`does not compile: ${detail}`);
    } else {
      const { image, pageCount } = await rasterizeFirstPage(result.pdf);
      if (pageCount !== 1) issues.push(`spills onto ${pageCount} pages`);

      const ink = inspectInk(image);
      if (!ink.any) issues.push('renders a blank page');
      if (ink.touchesEdge) issues.push('content runs off the page');

      // Fix-it hands the player a generated mutation of this source, and at run
      // time walks the candidates until one is genuinely wrong. That search is
      // only guaranteed to terminate usefully if at least one candidate is a
      // real puzzle, which is the invariant asserted here.
      //
      // It is not a formality: four problems have a leading mutation that
      // compiles and still renders the target exactly, because dropping a final
      // brace only leaves a group that closes at end of document, and a tie
      // typesets like a space unless the line breaks there.
      const candidates = candidateBreaks(problem);
      if (candidates.length === 0) {
        issues.push('cannot be broken, so Fix-it will never offer it');
      } else {
        let playable: string | null = null;
        const noOps: string[] = [];
        for (const candidate of candidates) {
          const brokenResult = await engine.compile(normalize(candidate.source), problem.preamble);
          if (brokenResult.status !== 'ok') {
            playable = candidate.mutator.id;
            break;
          }
          const brokenRender = await rasterizeFirstPage(brokenResult.pdf);
          if (!compareBitmaps(image, brokenRender.image).match) {
            playable = candidate.mutator.id;
            break;
          }
          noOps.push(candidate.mutator.id);
        }
        if (!playable) {
          issues.push(`every mutation reproduces the target: ${candidates.map((c) => c.mutator.id).join(', ')}`);
        } else if (noOps.length > 0) {
          // Not a failure; worth seeing which leading mutations fall through.
          fellThrough.push(`${problem.id}: skipped ${noOps.join(', ')} -> used ${playable}`);
        }
      }
    }

    if (issues.length > 0) {
      failed++;
      log(`FAIL  ${problem.id}`);
      for (const issue of issues) log(`        ${issue}`);
    } else {
      log(`ok    ${problem.id.padEnd(24)} ${Math.round(elapsed)}ms`);
    }
  }

  const sorted = [...timings].sort((a, b) => a - b);
  const median = Math.round(sorted[Math.floor(sorted.length / 2)] ?? 0);
  const slowest = Math.round(sorted.at(-1) ?? 0);
  log(`\nCompile time: median ${median}ms, slowest ${slowest}ms`);
  if (fellThrough.length > 0) {
    log(`\nFix-it fell through to a later mutation for ${fellThrough.length} problem(s):`);
    for (const line of fellThrough) log(`  ${line}`);
  }
  log(failed === 0 ? `ALL ${problems.length} PROBLEMS OK` : `${failed} PROBLEMS FAILED`);

  window.verifyFailed = failed;
  window.verifyDone = true;
}

/** Pulls the first real TeX error line out of a log, which is mostly noise. */
function firstTexError(log: string): string {
  const line = log.split('\n').find((l) => l.startsWith('!'));
  return (line ?? log.split('\n')[0] ?? log).slice(0, 160);
}

main().catch((err: unknown) => {
  log(`FATAL ${err instanceof Error ? (err.stack ?? err.message) : String(err)}`);
  window.verifyFailed = 1;
  window.verifyDone = true;
});
