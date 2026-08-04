/**
 * A deliberately small error signal.
 *
 * Payloads contain no LaTeX source, rendered content, scores, browser details,
 * timestamps, or identifiers. The endpoint is optional, so local development
 * and deployments without a collector make no requests at all.
 */

export type ErrorReason = 'network' | 'timeout' | 'wasm' | 'storage' | 'unknown';

export type TelemetryEvent =
  | { event: 'engine_warm_failed'; reason: ErrorReason }
  | { event: 'compile_timeout' }
  | { event: 'target_compile_failed'; problem: string }
  | { event: 'unexpected_error'; reason: ErrorReason };

export type TelemetryPayload = TelemetryEvent & { schema: 1 };

export type TelemetrySender = (
  endpoint: string,
  payload: TelemetryPayload,
) => Promise<void>;

export interface PrivacyPreferences {
  doNotTrack?: string | null;
  globalPrivacyControl?: boolean;
}

export function allowsTelemetry(preferences: PrivacyPreferences | null): boolean {
  return preferences?.globalPrivacyControl !== true && preferences?.doNotTrack !== '1';
}

async function sendWithFetch(endpoint: string, payload: TelemetryPayload): Promise<void> {
  await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
    credentials: 'omit',
    referrerPolicy: 'no-referrer',
    keepalive: true,
  });
}

export class Telemetry {
  private readonly sent = new Set<string>();

  constructor(
    private readonly endpoint: string | null,
    private readonly sender: TelemetrySender = sendWithFetch,
  ) {}

  report(event: TelemetryEvent): void {
    if (!this.endpoint) return;
    const payload: TelemetryPayload = { schema: 1, ...event };
    const key = JSON.stringify(payload);
    if (this.sent.has(key)) return;
    this.sent.add(key);
    void this.sender(this.endpoint, payload).catch(() => {
      // Telemetry must never become an application failure of its own.
    });
  }
}

export function classifyError(value: unknown): ErrorReason {
  const text =
    value instanceof Error
      ? `${value.name} ${value.message}`.toLowerCase()
      : typeof value === 'string'
        ? value.toLowerCase()
        : '';

  if (/timeout|timed out/.test(text)) return 'timeout';
  if (/webassembly|wasm|compileerror/.test(text)) return 'wasm';
  if (/quota|storage|indexeddb|opfs/.test(text)) return 'storage';
  if (/fetch|network|cors|failed to load|http/.test(text)) return 'network';
  return 'unknown';
}

const privacyPreferences =
  typeof navigator === 'undefined'
    ? null
    : (navigator as Navigator & { globalPrivacyControl?: boolean });

export const telemetry = new Telemetry(
  allowsTelemetry(privacyPreferences)
    ? import.meta.env.VITE_TELEMETRY_ENDPOINT?.trim() || null
    : null,
);
