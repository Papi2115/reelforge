/**
 * The film a repetition analysis looks at and the shape of its items (analyse.ts, sfx-items.ts):
 * occurrences, the analysis context and the item builder.
 */
import type {
  LookMode,
  RepetitionChange,
  RepetitionItem,
  RepetitionKind,
  RepetitionThresholds,
  StoryboardShot,
} from '@reelforge/shared';
import type { DirectorWord } from '../sound/cue-events.js';

export interface FilmCue {
  readonly id?: string | undefined;
  readonly t: number;
  readonly name?: string | undefined;
}

export interface RepetitionFilm {
  readonly shots: readonly StoryboardShot[];
  /** Scene source per shot id (static scan); a missing source = no visual signature. */
  readonly sources?: ReadonlyMap<string, string> | undefined;
  /** cues.json sfx. */
  readonly cues?: readonly FilmCue[] | undefined;
  readonly words?: readonly DirectorWord[] | undefined;
  readonly locked?: ReadonlySet<string> | undefined;
  readonly lookMode?: LookMode | undefined;
  /** Project seed (transition re-picks). */
  readonly seed?: number | undefined;
  /** A world's film: the visual signature is the planned moment, look and paper (signature.ts). */
  readonly world?: boolean | undefined;
}

export interface Occurrence {
  readonly t: number;
  readonly shotId?: string | undefined;
  readonly cueIds?: readonly string[] | undefined;
}

export const fmt = (t: number): string => `${t.toFixed(1)} s`;

export function cueKey(cue: FilmCue): string {
  return cue.id ?? `t${String(Math.round(cue.t * 1000))}`;
}

export interface Context {
  readonly film: RepetitionFilm;
  readonly rules: RepetitionThresholds;
  readonly locked: ReadonlySet<string>;
  readonly lookMode: LookMode;
  shotAt(t: number): StoryboardShot | undefined;
}

export function item(
  kind: RepetitionKind,
  subject: string,
  text: string,
  occurrences: readonly Occurrence[],
  action: RepetitionItem['action'],
  changes: readonly RepetitionChange[],
  severity: RepetitionItem['severity'],
  lockedTargets: boolean,
): RepetitionItem {
  const first = occurrences[0];
  return {
    id: `${kind}:${subject}@${(first?.t ?? 0).toFixed(2)}`,
    kind,
    severity,
    subject,
    text,
    occurrences: occurrences.map((occurrence) => ({
      t: Math.round(occurrence.t * 1000) / 1000,
      ...(occurrence.shotId === undefined ? {} : { shotId: occurrence.shotId }),
      ...(occurrence.cueIds?.[0] === undefined ? {} : { cueId: occurrence.cueIds[0] }),
    })),
    action,
    changes: [...changes],
    locked: lockedTargets,
    status: 'open',
  };
}

export const span = (occurrences: readonly { t: number }[]): string =>
  `${fmt(occurrences[0]?.t ?? 0)}–${fmt(occurrences.at(-1)?.t ?? 0)}`;
