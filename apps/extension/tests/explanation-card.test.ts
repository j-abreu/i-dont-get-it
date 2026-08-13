// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  calculateCardPosition,
  EXPLANATION_CARD_HOST_ID,
  mountExplanationCard,
} from '../src/content/explanation-card';
import type { ExplanationProvider } from '../src/content/mock-explanation';
import type { SelectionSnapshot } from '../src/shared/selection';

describe('mountExplanationCard', () => {
  afterEach(() => {
    document.documentElement.replaceChildren(document.createElement('head'), document.createElement('body'));
    vi.restoreAllMocks();
  });

  it('renders loading and success inside an isolated shadow root', async () => {
    const explain = vi.fn<ExplanationProvider>().mockResolvedValue({
      text: 'A contextual explanation.',
    });
    const controller = mountExplanationCard({
      document,
      snapshot: createSnapshot(),
      anchorRect: createAnchorRect(),
      explain,
    });
    const shadow = controller.host.shadowRoot!;

    expect(shadow.querySelector('[role="status"]')?.textContent).toContain('Preparing');
    expect(document.querySelector('.card')).toBeNull();

    await controller.settled;

    expect(shadow.querySelector('.explanation')?.textContent).toBe('A contextual explanation.');
    expect(shadow.querySelector('blockquote')?.textContent).toContain('contextual representation');
    expect(shadow.querySelector('details')?.textContent).toContain('How models learn');
  });

  it('renders an error and retries with the same snapshot', async () => {
    const explain = vi
      .fn<ExplanationProvider>()
      .mockRejectedValueOnce(new Error('temporary failure'))
      .mockResolvedValueOnce({ text: 'Recovered explanation.' });
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
    expect(shadow.querySelector('.explanation')?.textContent).toBe('Recovered explanation.');
  });

  it('replaces an existing card instead of duplicating the host', async () => {
    const first = mountExplanationCard({
      document,
      snapshot: createSnapshot(),
      explain: vi.fn<ExplanationProvider>().mockResolvedValue({ text: 'First' }),
    });
    const second = mountExplanationCard({
      document,
      snapshot: { ...createSnapshot(), selectedText: 'second selection' },
      explain: vi.fn<ExplanationProvider>().mockResolvedValue({ text: 'Second' }),
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
      heading: 'How models learn',
      containingBlock: 'A model learns a contextual representation from examples.',
      before: 'An earlier paragraph.',
      after: 'A later paragraph.',
    },
    page: {
      title: 'Contextual article',
      url: 'https://example.com/article',
      hostname: 'example.com',
      language: 'en',
    },
  };
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
