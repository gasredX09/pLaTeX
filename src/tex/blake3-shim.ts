/**
 * Stands in for `blake3-wasm/browser.js`, aliased in vite.config.ts.
 *
 * Why replace it: blake3-wasm imports its .wasm through the ESM-integration
 * proposal, which Rollup cannot bundle, so `vite build` fails outright. The
 * engine only uses BLAKE3 to key two caches (compiled PDFs by document, format
 * files by preamble) and already degrades to a 32-bit DJB2 hash whenever the
 * WASM fails to load, so nothing here is cryptographic.
 *
 * Why not just let it fall back to DJB2: a cache keyed by a 32-bit hash can
 * collide, and a collision would hand back the wrong PDF. In this game a wrong
 * PDF is a wrong verdict on the player's answer. So this shim produces a full
 * 64-bit digest, matching the 8-byte length the engine requests, which puts
 * collisions out of reach for a session's worth of documents.
 *
 * FNV-1a over 64 bits, computed as two interleaved 32-bit lanes to stay in
 * integer arithmetic rather than paying for BigInt on every call.
 */

interface Digest {
  toString(encoding?: string): string;
}

const OFFSET_LOW = 0x84222325;
const OFFSET_HIGH = 0xcbf29ce4;

/** Multiplies the 64-bit accumulator by the FNV prime (0x100000001b3). */
function multiplyPrime(low: number, high: number): [number, number] {
  // prime = 2^40 + 2^8 + 0x b3, so the product is a few shifts plus the low
  // 32x32 multiply, kept in unsigned 32-bit lanes throughout.
  const lowProduct = Math.imul(low, 0x1b3) >>> 0;
  const carry = Math.floor((low * 0x1b3) / 0x100000000);
  const highProduct =
    (Math.imul(high, 0x1b3) + carry + (Math.imul(low, 0x100) >>> 0) + (high << 8)) >>> 0;
  return [lowProduct, highProduct];
}

function fnv1a64(input: string): [number, number] {
  let low = OFFSET_LOW;
  let high = OFFSET_HIGH;

  for (let i = 0; i < input.length; i++) {
    const code = input.charCodeAt(i);
    // Fold both bytes of the code unit so non-ASCII input is not truncated.
    low = (low ^ (code & 0xff)) >>> 0;
    [low, high] = multiplyPrime(low, high);
    low = (low ^ ((code >>> 8) & 0xff)) >>> 0;
    [low, high] = multiplyPrime(low, high);
  }
  return [low, high];
}

function toHex(value: number): string {
  return (value >>> 0).toString(16).padStart(8, '0');
}

/**
 * Mirrors blake3-wasm's `hash(input, { length })`, returning an object whose
 * toString('hex') the engine calls.
 */
export function hash(input: string | Uint8Array, options?: { length?: number }): Digest {
  const text = typeof input === 'string' ? input : new TextDecoder().decode(input);
  const [low, high] = fnv1a64(text);
  const full = `${toHex(high)}${toHex(low)}`;
  // `length` is in bytes; two hex characters per byte.
  const hex = options?.length ? full.slice(0, options.length * 2) : full;
  return { toString: () => hex };
}

export default { hash };
