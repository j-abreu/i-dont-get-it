import { registerExplainSelectionMenu } from '../src/background/context-menu';
import { handleExplainSelectionClick } from '../src/background/explain-selection';
import { registerExplanationMessageHandler } from '../src/background/explanation-messages';
import { EXTENSION_NAME } from '../src/shared/extension-info';
import { EXPLAIN_SELECTION_MENU_ID } from '../src/shared/menu';

export default defineBackground(() => {
  console.info(`${EXTENSION_NAME} background service worker started`);
  registerExplanationMessageHandler();

  const refreshContextMenu = () => {
    void registerExplainSelectionMenu().catch((error: unknown) => {
      console.warn(`${EXTENSION_NAME} could not register its context menu`, error);
    });
  };

  browser.runtime.onInstalled.addListener(refreshContextMenu);
  browser.runtime.onStartup.addListener(refreshContextMenu);

  browser.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId !== EXPLAIN_SELECTION_MENU_ID) {
      return;
    }

    void handleExplainSelectionClick(info, tab);
  });
});
