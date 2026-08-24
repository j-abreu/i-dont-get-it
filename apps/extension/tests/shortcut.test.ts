import { afterEach, describe, expect, it, vi } from 'vitest';

import { warnIfExplainSelectionShortcutIsUnassigned } from '../src/background/shortcut';
import { EXPLAIN_SELECTION_COMMAND_ID } from '../src/shared/commands';

describe('warnIfExplainSelectionShortcutIsUnassigned', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('warns when Chrome could not assign the suggested shortcut', async () => {
    const getAll = vi.fn().mockResolvedValue([
      { name: EXPLAIN_SELECTION_COMMAND_ID, description: 'Explain the selected text.', shortcut: '' },
    ]);
    vi.stubGlobal('browser', { commands: { getAll } });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    await warnIfExplainSelectionShortcutIsUnassigned();

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('chrome://extensions/shortcuts'));
  });

  it('does not warn when the shortcut is assigned', async () => {
    const getAll = vi.fn().mockResolvedValue([
      {
        name: EXPLAIN_SELECTION_COMMAND_ID,
        description: 'Explain the selected text.',
        shortcut: 'Ctrl+Shift+Y',
      },
    ]);
    vi.stubGlobal('browser', { commands: { getAll } });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    await warnIfExplainSelectionShortcutIsUnassigned();

    expect(warn).not.toHaveBeenCalled();
  });
});
