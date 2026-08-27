// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  calculateCardPosition,
  EXPLANATION_CARD_HOST_ID,
  getSelectionAnchorRect,
  getSelectionSurfaceTone,
  mountExplanationCard,
} from '../src/content/explanation-card';
import type { ExplanationProvider } from '../src/content/explanation-provider';
import type { SelectionSnapshot } from '../src/shared/selection';

describe('mountExplanationCard', () => {
  afterEach(() => {
    document.documentElement.replaceChildren(document.createElement('head'), document.createElement('body'));
    vi.restoreAllMocks();
  });

  it('renders loading and success inside an isolated shadow root', async () => {
    const explain = vi.fn<ExplanationProvider>().mockResolvedValue(
      structured('A standalone definition.', 'A contextual explanation.', ['representation']),
    );
    const controller = mountExplanationCard({
      document,
      snapshot: createSnapshot(),
      anchorRect: createAnchorRect(),
      explain,
    });
    const shadow = controller.host.shadowRoot!;

    expect(shadow.querySelector('[role="status"]')?.textContent).toContain('Preparing');
    expect(shadow.querySelector('.brand')?.textContent).toBe("I don't get it");
    expect(document.querySelector('.card')).toBeNull();

    await controller.settled;

    expect(shadow.querySelector('.definition p')?.textContent).toBe('A standalone definition.');
    expect(shadow.querySelector('.contextual-meaning p')?.textContent).toBe(
      'A contextual explanation.',
    );
    expect(shadow.querySelector('.synonyms')?.textContent).toContain('representation');
    expect(shadow.querySelector('.brand')?.textContent).toBe('Now you get it!');
    expect(shadow.querySelector('.eyebrow')?.textContent).toBe('Simple explanation');
    expect(shadow.querySelector('.beginner-action')?.textContent).toBe("Explain Like I'm 5");
    expect(shadow.querySelector('.detail-action')?.textContent).toBe('Explain in more detail');
    expect(shadow.querySelector('blockquote')?.textContent).toContain('contextual representation');
    expect(shadow.querySelector('details')?.textContent).toContain('How models learn');
    expect(explain).toHaveBeenCalledWith(createSnapshot(), { level: 'simple' });
  });

  it('renders an error and retries with the same snapshot', async () => {
    const explain = vi
      .fn<ExplanationProvider>()
      .mockRejectedValueOnce(new Error('temporary failure'))
      .mockResolvedValueOnce(structured('Recovered explanation.'));
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const controller = mountExplanationCard({
      document,
      snapshot: createSnapshot(),
      explain,
    });

    await controller.settled;
    const shadow = controller.host.shadowRoot!;
    const retry = shadow.querySelector<HTMLButtonElement>('.retry')!;
    expect(shadow.querySelector('[role="alert"]')?.textContent).toContain('could not be prepared');

    retry.click();
    await waitForMicrotasks();

    expect(explain).toHaveBeenCalledTimes(2);
    expect(explain).toHaveBeenLastCalledWith(createSnapshot(), { level: 'simple' });
    expect(shadow.querySelector('.definition p')?.textContent).toBe('Recovered explanation.');
  });

  it('replaces a simple explanation with a detailed explanation on request', async () => {
    const detailed = deferredExplanation();
    const explain = vi
      .fn<ExplanationProvider>()
      .mockResolvedValueOnce(structured('Simple answer.'))
      .mockImplementationOnce(() => detailed.promise);
    const snapshot = createSnapshot();
    const controller = mountExplanationCard({ document, snapshot, explain });
    await controller.settled;
    const shadow = controller.host.shadowRoot!;
    const action = shadow.querySelector<HTMLButtonElement>('.detail-action')!;

    action.click();
    action.click();

    expect(shadow.querySelector('.definition p')?.textContent).toBe('Simple answer.');
    expect(shadow.querySelector<HTMLButtonElement>('.detail-action')?.disabled).toBe(true);
    expect(shadow.querySelector('.detail-action')?.textContent).toBe('Expanding…');
    expect(explain).toHaveBeenCalledTimes(2);
    expect(explain).toHaveBeenLastCalledWith(snapshot, { level: 'detailed' });

    detailed.resolve(structured('Detailed answer with more context.'));
    await waitForMicrotasks();

    expect(shadow.querySelector('.definition p')?.textContent).toBe(
      'Detailed answer with more context.',
    );
    expect(shadow.querySelector('.eyebrow')?.textContent).toBe('Detailed explanation');
    expect(shadow.querySelector<HTMLButtonElement>('.detail-action')?.disabled).toBe(true);
    expect(shadow.querySelector('.detail-action')?.getAttribute('aria-pressed')).toBe('true');
    expect(shadow.querySelector<HTMLButtonElement>('.beginner-action')?.disabled).toBe(false);
    expect(shadow.querySelector('.beginner-action')?.getAttribute('aria-pressed')).toBe('false');
  });

  it('keeps both actions visible and supports switching refinement modes', async () => {
    const beginner = deferredExplanation();
    const detailed = deferredExplanation();
    const explain = vi
      .fn<ExplanationProvider>()
      .mockResolvedValueOnce(structured('Simple answer.'))
      .mockImplementationOnce(() => beginner.promise)
      .mockImplementationOnce(() => detailed.promise);
    const snapshot = createSnapshot();
    const controller = mountExplanationCard({ document, snapshot, explain });
    await controller.settled;
    const shadow = controller.host.shadowRoot!;
    const beginnerAction = shadow.querySelector<HTMLButtonElement>('.beginner-action')!;
    const detailedAction = shadow.querySelector<HTMLButtonElement>('.detail-action')!;

    beginnerAction.click();
    beginnerAction.click();
    detailedAction.click();

    expect(shadow.querySelector('.definition p')?.textContent).toBe('Simple answer.');
    expect(shadow.querySelector<HTMLButtonElement>('.beginner-action')?.disabled).toBe(true);
    expect(shadow.querySelector<HTMLButtonElement>('.detail-action')?.disabled).toBe(true);
    expect(shadow.querySelector('.beginner-action')?.textContent).toBe('Simplifying…');
    expect(shadow.querySelector('.detail-action')?.textContent).toBe('Explain in more detail');
    expect(shadow.querySelector('.refinement-control')?.getAttribute('aria-label')).toBe(
      'Preparing a beginner-friendly explanation',
    );
    expect(explain).toHaveBeenCalledTimes(2);
    expect(explain).toHaveBeenLastCalledWith(snapshot, { level: 'beginner' });

    beginner.resolve(structured('A very easy explanation.'));
    await waitForMicrotasks();

    expect(shadow.querySelector('.definition p')?.textContent).toBe('A very easy explanation.');
    expect(shadow.querySelector('.eyebrow')?.textContent).toBe(
      'Beginner-friendly explanation',
    );
    expect(shadow.querySelector<HTMLButtonElement>('.beginner-action')?.disabled).toBe(true);
    expect(shadow.querySelector('.beginner-action')?.getAttribute('aria-pressed')).toBe('true');
    expect(shadow.querySelector<HTMLButtonElement>('.detail-action')?.disabled).toBe(false);
    expect(shadow.querySelector('.detail-action')?.getAttribute('aria-pressed')).toBe('false');

    shadow.querySelector<HTMLButtonElement>('.detail-action')!.click();

    expect(shadow.querySelector('.definition p')?.textContent).toBe('A very easy explanation.');
    expect(shadow.querySelector('.detail-action')?.textContent).toBe('Expanding…');
    expect(explain).toHaveBeenLastCalledWith(snapshot, { level: 'detailed' });

    detailed.resolve(structured('A more complete explanation.'));
    await waitForMicrotasks();

    expect(shadow.querySelector('.definition p')?.textContent).toBe(
      'A more complete explanation.',
    );
    expect(shadow.querySelector('.eyebrow')?.textContent).toBe('Detailed explanation');
    expect(shadow.querySelector<HTMLButtonElement>('.detail-action')?.disabled).toBe(true);
    expect(shadow.querySelector<HTMLButtonElement>('.beginner-action')?.disabled).toBe(false);
  });

  it('keeps the simple answer visible when expansion fails and supports retry', async () => {
    const explain = vi
      .fn<ExplanationProvider>()
      .mockResolvedValueOnce(structured('Simple answer stays visible.'))
      .mockRejectedValueOnce(new Error('detail failure'))
      .mockResolvedValueOnce(structured('Detailed answer after retry.'));
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const controller = mountExplanationCard({ document, snapshot: createSnapshot(), explain });
    await controller.settled;
    const shadow = controller.host.shadowRoot!;

    shadow.querySelector<HTMLButtonElement>('.detail-action')!.click();
    await waitForMicrotasks();

    expect(shadow.querySelector('.definition p')?.textContent).toBe('Simple answer stays visible.');
    expect(shadow.querySelector('[role="alert"]')?.textContent).toContain(
      'detailed explanation could not be prepared',
    );

    shadow.querySelector<HTMLButtonElement>('.refinement-retry')!.click();
    await waitForMicrotasks();

    expect(explain).toHaveBeenCalledTimes(3);
    expect(shadow.querySelector('.definition p')?.textContent).toBe('Detailed answer after retry.');
    expect(shadow.querySelector('.eyebrow')?.textContent).toBe('Detailed explanation');
  });

  it('ignores a detailed response after the card is replaced', async () => {
    const detailed = deferredExplanation();
    const firstExplain = vi
      .fn<ExplanationProvider>()
      .mockResolvedValueOnce(structured('First simple answer.'))
      .mockImplementationOnce(() => detailed.promise);
    const first = mountExplanationCard({ document, snapshot: createSnapshot(), explain: firstExplain });
    await first.settled;
    first.host.shadowRoot?.querySelector<HTMLButtonElement>('.detail-action')?.click();

    const second = mountExplanationCard({
      document,
      snapshot: { ...createSnapshot(), selectedText: 'new selection' },
      explain: vi.fn<ExplanationProvider>().mockResolvedValue(structured('New answer.')),
    });
    await second.settled;
    detailed.resolve(structured('Stale detailed answer.'));
    await waitForMicrotasks();

    expect(first.host.isConnected).toBe(false);
    expect(second.host.shadowRoot?.querySelector('.definition p')?.textContent).toBe('New answer.');
  });

  it('replaces an existing card instead of duplicating the host', async () => {
    const first = mountExplanationCard({
      document,
      snapshot: createSnapshot(),
      explain: vi.fn<ExplanationProvider>().mockResolvedValue(structured('First')),
    });
    const second = mountExplanationCard({
      document,
      snapshot: { ...createSnapshot(), selectedText: 'second selection' },
      explain: vi.fn<ExplanationProvider>().mockResolvedValue(structured('Second')),
    });
    await second.settled;

    expect(document.querySelectorAll(`#${EXPLANATION_CARD_HOST_ID}`)).toHaveLength(1);
    expect(first.host.isConnected).toBe(false);
    expect(second.host.shadowRoot?.querySelector('blockquote')?.textContent).toContain(
      'second selection',
    );
  });

  it('closes through its button and the Escape key', () => {
    const first = mountExplanationCard({
      document,
      snapshot: createSnapshot(),
      explain: pendingExplanation,
    });
    first.host.shadowRoot?.querySelector<HTMLButtonElement>('.close')?.click();
    expect(first.host.isConnected).toBe(false);

    const second = mountExplanationCard({
      document,
      snapshot: createSnapshot(),
      explain: pendingExplanation,
    });
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(second.host.isConnected).toBe(false);
  });

  it('uses a stronger glass surface over a dark selection background', () => {
    const controller = mountExplanationCard({
      document,
      snapshot: createSnapshot(),
      surfaceTone: 'dark',
      explain: pendingExplanation,
    });

    expect(controller.host.shadowRoot?.querySelector('.card--over-dark')).not.toBeNull();
  });
});

