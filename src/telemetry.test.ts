import { describe, expect, it, vi } from 'vitest';
import {
  allowsTelemetry,
  classifyError,
  Telemetry,
  type TelemetrySender,
} from './telemetry.js';

describe('Telemetry', () => {
  it('does nothing when no endpoint is configured', () => {
    const sender = vi.fn<TelemetrySender>();
    const telemetry = new Telemetry(null, sender);
    telemetry.report({ event: 'compile_timeout' });
    expect(sender).not.toHaveBeenCalled();
  });

  it('sends only the small schema and deduplicates identical events', () => {
    const sender = vi.fn<TelemetrySender>().mockResolvedValue();
    const telemetry = new Telemetry('https://errors.example.test/event', sender);
    telemetry.report({ event: 'target_compile_failed', problem: 'quadratic' });
    telemetry.report({ event: 'target_compile_failed', problem: 'quadratic' });

    expect(sender).toHaveBeenCalledTimes(1);
    expect(sender).toHaveBeenCalledWith('https://errors.example.test/event', {
      schema: 1,
      event: 'target_compile_failed',
      problem: 'quadratic',
    });
  });

  it('swallows collector failures', async () => {
    const sender = vi.fn<TelemetrySender>().mockRejectedValue(new Error('offline'));
    const telemetry = new Telemetry('https://errors.example.test/event', sender);
    expect(() => telemetry.report({ event: 'compile_timeout' })).not.toThrow();
    await Promise.resolve();
  });
});

describe('classifyError', () => {
  it('reduces raw errors to non-sensitive categories', () => {
    expect(classifyError(new Error('Failed to fetch secret URL'))).toBe('network');
    expect(classifyError(new Error('Worker init timeout'))).toBe('timeout');
    expect(classifyError(new WebAssembly.CompileError('bad module'))).toBe('wasm');
    expect(classifyError(new Error('IndexedDB quota exceeded'))).toBe('storage');
    expect(classifyError(new Error('something else'))).toBe('unknown');
  });
});

describe('allowsTelemetry', () => {
  it('honors Global Privacy Control and Do Not Track', () => {
    expect(allowsTelemetry({ globalPrivacyControl: true })).toBe(false);
    expect(allowsTelemetry({ doNotTrack: '1' })).toBe(false);
    expect(allowsTelemetry({ doNotTrack: '0' })).toBe(true);
    expect(allowsTelemetry(null)).toBe(true);
  });
});
