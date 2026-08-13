export const EXPLANATION_CONTRACT_VERSION = 1 as const;

export const EXPLANATION_LEVELS = ['concise', 'simple', 'detailed'] as const;
export type ExplanationLevel = (typeof EXPLANATION_LEVELS)[number];

export type ExplanationSelectionSnapshot = {
  selectedText: string;
  context: {
    heading?: string;
    containingBlock: string;
    before?: string;
    after?: string;
  };
  page: {
    title: string;
    url: string;
    hostname: string;
    language?: string;
  };
};

export type ExplainRequest = {
  version: typeof EXPLANATION_CONTRACT_VERSION;
  selection: ExplanationSelectionSnapshot;
  preferences: {
    level: ExplanationLevel;
    responseLanguage?: string;
  };
};

export type ExplainSuccessResponse = {
  version: typeof EXPLANATION_CONTRACT_VERSION;
  requestId: string;
  explanation: {
    text: string;
  };
};

export const EXPLAIN_ERROR_CODES = [
  'invalid_request',
  'service_unavailable',
  'timeout',
  'internal_error',
] as const;

export type ExplainErrorCode = (typeof EXPLAIN_ERROR_CODES)[number];

export type ExplainErrorResponse = {
  version: typeof EXPLANATION_CONTRACT_VERSION;
  requestId?: string;
  error: {
    code: ExplainErrorCode;
    message: string;
    retryable: boolean;
  };
};

export type ExplainResponse = ExplainSuccessResponse | ExplainErrorResponse;

const LIMITS = {
  selectedText: 5_000,
  contextBlock: 2_000,
  pageTitle: 500,
  language: 100,
  url: 2_048,
  hostname: 253,
  explanation: 20_000,
  requestId: 200,
} as const;

export function isExplainRequest(value: unknown): value is ExplainRequest {
  if (!isRecord(value) || value.version !== EXPLANATION_CONTRACT_VERSION) {
    return false;
  }

  const selection = value.selection;
  const preferences = value.preferences;

  if (!isRecord(selection) || !isRecord(preferences)) {
    return false;
  }

  const context = selection.context;
  const page = selection.page;

  return (
    isBoundedString(selection.selectedText, 1, LIMITS.selectedText) &&
    isRecord(context) &&
    isBoundedString(context.containingBlock, 1, LIMITS.contextBlock) &&
    isOptionalBoundedString(context.heading, LIMITS.contextBlock) &&
    isOptionalBoundedString(context.before, LIMITS.contextBlock) &&
    isOptionalBoundedString(context.after, LIMITS.contextBlock) &&
    isRecord(page) &&
    isBoundedString(page.title, 0, LIMITS.pageTitle) &&
    isBoundedString(page.url, 0, LIMITS.url) &&
    isBoundedString(page.hostname, 0, LIMITS.hostname) &&
    isOptionalBoundedString(page.language, LIMITS.language) &&
    EXPLANATION_LEVELS.includes(preferences.level as ExplanationLevel) &&
    isOptionalBoundedString(preferences.responseLanguage, LIMITS.language)
  );
}

export function isExplainResponse(value: unknown): value is ExplainResponse {
  if (!isRecord(value) || value.version !== EXPLANATION_CONTRACT_VERSION) {
    return false;
  }

  if ('explanation' in value) {
    return (
      isBoundedString(value.requestId, 1, LIMITS.requestId) &&
      isRecord(value.explanation) &&
      isBoundedString(value.explanation.text, 1, LIMITS.explanation)
    );
  }

  return (
    isOptionalBoundedString(value.requestId, LIMITS.requestId) &&
    isRecord(value.error) &&
    EXPLAIN_ERROR_CODES.includes(value.error.code as ExplainErrorCode) &&
    isBoundedString(value.error.message, 1, 500) &&
    typeof value.error.retryable === 'boolean'
  );
}

export function isExplainSuccessResponse(value: unknown): value is ExplainSuccessResponse {
  return isExplainResponse(value) && 'explanation' in value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isBoundedString(value: unknown, minimum: number, maximum: number): value is string {
  return typeof value === 'string' && value.length >= minimum && value.length <= maximum;
}

function isOptionalBoundedString(value: unknown, maximum: number): value is string | undefined {
  return value === undefined || isBoundedString(value, 0, maximum);
}