describe('selection presentation context', () => {
  it('anchors textarea selections to the editable control', () => {
    document.body.innerHTML = '<textarea id="editor">editable selection</textarea>';
    const editor = document.querySelector<HTMLTextAreaElement>('#editor')!;
    editor.focus();
    vi.spyOn(editor, 'getBoundingClientRect').mockReturnValue(
      createAnchorRect({ top: 200, bottom: 280, height: 80 }) as DOMRect,
    );

    expect(getSelectionAnchorRect(window.getSelection(), document)).toMatchObject({
      top: 200,
      bottom: 280,
      height: 80,
    });
  });

  it('detects a dark ancestor behind the selected text', () => {
    document.body.innerHTML = `
      <section style="background-color: rgb(24, 36, 42)">
        <p id="target">Readable selected text.</p>
      </section>
    `;
    const text = document.querySelector('#target')!.firstChild!;
    const range = document.createRange();
    range.selectNodeContents(text);
    const selection = window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);

    expect(getSelectionSurfaceTone(document, selection)).toBe('dark');
  });
});

describe('calculateCardPosition', () => {
  it('keeps a card within a narrow viewport', () => {
    expect(calculateCardPosition(createAnchorRect({ left: 290 }), 320, 500, 296, 300)).toEqual({
      left: 12,
      top: 100,
    });
  });

  it('places the card above a selection near the bottom edge', () => {
    expect(
      calculateCardPosition(createAnchorRect({ top: 700, bottom: 720 }), 1000, 800, 384, 300),
    ).toEqual({ left: 120, top: 390 });
  });

  it('uses a stable top-right fallback without selection geometry', () => {
    expect(calculateCardPosition(undefined, 1000, 800, 384, 300)).toEqual({
      left: 604,
      top: 12,
    });
  });
});

