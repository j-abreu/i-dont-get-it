import { afterEach, describe, expect, it, vi } from 'vitest';

import { registerExplainSelectionMenu } from '../src/background/context-menu';
import { EXPLAIN_SELECTION_MENU_ID } from '../src/shared/menu';

describe('registerExplainSelectionMenu', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('replaces existing items with one selection-only action', async () => {
    const removeAll = vi.fn().mockResolvedValue(undefined);
    const create = vi.fn();
    vi.stubGlobal('browser', {
      contextMenus: { removeAll, create },
    });

    await registerExplainSelectionMenu();

    expect(removeAll).toHaveBeenCalledOnce();
    expect(create).toHaveBeenCalledWith({
      id: EXPLAIN_SELECTION_MENU_ID,
      title: 'Explain selection',
      contexts: ['selection'],
    });
    expect(removeAll.mock.invocationCallOrder[0]).toBeLessThan(create.mock.invocationCallOrder[0] ?? 0);
  });
});
