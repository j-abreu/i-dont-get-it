import { defineConfig } from 'wxt';

import { EXTENSION_DESCRIPTION, EXTENSION_NAME } from './src/shared/extension-info';

export default defineConfig({
  manifestVersion: 3,
  manifest: {
    name: EXTENSION_NAME,
    description: EXTENSION_DESCRIPTION,
    permissions: ['activeTab', 'contextMenus', 'scripting'],
    host_permissions: ['http://127.0.0.1:8787/*'],
  },
});