function createSnapshot(): SelectionSnapshot {
  return {
    selectedText: 'contextual representation',
    context: {
      immediate: 'A model learns a contextual representation from examples.',
      heading: 'How models learn',
      containingBlock: 'A model learns a contextual representation from examples.',
      before: 'An earlier paragraph.',
      after: 'A later paragraph.',
    },
    page: {
      title: 'Contextual article',
      hostname: 'example.com',
      language: 'en',
    },
  };
}

function structured(
  definition: string,
  contextualMeaning = 'Meaning in this context.',
  synonyms: string[] = [],
) {
  return { definition, contextualMeaning, synonyms };
}

type TestAnchorRect = {
  top: number;
  right: number;
  bottom: number;
  left: number;
  width: number;
  height: number;
};

function createAnchorRect(overrides: Partial<TestAnchorRect> = {}): TestAnchorRect {
  return {
    top: 70,
    right: 300,
    bottom: 90,
    left: 120,
    width: 180,
    height: 20,
    ...overrides,
  };
}

const pendingExplanation: ExplanationProvider = () => new Promise(() => undefined);

async function waitForMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

function deferredExplanation(): {
  promise: ReturnType<ExplanationProvider>;
  resolve: (value: Awaited<ReturnType<ExplanationProvider>>) => void;
} {
  let resolve!: (value: Awaited<ReturnType<ExplanationProvider>>) => void;
  const promise = new Promise<Awaited<ReturnType<ExplanationProvider>>>((resolvePromise) => {
    resolve = resolvePromise;
  });

  return { promise, resolve };
}
