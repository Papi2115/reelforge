/**
 * The direction plan of a Grim Ink film (PLAN.md#14.16; docs/worlds/c-cam-DIRECTION.md §3): the
 * `c-cam-direction` reply / `direction.json` (schema + rules). Every person has ONE signature gag
 * with a setup, at least one escalation and a payoff in the last 30 % of the runtime; at least one
 * accident beat; one climax ECU with a reason; every close / ECU framing says why; 2–5 framings
 * per beat (the depth rule); close + ECU at least a quarter of all framings; no two adjacent beats
 * with the same framing sequence; the title frame casts 1–3 of the film's people under a title of
 * at most 6 words. Errors carry the fix in their message (the repair turn reads them).
 */
import {
  directionFileSchema,
  framingSequence,
  type DirectionBeat,
  type DirectionFile,
} from '@reelforge/shared';
import { closeShareIssues, DIRECTION_RULES, whyIssues } from './direction-rules.js';
import { parseEmbeddedJsonText } from './embedded-json.js';
import {
  issue,
  report,
  schemaIssues,
  type ValidationIssue,
  type ValidationReport,
} from './issues.js';

export { DIRECTION_RULES } from './direction-rules.js';

export interface DirectionCheckOptions {
  /** Length of the narration (s). */
  readonly durationS: number;
  /** The kit's gag kinds (`C_CAM_VOCABULARY.gags`); absent = the kind is not checked. */
  readonly gagKinds?: readonly string[];
  /** script.txt: a beat quote not found in it is a warning. */
  readonly script?: string;
}

const err = (code: string, message: string, path?: string): ValidationIssue =>
  issue('error', code, message, path);

function duplicateIds(ids: readonly string[], path: string): ValidationIssue[] {
  const seen = new Set<string>();
  const issues: ValidationIssue[] = [];
  for (const id of ids) {
    if (seen.has(id))
      issues.push(err('direction-duplicate-id', `the id "${id}" is used twice`, path));
    seen.add(id);
  }
  return issues;
}

function beatIssues(file: DirectionFile, options: DirectionCheckOptions): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const cast = new Set(file.cast.map((person) => person.id));
  const limit = options.durationS + DIRECTION_RULES.tailS;
  file.beats.forEach((beat, index) => {
    const path = `beats[${String(index)}]`;
    const { t0, t1 } = beat.span;
    if (t1 <= t0 || t1 > limit) {
      issues.push(
        err(
          'direction-span',
          `beat ${beat.id} spans ${String(t0)}–${String(t1)} s: it must end after it starts and inside the narration (0–${options.durationS.toFixed(1)} s)`,
          `${path}.span`,
        ),
      );
    }
    const previous = file.beats[index - 1];
    if (previous !== undefined && t0 < previous.span.t0) {
      issues.push(
        err(
          'direction-beat-order',
          `beat ${beat.id} starts before ${previous.id}: keep the beats in narration order`,
          `${path}.span.t0`,
        ),
      );
    }
    const count = beat.camera.progression.length;
    if (count < DIRECTION_RULES.minFramings || count > DIRECTION_RULES.maxFramings) {
      issues.push(
        err(
          'direction-framings',
          `beat ${beat.id} has ${String(count)} framings: give it ${String(DIRECTION_RULES.minFramings)}–${String(DIRECTION_RULES.maxFramings)} (establish -> the object in ECU -> the reaction in close-up -> a pull-back)`,
          `${path}.camera.progression`,
        ),
      );
    }
    issues.push(...whyIssues(beat.camera.progression, `${path}.camera.progression`));
    if (
      previous !== undefined &&
      framingSequence(previous.camera.progression) === framingSequence(beat.camera.progression)
    ) {
      issues.push(
        err(
          'direction-repeat',
          `beats ${previous.id} and ${beat.id} repeat the same framing sequence (${framingSequence(beat.camera.progression)}): vary the sizes or their order`,
          `${path}.camera.progression`,
        ),
      );
    }
    for (const ref of beat.gagRefs) {
      if (!cast.has(ref)) {
        issues.push(
          err(
            'direction-unknown-ref',
            `beat ${beat.id} plays the gag of "${ref}", who is not in the cast`,
            `${path}.gagRefs`,
          ),
        );
      }
    }
  });
  issues.push(
    ...closeShareIssues(
      file.beats.map((beat) => beat.camera.progression),
      'beats',
    ),
  );
  return issues;
}

