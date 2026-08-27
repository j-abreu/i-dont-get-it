import {
  isExplainSuccessResponse,
  type ExplainResponse,
} from '@i-dont-get-it/contracts';

import type { EvaluationCase, EvaluationCheck } from './types.js';

export function scoreResponse(
  evaluationCase: EvaluationCase,
  response: ExplainResponse,
): EvaluationCheck[] {
  if (!isExplainSuccessResponse(response)) {
    return [
      {
        name: 'successful structured response',
        passed: false,
        detail: response.error.code,
      },
    ];
  }

  const { explanation } = response;
  const prose = `${explanation.definition}\n${explanation.contextualMeaning}`.toLocaleLowerCase();
  const forbiddenPhrases = evaluationCase.expectations.forbiddenPhrases ?? [];
  const mustMentionAny = evaluationCase.expectations.mustMentionAny ?? [];

  return [
    { name: 'successful structured response', passed: true },
    {
      name: 'definition and context are not identical',
      passed:
        explanation.definition.trim().toLocaleLowerCase() !==
        explanation.contextualMeaning.trim().toLocaleLowerCase(),
    },
    {
      name: 'forbidden phrases absent',
      passed: forbiddenPhrases.every((phrase) => !prose.includes(phrase.toLocaleLowerCase())),
      detail: forbiddenPhrases.length === 0 ? undefined : forbiddenPhrases.join(', '),
    },
    {
      name: 'expected concept appears',
      passed:
        mustMentionAny.length === 0 ||
        mustMentionAny.some((phrase) => prose.includes(phrase.toLocaleLowerCase())),
      detail: mustMentionAny.length === 0 ? undefined : mustMentionAny.join(' | '),
    },
    {
      name: 'synonym applicability',
      passed:
        evaluationCase.expectations.synonyms === 'allowed' || explanation.synonyms.length === 0,
      detail: evaluationCase.expectations.synonyms,
    },
  ];
}

