import type { ExplanationProvider } from './mock-explanation';
import type { SelectionSnapshot } from '../shared/selection';

export const EXPLANATION_CARD_HOST_ID = 'i-dont-get-it-explanation-card';

const CARD_WIDTH = 384;
const CARD_MAX_HEIGHT = 520;
const VIEWPORT_MARGIN = 12;
const ANCHOR_GAP = 10;
const MAX_DISPLAYED_SELECTION_CHARACTERS = 280;

type AnchorRect = {
  top: number;
  right: number;
  bottom: number;
  left: number;
  width: number;
  height: number;
};

type CardHost = HTMLElement & {
  __idgiCleanup?: () => void;
};

type MountExplanationCardOptions = {
  document: Document;
  snapshot: SelectionSnapshot;
  anchorRect?: AnchorRect;
  explain: ExplanationProvider;
};

export type ExplanationCardController = {
  host: HTMLElement;
  close: () => void;
  settled: Promise<void>;
};

export function mountExplanationCard(
  options: MountExplanationCardOptions,
): ExplanationCardController {
  const view = options.document.defaultView;

  if (view === null) {
    throw new Error('The explanation card requires a document with a window.');
  }

  removeExistingCard(options.document);

  const host = options.document.createElement('div') as CardHost;
  host.id = EXPLANATION_CARD_HOST_ID;
  host.style.all = 'initial';
  host.style.position = 'fixed';
  host.style.zIndex = '2147483647';
  host.style.width = `min(${CARD_WIDTH}px, calc(100vw - ${VIEWPORT_MARGIN * 2}px))`;
  host.style.maxHeight = `calc(100vh - ${VIEWPORT_MARGIN * 2}px)`;

  const shadowRoot = host.attachShadow({ mode: 'open' });
  shadowRoot.append(createStyles(options.document));

  const card = options.document.createElement('section');
  card.className = 'card';
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-label', 'Explanation');
  card.setAttribute('aria-live', 'polite');
  card.tabIndex = -1;
  shadowRoot.append(card);

  const abortController = new AbortController();

  const close = () => {
    abortController.abort();
    host.remove();
  };
  host.__idgiCleanup = close;

  const updatePosition = () => {
    positionHost(host, options.anchorRect, view.innerWidth, view.innerHeight);
  };

  view.addEventListener('resize', updatePosition, { signal: abortController.signal });
  view.addEventListener('scroll', updatePosition, {
    capture: true,
    passive: true,
    signal: abortController.signal,
  });
  view.addEventListener(
    'keydown',
    (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close();
      }
    },
    { signal: abortController.signal },
  );

  options.document.documentElement.append(host);
  renderLoading(card, options.snapshot, close);
  updatePosition();
  card.focus({ preventScroll: true });

  const settled = requestExplanation(card, options, close);

  return { host, close, settled };
}

export function getSelectionAnchorRect(selection: Selection | null): AnchorRect | undefined {
  if (selection === null || selection.rangeCount === 0) {
    return undefined;
  }

  try {
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    if (rect.width === 0 && rect.height === 0) {
      return undefined;
    }

    return {
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      left: rect.left,
      width: rect.width,
      height: rect.height,
    };
  } catch {
    return undefined;
  }
}

export function calculateCardPosition(
  anchorRect: AnchorRect | undefined,
  viewportWidth: number,
  viewportHeight: number,
  cardWidth = CARD_WIDTH,
  cardHeight = CARD_MAX_HEIGHT,
): { left: number; top: number } {
  const boundedWidth = Math.min(cardWidth, Math.max(0, viewportWidth - VIEWPORT_MARGIN * 2));
  const boundedHeight = Math.min(cardHeight, Math.max(0, viewportHeight - VIEWPORT_MARGIN * 2));

  if (anchorRect === undefined) {
    return {
      left: Math.max(VIEWPORT_MARGIN, viewportWidth - boundedWidth - VIEWPORT_MARGIN),
      top: VIEWPORT_MARGIN,
    };
  }

  const maximumLeft = Math.max(VIEWPORT_MARGIN, viewportWidth - boundedWidth - VIEWPORT_MARGIN);
  const left = clamp(anchorRect.left, VIEWPORT_MARGIN, maximumLeft);
  const spaceBelow = viewportHeight - anchorRect.bottom - VIEWPORT_MARGIN;
  const preferredTop =
    spaceBelow >= Math.min(boundedHeight, 240)
      ? anchorRect.bottom + ANCHOR_GAP
      : anchorRect.top - boundedHeight - ANCHOR_GAP;
  const maximumTop = Math.max(VIEWPORT_MARGIN, viewportHeight - boundedHeight - VIEWPORT_MARGIN);

  return {
    left,
    top: clamp(preferredTop, VIEWPORT_MARGIN, maximumTop),
  };
}