function middle(beat: DirectionBeat): number {
  return (beat.span.t0 + beat.span.t1) / 2;
}

function gagIssues(file: DirectionFile, options: DirectionCheckOptions): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const beats = new Map(file.beats.map((beat) => [beat.id, beat]));
  file.cast.forEach((person, index) => {
    const path = `cast[${String(index)}].signatureGag`;
    const { kind, arc } = person.signatureGag;
    if (options.gagKinds !== undefined && !options.gagKinds.includes(kind)) {
      issues.push(
        err(
          'direction-gag-kind',
          `${person.id}'s gag kind "${kind}" is not a kit gag: use one of ${options.gagKinds.join(', ')}`,
          `${path}.kind`,
        ),
      );
    }
    const refs = [arc.setup, ...arc.escalations, arc.payoff];
    const missing = refs.filter((ref) => !beats.has(ref));
    if (missing.length > 0) {
      issues.push(
        err(
          'direction-unknown-ref',
          `${person.id}'s gag arc names unknown beats: ${missing.join(', ')}`,
          `${path}.arc`,
        ),
      );
      return;
    }
    if (new Set(refs).size < DIRECTION_RULES.minArcBeats) {
      issues.push(
        err(
          'direction-gag-arc',
          `${person.id}'s gag needs a setup, at least one escalation and a payoff on ${String(DIRECTION_RULES.minArcBeats)} different beats`,
          `${path}.arc`,
        ),
      );
    }
    const setup = beats.get(arc.setup);
    const payoff = beats.get(arc.payoff);
    if (setup !== undefined && payoff !== undefined && payoff.span.t0 <= setup.span.t0) {
      issues.push(
        err(
          'direction-gag-arc',
          `${person.id}'s payoff (${payoff.id}) must come after the setup (${setup.id})`,
          `${path}.arc.payoff`,
        ),
      );
    }
    if (payoff !== undefined && middle(payoff) < DIRECTION_RULES.payoffFrom * options.durationS) {
      const at = Math.round((middle(payoff) / Math.max(options.durationS, 1e-6)) * 100);
      issues.push(
        err(
          'direction-payoff-early',
          `${person.id}'s payoff beat ${payoff.id} sits at ${String(at)} % of the film: put the payoff in the last 30 % (a later beat the narration gives it a reason on)`,
          `${path}.arc.payoff`,
        ),
      );
    }
    for (const ref of new Set(refs)) {
      if (beats.get(ref)?.gagRefs.includes(person.id) === false) {
        issues.push(
          err(
            'direction-gag-arc',
            `beat ${ref} is in ${person.id}'s gag arc but its gagRefs miss "${person.id}"`,
            `${path}.arc`,
          ),
        );
      }
    }
  });
  return issues;
}

function accidentIssues(file: DirectionFile): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const beats = new Map(file.beats.map((beat) => [beat.id, beat]));
  const carrying = file.accidents.filter((ref) => beats.get(ref)?.accident !== undefined);
  for (const ref of file.accidents) {
    if (beats.get(ref)?.accident === undefined) {
      issues.push(
        err(
          'direction-accident',
          `accidents names "${ref}", which is not a beat with an "accident" text`,
          'accidents',
        ),
      );
    }
  }
  if (carrying.length < DIRECTION_RULES.minAccidents) {
    issues.push(
      err(
        'direction-accident',
        'plan at least one accident beat: a small physical mishap the narration does not say but motivates (a bump, a slip, something that falls), as the beat\'s "accident" and its id in "accidents"',
        'accidents',
      ),
    );
  }
  return issues;
}

