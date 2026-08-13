import { describe, expect, it } from 'vitest';

import { isSupportedPageUrl } from '../src/background/page-support';

describe('isSupportedPageUrl', () => {
  it.each(['https://example.com/article', 'http://localhost:3000/test'])('%s is supported', (url) => {
    expect(isSupportedPageUrl(url)).toBe(true);
  });

  it.each([
    undefined,
    'not a URL',
    'chrome://extensions',
    'about:blank',
    'file:///tmp/article.html',
    'chrome-extension://extension-id/page.html',
  ])('%s is not supported', (url) => {
    expect(isSupportedPageUrl(url)).toBe(false);
  });
});
