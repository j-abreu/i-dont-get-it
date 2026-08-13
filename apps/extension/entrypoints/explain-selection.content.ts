import {
  getSelectionAnchorRect,
  mountExplanationCard,
} from '../src/content/explanation-card';
import { generateMockExplanation } from '../src/content/mock-explanation';
import { captureSelectionSnapshot } from '../src/content/selection-snapshot';
import type { SelectionCaptureResult } from '../src/shared/selection';

export default defineContentScript({
  registration: 'runtime',
  main(): SelectionCaptureResult {
    const selection = window.getSelection();
    const anchorRect = getSelectionAnchorRect(selection);
    const result = captureSelectionSnapshot({
      document,
      selection,
      pageUrl: window.location.href,
      browserLanguage: navigator.language,
    });

    if (result.status === 'captured') {
      mountExplanationCard({
        document,
        snapshot: result.snapshot,
        anchorRect,
        explain: generateMockExplanation,
      });
    }

    return result;
  },
});
