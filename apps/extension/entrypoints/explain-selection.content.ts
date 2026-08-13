import {
  getSelectionAnchorRect,
  getSelectionSurfaceTone,
  mountExplanationCard,
} from '../src/content/explanation-card';
import { generateApiExplanation } from '../src/content/api-explanation';
import { captureSelectionSnapshot } from '../src/content/selection-snapshot';
import type { SelectionCaptureResult } from '../src/shared/selection';

export default defineContentScript({
  registration: 'runtime',
  main(): SelectionCaptureResult {
    const selection = window.getSelection();
    const anchorRect = getSelectionAnchorRect(selection, document);
    const surfaceTone = getSelectionSurfaceTone(document, selection);
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
        surfaceTone,
        explain: generateApiExplanation,
      });
    }

    return result;
  },
});