async function requestExplanation(
  card: HTMLElement,
  options: MountExplanationCardOptions,
  close: () => void,
): Promise<void> {
  try {
    const explanation = await options.explain(options.snapshot);

    if (!card.isConnected) {
      return;
    }

    renderSuccess(card, options.snapshot, explanation.text, close);
  } catch (error: unknown) {
    if (!card.isConnected) {
      return;
    }

    renderError(card, options.snapshot, close, () => {
      renderLoading(card, options.snapshot, close);
      void requestExplanation(card, options, close);
    });

    console.warn('i-dont-get-it mock explanation failed', error);
  }
}

function renderLoading(card: HTMLElement, snapshot: SelectionSnapshot, close: () => void): void {
  renderShell(card, snapshot, close);

  const status = card.ownerDocument.createElement('div');
  status.className = 'status';
  status.setAttribute('role', 'status');

  const spinner = card.ownerDocument.createElement('span');
  spinner.className = 'spinner';
  spinner.setAttribute('aria-hidden', 'true');
  status.append(spinner, card.ownerDocument.createTextNode('Preparing an explanation…'));
  card.append(status);
}

function renderSuccess(
  card: HTMLElement,
  snapshot: SelectionSnapshot,
  explanation: string,
  close: () => void,
): void {
  renderShell(card, snapshot, close);

  const label = card.ownerDocument.createElement('p');
  label.className = 'eyebrow';
  label.textContent = 'Prototype explanation';

  const text = card.ownerDocument.createElement('p');
  text.className = 'explanation';
  text.textContent = explanation;

  const details = card.ownerDocument.createElement('details');
  details.className = 'context';
  const summary = card.ownerDocument.createElement('summary');
  summary.textContent = 'Context used';
  const contextText = card.ownerDocument.createElement('p');
  contextText.textContent = formatContext(snapshot);
  details.append(summary, contextText);

  card.append(label, text, details);
}

function renderError(
  card: HTMLElement,
  snapshot: SelectionSnapshot,
  close: () => void,
  retry: () => void,
): void {
  renderShell(card, snapshot, close);

  const error = card.ownerDocument.createElement('div');
  error.className = 'error';
  error.setAttribute('role', 'alert');

  const message = card.ownerDocument.createElement('p');
  message.textContent = 'The explanation could not be prepared.';

  const retryButton = card.ownerDocument.createElement('button');
  retryButton.className = 'retry';
  retryButton.type = 'button';
  retryButton.textContent = 'Try again';
  retryButton.addEventListener('click', retry, { once: true });

  error.append(message, retryButton);
  card.append(error);
  retryButton.focus({ preventScroll: true });
}

function renderShell(card: HTMLElement, snapshot: SelectionSnapshot, close: () => void): void {
  card.replaceChildren();

  const header = card.ownerDocument.createElement('header');
  const brand = card.ownerDocument.createElement('span');
  brand.className = 'brand';
  brand.textContent = "I don't get it";

  const closeButton = card.ownerDocument.createElement('button');
  closeButton.className = 'close';
  closeButton.type = 'button';
  closeButton.setAttribute('aria-label', 'Close explanation');
  closeButton.textContent = '×';
  closeButton.addEventListener('click', close, { once: true });
  header.append(brand, closeButton);

  const quote = card.ownerDocument.createElement('blockquote');
  quote.textContent = truncateDisplayedSelection(snapshot.selectedText);

  card.append(header, quote);
}

function positionHost(
  host: HTMLElement,
  anchorRect: AnchorRect | undefined,
  viewportWidth: number,
  viewportHeight: number,
): void {
  const renderedRect = host.getBoundingClientRect();
  const cardHeight = renderedRect.height > 0 ? renderedRect.height : CARD_MAX_HEIGHT;
  const cardWidth = renderedRect.width > 0 ? renderedRect.width : CARD_WIDTH;
  const position = calculateCardPosition(
    anchorRect,
    viewportWidth,
    viewportHeight,
    cardWidth,
    cardHeight,
  );
  host.style.left = `${position.left}px`;
  host.style.top = `${position.top}px`;
}

