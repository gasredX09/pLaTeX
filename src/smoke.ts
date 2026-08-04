/**
 * Browser smoke test for the compile pipeline.
 *
 * Run headlessly by scripts/smoke.ts. This exists because the interesting
 * failure modes (WASM init, cross-origin isolation, package availability,
 * render determinism) only appear in a real browser and cannot be unit tested.
 */
import { TexEngine } from './tex/engine.js';
import { rasterizeFirstPage } from './render/rasterize.js';
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
    smokeDone?: boolean;
    smokeFailed?: number;
  }
}

let failed = 0;
function check(name: string, ok: boolean, detail = ''): void {
  if (!ok) failed++;
  log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
}

async function render(body: string): Promise<ImageData | null> {
  const result = await engine.compile(body);
  if (result.status !== 'ok') {
    log(`   compile ${result.status}: ${result.status === 'error' ? result.log.slice(0, 400) : ''}`);
    return null;
  }
  return (await rasterizeFirstPage(result.pdf)).image;
}

const verbose = new URLSearchParams(location.search).has('verbose');
const engine = new TexEngine({
  verbose,
  onLog: verbose ? (msg) => log(`   [tex] ${msg}`) : undefined,
});
engine.onStageChange = (stage, detail) => log(`   [engine] ${stage}${detail ? ` ${detail}` : ''}`);

async function main(): Promise<void> {
  log(`crossOriginIsolated = ${globalThis.crossOriginIsolated}`);

  const t0 = performance.now();
  await engine.warm();
  log(`engine warm in ${Math.round(performance.now() - t0)}ms`);

  // 1. The engine compiles at all.
  const t1 = performance.now();
  const hello = await render('Hello, world!');
  check('compiles plain text', hello !== null, `${Math.round(performance.now() - t1)}ms`);
  if (hello) log(`   page raster: ${hello.width}x${hello.height}`);

  // 2. Compilation is deterministic — the premise the whole comparison rests on.
  const helloAgain = await render('Hello, world!');
  check(
    'identical source renders identically',
    !!hello && !!helloAgain && compareBitmaps(hello, helloAgain).match,
  );

  // 3. The payoff of a real TeX engine: equivalent markup, identical output.
  const bfA = await render(String.raw`\textbf{bold}`);
  const bfB = await render(String.raw`{\bfseries bold}`);
  check(
    String.raw`\textbf{bold} == {\bfseries bold}`,
    !!bfA && !!bfB && compareBitmaps(bfA, bfB).match,
  );

  // 4. Near-misses must still be rejected.
  const spaced = await render(String.raw`$a\,b$`);
  const unspaced = await render('$ab$');
  check(
    String.raw`$a\,b$ != $ab$`,
    !!spaced && !!unspaced && !compareBitmaps(spaced, unspaced).match,
  );

  // 5. Every package the preamble loads must actually resolve from the bundles.
  const math = await render(String.raw`\[ \sum_{i=1}^n i^2 = \frac{n(n+1)(2n+1)}{6} \]`);
  check('math with amsmath', math !== null);

  const table = await render(
    String.raw`\begin{tabular}{|l|r|}\hline Item & Qty \\\hline Pen & 3 \\\hline\end{tabular}`,
  );
  check('tabular with rules', table !== null);

  const list = await render(String.raw`\begin{itemize}\item One\item Two\end{itemize}`);
  check('itemize', list !== null);

  const tikz = await render(
    String.raw`\begin{tikzpicture}\draw[thick,red] (0,0) circle (0.5cm);\end{tikzpicture}`,
  );
  check('tikz picture', tikz !== null);

  const color = await render(String.raw`\textcolor{blue}{blue text}`);
  check('xcolor', color !== null);

  // 6. Broken input must fail cleanly rather than hang or throw.
  const broken = await engine.compile(String.raw`\frac{1`);
  check('unbalanced brace reports an error', broken.status === 'error', broken.status);

  // 7. Runaway expansion must not wedge the engine.
  const t2 = performance.now();
  const runaway = await engine.compile(String.raw`\def\x{\x}\x`);
  log(`   runaway returned ${runaway.status} in ${Math.round(performance.now() - t2)}ms`);
  check(
    'runaway macro is contained',
    runaway.status === 'timeout' || runaway.status === 'error',
    runaway.status,
  );

  // 8. And the engine still works afterwards.
  const after = await render('recovered');
  check('engine usable after runaway', after !== null);

  log(`\n${failed === 0 ? 'ALL PASSED' : `${failed} FAILED`}`);
  window.smokeFailed = failed;
  window.smokeDone = true;
}

main().catch((err: unknown) => {
  log(`FATAL ${err instanceof Error ? (err.stack ?? err.message) : String(err)}`);
  window.smokeFailed = failed + 1;
  window.smokeDone = true;
});
