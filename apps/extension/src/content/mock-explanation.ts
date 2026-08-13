import type { SelectionSnapshot } from '../shared/selection';

export type Explanation = {
  text: string;
};

export type ExplanationProvider = (snapshot: SelectionSnapshot) => Promise<Explanation>;

const MOCK_DELAY_MS = 350;

export const generateMockExplanation: ExplanationProvider = async (snapshot) => {
  await delay(MOCK_DELAY_MS);

  const subject = snapshot.context.heading ?? snapshot.page.title ?? 'this passage';

  return {
    text: `In the context of ${subject}, “${snapshot.selectedText}” describes the role or idea expressed by the surrounding passage. This is a mocked explanation; a later slice will replace it with a model-generated response.`,
  };
};

function delay(duration: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, duration);
  });
}
