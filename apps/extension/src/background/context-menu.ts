import { EXPLAIN_SELECTION_MENU_ID } from '../shared/menu';

export async function registerExplainSelectionMenu(): Promise<void> {
  await browser.contextMenus.removeAll();

  browser.contextMenus.create({
    id: EXPLAIN_SELECTION_MENU_ID,
    title: "I don't get it!",
    contexts: ['selection'],
  });
}
