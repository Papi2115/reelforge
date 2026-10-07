/**
 * What a world asset is (PLAN.md#13.15, real runs Game B2 2 / Game B1 2): its words from
 * `assets/cast.json` (name, kind) and its own definition (description, generator, kind, role),
 * compared with what the blind critic says it sees ("name each thing"), and the guard against
 * invented people: a person asset needs a person or role the narration (`script.txt`) names.
 */
import type { WorldAssetFiles } from '@reelforge/cli/service';
import type { WorldAssetSet } from '@reelforge/engine';
import type { WorldCastEntry } from '@reelforge/shared';

export interface AssetFacts {
  readonly id: string;
  /** The world's kind of the asset (`sprites`, `figures`, …). */
  readonly section: string;
  readonly cast?: WorldCastEntry | undefined;
  /** String fields of its definition: description, gen, kind, role, type, draw, name, label. */
  readonly traits: readonly string[];
  /** Its `role` field (Game B1 people), a head noun like the cast name. */
  readonly role?: string | undefined;
}

const TRAIT_KEYS = new Set(['description', 'gen', 'kind', 'role', 'type', 'draw', 'name', 'label']);

/** Words that say nothing about what a thing is (articles, colours, sizes, vague shapes). */
const VAGUE = new Set(
  (
    'a an the of in on at with and or to for its it this that some one two three ' +
    'red green blue yellow orange purple pink brown black white grey gray gold silver dark light pale ' +
    'small big large tiny little huge tall short old young new round square shape blob smudge ' +
    'thing object item stuff mark spot dot line pixel pixels sprite drawing picture image icon'
  ).split(' '),
);

/** Words that only say "a person" (the narration must still name somebody). */
const PEOPLE = new Set(
  (
    'person people man men woman women human humans figure character someone somebody ' +
    'boy girl child children kid kids guy crowd stick'
  ).split(' '),
);

/** Role words that make an asset a person (real runs: keeper, clerk, dad, narrator). */
const ROLES = new Set(
  (
    'keeper clerk dad mum mom father mother parent narrator host guide ranger guard worker ' +
    'scientist teacher farmer captain pilot crew astronaut diver fisherman villager merchant ' +
    'king queen knight soldier doctor nurse officer detective engineer student driver sailor'
  ).split(' '),
);

const ANIMAL_GENS = new Set(
  'animal bird fish insect reptile creature beast mammal plant tree'.split(' '),
);

/** Category words a viewer may use instead of the name. */
const CATEGORY: Readonly<Record<string, readonly string[]>> = {
  character: ['person', 'man', 'woman', 'figure', 'character', 'human', 'people', 'boy', 'girl'],
  animal: ['animal', 'creature'],
  texture: ['texture', 'pattern', 'wall', 'tile', 'floor', 'surface'],
  place: ['place', 'landscape', 'scene', 'room', 'background', 'backdrop'],
};

