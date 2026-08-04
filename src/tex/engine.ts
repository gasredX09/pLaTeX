/**
 * Wrapper around the WASM TeX engine.
 *
 * Responsibilities kept here: asset URLs, warm-up, one-compile-at-a-time
 * serialization, and surviving a compile that never finishes. Debouncing and
 * staleness live a layer up in compileQueue.ts.
 */
import { SiglumCompiler } from '@siglum/engine';
import { buildDocument } from './document.js';

/**
 * Where the engine's ~50MB of wasm and packages live.
 *
 * Defaults to /tex, served from public/ by scripts/fetch-tex-assets.sh, which is
 * what `npm run dev` uses. Set VITE_TEX_BASE at build time to serve them from
 * object storage instead: these files are far larger than typical static-host
 * per-file limits allow, and a host with no egress charge is what keeps the game
 * free to run. An absolute URL is fine; the engine treats the bases as opaque
 * and the origin only needs to permit cross-origin reads.
 */
const TEX_BASE = (
  import.meta.env.VITE_TEX_BASE || `${import.meta.env.BASE_URL}tex`
).replace(/\/$/, '');

const ASSET_URLS = {
  bundlesUrl: `${TEX_BASE}/bundles`,
  wasmUrl: `${TEX_BASE}/busytex.wasm`,
  jsUrl: `${TEX_BASE}/busytex.js`,
  // The engine spawns this itself. It must be a plain static file, because a
  // bundler would otherwise rewrite the package's internal worker path, and it
  // stays on the app's own origin because a worker script cannot be cross-origin.
  // BASE_URL rather than a leading slash, so a project page served from a
  // subpath resolves it correctly.
  workerUrl: `${import.meta.env.BASE_URL}tex/worker.js`,
} as const;

/**
 * A compile that exceeds this is treated as non-terminating and the worker is
 * destroyed. Runaway macro expansion (`\def\x{\x}\x`) is an ordinary typo here,
 * not an attack, and TeX cannot be interrupted cooperatively once it is
 * spinning, so the only reliable remedy is to kill the worker.
 */
export const COMPILE_TIMEOUT_MS = 5_000;

export type CompileOutcome =
  | { status: 'ok'; pdf: Uint8Array }
  | { status: 'error'; log: string }
  | { status: 'timeout' };

export type EngineStage = 'idle' | 'loading' | 'ready' | 'restarting' | 'failed';

export interface TexEngineOptions {
  /** Forwards TeX stdout to onLog. Costs a postMessage per log line, so it is
   *  off during play and used only by diagnostics. */
  verbose?: boolean;
  onLog?: (msg: string) => void;
}

export class TexEngine {
  private compiler: SiglumCompiler | null = null;
  private ready: Promise<void> | null = null;
  /** Serializes compiles: the engine holds a single pending-compile slot. */
  private queue: Promise<unknown> = Promise.resolve();

  stage: EngineStage = 'idle';
  onStageChange: (stage: EngineStage, detail?: string) => void = () => {};

  constructor(private readonly options: TexEngineOptions = {}) {}

  private setStage(stage: EngineStage, detail?: string): void {
    this.stage = stage;
    this.onStageChange(stage, detail);
  }

  private create(): SiglumCompiler {
    return new SiglumCompiler({
      ...ASSET_URLS,
      // No CTAN proxy: every package a problem can use is already bundled, and
      // a surprise network fetch mid-run would stall the timer.
      enableCtan: false,
      enableLazyFS: true,
      enableDocCache: true,
      // With no CTAN and a fixed preamble there is nothing worth retrying much.
      maxRetries: 3,
      verbose: this.options.verbose ?? false,
      onLog: this.options.onLog ?? (() => {}),
      onProgress: (stageName, detail) => {
        if (this.stage === 'loading') this.setStage('loading', `${stageName} ${detail}`);
      },
    });
  }

  /**
   * Begins loading the engine. Safe to call repeatedly; the same promise is
   * returned. Kicked off behind the intro screen so the ~45MB of WASM and core
   * bundles download while the player reads the instructions.
   */
  warm(): Promise<void> {
    if (!this.ready) {
      this.setStage('loading');
      this.compiler = this.create();
      this.ready = this.compiler
        .init()
        .then(() => this.setStage('ready'))
        .catch((err: unknown) => {
          this.setStage('failed', err instanceof Error ? err.message : String(err));
          throw err;
        });
    }
    return this.ready;
  }

  isReady(): boolean {
    return this.stage === 'ready';
  }

  /**
   * Fetches package bundles in the background, without blocking anything.
   *
   * For bundles that only some problems need. Keeping such a package out of the
   * shared preamble means nobody waits for it before the first compile, but it
   * would then arrive mid-run, stalling the clock on whoever draws that problem.
   * Warming it after the engine is ready gets both: a fast start, and the bundle
   * already in hand by the time it is wanted. The engine's own cache dedupes
   * this against a real fetch, so a problem that arrives first simply waits.
   */
  preload(bundles: string[]): void {
    void this.warm()
      .then(() => this.compiler?.preloadBundles(bundles))
      .catch(() => {
        // Nothing to do: a failed preload just means the bundle is fetched on
        // demand later, which is the behaviour we had before.
      });
  }

  /**
   * Compiles a body snippet to PDF bytes. Calls are serialized in arrival
   * order, so a caller that wants only the newest result must discard stale
   * ones itself.
   */
  compile(body: string, extraPreamble?: string): Promise<CompileOutcome> {
    const run = this.queue.then(() => this.compileNow(body, extraPreamble));
    // Keep the chain alive even when one compile rejects.
    this.queue = run.catch(() => undefined);
    return run;
  }

  private async compileNow(body: string, extraPreamble?: string): Promise<CompileOutcome> {
    await this.warm();
    const compiler = this.compiler;
    if (!compiler) return { status: 'error', log: 'engine unavailable' };

    const source = buildDocument(body, extraPreamble);

    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<'timeout'>((resolve) => {
      timer = setTimeout(() => resolve('timeout'), COMPILE_TIMEOUT_MS);
    });

    try {
      const result = await Promise.race([
        compiler.compile(source, { engine: 'pdflatex' }),
        timeout,
      ]);

      if (result === 'timeout') {
        await this.restart();
        return { status: 'timeout' };
      }
      if (!result.success || !result.pdf) {
        const detail = [result.error, result.log].filter(Boolean).join('\n');
        return { status: 'error', log: detail || 'compilation failed (no log returned)' };
      }
      // The engine may hand back a view onto a SharedArrayBuffer it reuses for
      // the next compile. Copy before the bytes are overwritten underneath us.
      return { status: 'ok', pdf: new Uint8Array(result.pdf) };
    } catch (err) {
      return { status: 'error', log: err instanceof Error ? err.message : String(err) };
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Destroys the worker and builds a fresh one. Only reachable via the compile
   * timeout. A spare warm engine would make this instant, but each instance
   * reserves roughly 512MB, so we pay the reload instead of doubling memory.
   */
  private async restart(): Promise<void> {
    this.setStage('restarting');
    try {
      this.compiler?.terminate();
    } catch {
      // Already dead; nothing to salvage.
    }
    this.compiler = null;
    this.ready = null;
    await this.warm();
  }
}
