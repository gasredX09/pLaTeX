/**
 * Boots the Vite dev server in-process so the browser-driven checks are a
 * single command. They need the real server rather than a plain static host:
 * the COOP/COEP headers and the *.data.gz content-encoding fix both live in
 * vite.config.ts, and the engine will not start without them.
 */
import { createServer, type ViteDevServer } from 'vite';

export interface RunningServer {
  url: string;
  close: () => Promise<void>;
}

export async function startServer(): Promise<RunningServer> {
  const server: ViteDevServer = await createServer({
    configFile: new URL('../vite.config.ts', import.meta.url).pathname,
    server: { port: 0 },
    logLevel: 'warn',
  });
  await server.listen();

  const address = server.httpServer?.address();
  if (!address || typeof address === 'string') throw new Error('dev server did not bind a port');

  return {
    url: `http://localhost:${address.port}/`,
    close: () => server.close(),
  };
}
