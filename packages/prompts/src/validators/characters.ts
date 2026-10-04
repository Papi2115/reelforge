/**
 * Character and mascot checks of the storyboard (PLAN.md#12.20, ADR-025, docs/characters.md):
 * - `mascot-without-choice` (error): `shot.mascot` in a project without a mascot (or with the
 *   classic hero, where mascots are off).
 * - `mascot-impersonation` (error): a mascot shot whose intent, action or narration names a
 *   profession, a role in the story or a title (mascot-words.ts), quotes someone, or names a
 *   person (capitalised first + last name, or an honorific + name, in the narration).
 * - `mascot-overuse` (error): more than 30% of the shots, or two mascot shots starting less than
 *   12 s apart; `mascot-gap` (warning): more than 90 s without the mascot in a film over 3 min;
 *   `mascot-in-hook` (warning): a mascot in the first 3 s outside a title card.
 * - `unknown-role` (error, pack): `newRoles` repeating an id or naming a cast member, the
 *   mannequin or a mascot; an intent calling `kit.cast.person('<id>')` with an id that is neither
 *   in the cast, built for the project, nor in `newRoles`. `role-built` (warning): a `newRoles`
 *   entry that is already built. `roles-without-pack` (warning): `newRoles` with the classic hero.
 * Nothing applies to a storyboard without `mascot` / `newRoles` in a classic project.
 */
import {
  CAST_PERSON_IDS,
  castRoleId,
  isCastPersonId,
  isMascotId,
  type CharacterMode,
  type MascotChoice,
  type NewRole,
  type StoryboardShot,
  type WordsFile,
} from '@reelforge/shared';
import { issue, type ValidationIssue } from './issues.js';
import {
  HONORIFICS,
  matchesWordList,
  NOT_A_FIRST_NAME,
  PERSON_ROLE_WORDS,
  QUOTE_CHARACTERS,
  SPEECH_WORDS,
} from './mascot-words.js';

export interface MascotRules {
  /** Largest share of mascot shots. Default 0.3. */
  readonly maxShare: number;
  /** Smallest distance between the starts of two mascot shots, seconds. Default 12. */
  readonly minGapS: number;
  /** A mascot starting before this is in the hook (warning unless a title card). Default 3. */
  readonly hookS: number;
  /** Longest stretch without the mascot (warning), seconds. Default 90. */
  readonly maxAbsenceS: number;
  /** The absence warning applies to films longer than this, seconds. Default 180. */
  readonly absenceFilmS: number;
}

export const DEFAULT_MASCOT_RULES: MascotRules = {
  maxShare: 0.3,
  minGapS: 12,
  hookS: 3,
  maxAbsenceS: 90,
  absenceFilmS: 180,
};

export interface CharacterCheckOptions {
  readonly characters: CharacterMode;
  /** The mascot in effect (`projectMascot`). */
  readonly mascot: MascotChoice;
  /** Roles already built for the project. */
  readonly builtRoles?: readonly string[];
  readonly rules?: Partial<MascotRules>;
}

interface CharacterStoryboard {
  readonly shots: readonly StoryboardShot[];
  readonly newRoles?: readonly NewRole[] | undefined;
}

