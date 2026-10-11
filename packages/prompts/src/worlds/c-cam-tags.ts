/**
 * The cast and place tags of a Grim Ink storyboard intent (PLAN.md#14.11): the first intent that
 * shows a role introduces it with a description in parentheses (`cast: nightPorter (the hotel's
 * night porter; axis: …), guest`), later intents name the id only; every setting is
 * `place: boilerRoom`. Ids are camelCase (kebab-case spellings are read the same: `place:
 * boiler-room` = `boilerRoom`). A tag runs to the next `|`, `;` at the top level, newline, sentence
 * end or another tag (including the gag hint, `gag: nightPorter on …`). One reader for the module
 * builder (stages c-cam/design.ts) and the storyboard's casting check (direction-storyboard.ts).
 */
import { normalizePropName } from '@reelforge/shared';
import { C_CAM_CAST_TAG, C_CAM_GAG_TAG, C_CAM_PLACE_TAG } from './c-cam-api.js';

export interface IntentTagEntry {
  readonly id: string;
  /** The tag's description in parentheses, or undefined. */
  readonly description: string | undefined;
}

export interface IntentTags {
  readonly cast: readonly IntentTagEntry[];
  readonly place: IntentTagEntry | undefined;
}

/** Words that fill a tag without naming anyone. */
const NOBODY = new Set(['none', 'nobody', 'no', 'na', 'empty', 'nothing']);
const MAX_ID_LENGTH = 40;

/** The start of another tag (the gag hint follows the cast in an intent, PLAN.md#14.15). */
const OTHER_TAG = new RegExp(
  `^\\s(?:${[C_CAM_CAST_TAG, C_CAM_PLACE_TAG, C_CAM_GAG_TAG].map((tag) => tag.replace(':', '')).join('|')})\\s*:`,
  'i',
);

/** The tag's text: from after the tag to its end at paren depth 0. */
function tagSegment(intent: string, tag: string): string | undefined {
  const match = new RegExp(`(?:^|[\\s|(;,\`'"])${tag.replace(':', '\\s*:')}`, 'i').exec(intent);
  if (match === null) return undefined;
  const start = match.index + match[0].length;
  let depth = 0;
  for (let index = start; index < intent.length; index += 1) {
    const char = intent.charAt(index);
    if (char === '(') depth += 1;
    else if (char === ')') depth = Math.max(0, depth - 1);
    else if (depth === 0) {
      const rest = intent.slice(index);
      if (/^[|;\n]/.test(rest) || /^\.(\s|$)/.test(rest)) return intent.slice(start, index);
      if (OTHER_TAG.test(rest)) return intent.slice(start, index);
    }
  }
  return intent.slice(start);
}

/** Top-level comma-separated items of a segment. */
function items(segment: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let current = '';
  for (const char of segment) {
    if (char === '(') depth += 1;
    if (char === ')') depth = Math.max(0, depth - 1);
    if (char === ',' && depth === 0) {
      out.push(current);
      current = '';
    } else current += char;
  }
  out.push(current);
  return out.map((item) => item.trim()).filter((item) => item !== '');
}

function entryOf(item: string): IntentTagEntry | undefined {
  const head = /^[`'"]?([A-Za-z][A-Za-z0-9_-]*)/.exec(item)?.[1];
  if (head === undefined || NOBODY.has(head.toLowerCase())) return undefined;
  const id = normalizePropName(head);
  if (id === undefined || id.length > MAX_ID_LENGTH) return undefined;
  const open = item.indexOf('(');
  const close = item.lastIndexOf(')');
  const detail = open >= 0 && close > open ? item.slice(open + 1, close).trim() : '';
  return { id, description: detail === '' ? undefined : detail };
}

export function intentTags(intent: string): IntentTags {
  const cast = items(tagSegment(intent, C_CAM_CAST_TAG) ?? '')
    .map(entryOf)
    .filter((entry) => entry !== undefined);
  const [place] = items(tagSegment(intent, C_CAM_PLACE_TAG) ?? '')
    .map(entryOf)
    .filter((entry) => entry !== undefined);
  return { cast, place };
}

/** The ids the intent's `cast:` tag names (normalized like the module file names). */
export function castTagIds(intent: string): string[] {
  return intentTags(intent).cast.map((entry) => entry.id);
}
