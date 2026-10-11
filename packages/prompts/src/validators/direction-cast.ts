/**
 * The casting rules of a Grim Ink direction plan (PLAN.md#14.16 casting; docs/worlds/c-cam-DIRECTION.md
 * §4): the concept films had an ensemble (Apollo: you, the commander, the orbiter, guidance, the
 * flight director and a crowd), so a plan names at least `castTarget(duration)` people, each on
 * screen in 2+ beats, 3 distinct people within the first 60 % of the runtime, nobody in more than
 * 60 % of the beats, at least one signature gag, and a `crowd` beat when the script names a group.
 * Errors carry the fix in their message (the repair turn reads them).
 */
import {
  beatCast,
  CAST_PARTS,
  type CastPart,
  type DirectionCast,
  type DirectionFile,
} from '@reelforge/shared';
import { castTarget, DIRECTION_RULES, maxPersonBeats } from './direction-rules.js';
import { issue, type ValidationIssue } from './issues.js';

const err = (code: string, message: string, path?: string): ValidationIssue =>
  issue('error', code, message, path);

/** Plural nouns of a group the narration may name (whole words, lower case). */
const GROUP_WORDS = [
  'crowd',
  'crowds',
  'audience',
  'audiences',
  'spectators',
  'onlookers',
  'bystanders',
  'soldiers',
  'troops',
  'army',
  'armies',
  'legions',
  'senators',
  'senate',
  'villagers',
  'townsfolk',
  'townspeople',
  'citizens',
  'mob',
  'protesters',
  'rioters',
  'workers',
  'miners',
  'sailors',
  'passengers',
  'guests',
  'voters',
  'students',
  'monks',
  'priests',
  'cardinals',
  'nuns',
  'knights',
  'warriors',
  'peasants',
  'farmers',
  'residents',
  'tourists',
  'pilgrims',
  'prisoners',
  'refugees',
  'employees',
  'congregation',
  'parliament',
  'jury',
] as const;

const GROUP_PATTERN = new RegExp(`\\b(${GROUP_WORDS.join('|')})\\b`, 'i');

/** The first group noun the script names (`soldiers`, `the audience`…), or undefined. */
export function groupWordOf(script: string): string | undefined {
  return GROUP_PATTERN.exec(script)?.[1]?.toLowerCase();
}

/** How many beats each cast id is on screen in. */
export function castAppearances(file: DirectionFile): Map<string, number> {
  const counts = new Map(file.cast.map((person) => [person.id, 0]));
  for (const beat of file.beats) {
    for (const id of beatCast(beat)) {
      const count = counts.get(id);
      if (count !== undefined) counts.set(id, count + 1);
    }
  }
  return counts;
}

const PART_RANK: Readonly<Record<CastPart, number>> = Object.fromEntries(
  CAST_PARTS.map((part, index) => [part, index]),
) as Record<CastPart, number>;

/**
 * Cast ids, the most important first (the order the people are built in): title-frame people in
 * their order, then gag carriers, then by part (protagonist … bystander), then by beats on screen.
 */
export function castByImportance(file: DirectionFile): string[] {
  const appearances = castAppearances(file);
  const titled = (id: string): number => {
    const at = file.titleFrame.cast.indexOf(id);
    return at >= 0 ? at : file.titleFrame.cast.length;
  };
  const score = (person: DirectionCast): number[] => [
    titled(person.id),
    person.signatureGag === undefined ? 1 : 0,
    person.part === undefined ? CAST_PARTS.length : PART_RANK[person.part],
    -(appearances.get(person.id) ?? 0),
  ];
  return file.cast
    .map((person, order) => ({ person, order, key: score(person) }))
    .sort((a, b) => {
      for (let index = 0; index < a.key.length; index += 1) {
        const delta = (a.key[index] ?? 0) - (b.key[index] ?? 0);
        if (delta !== 0) return delta;
      }
      return a.order - b.order;
    })
    .map((entry) => entry.person.id);
}

const LEAD_MAX_SHARE = 0.85;

const PARTS_HINT =
  'protagonist, foil/antagonist, authority, helper/confidant, comic relief, bystander';

function sizeIssues(file: DirectionFile, durationS: number): ValidationIssue[] {
  const target = castTarget(durationS);
  if (file.cast.length >= target) return [];
  const used = new Set(
    file.cast.flatMap((person) => (person.part === undefined ? [] : [person.part])),
  );
  const open = CAST_PARTS.filter((part) => !used.has(part));
  return [
    err(
      'direction-cast-size',
      `the cast has ${String(file.cast.length)} people; a ${durationS.toFixed(0)} s film casts at least ${String(target)}: add ${String(target - file.cast.length)} more the narration implies (parts still open: ${open.join(', ') || PARTS_HINT}), each with a distinct silhouette, a part in the story and "people" entries on 2+ beats (only the 2-3 main ones need a signature gag)`,
      'cast',
    ),
  ];
}

