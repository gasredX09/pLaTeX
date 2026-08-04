export interface WarmMilestone {
  percent: number;
  detail: string;
}

/** The compressed engine and bundles required before the first compile. */
export const FIRST_VISIT_MB = 48;

/** Converts the engine's internal log into a small number of honest milestones. */
export function warmMilestone(message: string): WarmMilestone | null {
  if (message.includes('Manifests loaded from cache')) {
    return { percent: 15, detail: 'Reading the package index from browser storage' };
  }
  if (message.includes('Manifests saved to cache')) {
    return { percent: 15, detail: 'Package index ready' };
  }
  if (message.includes('Loading WASM')) {
    return { percent: 20, detail: 'Loading the TeX engine' };
  }
  if (message.includes('WASM loaded from cache')) {
    return { percent: 70, detail: 'TeX engine restored from browser storage' };
  }
  if (message.includes('WASM fetched')) {
    return { percent: 70, detail: 'TeX engine downloaded and compiled' };
  }
  if (message.includes('Preloading pdflatex bundles')) {
    return { percent: 75, detail: 'Loading core fonts and the pdfLaTeX format' };
  }
  if (message.includes('Preload complete')) {
    return { percent: 92, detail: 'Core fonts and format ready' };
  }
  if (message.includes('Worker ready')) {
    return { percent: 97, detail: 'Starting the typesetting worker' };
  }
  return null;
}
