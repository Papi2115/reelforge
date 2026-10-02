/**
 * Front matter of a prompt file: a `---` block with `key: value` lines, where a value is a number,
 * a bare string or a `[a, b]` list (the YAML subset the prompt files use), checked with zod.
 */
import { err, MODEL_ALIASES, ok, type Result } from '@reelforge/claude-bridge';
import { z } from 'zod';

type FrontMatterValue = string | number | readonly string[];

export const frontMatterSchema = z.strictObject({
  id: z.string().regex(/^[a-z][a-z0-9-]*$/),
  version: z.int().positive(),
  model: z.enum(MODEL_ALIASES),
  tools: z.array(z.string().min(1)).min(1),
  /** File path(s) the stage writes (may contain template variables), or `json` = JSON reply. */
  output: z.union([z.string().min(1), z.array(z.string().min(1)).min(1)]).optional(),
});
export type FrontMatter = z.infer<typeof frontMatterSchema>;

export interface SplitPrompt {
  readonly frontMatter: FrontMatter;
  /** The template body after the closing `---`. */
  readonly template: string;
}

/** Splits `a, b(c, d), e` on top-level commas (parentheses may contain commas). */
function splitList(inner: string): string[] {
  const items: string[] = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index < inner.length; index += 1) {
    const char = inner[index];
    if (char === '(') depth += 1;
    if (char === ')') depth -= 1;
    if (char === ',' && depth === 0) {
      items.push(inner.slice(start, index));
      start = index + 1;
    }
  }
  items.push(inner.slice(start));
  return items.map((item) => item.trim()).filter((item) => item !== '');
}

function parseValue(raw: string): FrontMatterValue {
  if (raw.startsWith('[') && raw.endsWith(']')) return splitList(raw.slice(1, -1));
  if (/^\d+$/.test(raw)) return Number(raw);
  return raw;
}

export function parseFrontMatter(source: string): Result<SplitPrompt, string> {
  const lines = source.replaceAll('\r\n', '\n').split('\n');
  if (lines[0] !== '---') return err('missing opening --- line');
  const end = lines.indexOf('---', 1);
  if (end === -1) return err('missing closing --- line');
  const fields: Record<string, FrontMatterValue> = {};
  for (const [offset, line] of lines.slice(1, end).entries()) {
    if (line.trim() === '') continue;
    const match = /^([A-Za-z][\w-]*):\s*(.*?)\s*$/.exec(line);
    if (match === null) return err(`line ${String(offset + 2)}: expected "key: value"`);
    const [, key = '', value = ''] = match;
    if (Object.hasOwn(fields, key)) return err(`line ${String(offset + 2)}: duplicate key ${key}`);
    fields[key] = parseValue(value);
  }
  const parsed = frontMatterSchema.safeParse(fields);
  if (!parsed.success) return err(z.prettifyError(parsed.error));
  return ok({ frontMatter: parsed.data, template: lines.slice(end + 1).join('\n') });
}
