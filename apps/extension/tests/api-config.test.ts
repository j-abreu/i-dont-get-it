import { describe, expect, it } from 'vitest';

import {
  DEVELOPMENT_API_BASE_URL,
  getApiHostPermission,
  PRODUCTION_API_BASE_URL,
  resolveApiBaseUrl,
} from '../src/shared/api-config';

describe('API configuration', () => {
  it('selects separate development and production defaults', () => {
    expect(resolveApiBaseUrl('development', DEVELOPMENT_API_BASE_URL)).toBe(
      DEVELOPMENT_API_BASE_URL,
    );
    expect(resolveApiBaseUrl('production', PRODUCTION_API_BASE_URL)).toBe(
      PRODUCTION_API_BASE_URL,
    );
  });

  it('requires an explicit build-mode value', () => {
    expect(() => resolveApiBaseUrl('production')).toThrow('WXT_API_BASE_URL is required');
  });

  it('allows an HTTPS production origin override', () => {
    expect(resolveApiBaseUrl('production', 'https://staging.example.com')).toBe(
      'https://staging.example.com',
    );
    expect(getApiHostPermission('https://staging.example.com')).toBe(
      'https://staging.example.com/*',
    );
  });

  it.each([
    'http://api.example.com',
    'https://localhost:8787',
    'https://127.0.0.1:8787',
    'https://user:password@example.com',
    'https://api.example.com/path',
    'https://api.example.com?debug=true',
    'https://api.example.com/#fragment',
  ])('rejects unsafe production configuration: %s', (value) => {
    expect(() => resolveApiBaseUrl('production', value)).toThrow();
  });
});
