/**
 * Pixel comparison between the target render and the player's render.
 *
 * This is the game's correctness check. It is deliberately strict: both images
 * come from the same TeX engine and the same pdf.js rasterizer at the same
 * scale, so a genuinely correct answer produces a byte-identical bitmap. That
 * strictness is what lets the game accept any LaTeX that *typesets* the same
 * (`\textbf{x}` and `{\bfseries x}`) while still rejecting near-misses.
 *
 * Why zero differing pixels rather than a small allowance: real near-misses can
 * be tiny. A hyphen typed where an en-dash belongs moves only a few dozen
 * pixels on a ~190k pixel canvas. Any percentage-based tolerance wide enough to
 * absorb noise would also silently accept that. Since we have no noise to
 * absorb, we allow none.
 */

/** Shape-compatible with the DOM's ImageData, but constructible under test. */
export interface Bitmap {
  readonly width: number;
  readonly height: number;
  /** RGBA, row-major, 4 bytes per pixel. */
  readonly data: Uint8ClampedArray;
}

/**
 * Per-channel absolute difference at or below this still counts as equal.
 * Guards against sub-unit rounding in the rasterizer. Rendering is expected to
 * be deterministic, so in practice this should never be exercised.
 */
export const CHANNEL_TOLERANCE = 8;

/**
 * How many pixels may differ and still count as a match. Zero on purpose; see
 * the note above. Exposed as a constant so it can be relaxed if a real source
 * of rasterizer nondeterminism ever turns up.
 */
export const MAX_DIFFERING_PIXELS = 0;

export type CompareResult =
  | { match: true; differingPixels: number }
  | { match: false; reason: 'dimensions' | 'pixels'; differingPixels: number };

export function compareBitmaps(target: Bitmap, attempt: Bitmap): CompareResult {
  if (target.width !== attempt.width || target.height !== attempt.height) {
    return { match: false, reason: 'dimensions', differingPixels: Number.POSITIVE_INFINITY };
  }

  const a = target.data;
  const b = attempt.data;
  let differing = 0;

  // Alpha is ignored: both renders are composited onto an opaque white page, so
  // it is always 255 and comparing it only costs time.
  for (let i = 0; i < a.length; i += 4) {
    if (
      Math.abs(a[i]! - b[i]!) > CHANNEL_TOLERANCE ||
      Math.abs(a[i + 1]! - b[i + 1]!) > CHANNEL_TOLERANCE ||
      Math.abs(a[i + 2]! - b[i + 2]!) > CHANNEL_TOLERANCE
    ) {
      differing++;
      if (differing > MAX_DIFFERING_PIXELS) {
        // Bail out early: the exact count only matters for debugging, and a
        // wrong answer is the common case on every keystroke.
        return { match: false, reason: 'pixels', differingPixels: differing };
      }
    }
  }

  return { match: true, differingPixels: differing };
}
