export const EXPLAIN_SELECTION_ENTRYPOINT = '/content-scripts/explain-selection.js';

export type InjectionReadiness = {
  status: 'ready';
  pageOrigin: string;
  selectionDetected: boolean;
  selectionLength: number;
};

export function isInjectionReadiness(value: unknown): value is InjectionReadiness {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Partial<InjectionReadiness>;

  return (
    candidate.status === 'ready' &&
    typeof candidate.pageOrigin === 'string' &&
    typeof candidate.selectionDetected === 'boolean' &&
    typeof candidate.selectionLength === 'number'
  );
}
