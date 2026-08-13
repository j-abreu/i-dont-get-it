import {
  createRejection,
  MAX_PAGE_TITLE_CHARACTERS,
  MAX_SELECTION_CHARACTERS,
  normalizeReadableText,
  truncateContextText,
  type PageMetadata,
  type SelectionCaptureResult,
  type SelectionContext,
} from '../shared/selection';

const CONTENT_BLOCK_SELECTOR = 'p, li, blockquote, pre, td, th, dd, dt, h1, h2, h3, h4, h5, h6';
const HEADING_SELECTOR = 'h1, h2, h3, h4, h5, h6';
const DOCUMENT_POSITION_FOLLOWING = 4;
const NON_PROSE_CONTAINER_SELECTOR =
  'nav, aside, footer, [role="navigation"], [role="banner"], [role="contentinfo"]';
const MAX_LINK_TEXT_RATIO = 0.5;

type CaptureOptions = {
  document: Document;
  selection: Selection | null;
  pageUrl: string;
  browserLanguage?: string;
};

export function captureSelectionSnapshot(options: CaptureOptions): SelectionCaptureResult {
  const page = extractPageMetadata(options);
  const { document, selection } = options;

  if (isEditableSelection(document, selection)) {
    return createRejection('editable-selection', page);
  }

  const selectedText = normalizeReadableText(selection?.toString() ?? '');

  if (selectedText.length === 0) {
    return createRejection('empty-selection', page);
  }

  if (selectedText.length > MAX_SELECTION_CHARACTERS) {
    return createRejection('selection-too-long', page);
  }

  if (selection === null || selection.rangeCount === 0) {
    return createRejection('selection-unavailable', page);
  }

  let range: Range;

  try {
    range = selection.getRangeAt(0);
  } catch {
    return createRejection('selection-unavailable', page);
  }

  return {
    status: 'captured',
    source: 'dom',
    snapshot: {
      selectedText,
      context: extractSelectionContext(document, range, selectedText),
      page,
    },
  };
}

export function sanitizePageUrl(value: string): Pick<PageMetadata, 'url' | 'hostname'> {
  try {
    const url = new URL(value);
    url.username = '';
    url.password = '';
    url.search = '';
    url.hash = '';

    return {
      url: url.toString(),
      hostname: url.hostname,
    };
  } catch {
    return { url: '', hostname: '' };
  }
}

function extractPageMetadata(options: CaptureOptions): PageMetadata {
  const location = sanitizePageUrl(options.pageUrl);
  const title = normalizeReadableText(options.document.title).slice(0, MAX_PAGE_TITLE_CHARACTERS);
  const language =
    normalizeReadableText(options.document.documentElement.lang) ||
    normalizeReadableText(options.browserLanguage ?? '') ||
    undefined;

  return {
    title,
    ...location,
    ...(language === undefined ? {} : { language }),
  };
}

function extractSelectionContext(
  document: Document,
  range: Range,
  selectedText: string,
): SelectionContext {
  const blocks = getVisibleContentBlocks(document);
  const startBlock = findClosestContentBlock(range.startContainer);
  const endBlock = findClosestContentBlock(range.endContainer);
  const startIndex = startBlock === null ? -1 : blocks.indexOf(startBlock);
  const endIndex = endBlock === null ? startIndex : blocks.indexOf(endBlock);
  const firstIndex = startIndex < 0 ? -1 : Math.min(startIndex, endIndex < 0 ? startIndex : endIndex);
  const lastIndex = startIndex < 0 ? -1 : Math.max(startIndex, endIndex < 0 ? startIndex : endIndex);
  const selectedBlocks =
    firstIndex < 0 ? [] : blocks.slice(firstIndex, lastIndex + 1).map((block) => block.textContent ?? '');
  const containingBlock = truncateContextText(joinUniqueBlocks(selectedBlocks) || selectedText);
  const heading = startBlock === null ? undefined : findNearestHeading(document, startBlock);
  const before = findAdjacentProse(blocks, firstIndex, -1);
  const after = findAdjacentProse(blocks, lastIndex, 1);

  return {
    ...(heading === undefined ? {} : { heading }),
    containingBlock,
    ...(before === undefined ? {} : { before }),
    ...(after === undefined ? {} : { after }),
  };
}

