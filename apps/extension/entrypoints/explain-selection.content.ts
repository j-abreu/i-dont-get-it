import { captureSelectionSnapshot } from '../src/content/selection-snapshot';
import type { SelectionCaptureResult } from '../src/shared/selection';

export default defineContentScript({
  registration: 'runtime',
  main(): SelectionCaptureResult {
    return captureSelectionSnapshot({
      document,
      selection: window.getSelection(),
      pageUrl: window.location.href,
      browserLanguage: navigator.language,
    });
  },
});
