import { describe, expect, it } from 'vitest';

import { EXTENSION_DESCRIPTION, EXTENSION_NAME } from '../src/shared/extension-info';

describe('extension metadata', () => {
  it('provides user-facing name and description', () => {
    expect(EXTENSION_NAME).toBe('i-dont-get-it');
    expect(EXTENSION_DESCRIPTION).toContain('Explain selected text');
  });
});
