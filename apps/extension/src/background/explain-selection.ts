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

  await injectExplainSelection({
    tab,
    targetUrl,
    target: tab?.id === undefined ? undefined : { tabId: tab.id, frameIds: [info.frameId ?? 0] },
    fallbackSelectionText: info.selectionText,
  });
}

export async function handleExplainSelectionCommand(): Promise<void> {
  let tab: Browser.tabs.Tab | undefined;

  try {
    [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  } catch (error: unknown) {
    console.warn(`${EXTENSION_NAME} could not find the active tab`, error);
    return;
  }

  await injectExplainSelection({
    tab,
    targetUrl: tab?.url,
    target: tab?.id === undefined ? undefined : { tabId: tab.id, allFrames: true },
  });
}

type ExplainSelectionTarget =
  | { tabId: number; frameIds: number[] }
  | { tabId: number; allFrames: true };

type InjectExplainSelectionOptions = {
  tab: Browser.tabs.Tab | undefined;
  targetUrl: string | undefined;
  target: ExplainSelectionTarget | undefined;
  fallbackSelectionText?: string;
};

async function injectExplainSelection(options: InjectExplainSelectionOptions): Promise<void> {
  const { tab, targetUrl, target } = options;

  if (tab?.id === undefined || target === undefined || !isSupportedPageUrl(targetUrl)) {
    console.warn(`${EXTENSION_NAME} cannot run on this page`, {
      pageProtocol: getProtocol(targetUrl),
    });
    return;
  }

  try {
    const results = await browser.scripting.executeScript<[], SelectionCaptureResult>({
      target,
      files: [EXPLAIN_SELECTION_ENTRYPOINT],
    });
    const validResults = results.filter(
      (entry): entry is typeof entry & { result: SelectionCaptureResult } =>
        isSelectionCaptureResult(entry.result),
    );
    const injectedResult =
      validResults.find((entry) => entry.result.status === 'captured') ?? validResults[0];
    const rawResult = injectedResult?.result;

    if (!isSelectionCaptureResult(rawResult)) {
      console.warn(`${EXTENSION_NAME} content script returned an invalid selection result`);
      return;
    }

    const result = applyContextMenuFallback(rawResult, options.fallbackSelectionText);

    if (result.status === 'rejected') {
      console.warn(`${EXTENSION_NAME} selection was rejected`, {
        reason: result.reason,
        message: result.message,
      });
      return;
    }

    console.info(`${EXTENSION_NAME} captured a selection snapshot`, {
      tabId: tab.id,
      frameId: injectedResult?.frameId,
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
