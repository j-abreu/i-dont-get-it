import { isSupportedPageUrl } from './page-support';
import { EXPLAIN_SELECTION_ENTRYPOINT } from '../shared/injection';
import { EXTENSION_NAME } from '../shared/extension-info';
import {
  applyContextMenuFallback,
  isSelectionCaptureResult,
  type SelectionCaptureResult,
} from '../shared/selection';

export async function handleExplainSelectionClick(
  info: Browser.contextMenus.OnClickData,
  tab: Browser.tabs.Tab | undefined,
): Promise<void> {
  const targetUrl = info.frameUrl ?? info.pageUrl ?? tab?.url;

  if (tab?.id === undefined || !isSupportedPageUrl(targetUrl)) {
    console.warn(`${EXTENSION_NAME} cannot run on this page`, {
      pageProtocol: getProtocol(targetUrl),
    });
    return;
  }

  const targetFrameId = info.frameId ?? 0;

  try {
    const results = await browser.scripting.executeScript<[], SelectionCaptureResult>({
      target: {
        tabId: tab.id,
        frameIds: [targetFrameId],
      },
      files: [EXPLAIN_SELECTION_ENTRYPOINT],
    });
    const rawResult = results[0]?.result;

    if (!isSelectionCaptureResult(rawResult)) {
      console.warn(`${EXTENSION_NAME} content script returned an invalid selection result`);
      return;
    }

    const result = applyContextMenuFallback(rawResult, info.selectionText);

    if (result.status === 'rejected') {
      console.warn(`${EXTENSION_NAME} selection was rejected`, {
        reason: result.reason,
        message: result.message,
      });
      return;
    }

    console.info(`${EXTENSION_NAME} captured a selection snapshot`, {
      tabId: tab.id,
      frameId: targetFrameId,
      source: result.source,
      selectedTextLength: result.snapshot.selectedText.length,
      hostname: result.snapshot.page.hostname,
    });

    if (import.meta.env.DEV) {
      console.debug(`${EXTENSION_NAME} development selection snapshot`, result.snapshot);
    }
  } catch (error: unknown) {
    console.warn(`${EXTENSION_NAME} could not inject into this page`, error);
  }
}

function getProtocol(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  try {
    return new URL(value).protocol;
  } catch {
    return undefined;
  }
}
