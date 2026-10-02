/**
 * Markdown-lite for Claude's replies in the chat (PLAN.md#6.6): paragraphs, headings, fenced code,
 * bullet/numbered lists, `inline code`, **bold** and *italic*. The parser returns plain nodes that
 * React renders as elements, so text is never interpreted as HTML (tags, entities and links stay
 * literal text) and nothing is ever navigable. Control and bidi-override characters are removed.
 */

export type Inline =
  | { readonly type: 'text'; readonly text: string }
  | { readonly type: 'code'; readonly text: string }
  | { readonly type: 'strong'; readonly children: readonly Inline[] }
  | { readonly type: 'em'; readonly children: readonly Inline[] };

export type Block =
  | { readonly type: 'paragraph'; readonly children: readonly Inline[] }
  | { readonly type: 'heading'; readonly children: readonly Inline[] }
  | { readonly type: 'code'; readonly language: string; readonly text: string }
  | {
      readonly type: 'list';
      readonly ordered: boolean;
      readonly items: readonly (readonly Inline[])[];
    };

/** Longest reply rendered (the rest is cut with an ellipsis). */
export const MAX_MARKDOWN_CHARS = 40_000;

// C0/C1 controls (except tab and newline) and bidi overrides/isolates (text spoofing).
// eslint-disable-next-line no-control-regex -- removing control characters is the point
const UNSAFE_CHARACTERS = /[\u0000-\u0008\u000b-\u001f\u007f-\u009f‪-‮⁦-⁩]/g;

export function sanitizeText(text: string): string {
  const clean = text.replace(/\r\n?/g, '\n').replace(UNSAFE_CHARACTERS, '');
  return clean.length <= MAX_MARKDOWN_CHARS ? clean : `${clean.slice(0, MAX_MARKDOWN_CHARS)}…`;
}

const INLINE_TOKEN = /`([^`\n]+)`|\*\*([^*\n]+?)\*\*|(?<![\w*])\*([^*\s][^*\n]*?)\*(?![\w*])/g;

export function parseInline(text: string): Inline[] {
  const nodes: Inline[] = [];
  let cursor = 0;
  for (const match of text.matchAll(INLINE_TOKEN)) {
    const index = match.index;
    if (index > cursor) nodes.push({ type: 'text', text: text.slice(cursor, index) });
    const [, code, strong, em] = match;
    if (code !== undefined) nodes.push({ type: 'code', text: code });
    else if (strong !== undefined) nodes.push({ type: 'strong', children: parseInline(strong) });
    else if (em !== undefined) nodes.push({ type: 'em', children: parseInline(em) });
    cursor = index + match[0].length;
  }
  if (cursor < text.length) nodes.push({ type: 'text', text: text.slice(cursor) });
  return nodes;
}

const FENCE = /^\s*```\s*([\w+-]*)\s*$/;
const HEADING = /^\s{0,3}#{1,6}\s+(.*)$/;
const BULLET = /^\s*[-*+]\s+(.*)$/;
const NUMBERED = /^\s*\d{1,3}[.)]\s+(.*)$/;

function listItem(line: string): { ordered: boolean; text: string } | undefined {
  const bullet = BULLET.exec(line);
  if (bullet) return { ordered: false, text: bullet[1] ?? '' };
  const numbered = NUMBERED.exec(line);
  return numbered ? { ordered: true, text: numbered[1] ?? '' } : undefined;
}

export function parseMarkdownLite(input: string): Block[] {
  const lines = sanitizeText(input).split('\n');
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  const flush = (): void => {
    if (paragraph.length > 0) {
      blocks.push({ type: 'paragraph', children: parseInline(paragraph.join('\n')) });
      paragraph = [];
    }
  };
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? '';
    const fence = FENCE.exec(line);
    if (fence) {
      flush();
      const body: string[] = [];
      index += 1;
      while (index < lines.length && !FENCE.test(lines[index] ?? '')) {
        body.push(lines[index] ?? '');
        index += 1;
      }
      blocks.push({ type: 'code', language: fence[1] ?? '', text: body.join('\n') });
      continue;
    }
    const heading = HEADING.exec(line);
    if (heading) {
      flush();
      blocks.push({ type: 'heading', children: parseInline(heading[1] ?? '') });
      continue;
    }
    const item = listItem(line);
    if (item) {
      flush();
      const last = blocks.at(-1);
      const inline = parseInline(item.text);
      if (last?.type === 'list' && last.ordered === item.ordered) {
        blocks[blocks.length - 1] = { ...last, items: [...last.items, inline] };
      } else {
        blocks.push({ type: 'list', ordered: item.ordered, items: [inline] });
      }
      continue;
    }
    if (line.trim() === '') flush();
    else paragraph.push(line);
  }
  flush();
  return blocks;
}