function presenceIssues(file: DirectionFile): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const appearances = castAppearances(file);
  const limit = maxPersonBeats(file.beats.length);
  file.cast.forEach((person, index) => {
    const count = appearances.get(person.id) ?? 0;
    if (count < DIRECTION_RULES.minPersonBeats) {
      issues.push(
        err(
          'direction-cast-presence',
          `${person.id} is on screen in ${String(count)} beat(s): list "${person.id}" in the "people" of at least ${String(DIRECTION_RULES.minPersonBeats)} beats where the story gives them a reason (a reaction, an OTS, the other side of a cut)`,
          `cast[${String(index)}]`,
        ),
      );
    }
    // The protagonist carries the film (the Apollo prototype's lead is in 11 of 13 shots): up to 85 % of the beats.
    const isLead =
      person.part === 'protagonist' ||
      (index === 0 && !file.cast.some((entry) => entry.part === 'protagonist'));
    const personLimit = isLead
      ? Math.max(limit, Math.ceil(file.beats.length * LEAD_MAX_SHARE))
      : limit;
    if (count > personLimit) {
      issues.push(
        err(
          'direction-cast-overexposed',
          `${person.id} is on screen in ${String(count)} of ${String(file.beats.length)} beats (at most ${String(personLimit)}, ${String(isLead ? LEAD_MAX_SHARE * 100 : DIRECTION_RULES.maxPersonShare * 100)} %): give some of those beats to the other people (their reaction, their side of the story)`,
          `cast[${String(index)}]`,
        ),
      );
    }
  });
  return issues;
}

function earlyIssues(file: DirectionFile, durationS: number): ValidationIssue[] {
  const until = DIRECTION_RULES.earlyShare * durationS;
  const early = new Set(
    file.beats.filter((beat) => beat.span.t0 < until).flatMap((beat) => beatCast(beat)),
  );
  const cast = new Set(file.cast.map((person) => person.id));
  const seen = [...early].filter((id) => cast.has(id));
  const needed = Math.min(DIRECTION_RULES.earlyPeople, file.cast.length);
  if (seen.length >= needed) return [];
  return [
    err(
      'direction-cast-early',
      `only ${String(seen.length)} people are on screen before ${until.toFixed(1)} s (${String(DIRECTION_RULES.earlyShare * 100)} % of the film): introduce at least ${String(needed)} distinct people by then ("people" of the early beats)`,
      'beats',
    ),
  ];
}

function refIssues(file: DirectionFile): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const cast = new Map(file.cast.map((person) => [person.id, person]));
  file.beats.forEach((beat, index) => {
    const path = `beats[${String(index)}]`;
    for (const ref of beat.people ?? []) {
      if (!cast.has(ref)) {
        issues.push(
          err(
            'direction-unknown-ref',
            `beat ${beat.id} puts "${ref}" on screen, who is not in the cast`,
            `${path}.people`,
          ),
        );
      }
    }
    for (const ref of beat.gagRefs) {
      const person = cast.get(ref);
      if (person !== undefined && person.signatureGag === undefined) {
        issues.push(
          err(
            'direction-unknown-ref',
            `beat ${beat.id} plays the gag of "${ref}", who has no signatureGag: give ${ref} one or list them in "people" instead`,
            `${path}.gagRefs`,
          ),
        );
      }
    }
  });
  return issues;
}

function gagCountIssues(file: DirectionFile): ValidationIssue[] {
  const carriers = file.cast.filter((person) => person.signatureGag !== undefined).length;
  return carriers >= DIRECTION_RULES.minGagPeople
    ? []
    : [
        err(
          'direction-cast-gags',
          'nobody has a signature gag: give the 2-3 main people ONE each (setup, escalation, payoff)',
          'cast',
        ),
      ];
}

function crowdIssues(file: DirectionFile, script: string | undefined): ValidationIssue[] {
  const word = script === undefined ? undefined : groupWordOf(script);
  if (word === undefined || file.beats.some((beat) => beat.crowd !== undefined)) return [];
  return [
    err(
      'direction-crowd',
      `the narration names a group ("${word}") but no beat has a "crowd": give the beat where it is said a "crowd" (who they are and what they do as one body; drawn with ink.crowd, never a module)`,
      'beats',
    ),
  ];
}

/** Casting checks on a parsed plan. */
export function castIssues(
  file: DirectionFile,
  options: { readonly durationS: number; readonly script?: string | undefined },
): ValidationIssue[] {
  return [
    ...sizeIssues(file, options.durationS),
    ...refIssues(file),
    ...presenceIssues(file),
    ...earlyIssues(file, options.durationS),
    ...gagCountIssues(file),
    ...crowdIssues(file, options.script),
  ];
}
