import type { ExplanationLevel } from '@i-dont-get-it/contracts';

import type { SelectionSnapshot } from '../shared/selection';

export type Explanation = {
  text: string;
};

export type ExplanationRequestOptions = {
  level: ExplanationLevel;
};

export type ExplanationProvider = (
  snapshot: SelectionSnapshot,
  options: ExplanationRequestOptions,
) => Promise<Explanation>;
