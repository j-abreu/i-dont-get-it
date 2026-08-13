export const MAX_SELECTION_CHARACTERS = 5_000;
export const MAX_CONTEXT_BLOCK_CHARACTERS = 2_000;
export const MAX_PAGE_TITLE_CHARACTERS = 500;

export type PageMetadata = {
  title: string;
  url: string;
  hostname: string;
  language?: string;
};

export type SelectionContext = {
  heading?: string;
  containingBlock: string;
  before?: string;
  after?: string;
};

export type SelectionSnapshot = {
  selectedText: string;
  context: SelectionContext;
  page: PageMetadata;
};

export type SelectionRejectionReason =
  | 'editable-selection'
  | 'empty-selection'
  | 'selection-too-long'
  | 'selection-unavailable';

export type SelectionCaptureResult =
  | {
      status: 'captured';
      source: 'dom' | 'editable' | 'context-menu-fallback';
      snapshot: SelectionSnapshot;
    }
  | {
      status: 'rejected';
      reason: SelectionRejectionReason;
      message: string;
      page: PageMetadata;
    };

const REJECTION_MESSAGES: Record<SelectionRejectionReason, string> = {
  'editable-selection': 'Text selected in a sensitive editable field cannot be explained.',
  'empty-selection': 'Select some text before asking for an explanation.',
  'selection-too-long': `Selections can contain at most ${MAX_SELECTION_CHARACTERS.toLocaleString()} characters.`,
  'selection-unavailable': 'The selected text is no longer available on this page.',
};

export function normalizeReadableText(value: string): string {
  return value
    .replace(/\r\n?/g, '\n')
    .split(/\n+/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n\n');
}

export function truncateContextText(value: string): string {
  const normalized = normalizeReadableText(value);

  if (normalized.length <= MAX_CONTEXT_BLOCK_CHARACTERS) {
    return normalized;
  }

  return `${normalized.slice(0, MAX_CONTEXT_BLOCK_CHARACTERS - 1).trimEnd()}…`;
}

export function createRejection(
  reason: SelectionRejectionReason,
  page: PageMetadata,
): SelectionCaptureResult {
  return {
    status: 'rejected',
    reason,
    message: REJECTION_MESSAGES[reason],
    page,
  };
}

export function applyContextMenuFallback(
  result: SelectionCaptureResult,
  contextMenuSelection: string | undefined,
): SelectionCaptureResult {
  if (
    result.status === 'captured' ||
    result.reason === 'editable-selection' ||
    result.reason === 'selection-too-long'
  ) {
    return result;
  }

  const selectedText = normalizeReadableText(contextMenuSelection ?? '');

  if (selectedText.length === 0) {
    return result;
  }

  if (selectedText.length > MAX_SELECTION_CHARACTERS) {
    return createRejection('selection-too-long', result.page);
  }

  return {
    status: 'captured',
    source: 'context-menu-fallback',
    snapshot: {
      selectedText,
      context: {
        containingBlock: truncateContextText(selectedText),
      },
      page: result.page,
    },
  };
}

export function isSelectionCaptureResult(value: unknown): value is SelectionCaptureResult {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Partial<SelectionCaptureResult>;

  if (candidate.status === 'captured') {
    return (
      (candidate.source === 'dom' ||
        candidate.source === 'editable' ||
        candidate.source === 'context-menu-fallback') &&
      isSelectionSnapshot(candidate.snapshot)
    );
  }

  return (
    candidate.status === 'rejected' &&
    isSelectionRejectionReason(candidate.reason) &&
    typeof candidate.message === 'string' &&
    isPageMetadata(candidate.page)
  );
}

function isSelectionRejectionReason(value: unknown): value is SelectionRejectionReason {
  return (
    value === 'editable-selection' ||
    value === 'empty-selection' ||
    value === 'selection-too-long' ||
    value === 'selection-unavailable'
  );
}

function isSelectionSnapshot(value: unknown): value is SelectionSnapshot {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Partial<SelectionSnapshot>;

  return (
    typeof candidate.selectedText === 'string' &&
    isSelectionContext(candidate.context) &&
    isPageMetadata(candidate.page)
  );
}

function isSelectionContext(value: unknown): value is SelectionContext {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Partial<SelectionContext>;

  return (
    typeof candidate.containingBlock === 'string' &&
    isOptionalString(candidate.heading) &&
    isOptionalString(candidate.before) &&
    isOptionalString(candidate.after)
  );
}

function isPageMetadata(value: unknown): value is PageMetadata {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Partial<PageMetadata>;

  return (
    typeof candidate.title === 'string' &&
    typeof candidate.url === 'string' &&
    typeof candidate.hostname === 'string' &&
    isOptionalString(candidate.language)
  );
}

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === 'string';
}