function climaxIssues(file: DirectionFile): ValidationIssue[] {
  const beat = file.beats.find((candidate) => candidate.id === file.climax.beatRef);
  if (beat === undefined) {
    return [
      err(
        'direction-climax',
        `the climax names the unknown beat "${file.climax.beatRef}"`,
        'climax.beatRef',
      ),
    ];
  }
  return beat.camera.progression.some((step) => step.framing === 'ecu')
    ? []
    : [
        err(
          'direction-climax',
          `the climax beat ${beat.id} has no ecu framing: add the extreme close-up of ${file.climax.ecuSubject} to its progression`,
          'climax',
        ),
      ];
}

/** Words of a title: letters/digits runs. */
export function titleWords(title: string): string[] {
  return title.split(/\s+/).filter((word) => /[\p{L}\p{N}]/u.test(word));
}

function titleIssues(file: DirectionFile): ValidationIssue[] {
  const { titleFrame } = file;
  const issues: ValidationIssue[] = [];
  const cast = new Set(file.cast.map((person) => person.id));
  const unknown = titleFrame.cast.filter((id) => !cast.has(id));
  if (unknown.length > 0) {
    issues.push(
      err(
        'direction-title',
        `the title frame casts unknown people: ${unknown.join(', ')}`,
        'titleFrame.cast',
      ),
    );
  }
  const words = titleWords(titleFrame.title).length;
  if (words > DIRECTION_RULES.titleMaxWords) {
    issues.push(
      err(
        'direction-title',
        `the title has ${String(words)} words: at most ${String(DIRECTION_RULES.titleMaxWords)}, in the script's own words`,
        'titleFrame.title',
      ),
    );
  }
  const acted = new Set(titleFrame.acting.map((entry) => entry.person));
  const silent = titleFrame.cast.filter((id) => !acted.has(id));
  if (silent.length > 0) {
    issues.push(
      err(
        'direction-title',
        `give the title frame a pose and an expression for ${silent.join(', ')}`,
        'titleFrame.acting',
      ),
    );
  }
  return issues;
}

const normalize = (text: string): string =>
  text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

function quoteIssues(file: DirectionFile, script: string | undefined): ValidationIssue[] {
  if (script === undefined) return [];
  const haystack = normalize(script);
  return file.beats.flatMap((beat, index) => {
    const parts = beat.span.text
      .split(/…|\.\.\./)
      .map(normalize)
      .filter((part) => part !== '');
    return parts.every((part) => haystack.includes(part))
      ? []
      : [
          issue(
            'warning',
            'direction-quote',
            `beat ${beat.id} quotes words that are not in script.txt: quote the narration, never new claims`,
            `beats[${String(index)}].span.text`,
          ),
        ];
  });
}

/** Rule checks on a parsed plan. */
export function checkDirection(
  file: DirectionFile,
  options: DirectionCheckOptions,
): ValidationIssue[] {
  return [
    ...duplicateIds(
      file.beats.map((beat) => beat.id),
      'beats',
    ),
    ...duplicateIds(
      file.cast.map((person) => person.id),
      'cast',
    ),
    ...duplicateIds(
      file.motifs.map((motif) => motif.id),
      'motifs',
    ),
    ...beatIssues(file, options),
    ...gagIssues(file, options),
    ...accidentIssues(file),
    ...climaxIssues(file),
    ...titleIssues(file),
    ...quoteIssues(file, options.script),
  ];
}

/** The `c-cam-direction` reply (JSON, possibly with prose around it) -> schema + rule checks. */
export function validateDirection(
  text: string,
  options: DirectionCheckOptions,
): ValidationReport<DirectionFile> {
  const json = parseEmbeddedJsonText(text);
  if (!json.parsed) return report<DirectionFile>(undefined, json.issues);
  const parsed = directionFileSchema.safeParse(json.value);
  if (!parsed.success) {
    return report<DirectionFile>(undefined, [...json.issues, ...schemaIssues(parsed.error)]);
  }
  return report(parsed.data, [...json.issues, ...checkDirection(parsed.data, options)]);
}
