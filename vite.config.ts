import { defineConfig, type Plugin } from 'vite';
import type { IncomingMessage, ServerResponse } from 'node:http';

// The TeX engine communicates with its worker through a SharedArrayBuffer, which
// browsers only expose to cross-origin-isolated pages. Without these headers the
// compiler fails at init with an opaque error, so they must be set in dev, in
// preview, and by whatever serves the production build.
const crossOriginIsolation = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
};

/**
 * Serves the engine's *.data.gz package bundles as opaque bytes.
 *
 * Static servers see the .gz extension and helpfully label the response
 * `Content-Encoding: gzip`, which makes the browser transparently decompress it.
 * That breaks the engine: it checks for `br` and otherwise assumes the body is
 * still compressed, running it through DecompressionStream('gzip') itself. Given
 * already-decompressed bytes it throws, and every bundle fails to load.
 *
 * Any production host serving these files needs the same treatment.
 */
function opaqueGzipBundles(): Plugin {
  const middleware = (req: IncomingMessage, res: ServerResponse, next: () => void): void => {
    if (req.url?.startsWith('/tex/bundles/') && req.url.includes('.data.gz')) {
      const original = res.setHeader.bind(res);
      res.setHeader = ((name: string, value: never) => {
        if (name.toLowerCase() === 'content-encoding') return res;
        return original(name, value);
      }) as typeof res.setHeader;
      res.setHeader('Content-Type', 'application/octet-stream');
    }
    next();
  };

  return {
    name: 'opaque-gzip-bundles',
    configureServer(server) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
    },
  };
}

export default defineConfig({
  plugins: [opaqueGzipBundles()],
  resolve: {
    alias: {
      // blake3-wasm imports its .wasm through the ESM-integration proposal,
      // which Rollup cannot bundle, so `vite build` fails on it. It is only a
      // hashing optimization for the engine's caches; see the shim for why we
      // replace it rather than let the engine fall back on its own.
      'blake3-wasm/browser.js': new URL('./src/tex/blake3-shim.ts', import.meta.url).pathname,
    },
  },
  server: { headers: crossOriginIsolation },
  preview: { headers: crossOriginIsolation },
  worker: { format: 'es' },
  optimizeDeps: {
    // Pre-bundling rewrites the engine's internal worker path. We serve the
    // worker as a static file instead (see scripts/fetch-tex-assets.sh).
    exclude: ['@siglum/engine'],
  },
  build: {
    target: 'es2022',
    // The 29MB wasm and the bundle files are already in public/ and are copied
    // verbatim; nothing here should try to inline them.
    assetsInlineLimit: 0,
  },
});
