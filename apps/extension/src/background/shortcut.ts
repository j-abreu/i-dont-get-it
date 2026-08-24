import { EXTENSION_NAME } from '../shared/extension-info';
import { EXPLAIN_SELECTION_COMMAND_ID } from '../shared/commands';

export async function warnIfExplainSelectionShortcutIsUnassigned(): Promise<void> {
  try {
    const commands = await browser.commands.getAll();
    const command = commands.find(({ name }) => name === EXPLAIN_SELECTION_COMMAND_ID);

    if (command?.shortcut === '') {
      console.warn(
        `${EXTENSION_NAME} keyboard shortcut is unassigned; configure it at chrome://extensions/shortcuts`,
      );
    }
  } catch (error: unknown) {
    console.warn(`${EXTENSION_NAME} could not inspect its keyboard shortcut`, error);
  }
}
