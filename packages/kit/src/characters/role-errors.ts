/**
 * Readable role spec errors (ADR-026): zod issues as `path: message` lines, with "did you mean"
 * for misspelt vocabulary ids, colours and fields, and a hint when an id belongs to another field
 * ("fireHelmet is headgear"), so a spec can be fixed from the error alone.
 */
import type { z } from 'zod';
import { CAST_COLORS, STYLE_TOKENS } from './palette.js';
import { ACCESSORIES } from './role-accessories.js';
import { HELD_PROPS } from './role-held.js';
import { HAIR_STYLES, HEADGEAR } from './role-head.js';
import { LAYERS } from './role-layers.js';
import { didYouMean } from './suggest.js';

/** Accessory and held ids a spec may name (the kit's, plus project accessories). */
export interface VocabularyLists {
  readonly accessories: readonly string[];
  readonly held: readonly string[];
}

export const KIT_LISTS: VocabularyLists = { accessories: ACCESSORIES, held: HELD_PROPS };

const BODY = ['standard', 'tall', 'broad', 'kid', 'bulky'];
const SKIN = ['peach', 'tan', 'brown'];

export const ROLE_FIELDS = [
  'version',
  'id',
  'label',
  'description',
  'body',
  'skin',
  'hair',
  'headgear',
  'top',
  'layers',
  'legs',
  'shoes',
  'eyes',
  'accessories',
  'held',
] as const;

/** Common wrong field names and the field meant. */
const FIELD_ALIASES: Readonly<Record<string, string>> = {
  hat: 'headgear',
  helmet: 'headgear',
  cap: 'headgear',
  shirt: 'top',
  torso: 'top',
  pants: 'legs',
  trousers: 'legs',
  boots: 'shoes',
  prop: 'held',
  props: 'held',
  tool: 'held',
  item: 'held',
  accessory: 'accessories',
  layer: 'layers',
  clothes: 'layers',
  coat: 'layers',
  outfit: 'layers',
  name: 'label',
};

const COLORS: readonly string[] = [...CAST_COLORS, ...STYLE_TOKENS];

function sections(lists: VocabularyLists): readonly (readonly [string, readonly string[]])[] {
  return [
    ['headgear', HEADGEAR.filter((id) => id !== 'none')],
    ['layers', LAYERS],
    ['accessories', lists.accessories],
    ['held', lists.held],
    ['hair.style', HAIR_STYLES.filter((id) => id !== 'none')],
  ];
}

/** The vocabulary of the field at `path` (undefined: not a vocabulary field). */
function fieldIds(
  path: readonly PropertyKey[],
  lists: VocabularyLists,
): readonly string[] | undefined {
  const [head, second] = path;
  const last = path.at(-1);
  if (last === 'color' || last === 'trim' || last === 'detail') return COLORS;
  switch (head) {
    case 'body':
      return BODY;
    case 'skin':
      return SKIN;
    case 'hair':
      return second === 'style' ? HAIR_STYLES : undefined;
    case 'headgear':
      return HEADGEAR;
    case 'layers':
      return LAYERS;
    case 'accessories':
      return lists.accessories;
    case 'held':
      return lists.held;
    case 'legs':
      return second === 'style' ? ['pants', 'shorts'] : undefined;
    case 'shoes':
      return second === 'style' ? ['shoes', 'boots'] : undefined;
    case 'eyes':
      return second === 'style' ? ['dots', 'glow', 'none'] : undefined;
    default:
      return undefined;
  }
}

/** The value at `path` of the input (an item object's `id`). */
function valueAt(input: unknown, path: readonly PropertyKey[]): unknown {
  let value: unknown = input;
  for (const key of path) {
    if (typeof value !== 'object' || value === null) return undefined;
    value = (value as Record<PropertyKey, unknown>)[key];
  }
  if (typeof value === 'object' && value !== null && 'id' in value) {
    return value.id;
  }
  return value;
}

function otherField(value: string, own: string, lists: VocabularyLists): string {
  const found = sections(lists).find(
    ([field, ids]) => !field.startsWith(own) && ids.includes(value),
  );
  if (found === undefined) return '';
  const [field] = found;
  return ` ("${value}" is ${field === 'layers' ? 'a layer' : field}: put it in ${field})`;
}

function vocabularyMessage(
  value: string,
  path: readonly PropertyKey[],
  ids: readonly string[],
  lists: VocabularyLists,
): string {
  const own = String(path[0] ?? '');
  const elsewhere = otherField(value, own, lists);
  if (elsewhere !== '') return `"${value}" is not a ${own} id${elsewhere}`;
  return `"${value}" is not in the vocabulary${didYouMean(value, ids)}; see reelforge kit-docs characters`;
}

function unknownKeys(keys: readonly string[]): string {
  return keys
    .map((key) => {
      const alias = FIELD_ALIASES[key.toLowerCase()];
      return `unknown field "${key}"${alias === undefined ? didYouMean(key, ROLE_FIELDS) : ` (use "${alias}")`}`;
    })
    .join('; ');
}

/** `path: message` lines for the issues of a role spec parse. */
export function roleIssueMessages(
  error: z.ZodError,
  input: unknown,
  lists: VocabularyLists = KIT_LISTS,
): string[] {
  return error.issues.map((issue) => {
    const where = issue.path.join('.') || '(spec)';
    if (issue.code === 'unrecognized_keys') return `${where}: ${unknownKeys(issue.keys)}`;
    const value = valueAt(input, issue.path);
    const ids = fieldIds(issue.path, lists);
    if (typeof value === 'string' && ids !== undefined && !ids.includes(value)) {
      if (ids === COLORS) return `${where}: ${issue.message}${didYouMean(value, ids)}`;
      return `${where}: ${vocabularyMessage(value, issue.path, ids, lists)}`;
    }
    return `${where}: ${issue.message}`;
  });
}
