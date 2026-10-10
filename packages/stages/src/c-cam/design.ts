/**
 * The design list of a Grim Ink film (PLAN.md#14.11): its people and places, read from the
 * storyboard's intent tags (`cast:` / `place:`, packages/prompts/src/worlds/c-cam-api.ts). The
 * first intent that shows a role introduces it with a description in parentheses
 * (`cast: nightPorter (the hotel's night porter; axis: …), guest`), later intents name the id
 * only; every setting is `place: boilerRoom`. Ids are camelCase (kebab-case spellings are read
 * the same: `place: boiler-room` = `boilerRoom`). A tag runs to the next `|`, `;` at the top
 * level, newline, sentence end or another tag (including the gag hint, `gag: nightPorter on …`).
 */
import { C_CAM_CAST_TAG, C_CAM_GAG_TAG, C_CAM_PLACE_TAG } from '@reelforge/prompts';
import {
  INK_MODULE_LIMITS,
  normalizePropName,
  type InkModuleKind,
  type StoryboardShot,
  type WordsFile,
} from '@reelforge/shared';

export interface InkModuleDesign {
  readonly kind: InkModuleKind;
  readonly id: string;
  /** The tag's description (first one found), or undefined. */
  readonly description: string | undefined;
  /** Shots that name it, in storyboard order. */
  readonly shots: readonly StoryboardShot[];
}

export interface IntentTags {
  readonly cast: readonly { readonly id: string; readonly description: string | undefined }[];
  readonly place: { readonly id: string; readonly description: string | undefined } | undefined;
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

function entryOf(item: string): { id: string; description: string | undefined } | undefined {
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

interface Draft {
  kind: InkModuleKind;
  id: string;
  description: string | undefined;
  shots: StoryboardShot[];
}

/** People first, then places; each kind in order of first appearance, capped per kind. */
export function inkModuleDesigns(shots: readonly StoryboardShot[]): {
  designs: InkModuleDesign[];
  dropped: { kind: InkModuleKind; id: string }[];
} {
  const drafts = new Map<string, Draft>();
  const add = (
    kind: InkModuleKind,
    entry: { id: string; description: string | undefined },
    shot: StoryboardShot,
  ): void => {
    const key = `${kind}/${entry.id}`;
    const draft = drafts.get(key) ?? { kind, id: entry.id, description: undefined, shots: [] };
    draft.description ??= entry.description;
    if (!draft.shots.includes(shot)) draft.shots.push(shot);
    drafts.set(key, draft);
  };
  for (const shot of shots) {
    const tags = intentTags(shot.intent);
    for (const entry of tags.cast) add('people', entry, shot);
    if (tags.place !== undefined) add('places', tags.place, shot);
  }
  const designs: InkModuleDesign[] = [];
  const dropped: { kind: InkModuleKind; id: string }[] = [];
  for (const kind of ['people', 'places'] as const) {
    const ofKind = [...drafts.values()].filter((draft) => draft.kind === kind);
    designs.push(...ofKind.slice(0, INK_MODULE_LIMITS.maxModules));
    dropped.push(...ofKind.slice(INK_MODULE_LIMITS.maxModules).map(({ id }) => ({ kind, id })));
  }
  return { designs, dropped };
}

/** At most this many characters of narration per module prompt. */
export const NARRATION_BUDGET = 1500;

/** What the narration says in the module's shots (`s03: "…"` per shot), within the budget. */
export function narrationExcerpt(design: InkModuleDesign, words: WordsFile | undefined): string {
  const lines = design.shots.map((shot) => {
    const spoken = (words?.words ?? [])
      .filter((word) => word.t >= shot.t0 && word.t < shot.t1)
      .map((word) => word.text)
      .join(' ');
    return spoken === ''
      ? `${shot.id}: (no words timed yet) ${shot.intent}`
      : `${shot.id}: "${spoken}"`;
  });
  const text = lines.join('\n');
  return text.length <= NARRATION_BUDGET ? text : `${text.slice(0, NARRATION_BUDGET - 1)}…`;
}

/** The module's brief: its tag description, else what kind of thing it is. */
export function designBrief(design: InkModuleDesign): string {
  if (design.description !== undefined) return `${design.id}: ${design.description}`;
  return design.kind === 'people'
    ? `${design.id}: the person the storyboard casts as "${design.id}" (read what the shots and the narration say about them)`
    : `${design.id}: the setting the storyboard calls "${design.id}" (read what the shots and the narration show there)`;
}
