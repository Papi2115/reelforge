/**
 * One line per kit catalog entry, at three levels of detail: `full` (every param with type and
 * default, as in 1.x), `names` (param names only) and `short` (name, look tag, first sentence of
 * the description). `reelforge kit-docs <name>` always has the whole entry.
 */
import { VOXEL_LOOK_ID, type KitCatalogEntry } from '@reelforge/kit';
import { formatParam, paramDocs } from './schema-docs.js';

export type EntryDetail = 'full' | 'names' | 'short';

export const ENTRY_DETAILS: readonly EntryDetail[] = ['full', 'names', 'short'];

export const NAMESPACE: Readonly<Record<KitCatalogEntry['kind'], string>> = {
  env: 'env',
  prop: 'props',
  fx: 'fx',
};

/** Longest description a `short` line keeps (cut at a word, marked with "…"). */
const SHORT_DESCRIPTION = 140;
/** A period that ends a sentence (not "e.g." / "i.e." / "etc." / "vs."). */
const SENTENCE_END = /(?<!\b(?:e\.g|i\.e|etc|vs))\.(?=\s|$)/;

export function callName(entry: KitCatalogEntry): string {
  return `kit.${NAMESPACE[entry.kind]}.${entry.name}`;
}

export function originNote(entry: KitCatalogEntry): string {
  if (entry.origin === 'project') return ' (project-local, kit-ext/props)';
  // Voxel entries carry no note: with only the voxel look the text reads as before looks.
  return entry.look === undefined || entry.look === VOXEL_LOOK_ID ? '' : ` (look ${entry.look})`;
}

/** The look an entry belongs to (project props and untagged entries: voxel). */
export function entryLook(entry: KitCatalogEntry): string {
  return entry.look ?? VOXEL_LOOK_ID;
}

/** First sentence of a description, at most SHORT_DESCRIPTION characters. */
export function shortDescription(description: string): string {
  const end = SENTENCE_END.exec(description);
  const sentence = end === null ? description : description.slice(0, end.index + 1);
  if (sentence.length <= SHORT_DESCRIPTION) return sentence;
  const cut = sentence.slice(0, SHORT_DESCRIPTION - 1);
  const space = cut.lastIndexOf(' ');
  return `${(space > 0 ? cut.slice(0, space) : cut).replace(/[\s,;:]+$/, '')}…`;
}

export function entryLine(entry: KitCatalogEntry, detail: EntryDetail = 'full'): string {
  if (detail === 'short') {
    return `  ${callName(entry)}${originNote(entry)} — ${shortDescription(entry.description)}`;
  }
  const params = paramDocs(entry.params).map((param) =>
    detail === 'full' ? formatParam(param) : `${param.name}${param.required ? '' : '?'}`,
  );
  return `  ${callName(entry)}({ ${params.join(', ')} })${originNote(entry)} — ${entry.description}`;
}
