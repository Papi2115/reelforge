/**
 * `cues.json` written by the sound-cues stage. The file schema lives in `@reelforge/pipeline`
 * (`CuesFileSchema`); it is injected by the caller so this package does not depend on the audio
 * pipeline. On top of it: the prompt's mixing rules (ambience under the voice, music from
 * `audio/music/` files that exist, cue density, everything inside the timeline).
 */
import type { z } from 'zod';
import {
  issue,
  parseJsonText,
  report,
  schemaIssues,
  type ValidationIssue,
  type ValidationReport,
} from './issues.js';

/** The fields of a parsed cues file the rule checks need. */
export interface CuesLike {
  readonly sfx: readonly { readonly t: number }[];
  readonly ambience: readonly {
    readonly from: number;
    readonly to: number;
    readonly gainDb: number;
  }[];
  readonly music: readonly { readonly from: number; readonly to: number; readonly file: string }[];
  /** Mood per act of the generated music (names are checked by the schema). */
  readonly moods?: readonly string[] | undefined;
}

export type CuesSchema<T extends CuesLike> = z.ZodType<T>;

export interface CuesCheckOptions<T extends CuesLike> {
  /** `CuesFileSchema` from `@reelforge/pipeline`. */
  readonly schema: CuesSchema<T>;
  /** Voice-over length (s); enables the timeline and density checks. */
  readonly durationS?: number | undefined;
  /** Does this project-relative music file exist? Enables the existence check. */
  readonly musicFileExists?: ((file: string) => boolean) | undefined;
  /** Loudest allowed ambience (dB). Default -20. */
  readonly maxAmbienceDb?: number | undefined;
  /** Acts of the generated music; `moods` must then have one entry per act. */
  readonly actCount?: number | undefined;
}

/** Cues may run this far past the voice-over end (s). */
const END_TOLERANCE_S = 1;
/** Prompt: roughly one sound moment per 3–6 s; warn when clearly denser/sparser. */
const DENSEST_SFX_GAP_S = 2;
const SPARSEST_SFX_GAP_S = 20;
/** Cues closer than this form one sound moment (a counter's ticks, a list's pops). */
const GESTURE_JOIN_S = 0.6;

/** Number of sound moments: cues closer than GESTURE_JOIN_S to the previous one join it. */
export function sfxGestureCount(times: readonly number[]): number {
  const sorted = [...times].sort((a, b) => a - b);
  return sorted.filter((t, index) => index === 0 || t - (sorted[index - 1] ?? 0) >= GESTURE_JOIN_S)
    .length;
}

function timelineIssues(cues: CuesLike, durationS: number): ValidationIssue[] {
  const end = durationS + END_TOLERANCE_S;
  const issues: ValidationIssue[] = [];
  cues.sfx.forEach((cue, index) => {
    if (cue.t > end)
      issues.push(
        issue(
          'error',
          'beyond-end',
          `sfx at ${String(cue.t)} s is past the end (${String(durationS)} s)`,
          `sfx[${String(index)}].t`,
        ),
      );
  });
  for (const kind of ['ambience', 'music'] as const) {
    cues[kind].forEach((cue, index) => {
      if (cue.to > end)
        issues.push(
          issue(
            'error',
            'beyond-end',
            `${kind} runs to ${String(cue.to)} s, past the end (${String(durationS)} s)`,
            `${kind}[${String(index)}].to`,
          ),
        );
    });
  }
  const count = sfxGestureCount(cues.sfx.map((cue) => cue.t));
  if (count > durationS / DENSEST_SFX_GAP_S) {
    issues.push(
      issue(
        'warning',
        'sfx-density',
        `${String(count)} sound moments in ${String(durationS)} s is too dense (aim for one per 3–6 s)`,
      ),
    );
  } else if (count < Math.floor(durationS / SPARSEST_SFX_GAP_S)) {
    issues.push(
      issue(
        'warning',
        'sfx-density',
        `${String(count)} sound moments in ${String(durationS)} s is very sparse`,
      ),
    );
  }
  return issues;
}

export function checkCues<T extends CuesLike>(
  cues: T,
  options: CuesCheckOptions<T>,
): ValidationIssue[] {
  const maxAmbienceDb = options.maxAmbienceDb ?? -20;
  const issues: ValidationIssue[] = [];
  cues.ambience.forEach((cue, index) => {
    if (cue.gainDb > maxAmbienceDb) {
      issues.push(
        issue(
          'error',
          'ambience-too-loud',
          `ambience at ${String(cue.gainDb)} dB (max ${String(maxAmbienceDb)} dB)`,
          `ambience[${String(index)}].gainDb`,
        ),
      );
    }
  });
  cues.music.forEach((cue, index) => {
    const where = `music[${String(index)}].file`;
    if (!cue.file.replaceAll('\\', '/').startsWith('audio/music/')) {
      issues.push(
        issue(
          'error',
          'music-location',
          `music must come from audio/music/, got ${cue.file}`,
          where,
        ),
      );
    } else if (options.musicFileExists !== undefined && !options.musicFileExists(cue.file)) {
      issues.push(issue('error', 'music-missing', `music file ${cue.file} does not exist`, where));
    }
  });
  if (options.durationS !== undefined) issues.push(...timelineIssues(cues, options.durationS));
  const { actCount } = options;
  if (cues.moods !== undefined && actCount !== undefined && cues.moods.length !== actCount) {
    issues.push(
      issue(
        'error',
        'moods-count',
        `moods has ${String(cues.moods.length)} entries but the film has ${String(actCount)} act(s): one mood per act`,
        'moods',
      ),
    );
  }
  return issues;
}

export function validateCues<T extends CuesLike>(
  text: string,
  options: CuesCheckOptions<T>,
): ValidationReport<T> {
  const json = parseJsonText(text);
  if (!json.parsed) return report<T>(undefined, json.issues);
  const parsed = options.schema.safeParse(json.value);
  if (!parsed.success) return report<T>(undefined, [...json.issues, ...schemaIssues(parsed.error)]);
  return report(parsed.data, [...json.issues, ...checkCues(parsed.data, options)]);
}