function findAdjacentProse(
  blocks: Element[],
  selectedBoundaryIndex: number,
  direction: -1 | 1,
): string | undefined {
  if (selectedBoundaryIndex < 0) {
    return undefined;
  }

  for (
    let index = selectedBoundaryIndex + direction;
    index >= 0 && index < blocks.length;
    index += direction
  ) {
    const candidate = blocks[index];

    if (candidate === undefined || candidate.matches(HEADING_SELECTOR)) {
      return undefined;
    }

    if (isProseContextBlock(candidate)) {
      return getBlockText(candidate);
    }
  }

  return undefined;
}

function isProseContextBlock(element: Element): boolean {
  if (element.closest(NON_PROSE_CONTAINER_SELECTOR) !== null) {
    return false;
  }

  const text = normalizeReadableText(element.textContent ?? '');

  if (text.length === 0) {
    return false;
  }

  const linkedTextLength = Array.from(element.querySelectorAll('a')).reduce(
    (total, link) => total + normalizeReadableText(link.textContent ?? '').length,
    0,
  );

  return linkedTextLength / text.length <= MAX_LINK_TEXT_RATIO;
}

function getVisibleContentBlocks(document: Document): Element[] {
  return Array.from(document.querySelectorAll(CONTENT_BLOCK_SELECTOR)).filter(
    (element) => !isHidden(element) && getBlockText(element) !== undefined,
  );
}

function findClosestContentBlock(node: Node): Element | null {
  const element = node.nodeType === 1 ? (node as Element) : node.parentElement;
  return element?.closest(CONTENT_BLOCK_SELECTOR) ?? null;
}

function findNearestHeading(document: Document, block: Element): string | undefined {
  if (block.matches(HEADING_SELECTOR)) {
    return getBlockText(block);
  }

  let nearest: string | undefined;

  for (const heading of document.querySelectorAll(HEADING_SELECTOR)) {
    if (isHidden(heading)) {
      continue;
    }

    const position = heading.compareDocumentPosition(block);

    if ((position & DOCUMENT_POSITION_FOLLOWING) !== 0) {
      nearest = getBlockText(heading) ?? nearest;
    }
  }

  return nearest;
}

function getBlockText(element: Element | undefined): string | undefined {
  if (element === undefined) {
    return undefined;
  }

  const text = truncateContextText(element.textContent ?? '');
  return text.length === 0 ? undefined : text;
}

function joinUniqueBlocks(values: string[]): string {
  const unique: string[] = [];

  for (const value of values) {
    const normalized = normalizeReadableText(value);

    if (normalized.length > 0 && unique.at(-1) !== normalized) {
      unique.push(normalized);
    }
  }

  return unique.join('\n\n');
}

function isEditableSelection(document: Document, selection: Selection | null): boolean {
  const selectedNodes = [selection?.anchorNode, selection?.focusNode].filter(
    (node): node is Node => node !== null && node !== undefined,
  );

  if (selectedNodes.some(isInsideEditableElement)) {
    return true;
  }

  return selectedNodes.length === 0 && isInsideEditableElement(document.activeElement);
}

function isInsideEditableElement(node: Node | null): boolean {
  if (node === null) {
    return false;
  }

  const element = node.nodeType === 1 ? (node as Element) : node.parentElement;

  return Boolean(
    element?.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])'),
  );
}

function isHidden(element: Element): boolean {
  let current: Element | null = element;

  while (current !== null) {
    const htmlElement = current as HTMLElement;

    if (
      htmlElement.hidden ||
      current.getAttribute('aria-hidden') === 'true' ||
      htmlElement.style?.display === 'none' ||
      htmlElement.style?.visibility === 'hidden'
    ) {
      return true;
    }

    current = current.parentElement;
  }

  return false;
}
