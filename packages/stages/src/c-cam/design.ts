/**
 * The design list of a Grim Ink film (PLAN.md#14.11): its people and places, read from the
 * storyboard's intent tags (`cast:` / `place:`, read by `intentTags` of @reelforge/prompts). Every
 * person is one hand-built module (one Opus turn, about 1 USD): a film builds at most
 * DIRECTION_MAX_CAST (8) people, the most important first (the direction plan's ensemble order:
 * title-frame people, gag carriers, then by part; unplanned people by their number of shots), so
 * a cap drops the least important ones (PLAN.md#14.16 casting).
 */
import { castByImportance, intentTags } from '@reelforge/prompts';
import {
  DIRECTION_MAX_CAST,
  INK_MODULE_LIMITS,
  type DirectionFile,
  type InkModuleKind,
  type StoryboardShot,
  type WordsFile,
} from '@reelforge/shared';

export { intentTags, type IntentTags } from '@reelforge/prompts';

export interface InkModuleDesign {
  readonly kind: InkModuleKind;
  readonly id: string;
  /** The tag's description (first one found), or undefined. */
  readonly description: string | undefined;
  /** Shots that name it, in storyboard order. */
  readonly shots: readonly StoryboardShot[];
}

interface Draft {
  kind: InkModuleKind;
  id: string;
  description: string | undefined;
  shots: StoryboardShot[];
}

/** People in order of importance: the plan's ensemble order, then by shots (ties: first seen). */
function byImportance(people: readonly Draft[], plan: DirectionFile | undefined): Draft[] {
  const planned = plan === undefined ? [] : castByImportance(plan);
  const rank = (draft: Draft): number => {
    const at = planned.indexOf(draft.id);
    return at >= 0 ? at : planned.length;
  };
  return people
    .map((draft, order) => ({ draft, order }))
    .sort(
      (a, b) =>
        rank(a.draft) - rank(b.draft) ||
        b.draft.shots.length - a.draft.shots.length ||
        a.order - b.order,
    )
    .map((entry) => entry.draft);
}

/**
 * People first (by importance, at most DIRECTION_MAX_CAST), then places in order of first
 * appearance (capped per kind); `plan`: the film's direction plan, when it has one.
 */
export function inkModuleDesigns(
  shots: readonly StoryboardShot[],
  plan?: DirectionFile,
): {
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
  const all = [...drafts.values()];
  const people = byImportance(
    all.filter((draft) => draft.kind === 'people'),
    plan,
  );
  const places = all.filter((draft) => draft.kind === 'places');
  const limits = { people: DIRECTION_MAX_CAST, places: INK_MODULE_LIMITS.maxModules } as const;
  for (const [kind, ofKind] of [
    ['people', people],
    ['places', places],
  ] as const) {
    designs.push(...ofKind.slice(0, limits[kind]));
    dropped.push(...ofKind.slice(limits[kind]).map(({ id }) => ({ kind, id })));
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
