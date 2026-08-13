import type { InjectionReadiness } from '../src/shared/injection';

export default defineContentScript({
  registration: 'runtime',
  main(): InjectionReadiness {
    const selection = window.getSelection();
    const selectionLength = selection?.toString().length ?? 0;

    return {
      status: 'ready',
      pageOrigin: window.location.origin,
      selectionDetected: selectionLength > 0 && selection?.isCollapsed === false,
      selectionLength,
    };
  },
});
