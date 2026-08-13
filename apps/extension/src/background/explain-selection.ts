import { isSupportedPageUrl } from './page-support';
import {
  EXPLAIN_SELECTION_ENTRYPOINT,
  isInjectionReadiness,
  type InjectionReadiness,
} from '../shared/injection';
import { EXTENSION_NAME } from '../shared/extension-info';

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
    const results = await browser.scripting.executeScript<[], InjectionReadiness>({
      target: {
        tabId: tab.id,
        frameIds: [targetFrameId],
      },
      files: [EXPLAIN_SELECTION_ENTRYPOINT],
    });
    const readiness = results[0]?.result;

    if (!isInjectionReadiness(readiness)) {
      console.warn(`${EXTENSION_NAME} content script returned an invalid readiness result`);
      return;
    }

    console.info(`${EXTENSION_NAME} content script is ready`, {
      tabId: tab.id,
      frameId: targetFrameId,
      contextMenuSelectionLength: info.selectionText?.length ?? 0,
      readiness,
    });
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
