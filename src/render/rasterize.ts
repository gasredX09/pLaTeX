/**
 * Turns compiled PDF bytes into pixels for comparison and display.
 *
 * Both the target and the player's attempt go through this exact path at the
 * same scale, which is what makes a strict pixel comparison viable downstream.
 */
import * as pdfjsLib from 'pdfjs-dist';
import PdfjsWorker from 'pdfjs-dist/build/pdf.worker.mjs?worker';

pdfjsLib.GlobalWorkerOptions.workerPort = new PdfjsWorker();

/**
 * Points-to-pixels multiplier. Serves two ends at once: it sets how finely the
 * comparison can discriminate (at 3x a thin space is ~14px, so `a\,b` and `ab`
 * are far apart) and how crisp the preview looks, since the render is displayed
 * downscaled rather than blown up. Raising it costs pixels to compare on every
 * keystroke.
 */
export const RENDER_SCALE = 3;

/** Reused across calls; allocating a canvas per keystroke is pure garbage. */
let scratch: HTMLCanvasElement | null = null;

function scratchContext(width: number, height: number): CanvasRenderingContext2D {
  scratch ??= document.createElement('canvas');
  scratch.width = width;
  scratch.height = height;
  const ctx = scratch.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('2D canvas context unavailable');
  return ctx;
}

export interface RasterizedPage {
  image: ImageData;
  /** Total pages in the document. Only page one is ever rendered. */
  pageCount: number;
}

/**
 * Renders page 1 and returns its pixels.
 *
 * Only the first page is compared. A snippet that spills onto page 2 differs in
 * a way the player cannot see, so `pageCount` is reported for callers that want
 * to treat that as a problem in its own right.
 *
 * Note: pdf.js transfers the input buffer to its worker, leaving the caller's
 * `Uint8Array` detached. Pass a copy if you still need the bytes.
 */
export async function rasterizeFirstPage(
  pdfBytes: Uint8Array,
  scale: number = RENDER_SCALE,
): Promise<RasterizedPage> {
  const doc = await pdfjsLib.getDocument({ data: pdfBytes }).promise;
  try {
    const page = await doc.getPage(1);
    const viewport = page.getViewport({ scale });
    const width = Math.ceil(viewport.width);
    const height = Math.ceil(viewport.height);
    const ctx = scratchContext(width, height);

    // pdf.js draws only the page's marks, not its paper. Without this the
    // background stays transparent black and every render would "match".
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    await page.render({ canvasContext: ctx, viewport }).promise;
    return { image: ctx.getImageData(0, 0, width, height), pageCount: doc.numPages };
  } finally {
    // Each compile produces a new document; without this they accumulate.
    await doc.destroy();
  }
}

/** Paints a previously rasterized page into a visible canvas. */
export function paint(canvas: HTMLCanvasElement, image: ImageData): void {
  canvas.width = image.width;
  canvas.height = image.height;
  canvas.getContext('2d')?.putImageData(image, 0, 0);
}
