import type { SelectionSnapshot } from '../shared/selection';

export type Explanation = {
  text: string;
};

export type ExplanationProvider = (snapshot: SelectionSnapshot) => Promise<Explanation>;
