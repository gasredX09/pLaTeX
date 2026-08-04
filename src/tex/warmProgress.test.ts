import { describe, expect, it } from 'vitest';
import { warmMilestone } from './warmProgress.js';

describe('warmMilestone', () => {
  it('recognizes network and cache paths', () => {
    expect(warmMilestone('WASM fetched in 100ms, compiled in 50ms')).toEqual({
      percent: 70,
      detail: 'TeX engine downloaded and compiled',
    });
    expect(warmMilestone('WASM loaded from cache in 12ms')).toEqual({
      percent: 70,
      detail: 'TeX engine restored from browser storage',
    });
  });

  it('ignores unrelated compiler logs', () => {
    expect(warmMilestone('Required bundles: core')).toBeNull();
  });
});
