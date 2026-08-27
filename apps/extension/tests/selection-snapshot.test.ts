// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';

import {
  captureSelectionSnapshot,
  extractPageHostname,
} from '../src/content/selection-snapshot';
import { MAX_SELECTION_CHARACTERS } from '../src/shared/selection';

describe('captureSelectionSnapshot', () => {
  afterEach(() => {
    window.getSelection()?.removeAllRanges();
    document.body.replaceChildren();
    document.title = '';
    document.documentElement.lang = '';
  });

  it('captures inline text with its heading and adjacent paragraphs', () => {
    document.title = 'Contextual article';
    document.documentElement.lang = 'en';
    document.body.innerHTML = `
      <article>
        <h2>How models learn</h2>
        <p>The paragraph before introduces the subject.</p>
        <p id="target">A model learns a <em>contextual representation</em> from examples.</p>
        <p>The paragraph after expands on the idea.</p>
      </article>
    `;
    selectText(document.querySelector('em')!.firstChild!);

    const result = captureSelectionSnapshot(createOptions());

    expect(result).toEqual({
      status: 'captured',
      source: 'dom',
      snapshot: {
        selectedText: 'contextual representation',
        context: {
          immediate: 'A model learns a contextual representation from examples.',
          heading: 'How models learn',
          containingBlock: 'A model learns a contextual representation from examples.',
          before: 'The paragraph before introduces the subject.',
          after: 'The paragraph after expands on the idea.',
        },
        page: {
          title: 'Contextual article',
          hostname: 'example.com',
          language: 'en',
        },
      },
    });
  });

  it('captures the sentence containing the exact selected occurrence', () => {
    document.body.innerHTML = `
      <p id="target">Cache is discussed first. This cache is the selected occurrence. Cache appears again.</p>
    `;
    const node = document.querySelector('#target')!.firstChild!;
    const occurrence = node.textContent!.indexOf('cache');
    selectRange(node, occurrence, node, occurrence + 'cache'.length);

    const result = captureSelectionSnapshot(createOptions());

    expect(result.status).toBe('captured');
    if (result.status === 'captured') {
      expect(result.snapshot.context.immediate).toBe(
        'This cache is the selected occurrence.',
      );
    }
  });

  it('captures selections spanning multiple blocks', () => {
    document.body.innerHTML = `
      <h1>Topic</h1>
      <p id="first">First paragraph text.</p>
      <p id="second">Second paragraph text.</p>
      <p>Following paragraph.</p>
    `;
    const first = document.querySelector('#first')!.firstChild!;
    const second = document.querySelector('#second')!.firstChild!;
    selectRange(first, 0, second, second.textContent!.length);

    const result = captureSelectionSnapshot(createOptions());

    expect(result.status).toBe('captured');
    if (result.status === 'captured') {
      expect(result.snapshot.selectedText).toContain('First paragraph text.');
      expect(result.snapshot.selectedText).toContain('Second paragraph text.');
      expect(result.snapshot.context.containingBlock).toBe(
        'First paragraph text.\n\nSecond paragraph text.',
      );
      expect(result.snapshot.context.immediate).toBe(
        'First paragraph text.\n\nSecond paragraph text.',
      );
      expect(result.snapshot.context.after).toBe('Following paragraph.');
    }
  });

  it('skips hidden adjacent content', () => {
    document.body.innerHTML = `
      <p>Visible before.</p>
      <p hidden>Hidden noise.</p>
      <p id="target">Selected paragraph.</p>
    `;
    selectText(document.querySelector('#target')!.firstChild!);

    const result = captureSelectionSnapshot(createOptions());

    expect(result.status).toBe('captured');
    if (result.status === 'captured') {
      expect(result.snapshot.context.before).toBe('Visible before.');
    }
  });

  it('omits a heading when none precedes the selected block', () => {
    document.body.innerHTML = `<p id="target">A standalone paragraph.</p>`;
    selectText(document.querySelector('#target')!.firstChild!);

    const result = captureSelectionSnapshot(createOptions());

    expect(result.status).toBe('captured');
    if (result.status === 'captured') {
      expect(result.snapshot.context.heading).toBeUndefined();
      expect(result.snapshot.context.containingBlock).toBe('A standalone paragraph.');
    }
  });

  it('does not duplicate the section heading or include link navigation as adjacent prose', () => {
    document.body.innerHTML = `
      <section class="featured-card">
        <h2>From today's featured article</h2>
        <p id="target">
          <a href="/wiki/Ellis_Wackett">Ellis Wackett</a> was a senior commander in the
          <a href="/wiki/RAAF">Royal Australian Air Force</a>. The rest of the featured
          article excerpt supplies enough context for the selection.
        </p>
        <p class="related-links">
          Recently featured:
          <a href="/wiki/Yongle_Emperor">Yongle Emperor</a> ·
          <a href="/wiki/Grey-cowled_wood_rail">Grey-cowled wood rail</a> ·
          <a href="/wiki/Toys_for_Bob">Toys for Bob</a>
        </p>
      </section>
      <h2>Did you know ...</h2>
      <p>Content from the next section.</p>
    `;
    const target = document.querySelector('#target')!;
    const textNode = Array.from(target.childNodes).find((node) =>
      node.textContent?.includes('was a senior commander'),
    )!;
    const start = textNode.textContent!.indexOf('was a senior commander');
    selectRange(textNode, start, textNode, start + 'was a senior commander'.length);

    const result = captureSelectionSnapshot(createOptions());

    expect(result.status).toBe('captured');
    if (result.status === 'captured') {
      expect(result.snapshot.context.heading).toBe("From today's featured article");
      expect(result.snapshot.context.before).toBeUndefined();
      expect(result.snapshot.context.after).toBeUndefined();
    }
  });

  it('does not cross a section heading to find adjacent prose', () => {
    document.body.innerHTML = `
      <h2>First section</h2>
      <p id="target">The only paragraph in this section.</p>
      <h2>Second section</h2>
      <p>Unrelated prose in the next section.</p>
    `;
    selectText(document.querySelector('#target')!.firstChild!);

    const result = captureSelectionSnapshot(createOptions());

    expect(result.status).toBe('captured');
    if (result.status === 'captured') {
      expect(result.snapshot.context.before).toBeUndefined();
      expect(result.snapshot.context.after).toBeUndefined();
    }
  });

  it('excludes prose inside navigation landmarks', () => {
    document.body.innerHTML = `
      <article>
        <h2>Topic</h2>
        <nav><p>Navigate to a related article with explanatory-looking text.</p></nav>
        <p id="target">The selected article paragraph.</p>
      </article>
    `;
    selectText(document.querySelector('#target')!.firstChild!);

    const result = captureSelectionSnapshot(createOptions());

    expect(result.status).toBe('captured');
    if (result.status === 'captured') {
      expect(result.snapshot.context.before).toBeUndefined();
    }
  });

  it('captures a contenteditable selection as DOM content', () => {
    document.body.innerHTML = `
      <h2>Draft notes</h2>
      <div contenteditable="true" id="editor">An editable contextual phrase.</div>
    `;
    selectText(document.querySelector('#editor')!.firstChild!);

    expect(captureSelectionSnapshot(createOptions())).toMatchObject({
      status: 'captured',
      source: 'dom',
      snapshot: {
        selectedText: 'An editable contextual phrase.',
        context: {
          immediate: 'An editable contextual phrase.',
          heading: 'Draft notes',
          containingBlock: 'An editable contextual phrase.',
        },
      },
    });
  });

  it('captures a textarea selection with the field value as context', () => {
    document.body.innerHTML = `
      <h2>Editable sample</h2>
      <textarea id="editor">Text selected here should be explainable because it is editable.</textarea>
    `;
    const editor = document.querySelector<HTMLTextAreaElement>('#editor')!;
    editor.focus();
    editor.setSelectionRange(5, 18);

    expect(captureSelectionSnapshot(createOptions())).toMatchObject({
      status: 'captured',
      source: 'editable',
      snapshot: {
        selectedText: 'selected here',
        context: {
          immediate: 'Text selected here should be explainable because it is editable.',
          heading: 'Editable sample',
          containingBlock: 'Text selected here should be explainable because it is editable.',
        },
      },
    });
  });

  it('uses text-control offsets to capture immediate context', () => {
    document.body.innerHTML = `
      <textarea id="editor">Term appears first. The selected term has this meaning. Term appears last.</textarea>
    `;
    const editor = document.querySelector<HTMLTextAreaElement>('#editor')!;
    const start = editor.value.indexOf('term');
    editor.focus();
    editor.setSelectionRange(start, start + 'term'.length);

    const result = captureSelectionSnapshot(createOptions());

    expect(result.status).toBe('captured');
    if (result.status === 'captured') {
      expect(result.snapshot.context.immediate).toBe('The selected term has this meaning.');
    }
  });

  it('still rejects password and oversized selections', () => {
    document.body.innerHTML = `<input id="password" type="password" value="private secret">`;
    const password = document.querySelector<HTMLInputElement>('#password')!;
    password.focus();
    password.setSelectionRange(0, password.value.length);

    expect(captureSelectionSnapshot(createOptions())).toMatchObject({
      status: 'rejected',
      reason: 'editable-selection',
    });

    document.body.innerHTML = `<p id="long">${'x'.repeat(MAX_SELECTION_CHARACTERS + 1)}</p>`;
    selectText(document.querySelector('#long')!.firstChild!);

    expect(captureSelectionSnapshot(createOptions())).toMatchObject({
      status: 'rejected',
      reason: 'selection-too-long',
    });
  });
});

describe('extractPageHostname', () => {
  it('keeps only the hostname from page URLs', () => {
    expect(extractPageHostname('https://user:secret@example.com/article?q=private#section')).toBe(
      'example.com',
    );
  });
});

function createOptions() {
  return {
    document,
    selection: window.getSelection(),
    pageUrl: 'https://example.com/articles/models?source=test#details',
    browserLanguage: 'pt-BR',
  };
}

function selectText(node: Node): void {
  selectRange(node, 0, node, node.textContent!.length);
}

function selectRange(startNode: Node, startOffset: number, endNode: Node, endOffset: number): void {
  const range = document.createRange();
  range.setStart(startNode, startOffset);
  range.setEnd(endNode, endOffset);
  const selection = window.getSelection()!;
  selection.removeAllRanges();
  selection.addRange(range);
}