/** "Ranger's" → ranger, keepers → keeper, berries → berry, boxes → box, men → man. */
function singular(word: string): string {
  const base = word.replace(/'s$/, '');
  if (base.endsWith('men')) return `${base.slice(0, -3)}man`;
  if (base.endsWith('ies') && base.length > 4) return `${base.slice(0, -3)}y`;
  if (/(s|x|ch|sh)es$/.test(base)) return base.slice(0, -2);
  if (base.endsWith('s') && !base.endsWith('ss') && base.length > 3) return base.slice(0, -1);
  return base;
}

/** Lower-case singular words of a text (ids split on dashes and camelCase). */
export function wordsOf(text: string): string[] {
  return text
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .split(/[^a-z']+/)
    .map((word) => word.replace(/^'+|'+$/g, ''))
    .filter((word) => word.length > 1)
    .map(singular);
}

const telling = (words: readonly string[]): string[] => words.filter((word) => !VAGUE.has(word));

function traitsOf(value: unknown, depth = 0): (readonly [string, string])[] {
  if (value === null || typeof value !== 'object' || Array.isArray(value) || depth > 1) return [];
  return Object.entries(value).flatMap(([key, field]): (readonly [string, string])[] =>
    typeof field === 'string'
      ? TRAIT_KEYS.has(key)
        ? [[key, field]]
        : []
      : traitsOf(field, depth + 1),
  );
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

/** The definition of `id` in the asset files (`{ <section>: { <id>: … } }` or a file per id). */
function definitionOf(files: WorldAssetFiles, id: string): unknown {
  for (const entry of files.files) {
    let value: unknown;
    try {
      value = JSON.parse(entry.source);
    } catch (error) {
      if (error instanceof SyntaxError) continue;
      throw error;
    }
    if (!isRecord(value)) continue;
    if (value['id'] === id) return value;
    for (const section of Object.values(value)) {
      if (isRecord(section) && Object.hasOwn(section, id)) return section[id];
    }
  }
  return undefined;
}

export function assetFacts(
  files: WorldAssetFiles,
  set: WorldAssetSet,
  cast: readonly WorldCastEntry[],
): AssetFacts[] {
  return Object.entries(set.ids.byKind).flatMap(([section, ids]) =>
    ids.map((id) => {
      const traits = traitsOf(definitionOf(files, id));
      return {
        id,
        section,
        cast: cast.find((entry) => entry.id === id),
        traits: traits.map(([, value]) => value),
        role: traits.find(([key]) => key === 'role')?.[1],
      };
    }),
  );
}

const label = (facts: AssetFacts): string =>
  facts.cast === undefined ? facts.id : `${facts.id} ("${facts.cast.name}")`;

/** True when the critic's words name the asset, a trait of it or its category. */
export function readsAs(sees: string, facts: AssetFacts): boolean {
  const seen = new Set(telling(wordsOf(sees)));
  const expected = [
    ...wordsOf(facts.id),
    ...wordsOf(facts.cast?.name ?? ''),
    ...facts.traits.flatMap(wordsOf),
    ...(CATEGORY[isPerson(facts) ? 'character' : (facts.cast?.kind ?? '')] ?? []),
  ];
  return telling(expected).some((word) => seen.has(word));
}

/** A person: a Sketchbook figure, a person generator, a character that is no animal, a role word. */
export function isPerson(facts: AssetFacts): boolean {
  if (facts.section === 'figures') return true;
  const traits = facts.traits.flatMap(wordsOf);
  if (traits.some((word) => word === 'person' || word === 'human' || word === 'figure'))
    return true;
  const animal = traits.some((word) => ANIMAL_GENS.has(word));
  if (facts.cast?.kind === 'character' && !animal) return true;
  const named = [...wordsOf(facts.id), ...wordsOf(facts.cast?.name ?? '')];
  return !animal && named.some((word) => ROLES.has(word));
}

/** The head nouns (last telling word) of the name, the id and the role, plus proper names. */
function personWords(facts: AssetFacts): string[] {
  const name = facts.cast?.name ?? '';
  const sources = [name, facts.id.replace(/-/g, ' '), facts.role ?? ''];
  const heads = sources.flatMap((text) => telling(wordsOf(text)).slice(-1));
  const proper = telling(wordsOf((name.match(/\b[A-Z][a-z]+/g) ?? []).join(' ')));
  return [...new Set([...heads, ...proper])];
}

/**
 * Findings for people the narration does not name: each person asset needs one of its head nouns
 * or proper names in the script (a generic "man"/"person" needs any person word there).
 */
export function inventedPeopleFindings(script: string, assets: readonly AssetFacts[]): string[] {
  const spoken = new Set(wordsOf(script));
  const anyPerson = [...spoken].some((word) => PEOPLE.has(word) || ROLES.has(word));
  return assets.filter(isPerson).flatMap((facts) => {
    const words = personWords(facts);
    const specific = words.filter((word) => !PEOPLE.has(word));
    const named = specific.length > 0 ? specific.some((word) => spoken.has(word)) : anyPerson;
    if (named) return [];
    const wanted =
      specific.length > 0 ? specific.map((word) => `"${word}"`).join(' or ') : 'person';
    return [
      `${label(facts)} is a person the narration never mentions (script.txt names no ${wanted}): remove it and its cast entry, or show the thing itself; never invent people`,
    ];
  });
}

/** Finding for a crop the critic could not name as the asset (or found unreadable/off-style). */
export function legibilityFinding(
  facts: AssetFacts,
  where: string,
  verdict: {
    readonly sees: string;
    readonly legible: boolean;
    readonly style: string;
    readonly note: string;
  },
): string | undefined {
  const fix = 'make its 2-3 defining features bigger and clearer at film size';
  if (!verdict.legible)
    return `${label(facts)} is not legible at film size (${where}): the critic sees "${verdict.sees}" (${verdict.note}); ${fix}`;
  if (!readsAs(verdict.sees, facts))
    return `${label(facts)} does not read as itself at film size (${where}): the critic sees "${verdict.sees}"; ${fix}`;
  if (verdict.style === 'off-style')
    return `${label(facts)} breaks the world's style (${where}): ${verdict.note}`;
  return undefined;
}
