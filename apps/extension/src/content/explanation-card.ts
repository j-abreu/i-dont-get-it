import type { SelectionSnapshot } from '../shared/selection';
import type { Explanation, ExplanationProvider } from './explanation-provider';

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
  surfaceTone?: 'light' | 'dark';
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
  card.className = options.surfaceTone === 'dark' ? 'card card--over-dark' : 'card';
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

export function getSelectionAnchorRect(
  selection: Selection | null,
  document?: Document,
): AnchorRect | undefined {
  const textControl = getActiveTextControl(document, selection);

  if (textControl !== null) {
    return copyRect(textControl.getBoundingClientRect());
  }

  if (selection === null || selection.rangeCount === 0) {
    return undefined;
  }

  try {
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    if (rect.width === 0 && rect.height === 0) {
      return undefined;
    }

    return copyRect(rect);
  } catch {
    return undefined;
  }
}

export function getSelectionSurfaceTone(
  document: Document,
  selection: Selection | null,
): 'light' | 'dark' {
  const view = document.defaultView;
  const selectedNode = selection?.anchorNode;
  let element: Element | null =
    getActiveTextControl(document, selection) ??
    (selectedNode?.nodeType === 1 ? (selectedNode as Element) : selectedNode?.parentElement) ??
    document.body;

  while (view !== null && element !== null) {
    const color = parseCssColor(view.getComputedStyle(element).backgroundColor);

    if (color !== null && color.alpha >= 0.2) {
      const luminance =
        (0.2126 * color.red + 0.7152 * color.green + 0.0722 * color.blue) / 255;
      return luminance < 0.45 ? 'dark' : 'light';
    }

    element = element.parentElement;
  }

  return 'light';
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
    const explanation = await options.explain(options.snapshot, { level: 'simple' });

    if (!card.isConnected) {
      return;
    }

    renderSimpleSuccess(card, options, explanation, close);
  } catch (error: unknown) {
    if (!card.isConnected) {
      return;
    }

    renderError(card, options.snapshot, close, () => {
      renderLoading(card, options.snapshot, close);
      void requestExplanation(card, options, close);
    });

    console.warn('i-dont-get-it explanation failed', error);
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

function renderSimpleSuccess(
  card: HTMLElement,
  options: MountExplanationCardOptions,
  simpleExplanation: Explanation,
  close: () => void,
): void {
  let refinementRequestPending = false;
  let currentExplanation = simpleExplanation;
  let currentExplanationLabel = 'Simple explanation';
  let selectedLevel: Refinement['level'] | undefined;

  const requestRefinement = async (refinement: Refinement): Promise<void> => {
    if (refinementRequestPending || !card.isConnected) {
      return;
    }

    refinementRequestPending = true;
    renderExplanation(
      card,
      options.snapshot,
      currentExplanation,
      currentExplanationLabel,
      close,
      { status: 'loading', refinement, selectedLevel },
    );

    try {
      const refinedExplanation = await options.explain(options.snapshot, {
        level: refinement.level,
      });

      if (!card.isConnected) {
        return;
      }

      currentExplanation = refinedExplanation;
      currentExplanationLabel = refinement.successLabel;
      selectedLevel = refinement.level;
      refinementRequestPending = false;
      renderExplanation(card, options.snapshot, currentExplanation, currentExplanationLabel, close, {
        status: 'ready',
        selectedLevel,
        request: (nextRefinement) => void requestRefinement(nextRefinement),
      });
    } catch (error: unknown) {
      if (!card.isConnected) {
        return;
      }

      refinementRequestPending = false;
      renderExplanation(
        card,
        options.snapshot,
        currentExplanation,
        currentExplanationLabel,
        close,
        {
          status: 'error',
          refinement,
          selectedLevel,
          retry: () => void requestRefinement(refinement),
        },
      );

      console.warn(`i-dont-get-it ${refinement.level} explanation failed`, error);
    }
  };

  renderExplanation(
    card,
    options.snapshot,
    simpleExplanation,
    'Simple explanation',
    close,
    {
      status: 'ready',
      selectedLevel,
      request: (refinement) => void requestRefinement(refinement),
    },
  );
}

const REFINEMENTS = [
  {
    level: 'beginner',
    actionLabel: "Explain Like I'm 5",
    loadingLabel: 'Simplifying…',
    successLabel: 'Beginner-friendly explanation',
    errorMessage: 'The beginner-friendly explanation could not be prepared.',
    className: 'beginner-action',
  },
  {
    level: 'detailed',
    actionLabel: 'Explain in more detail',
    loadingLabel: 'Expanding…',
    successLabel: 'Detailed explanation',
    errorMessage: 'The detailed explanation could not be prepared.',
    className: 'detail-action',
  },
] as const;

type Refinement = (typeof REFINEMENTS)[number];

type RefinementControl =
  | {
      status: 'ready';
      selectedLevel: Refinement['level'] | undefined;
      request: (refinement: Refinement) => void;
    }
  | {
      status: 'loading';
      refinement: Refinement;
      selectedLevel: Refinement['level'] | undefined;
    }
  | {
      status: 'error';
      refinement: Refinement;
      selectedLevel: Refinement['level'] | undefined;
      retry: () => void;
    };

function renderExplanation(
  card: HTMLElement,
  snapshot: SelectionSnapshot,
  explanation: Explanation,
  explanationLabel: string,
  close: () => void,
  refinementControl?: RefinementControl,
): void {
  renderShell(card, snapshot, close, 'Now you get it!');

  const label = card.ownerDocument.createElement('p');
  label.className = 'eyebrow';
  label.textContent = explanationLabel;

  const content = card.ownerDocument.createElement('div');
  content.className = 'explanation';
  if (explanation.definition !== null) {
    content.append(
      createExplanationSection(card.ownerDocument, 'Definition', explanation.definition, 'definition'),
    );
  }
  content.append(
    createExplanationSection(
      card.ownerDocument,
      'In this context',
      explanation.contextualMeaning,
      'contextual-meaning',
    ),
  );

  if (explanation.synonyms.length > 0) {
    const synonyms = card.ownerDocument.createElement('section');
    synonyms.className = 'explanation-section synonyms';
    const heading = card.ownerDocument.createElement('h3');
    heading.textContent = 'Synonyms and other names';
    const list = card.ownerDocument.createElement('ul');
    for (const synonym of explanation.synonyms) {
      const item = card.ownerDocument.createElement('li');
      item.textContent = synonym;
      list.append(item);
    }
    synonyms.append(heading, list);
    content.append(synonyms);
  }

  card.append(label, content);

  if (refinementControl !== undefined) {
    card.append(createRefinementControl(card.ownerDocument, refinementControl));
  }

  const details = card.ownerDocument.createElement('details');
  details.className = 'context';
  const summary = card.ownerDocument.createElement('summary');
  summary.textContent = 'Context used';
  const contextText = card.ownerDocument.createElement('p');
  contextText.textContent = formatContext(snapshot);
  details.append(summary, contextText);

  card.append(details);
}

function createExplanationSection(
  document: Document,
  headingText: string,
  bodyText: string,
  className: string,
): HTMLElement {
  const section = document.createElement('section');
  section.className = `explanation-section ${className}`;
  const heading = document.createElement('h3');
  heading.textContent = headingText;
  const body = document.createElement('p');
  body.textContent = bodyText;
  section.append(heading, body);
  return section;
}

function createRefinementControl(
  document: Document,
  refinementControl: RefinementControl,
): HTMLElement {
  const container = document.createElement('div');
  container.className = 'refinement-control';

  if (refinementControl.status === 'error') {
    container.classList.add('refinement-control--error');
    container.setAttribute('role', 'alert');

    const message = document.createElement('p');
    message.textContent = refinementControl.refinement.errorMessage;

    const retryButton = createActionButton(document, 'Try again', 'refinement-retry');
    retryButton.addEventListener('click', refinementControl.retry, { once: true });
    container.append(message, retryButton);
    return container;
  }

  for (const refinement of REFINEMENTS) {
    const isActive =
      refinementControl.status === 'loading' &&
      refinementControl.refinement.level === refinement.level;
    const isSelected = refinementControl.selectedLevel === refinement.level;
    const actionButton = createActionButton(
      document,
      isActive ? refinement.loadingLabel : refinement.actionLabel,
      `refinement-action ${refinement.className}`,
    );
    actionButton.setAttribute('aria-pressed', String(isSelected));

    if (refinementControl.status === 'loading' || isSelected) {
      actionButton.disabled = true;
    } else {
      actionButton.addEventListener('click', () => refinementControl.request(refinement), {
        once: true,
      });
    }

    container.append(actionButton);
  }

  if (refinementControl.status === 'loading') {
    container.setAttribute('role', 'status');
    container.setAttribute(
      'aria-label',
      `Preparing a ${refinementControl.refinement.successLabel.toLowerCase()}`,
    );
  }

  return container;
}

function createActionButton(document: Document, text: string, className: string): HTMLButtonElement {
  const button = document.createElement('button');
  button.className = className;
  button.type = 'button';
  button.textContent = text;
  return button;
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

function renderShell(
  card: HTMLElement,
  snapshot: SelectionSnapshot,
  close: () => void,
  brandText = "I don't get it",
): void {
  card.replaceChildren();

  const header = card.ownerDocument.createElement('header');
  const brand = card.ownerDocument.createElement('span');
  brand.className = 'brand';
  brand.textContent = brandText;

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
      isolation: isolate;
      position: relative;
      max-height: min(${CARD_MAX_HEIGHT}px, calc(100vh - ${VIEWPORT_MARGIN * 2}px));
      overflow: auto;
      border: 1px solid rgba(255, 255, 255, 0.62);
      border-radius: 18px;
      background-color: rgba(255, 255, 255, 0.12);
      background:
        linear-gradient(145deg, rgba(255, 255, 255, 0.3), rgba(255, 255, 255, 0.16) 46%, rgba(255, 255, 255, 0.08));
      -webkit-backdrop-filter: blur(14px) saturate(120%) brightness(106%);
      backdrop-filter: blur(14px) saturate(120%) brightness(106%);
      box-shadow:
        inset 0 1px 0 rgba(255, 255, 255, 0.76),
        inset 0 -1px 0 rgba(255, 255, 255, 0.24),
        0 22px 56px rgba(20, 24, 32, 0.18),
        0 4px 14px rgba(20, 24, 32, 0.1);
      color: #17191d;
      font: 14px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      letter-spacing: normal;
      padding: 16px;
      text-align: left;
    }
    .card::before {
      background:
        radial-gradient(140% 90% at 8% 0%, rgba(255, 255, 255, 0.38), transparent 42%),
        linear-gradient(135deg, rgba(255, 255, 255, 0.2), transparent 24%, transparent 76%, rgba(255, 255, 255, 0.08));
      border-radius: inherit;
      content: "";
      inset: 0;
      pointer-events: none;
      position: absolute;
      z-index: -1;
    }
    .card--over-dark {
      border-color: rgba(255, 255, 255, 0.82);
      background-color: rgba(255, 255, 255, 0.44);
      background:
        linear-gradient(145deg, rgba(255, 255, 255, 0.68), rgba(255, 255, 255, 0.48) 46%, rgba(255, 255, 255, 0.36));
      -webkit-backdrop-filter: blur(18px) saturate(112%) brightness(118%);
      backdrop-filter: blur(18px) saturate(112%) brightness(118%);
      box-shadow:
        inset 0 1px 0 rgba(255, 255, 255, 0.92),
        inset 0 -1px 0 rgba(255, 255, 255, 0.38),
        0 22px 60px rgba(0, 0, 0, 0.3),
        0 4px 16px rgba(0, 0, 0, 0.2);
    }
    .card:focus-visible { outline: 2px solid rgba(25, 28, 34, 0.46); outline-offset: 2px; }
    header { align-items: center; display: flex; justify-content: space-between; margin: 0 0 12px; }
    .brand { color: #1a1d22; font-size: 13px; font-weight: 700; letter-spacing: 0.02em; }
    button { font: inherit; }
    .close {
      align-items: center; background: transparent; border: 0; border-radius: 9px; color: rgba(23, 25, 29, 0.66);
      cursor: pointer; display: inline-flex; font-size: 24px; height: 30px; justify-content: center;
      line-height: 1; margin: -5px -5px -5px 8px; padding: 0; width: 30px;
    }
    .close:hover { background: rgba(255, 255, 255, 0.38); color: #111318; }
    .close:focus-visible, .retry:focus-visible, .refinement-action:focus-visible, .refinement-retry:focus-visible, summary:focus-visible { outline: 3px solid rgba(31, 35, 42, 0.62); outline-offset: 2px; }
    blockquote {
      border-left: 3px solid rgba(28, 31, 37, 0.26); color: rgba(25, 28, 34, 0.72); font-size: 13px; margin: 0 0 15px;
      max-height: 88px; overflow: auto; padding: 2px 0 2px 10px;
    }
    .eyebrow { color: rgba(27, 30, 36, 0.56); font-size: 11px; font-weight: 700; letter-spacing: 0.08em; margin: 0 0 5px; text-transform: uppercase; }
    .explanation { color: #14161a; display: grid; font-size: 15px; gap: 12px; margin: 0; text-shadow: 0 1px 0 rgba(255, 255, 255, 0.28); }
    .explanation-section h3 { color: rgba(27, 30, 36, 0.62); font-size: 11px; font-weight: 750; letter-spacing: 0.06em; margin: 0 0 3px; text-transform: uppercase; }
    .explanation-section p { margin: 0; }
    .synonyms ul { display: flex; flex-wrap: wrap; gap: 6px; list-style: none; margin: 0; padding: 0; }
    .synonyms li { background: rgba(255, 255, 255, 0.34); border: 1px solid rgba(24, 27, 32, 0.14); border-radius: 999px; font-size: 13px; padding: 3px 8px; }
    .status { align-items: center; color: rgba(25, 28, 34, 0.7); display: flex; gap: 9px; min-height: 44px; }
    .spinner { animation: spin 0.8s linear infinite; border: 2px solid rgba(20, 23, 28, 0.16); border-radius: 50%; border-top-color: #181b20; height: 17px; width: 17px; }
    .error { background: rgba(255, 230, 226, 0.46); border: 1px solid rgba(126, 34, 27, 0.16); border-radius: 10px; color: #6e211a; padding: 12px; }
    .error p { margin: 0 0 10px; }
    .retry { background: rgba(24, 27, 32, 0.86); border: 1px solid rgba(255, 255, 255, 0.34); border-radius: 9px; color: #ffffff; cursor: pointer; font-weight: 650; padding: 7px 11px; }
    .retry:hover { background: #15181d; }
    .refinement-control { align-items: center; display: flex; flex-wrap: wrap; gap: 8px; margin-top: 14px; }
    .refinement-action, .refinement-retry {
      background: rgba(255, 255, 255, 0.34); border: 1px solid rgba(24, 27, 32, 0.22); border-radius: 9px;
      color: #181b20; cursor: pointer; font-weight: 650; padding: 7px 11px;
    }
    .refinement-action:hover, .refinement-retry:hover { background: rgba(255, 255, 255, 0.58); }
    .refinement-action:disabled { cursor: wait; opacity: 0.64; }
    .refinement-control--error {
      align-items: flex-start; background: rgba(255, 230, 226, 0.46); border: 1px solid rgba(126, 34, 27, 0.16);
      border-radius: 10px; color: #6e211a; flex-direction: column; gap: 9px; padding: 10px;
    }
    .refinement-control--error p { margin: 0; }
    .context { border-top: 1px solid rgba(27, 30, 36, 0.16); color: rgba(25, 28, 34, 0.66); font-size: 12px; margin-top: 16px; padding-top: 11px; }
    .context summary { border-radius: 4px; cursor: pointer; font-weight: 650; }
    .context p { margin: 9px 0 0; white-space: pre-line; }
    @keyframes spin { to { transform: rotate(360deg); } }
    @media (prefers-reduced-motion: reduce) { .spinner { animation: none; } }
    @media (prefers-contrast: more) {
      .card { background: rgba(255, 255, 255, 0.92); border-color: rgba(20, 23, 28, 0.5); }
      blockquote, .context, .eyebrow, .status { color: #000000; }
    }
  `;
  return style;
}

function getActiveTextControl(
  document: Document | undefined,
  selection: Selection | null,
): HTMLElement | null {
  if ((selection?.toString() ?? '').trim().length > 0) {
    return null;
  }

  const activeElement = document?.activeElement;
  return activeElement?.matches(
    'textarea, input:is([type="text"], [type="search"], [type="url"], [type="tel"], [type="email"], :not([type]))',
  )
    ? (activeElement as HTMLElement)
    : null;
}

function copyRect(rect: DOMRect): AnchorRect | undefined {
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
}

function parseCssColor(value: string): {
  red: number;
  green: number;
  blue: number;
  alpha: number;
} | null {
  const match = value.match(
    /^rgba?\(\s*([\d.]+)[, ]+\s*([\d.]+)[, ]+\s*([\d.]+)(?:\s*[,/]\s*([\d.]+))?\s*\)$/,
  );

  if (match === null) {
    return null;
  }

  return {
    red: Number(match[1]),
    green: Number(match[2]),
    blue: Number(match[3]),
    alpha: match[4] === undefined ? 1 : Number(match[4]),
  };
}