function removeExistingCard(document: Document): void {
  const existing = document.getElementById(EXPLANATION_CARD_HOST_ID) as CardHost | null;

  if (existing === null) {
    return;
  }

  existing.__idgiCleanup?.();
  existing.remove();
}

function truncateDisplayedSelection(value: string): string {
  if (value.length <= MAX_DISPLAYED_SELECTION_CHARACTERS) {
    return `“${value}”`;
  }

  return `“${value.slice(0, MAX_DISPLAYED_SELECTION_CHARACTERS - 1).trimEnd()}…”`;
}

function formatContext(snapshot: SelectionSnapshot): string {
  const parts = [
    snapshot.context.heading,
    snapshot.context.before,
    snapshot.context.containingBlock,
    snapshot.context.after,
  ].filter((value): value is string => value !== undefined && value.length > 0);

  return parts.join('\n\n');
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

function createStyles(document: Document): HTMLStyleElement {
  const style = document.createElement('style');
  style.textContent = `
    :host { color-scheme: light; }
    *, *::before, *::after { box-sizing: border-box; }
    .card {
      max-height: min(${CARD_MAX_HEIGHT}px, calc(100vh - ${VIEWPORT_MARGIN * 2}px));
      overflow: auto;
      border: 1px solid rgba(255, 255, 255, 0.68);
      border-radius: 14px;
      background:
        linear-gradient(145deg, rgba(255, 255, 255, 0.82), rgba(244, 243, 252, 0.68));
      -webkit-backdrop-filter: blur(18px) saturate(145%);
      backdrop-filter: blur(18px) saturate(145%);
      box-shadow:
        inset 0 1px 0 rgba(255, 255, 255, 0.78),
        0 18px 48px rgba(28, 25, 48, 0.22),
        0 3px 10px rgba(28, 25, 48, 0.12);
      color: #1d2230;
      font: 14px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      letter-spacing: normal;
      padding: 16px;
      text-align: left;
    }
    .card:focus-visible { outline: 3px solid #6d5ce8; outline-offset: 2px; }
    header { align-items: center; display: flex; justify-content: space-between; margin: 0 0 12px; }
    .brand { color: #513bc8; font-size: 13px; font-weight: 700; letter-spacing: 0.02em; }
    button { font: inherit; }
    .close {
      align-items: center; background: transparent; border: 0; border-radius: 7px; color: #5e6673;
      cursor: pointer; display: inline-flex; font-size: 24px; height: 30px; justify-content: center;
      line-height: 1; margin: -5px -5px -5px 8px; padding: 0; width: 30px;
    }
    .close:hover { background: rgba(255, 255, 255, 0.62); color: #202631; }
    .close:focus-visible, .retry:focus-visible, summary:focus-visible { outline: 3px solid #6d5ce8; outline-offset: 2px; }
    blockquote {
      border-left: 3px solid rgba(105, 82, 222, 0.42); color: #4a5261; font-size: 13px; margin: 0 0 15px;
      max-height: 88px; overflow: auto; padding: 2px 0 2px 10px;
    }
    .eyebrow { color: #727a87; font-size: 11px; font-weight: 700; letter-spacing: 0.08em; margin: 0 0 5px; text-transform: uppercase; }
    .explanation { font-size: 15px; margin: 0; }
    .status { align-items: center; color: #5e6673; display: flex; gap: 9px; min-height: 44px; }
    .spinner { animation: spin 0.8s linear infinite; border: 2px solid #d7d3f5; border-radius: 50%; border-top-color: #654fdc; height: 17px; width: 17px; }
    .error { background: rgba(255, 235, 231, 0.76); border-radius: 9px; color: #7b2821; padding: 12px; }
    .error p { margin: 0 0 10px; }
    .retry { background: #5a45d6; border: 0; border-radius: 8px; color: #fff; cursor: pointer; font-weight: 650; padding: 7px 11px; }
    .retry:hover { background: #4935be; }
    .context { border-top: 1px solid rgba(91, 84, 122, 0.16); color: #555d6b; font-size: 12px; margin-top: 16px; padding-top: 11px; }
    .context summary { border-radius: 4px; cursor: pointer; font-weight: 650; }
    .context p { margin: 9px 0 0; white-space: pre-line; }
    @keyframes spin { to { transform: rotate(360deg); } }
    @media (prefers-reduced-motion: reduce) { .spinner { animation: none; } }
  `;
  return style;
}