const WORD = /[\p{L}\p{N}]+/gu;
const TITLE_CASE = /^\p{Lu}\p{Ll}+$/u;
const SENTENCE_END = /[.!?;:]$/;
const PERSON_CALL = /\bperson\s*\(\s*['"`]([^'"`]+)['"`]/g;

const tokens = (text: string): string[] =>
  [...text.toLowerCase().matchAll(WORD)].map((match) => match[0]);

const clock = (seconds: number): string =>
  `${String(Math.floor(seconds / 60))}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;

function narration(shot: StoryboardShot, words: WordsFile | undefined): string[] {
  return (words?.words ?? [])
    .filter((word) => word.t >= shot.t0 && word.t < shot.t1)
    .map((word) => word.text);
}

const bare = (text: string): string => text.replace(/^[^\p{L}]+|[^\p{L}]+$/gu, '');

/** "Steve Jobs", "Dr Kowalski": a capitalised pair that reads as a person's name. */
function personName(spoken: readonly string[]): string | undefined {
  for (let index = 0; index + 1 < spoken.length; index += 1) {
    const raw = spoken[index] ?? '';
    const first = bare(raw);
    const second = bare(spoken[index + 1] ?? '');
    if (SENTENCE_END.test(raw) || !TITLE_CASE.test(second)) continue;
    const lower = first.toLowerCase();
    if (HONORIFICS.includes(lower)) return `${first} ${second}`;
    if (TITLE_CASE.test(first) && matchesWordList(lower, NOT_A_FIRST_NAME) === undefined) {
      return `${first} ${second}`;
    }
  }
  return undefined;
}

/** Why a mascot shot is about a person (the first cue found), or undefined. */
export function impersonationCue(
  shot: StoryboardShot,
  spoken: readonly string[],
): string | undefined {
  const planned = [shot.intent, shot.mascot?.action ?? ''].join(' ');
  for (const token of [...tokens(planned), ...tokens(spoken.join(' '))]) {
    const role = matchesWordList(token, PERSON_ROLE_WORDS);
    if (role !== undefined) return `"${token}" (a person the story needs)`;
  }
  for (const token of tokens(spoken.join(' '))) {
    if (matchesWordList(token, SPEECH_WORDS) !== undefined) {
      return `"${token}" (someone is quoted)`;
    }
  }
  const quote = QUOTE_CHARACTERS.find((mark) => spoken.some((word) => word.includes(mark)));
  if (quote !== undefined) return `quoted speech (${quote}) in the narration`;
  const name = personName(spoken);
  return name === undefined ? undefined : `"${name}" (a named person)`;
}

function withoutChoice(
  shots: readonly StoryboardShot[],
  options: CharacterCheckOptions,
): ValidationIssue[] {
  const why =
    options.characters === 'pack'
      ? 'this project has no mascot'
      : 'this project uses the classic hero, which has no mascot';
  return shots.flatMap((shot, index) =>
    shot.mascot === undefined
      ? []
      : [
          issue(
            'error',
            'mascot-without-choice',
            `${shot.id} has a \`mascot\` but ${why}: remove the field (Project settings → Mascot chooses one)`,
            `shots[${String(index)}].mascot`,
          ),
        ],
  );
}

function impersonations(
  shots: readonly StoryboardShot[],
  words: WordsFile | undefined,
  mascot: string,
): ValidationIssue[] {
  return shots.flatMap((shot, index) => {
    if (shot.mascot === undefined) return [];
    const cue = impersonationCue(shot, narration(shot, words));
    if (cue === undefined) return [];
    return [
      issue(
        'error',
        'mascot-impersonation',
        `${shot.id} shows the mascot (${mascot}) as the ${shot.mascot.role}, but the shot is about a person: ${cue}. The mascot never plays a professional, a witness, a victim or a real or quoted person: move it to an impersonal shot (a chart, an object, a reaction) or drop \`mascot\` here`,
        `shots[${String(index)}].mascot`,
      ),
    ];
  });
}

function rhythm(shots: readonly StoryboardShot[], rules: MascotRules): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const indexed = shots.map((shot, index) => ({ shot, index }));
  const appearances = indexed.filter(({ shot }) => shot.mascot !== undefined);
  if (shots.length > 0 && appearances.length / shots.length > rules.maxShare) {
    issues.push(
      issue(
        'error',
        'mascot-overuse',
        `the mascot is in ${String(appearances.length)} of ${String(shots.length)} shots (at most ${String(Math.round(rules.maxShare * 100))}%): keep it for a few moments, about one every 40–70 s`,
        'shots',
      ),
    );
  }
  appearances.forEach(({ shot, index }, order) => {
    const previous = appearances[order - 1]?.shot;
    if (previous !== undefined && shot.t0 - previous.t0 < rules.minGapS) {
      issues.push(
        issue(
          'error',
          'mascot-overuse',
          `${shot.id} brings the mascot back ${(shot.t0 - previous.t0).toFixed(1)} s after ${previous.id} (at least ${String(rules.minGapS)} s apart)`,
          `shots[${String(index)}].mascot`,
        ),
      );
    }
    if (shot.t0 < rules.hookS && shot.treatment !== 'title-card') {
      issues.push(
        issue(
          'warning',
          'mascot-in-hook',
          `${shot.id} opens the film with the mascot; in the first ${String(rules.hookS)} s it belongs only on the title/hook card`,
          `shots[${String(index)}].mascot`,
        ),
      );
    }
  });
  const end = shots.at(-1)?.t1 ?? 0;
  if (end > rules.absenceFilmS) {
    const marks = [0, ...appearances.map(({ shot }) => shot.t0), end];
    marks.slice(1).forEach((mark, order) => {
      const from = marks[order] ?? 0;
      if (mark - from > rules.maxAbsenceS) {
        issues.push(
          issue(
            'warning',
            'mascot-gap',
            `no mascot for ${String(Math.round(mark - from))} s (${clock(from)}–${clock(mark)}); bring it back about every 40–70 s where an impersonal moment fits`,
            'shots',
          ),
        );
      }
    });
  }
  return issues;
}

function roleIssues(
  storyboard: CharacterStoryboard,
  options: CharacterCheckOptions,
): ValidationIssue[] {
  const roles = storyboard.newRoles ?? [];
  if (options.characters !== 'pack') {
    return roles.length === 0
      ? []
      : [
          issue(
            'warning',
            'roles-without-pack',
            'newRoles is ignored: this project uses the classic hero, not the character pack',
            'newRoles',
          ),
        ];
  }
  // Built role files use camelCase ids (`policeOfficer`), newRoles kebab case (`police-officer`).
  const roleKey = (id: string): string => castRoleId(id) ?? id;
  const built = new Set((options.builtRoles ?? []).map(roleKey));
  const seen = new Set<string>();
  const issues: ValidationIssue[] = [];
  roles.forEach((role, index) => {
    const where = `newRoles[${String(index)}].id`;
    const key = roleKey(role.id);
    if (seen.has(key)) {
      issues.push(issue('error', 'unknown-role', `newRoles lists ${role.id} twice`, where));
    } else if (isCastPersonId(role.id)) {
      const message = `${role.id} is in the cast: use kit.cast.person('${role.id}') and leave it out of newRoles`;
      issues.push(issue('error', 'unknown-role', message, where));
    } else if (role.id === 'mannequin' || isMascotId(role.id)) {
      const message = `${role.id} is part of the pack (mannequin or mascot), not a new role`;
      issues.push(issue('error', 'unknown-role', message, where));
    } else if (built.has(key)) {
      const message = `${role.id} is already built for this project: leave it out of newRoles`;
      issues.push(issue('warning', 'role-built', message, where));
    }
    seen.add(key);
  });
  const known = new Set<string>([...CAST_PERSON_IDS, ...built, ...seen]);
  storyboard.shots.forEach((shot, index) => {
    for (const match of shot.intent.matchAll(PERSON_CALL)) {
      const id = match[1] ?? '';
      if (known.has(roleKey(id))) continue;
      issues.push(
        issue(
          'error',
          'unknown-role',
          `${shot.id} calls kit.cast.person('${id}'), which is not in the cast: add it to newRoles ({ "id": "${id}", "description": "…" }) or use a cast member`,
          `shots[${String(index)}].intent`,
        ),
      );
    }
  });
  return issues;
}

/** The character and mascot checks (see the file comment). */
export function checkCharacters(
  storyboard: CharacterStoryboard,
  words: WordsFile | undefined,
  options: CharacterCheckOptions,
): ValidationIssue[] {
  const rules = { ...DEFAULT_MASCOT_RULES, ...options.rules };
  const { shots } = storyboard;
  const mascot =
    options.mascot === 'none'
      ? withoutChoice(shots, options)
      : [...impersonations(shots, words, options.mascot), ...rhythm(shots, rules)];
  return [...mascot, ...roleIssues(storyboard, options)];
}
