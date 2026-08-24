import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  handleExplainSelectionClick,
  handleExplainSelectionCommand,
} from '../src/background/explain-selection';
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
          status: 'captured',
          source: 'dom',
          snapshot: {
            selectedText: 'selected text',
            context: { containingBlock: 'A paragraph with selected text.' },
            page: {
              title: 'Article',
              url: 'https://example.com/article',
              hostname: 'example.com',
              language: 'en',
            },
          },
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

  it('uses context-menu text when the DOM selection is no longer available', async () => {
    const executeScript = vi.fn().mockResolvedValue([
      {
        frameId: 0,
        result: {
          status: 'rejected',
          reason: 'empty-selection',
          message: 'Select some text before asking for an explanation.',
          page: {
            title: 'Article',
            url: 'https://example.com/article',
            hostname: 'example.com',
          },
        },
      },
    ]);
    vi.stubGlobal('browser', { scripting: { executeScript } });
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    vi.spyOn(console, 'debug').mockImplementation(() => undefined);

    await handleExplainSelectionClick(
      {
        editable: false,
        menuItemId: 'explain-selection',
        pageUrl: 'https://example.com/article',
        selectionText: '  selected   text  ',
      },
      SUPPORTED_TAB,
    );

    expect(info).toHaveBeenCalledWith(
      expect.stringContaining('captured a selection snapshot'),
      expect.objectContaining({ source: 'context-menu-fallback', selectedTextLength: 13 }),
    );
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

describe('handleExplainSelectionCommand', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('injects into accessible frames in the active tab and uses the captured selection', async () => {
    const query = vi.fn().mockResolvedValue([SUPPORTED_TAB]);
    const executeScript = vi.fn().mockResolvedValue([
      {
        frameId: 0,
        result: {
          status: 'rejected',
          reason: 'empty-selection',
          message: 'Select some text before asking for an explanation.',
          page: {
            title: 'Article',
            url: 'https://example.com/article',
            hostname: 'example.com',
          },
        },
      },
      {
        frameId: 7,
        result: {
          status: 'captured',
          source: 'dom',
          snapshot: {
            selectedText: 'selected iframe text',
            context: { containingBlock: 'A paragraph with selected iframe text.' },
            page: {
              title: 'Embedded article',
              url: 'https://example.com/embed',
              hostname: 'example.com',
              language: 'en',
            },
          },
        },
      },
    ]);
    vi.stubGlobal('browser', { tabs: { query }, scripting: { executeScript } });
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined);

    await handleExplainSelectionCommand();

    expect(query).toHaveBeenCalledWith({ active: true, currentWindow: true });
    expect(executeScript).toHaveBeenCalledWith({
      target: { tabId: 42, allFrames: true },
      files: [EXPLAIN_SELECTION_ENTRYPOINT],
    });
    expect(info).toHaveBeenCalledWith(
      expect.stringContaining('captured a selection snapshot'),
      expect.objectContaining({ frameId: 7, selectedTextLength: 20 }),
    );
  });

  it('contains active-tab lookup failures', async () => {
    const query = vi.fn().mockRejectedValue(new Error('Tabs unavailable'));
    vi.stubGlobal('browser', { tabs: { query } });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    await expect(handleExplainSelectionCommand()).resolves.toBeUndefined();

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('could not find the active tab'),
      expect.any(Error),
    );
  });
});
