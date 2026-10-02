import { describe, expect, it } from 'vitest';
import {
  MAX_MARKDOWN_CHARS,
  parseInline,
  parseMarkdownLite,
  sanitizeText,
  type Block,
  type Inline,
} from './markdown-lite.js';

/** Every text the renderer would put on screen (it renders nodes as text, never as HTML). */
function texts(blocks: readonly Block[]): string {
  const inline = (nodes: readonly Inline[]): string =>
    nodes
      .map((node) =>
        node.type === 'text' || node.type === 'code' ? node.text : inline(node.children),
      )
      .join('');
  return blocks
    .map((block) => {
      if (block.type === 'code') return block.text;
      if (block.type === 'list') return block.items.map(inline).join('|');
      return inline(block.children);
    })
    .join('\n');
}

describe('parseInline', () => {
  it('parses code, bold and italic; leaves the rest as text', () => {
    expect(parseInline('Run `reelforge lint`, **then** check *frames* 2*3*4')).toEqual([
      { type: 'text', text: 'Run ' },
      { type: 'code', text: 'reelforge lint' },
      { type: 'text', text: ', ' },
      { type: 'strong', children: [{ type: 'text', text: 'then' }] },
      { type: 'text', text: ' check ' },
      { type: 'em', children: [{ type: 'text', text: 'frames' }] },
      { type: 'text', text: ' 2*3*4' },
    ]);
    expect(parseInline('**`s02`** scale')).toEqual([
      { type: 'strong', children: [{ type: 'code', text: 's02' }] },
      { type: 'text', text: ' scale' },
    ]);
  });
});

describe('parseMarkdownLite', () => {
  it('builds paragraphs, headings, lists and fenced code', () => {
    const blocks = parseMarkdownLite(
      '## Done\nScaled the calculator\nto 1.6x.\n\n- lint ok\n- frames ok\n1. first\n2) second\n```js\nconst a = 1;\n\n```\ntail',
    );
    expect(blocks.map((block) => block.type)).toEqual([
      'heading',
      'paragraph',
      'list',
      'list',
      'code',
      'paragraph',
    ]);
    expect(blocks[1]).toEqual({
      type: 'paragraph',
      children: [{ type: 'text', text: 'Scaled the calculator\nto 1.6x.' }],
    });
    expect(blocks[2]).toMatchObject({
      ordered: false,
      items: [[{ text: 'lint ok' }], [{ text: 'frames ok' }]],
    });
    expect(blocks[3]).toMatchObject({ ordered: true });
    expect(blocks[4]).toEqual({ type: 'code', language: 'js', text: 'const a = 1;\n' });
  });

  it('keeps HTML, entities and links as literal text (nothing is executable or navigable)', () => {
    const hostile =
      '<script>alert(1)</script> <img src=x onerror="alert(2)"> &lt;b&gt; [click](javascript:alert(3))';
    const blocks = parseMarkdownLite(hostile);
    expect(blocks).toEqual([{ type: 'paragraph', children: [{ type: 'text', text: hostile }] }]);
    const code = parseMarkdownLite('```html\n<iframe src="https://evil">\n```');
    expect(code).toEqual([{ type: 'code', language: 'html', text: '<iframe src="https://evil">' }]);
  });

  it('removes control and bidi-override characters and caps the length', () => {
    expect(sanitizeText('a\u0000b‮c⁦d\r\ne\tf')).toBe('abcd\ne\tf');
    const long = parseMarkdownLite('x'.repeat(MAX_MARKDOWN_CHARS + 10));
    expect(texts(long)).toHaveLength(MAX_MARKDOWN_CHARS + 1);
    expect(texts(long).endsWith('…')).toBe(true);
  });

  it('treats an unclosed fence as code until the end', () => {
    expect(parseMarkdownLite('text\n```\ncode')).toEqual([
      { type: 'paragraph', children: [{ type: 'text', text: 'text' }] },
      { type: 'code', language: '', text: 'code' },
    ]);
  });
});
