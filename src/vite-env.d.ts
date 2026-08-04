/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Base URL for the TeX engine assets (wasm and package bundles). Unset in
   * development, where they are served from public/tex. See tex/engine.ts.
   */
  readonly VITE_TEX_BASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
