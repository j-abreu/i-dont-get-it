import { afterEach, describe, expect, it, vi } from 'vitest';

import { handleExplainSelectionClick } from '../src/background/explain-selection';
import { EXPLAIN_SELECTION_ENTRYPOINT } from '../src/shared/injection';

const SUPPORTED_TAB = {
  id: 42,
  url: 'https://example.com/article',
} as Browser.tabs.Tab;

describe('handleExplainSelectionClick', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('injects the runtime content script into the selected frame', async () => {
    const executeScript = vi.fn().mockResolvedValue([
      {
        frameId: 7,
        result: {
          status: 'ready',
          pageOrigin: 'https://example.com',
          selectionDetected: true,
          selectionLength: 12,
        },
      },
    ]);
    vi.stubGlobal('browser', { scripting: { executeScript } });
    vi.spyOn(console, 'info').mockImplementation(() => undefined);

    await handleExplainSelectionClick(
      {
        editable: false,
        frameId: 7,
        frameUrl: 'https://example.com/embed',
        menuItemId: 'explain-selection',
        selectionText: 'selected text',
      },
      SUPPORTED_TAB,
    );

    expect(executeScript).toHaveBeenCalledWith({
      target: { tabId: 42, frameIds: [7] },
      files: [EXPLAIN_SELECTION_ENTRYPOINT],
    });
  });

  it('declines unsupported pages without attempting injection', async () => {
    const executeScript = vi.fn();
    vi.stubGlobal('browser', { scripting: { executeScript } });
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    await expect(
      handleExplainSelectionClick(
        {
          editable: false,
          menuItemId: 'explain-selection',
          pageUrl: 'chrome://extensions',
          selectionText: 'selected text',
        },
        { ...SUPPORTED_TAB, url: 'chrome://extensions' },
      ),
    ).resolves.toBeUndefined();

    expect(executeScript).not.toHaveBeenCalled();
  });

  it('contains browser injection failures', async () => {
    const executeScript = vi.fn().mockRejectedValue(new Error('Cannot access this page'));
    vi.stubGlobal('browser', { scripting: { executeScript } });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    await expect(
      handleExplainSelectionClick(
        {
          editable: false,
          menuItemId: 'explain-selection',
          pageUrl: 'https://example.com/article',
          selectionText: 'selected text',
        },
        SUPPORTED_TAB,
      ),
    ).resolves.toBeUndefined();

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('could not inject'),
      expect.any(Error),
    );
  });
});
