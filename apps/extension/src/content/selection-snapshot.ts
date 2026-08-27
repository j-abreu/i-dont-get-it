import {
  createRejection,
  MAX_CONTEXT_BLOCK_CHARACTERS,
  MAX_PAGE_TITLE_CHARACTERS,
  MAX_SELECTION_CHARACTERS,
  normalizeReadableText,
  truncateContextText,
  type PageMetadata,
  type SelectionCaptureResult,
  type SelectionContext,
} from '../shared/selection';

const CONTENT_BLOCK_SELECTOR =
  'p, li, blockquote, pre, td, th, dd, dt, h1, h2, h3, h4, h5, h6, [contenteditable]:not([contenteditable="false"])';
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
  const textControl = findSelectedTextControl(document, selection);

  if (textControl !== null) {
    if (textControl instanceof HTMLInputElement && textControl.type === 'password') {
      return createRejection('editable-selection', page);
    }

    return captureTextControlSelection(document, textControl, page);
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

function captureTextControlSelection(
  document: Document,
  control: HTMLInputElement | HTMLTextAreaElement,
  page: PageMetadata,
): SelectionCaptureResult {
  const start = control.selectionStart;
  const end = control.selectionEnd;

  if (start === null || end === null || start === end) {
    return createRejection('empty-selection', page);
  }

  const selectedText = normalizeReadableText(
    control.value.slice(Math.min(start, end), Math.max(start, end)),
  );

  if (selectedText.length === 0) {
    return createRejection('empty-selection', page);
  }

  if (selectedText.length > MAX_SELECTION_CHARACTERS) {
    return createRejection('selection-too-long', page);
  }

  const heading = findNearestHeading(document, control);
  const selectionStart = Math.min(start, end);
  const selectionEnd = Math.max(start, end);

  return {
    status: 'captured',
    source: 'editable',
    snapshot: {
      selectedText,
      context: {
        immediate: extractImmediateContext(control.value, selectionStart, selectionEnd),
        ...(heading === undefined ? {} : { heading }),
        containingBlock: truncateContextAroundSelection(
          control.value,
          selectionStart,
          selectionEnd,
        ),
      },
      page,
    },
  };
}

export function extractPageHostname(value: string): string {
  try {
    return new URL(value).hostname;
  } catch {
    return '';
  }
}

function extractPageMetadata(options: CaptureOptions): PageMetadata {
  const title = normalizeReadableText(options.document.title).slice(0, MAX_PAGE_TITLE_CHARACTERS);
  const language =
    normalizeReadableText(options.document.documentElement.lang) ||
    normalizeReadableText(options.browserLanguage ?? '') ||
    undefined;

  return {
    title,
    hostname: extractPageHostname(options.pageUrl),
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
  const isSingleBlock = startBlock !== null && startBlock === endBlock;
  const blockText = isSingleBlock ? startBlock.textContent ?? '' : '';
  const rangeOffsets = isSingleBlock ? getRangeOffsetsInBlock(document, range, startBlock) : undefined;
  const containingBlock =
    rangeOffsets === undefined
      ? truncateContextText(joinUniqueBlocks(selectedBlocks) || selectedText)
      : truncateContextAroundSelection(blockText, rangeOffsets.start, rangeOffsets.end);
  const immediate =
    rangeOffsets === undefined
      ? truncateContextText(selectedText)
      : extractImmediateContext(blockText, rangeOffsets.start, rangeOffsets.end);
  const heading = startBlock === null ? undefined : findNearestHeading(document, startBlock);
  const before = findAdjacentProse(blocks, firstIndex, -1);
  const after = findAdjacentProse(blocks, lastIndex, 1);

  return {
    immediate,
    ...(heading === undefined ? {} : { heading }),
    containingBlock,
    ...(before === undefined ? {} : { before }),
    ...(after === undefined ? {} : { after }),
  };
}

function getRangeOffsetsInBlock(
  document: Document,
  range: Range,
  block: Element,
): { start: number; end: number } | undefined {
  try {
    const beforeStart = document.createRange();
    beforeStart.selectNodeContents(block);
    beforeStart.setEnd(range.startContainer, range.startOffset);
    const beforeEnd = document.createRange();
    beforeEnd.selectNodeContents(block);
    beforeEnd.setEnd(range.endContainer, range.endOffset);

    return {
      start: beforeStart.toString().length,
      end: beforeEnd.toString().length,
    };
  } catch {
    return undefined;
  }
}

export function extractImmediateContext(value: string, selectionStart: number, selectionEnd: number): string {
  const start = Math.max(0, Math.min(selectionStart, value.length));
  const end = Math.max(start, Math.min(selectionEnd, value.length));
  const sentenceBoundary = /[.!?。！？](?:["'”’)]|\[[^\]]+\])*(?:\s+|$)/g;
  let sentenceStart = 0;
  let sentenceEnd = value.length;

  for (const match of value.matchAll(sentenceBoundary)) {
    const boundaryStart = match.index;
    const boundaryEnd = boundaryStart + match[0].length;

    if (boundaryEnd <= start) {
      sentenceStart = boundaryEnd;
      continue;
    }

    if (boundaryStart >= end) {
      sentenceEnd = boundaryEnd;
      break;
    }
  }

  return truncateContextAroundSelection(
    value.slice(sentenceStart, sentenceEnd),
    start - sentenceStart,
    end - sentenceStart,
  );
}

function truncateContextAroundSelection(value: string, selectionStart: number, selectionEnd: number): string {
  const before = normalizeReadableText(value.slice(0, selectionStart));
  const selected = normalizeReadableText(value.slice(selectionStart, selectionEnd));
  const after = normalizeReadableText(value.slice(selectionEnd));
  const complete = [before, selected, after].filter(Boolean).join(' ');

  if (complete.length <= MAX_CONTEXT_BLOCK_CHARACTERS) {
    return complete;
  }

  if (selected.length >= MAX_CONTEXT_BLOCK_CHARACTERS) {
    return truncateContextText(selected);
  }

  const markerBudget = (before.length > 0 ? 1 : 0) + (after.length > 0 ? 1 : 0);
  const separatorBudget = (before.length > 0 ? 1 : 0) + (after.length > 0 ? 1 : 0);
  const surroundingBudget = Math.max(
    0,
    MAX_CONTEXT_BLOCK_CHARACTERS - selected.length - markerBudget - separatorBudget,
  );
  const beforeBudget = Math.min(before.length, Math.floor(surroundingBudget / 2));
  const afterBudget = Math.min(after.length, surroundingBudget - beforeBudget);
  const boundedBefore = before.slice(before.length - beforeBudget).trimStart();
  const boundedAfter = after.slice(0, afterBudget).trimEnd();

  return [
    boundedBefore.length === 0 ? undefined : `${beforeBudget < before.length ? '…' : ''}${boundedBefore}`,
    selected,
    boundedAfter.length === 0 ? undefined : `${boundedAfter}${afterBudget < after.length ? '…' : ''}`,
  ]
    .filter((part): part is string => part !== undefined && part.length > 0)
    .join(' ');
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

function findSelectedTextControl(
  document: Document,
  selection: Selection | null,
): HTMLInputElement | HTMLTextAreaElement | null {
  const selectedNodes = [selection?.anchorNode, selection?.focusNode].filter(
    (node): node is Node => node !== null && node !== undefined,
  );
  const hasDomSelection = normalizeReadableText(selection?.toString() ?? '').length > 0;
  const candidates = [
    ...selectedNodes,
    ...(hasDomSelection ? [] : [document.activeElement]),
  ].filter(
    (node): node is Node => node !== null,
  );

  for (const node of candidates) {
    const element = node.nodeType === 1 ? (node as Element) : node.parentElement;
    const control = element?.closest('input, textarea');

    if (
      control instanceof HTMLTextAreaElement ||
      (control instanceof HTMLInputElement && isSelectableTextInput(control))
    ) {
      return control;
    }
  }

  return null;
}

function isSelectableTextInput(input: HTMLInputElement): boolean {
  return ['text', 'search', 'url', 'tel', 'email', 'password'].includes(input.type);
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
