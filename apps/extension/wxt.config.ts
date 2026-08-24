import { defineConfig } from 'wxt';

import { getApiHostPermission, resolveApiBaseUrl } from './src/shared/api-config';
import {
  EXPLAIN_SELECTION_COMMAND_ID,
  EXPLAIN_SELECTION_SHORTCUTS,
} from './src/shared/commands';
import { EXTENSION_DESCRIPTION, EXTENSION_NAME } from './src/shared/extension-info';

export default defineConfig({
  manifestVersion: 3,
  manifest: ({ mode }) => {
    const apiBaseUrl = resolveApiBaseUrl(mode, process.env.WXT_API_BASE_URL);

    return {
      name: EXTENSION_NAME,
      description: EXTENSION_DESCRIPTION,
      icons: {
        16: 'icon/16.png',
        32: 'icon/32.png',
        48: 'icon/48.png',
        96: 'icon/96.png',
        128: 'icon/128.png',
      },
      commands: {
        [EXPLAIN_SELECTION_COMMAND_ID]: {
          suggested_key: EXPLAIN_SELECTION_SHORTCUTS,
          description: 'Explain the selected text.',
        },
      },
      permissions: ['activeTab', 'contextMenus', 'scripting'],
      host_permissions: [getApiHostPermission(apiBaseUrl)],
    };
  },
});
