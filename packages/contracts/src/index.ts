export const EXPLANATION_CONTRACT_VERSION = 2 as const;

export const EXPLANATION_LEVELS = ['concise', 'beginner', 'simple', 'detailed'] as const;
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
  explanation: StructuredExplanation;
};

export type StructuredExplanation = {
  definition: string;
  contextualMeaning: string;
  synonyms: string[];
};

export const STRUCTURED_EXPLANATION_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    definition: {
      type: 'string',
      minLength: 1,
      maxLength: 1_500,
      description:
        'Define or identify the selected passage independently of the page. For a named entity, state what it is. Do not describe only its role in the supplied context.',
    },
    contextualMeaning: {
      type: 'string',
      minLength: 1,
      maxLength: 4_000,
      description:
        'Explain what the selected passage means or does in its immediate context. Do not summarize unrelated page content.',
    },
    synonyms: {
      type: 'array',
      description:
        'Up to five true synonyms, aliases, abbreviations, or alternate names for the selected passage. Return an empty array when none apply. Do not return merely related concepts.',
      items: { type: 'string', minLength: 1, maxLength: 200 },
      maxItems: 5,
    },
  },
  required: ['definition', 'contextualMeaning', 'synonyms'],
} as const;

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
  definition: 1_500,
  contextualMeaning: 4_000,
  synonym: 200,
  synonyms: 5,
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
      isStructuredExplanation(value.explanation)
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

export function isStructuredExplanation(value: unknown): value is StructuredExplanation {
  if (!isRecord(value) || !hasExactlyKeys(value, ['definition', 'contextualMeaning', 'synonyms'])) {
    return false;
  }

  return (
    isBoundedString(value.definition, 1, LIMITS.definition) &&
    isBoundedString(value.contextualMeaning, 1, LIMITS.contextualMeaning) &&
    Array.isArray(value.synonyms) &&
    value.synonyms.length <= LIMITS.synonyms &&
    value.synonyms.every((synonym) => isBoundedString(synonym, 1, LIMITS.synonym))
  );
}

export function isExplainSuccessResponse(value: unknown): value is ExplainSuccessResponse {
  return isExplainResponse(value) && 'explanation' in value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasExactlyKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actualKeys = Object.keys(value);
  return actualKeys.length === keys.length && keys.every((key) => key in value);
}

function isBoundedString(value: unknown, minimum: number, maximum: number): value is string {
  return typeof value === 'string' && value.length >= minimum && value.length <= maximum;
}

function isOptionalBoundedString(value: unknown, maximum: number): value is string | undefined {
  return value === undefined || isBoundedString(value, 0, maximum);
}
