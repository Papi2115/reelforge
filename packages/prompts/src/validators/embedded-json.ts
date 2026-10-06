/**
 * JSON inside a chatty reply (real run Sketchbook 1: Haiku answered the review triage with a
 * fenced JSON block followed by a prose paragraph, and the whole reply was rejected). The reply
 * as a whole is tried first (`parseJsonText`); then the first ``` fenced block that parses; then
 * the first balanced `{…}` object in the text. Anything found that way carries a warning.
 */
import { issue, parseJsonText, type ValidationIssue } from './issues.js';

type Parsed = ReturnType<typeof parseJsonText>;

function tryParse(text: string): { ok: true; value: unknown } | { ok: false } {
  try {
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch {
    return { ok: false }; // not JSON: the caller tries the next candidate
  }
}

/** Every ``` fenced block's body, in order. */
function fencedBlocks(text: string): string[] {
  return [...text.matchAll(/```[a-zA-Z]*\s*\n([\s\S]*?)```/g)].map((match) => match[1] ?? '');
}

/** The first balanced `{…}` (string- and escape-aware) starting at or after `from`. */
function balancedObject(text: string, from: number): { body: string; start: number } | undefined {
  const start = text.indexOf('{', from);
  if (start < 0) return undefined;
  let depth = 0;
  let inString = false;
  for (let index = start; index < text.length; index += 1) {
    const char = text[index];
    if (inString) {
      if (char === '\\') index += 1;
      else if (char === '"') inString = false;
    } else if (char === '"') inString = true;
    else if (char === '{') depth += 1;
    else if (char === '}') {
      depth -= 1;
      if (depth === 0) return { body: text.slice(start, index + 1), start };
    }
  }
  return undefined;
}

function embedded(text: string): unknown {
  for (const block of fencedBlocks(text)) {
    const parsed = tryParse(block.trim());
    if (parsed.ok) return parsed.value;
  }
  let from = 0;
  let object = balancedObject(text, from);
  while (object !== undefined) {
    const parsed = tryParse(object.body);
    if (parsed.ok) return parsed.value;
    from = object.start + 1;
    object = balancedObject(text, from);
  }
  return undefined;
}

/** `parseJsonText`, or the first JSON object embedded in the reply (with an `embedded-json` warning). */
export function parseEmbeddedJsonText(text: string): Parsed {
  const whole = parseJsonText(text);
  if (whole.parsed) return whole;
  const value = embedded(text);
  if (value === undefined) return whole;
  const warning: ValidationIssue = issue(
    'warning',
    'embedded-json',
    'JSON taken from inside a reply with other text around it',
  );
  return { parsed: true, value, issues: [warning] };
}
