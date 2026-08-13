import { describe, expect, it } from 'vitest';

import { isInjectionReadiness } from '../src/shared/injection';

describe('isInjectionReadiness', () => {
  it('accepts a valid runtime result', () => {
    expect(
      isInjectionReadiness({
        status: 'ready',
        pageOrigin: 'https://example.com',
        selectionDetected: true,
        selectionLength: 18,
      }),
    ).toBe(true);
  });

  it('rejects incomplete and unrelated results', () => {
    expect(isInjectionReadiness(undefined)).toBe(false);
    expect(isInjectionReadiness({ status: 'ready' })).toBe(false);
    expect(isInjectionReadiness({ status: 'failed' })).toBe(false);
  });
});
