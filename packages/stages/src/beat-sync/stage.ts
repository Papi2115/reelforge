/**
 * Beat sync in the stages (PLAN.md#12.21, ADR-018; only with project.json `beatSync: "auto"`):
 * - Storyboard: after validation the grid is derived (`timing/beats.json`, from the words, the
 *   storyboard's acts and moods, its cuts and the tension curve), the unlocked cuts are snapped
 *   and the storyboard is validated again (anchor phrases, word boundaries, transitions, tempo);
 *   a snapped storyboard that fails goes back to the validated one (warning, nothing moved).
 * - Sound cues: the grid (read, or derived when missing) locks the music beds and snaps hits.
 * Both write `.reelforge/beat-sync-report.json`.
 */
import { err, ok, type Result } from '@reelforge/claude-bridge';
import type { MusicMood } from '@reelforge/pipeline';
import {
  BEAT_SYNC_REPORT_FILE,
  BEATS_FILE,
  beatSyncReportSchema,
  beatsFileSchema,
  projectBeatSync,
  type BeatSyncReport,
  type BeatsFile,
  type ProjectFile,
  type StoryboardShot,
  type TensionPoint,
} from '@reelforge/shared';
import type { z } from 'zod';
import { readProjectText, writeProjectJson } from '../files.js';
import { readLockedShots } from '../locks.js';
import { actMoods, detectActs } from '../sound/acts.js';
import type { DirectorWord } from '../sound/cue-events.js';
import type { StageError } from '../types.js';
import { deriveBeatGrid, GridTimes } from './grid.js';
import { beatSyncReport, cutStats, nudgeStats, whooshStats, type SfxCueLike } from './report.js';
import { snapCutsToBeats } from './snap.js';

export interface FilmForGrid {
  readonly shots: readonly StoryboardShot[];
  readonly words: readonly DirectorWord[];
  readonly styleId: string;
  readonly tension?: readonly TensionPoint[] | undefined;
}

function filmDuration(film: FilmForGrid): number {
  return Math.max(film.shots.at(-1)?.t1 ?? 0, film.words.at(-1)?.tEnd ?? 0);
}

/** The grid of a film: acts and moods as the sound design detects them (pure). */
export function gridForFilm(film: FilmForGrid): BeatsFile {
  const durationS = filmDuration(film);
  const acts = detectActs(film.shots, durationS, film.tension);
  const moods: MusicMood[] = actMoods(acts, film.styleId);
  return deriveBeatGrid({
    words: film.words,
    durationS,
    acts: acts.map((act, index) => ({
      from: act.from,
      to: act.to,
      mood: moods[index] ?? 'calm-tech',
    })),
    cuts: film.shots.slice(1).map((shot) => shot.t0),
    tension: film.tension,
  });
}

async function readJson<S extends z.ZodType>(
  projectDir: string,
  relative: string,
  schema: S,
): Promise<z.output<S> | undefined> {
  const text = await readProjectText(projectDir, relative);
  if (!text.ok || text.value === undefined) return undefined;
  try {
    const parsed = schema.safeParse(JSON.parse(text.value));
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined; // not JSON: treated as missing (re-derived / rewritten)
  }
}

export interface StoryboardSync<T> {
  readonly storyboard: T;
  readonly warnings: readonly string[];
  readonly report: BeatSyncReport;
}

export interface StoryboardSyncInput<T extends { readonly shots: StoryboardShot[] }> {
  readonly projectDir: string;
  readonly storyboard: T;
  readonly words: readonly DirectorWord[];
  readonly styleId: string;
  readonly tension?: readonly TensionPoint[] | undefined;
  /** Writes a storyboard (atomic, validated by the schema). */
  readonly write: (storyboard: T) => Promise<Result<T, StageError>>;
  /** The stage's own validation of storyboard.json on disk: its errors (empty = valid). */
  readonly revalidate: () => Promise<readonly string[]>;
}

/** Storyboard stage: grid + cut snapping + validation again (see the module comment). */
export async function syncStoryboardToBeats<T extends { readonly shots: StoryboardShot[] }>(
  input: StoryboardSyncInput<T>,
): Promise<Result<StoryboardSync<T>, StageError>> {
  const locked = await readLockedShots(input.projectDir);
  if (!locked.ok) return locked;
  const grid = gridForFilm({ ...input, shots: input.storyboard.shots });
  const gridWritten = await writeProjectJson(input.projectDir, BEATS_FILE, beatsFileSchema, grid);
  if (!gridWritten.ok) return gridWritten;
  const times = new GridTimes(grid);
  const snap = snapCutsToBeats(input.storyboard.shots, times, input.words, locked.value);
  let storyboard = input.storyboard;
  const warnings: string[] = [];
  let reverted = false;
  if (snap.nudges.length > 0) {
    const written = await input.write({ ...input.storyboard, shots: snap.shots });
    if (!written.ok) return written;
    const problems = await input.revalidate();
    if (problems.length > 0) {
      const restored = await input.write(input.storyboard);
      if (!restored.ok) return restored;
      reverted = true;
      warnings.push(`beat sync: cuts left as written (snapped storyboard: ${problems.join('; ')})`);
    } else {
      storyboard = written.value;
    }
  }
  const report = beatSyncReport({
    cuts: cutStats(storyboard.shots, times),
    nudges: nudgeStats(snap, reverted),
  });
  const reported = await writeBeatSyncReport(input.projectDir, report);
  if (!reported.ok) return reported;
  return ok({ storyboard, warnings, report });
}

/**
 * Sound stage: the project's grid when beat sync is on — timing/beats.json, or derived from the
 * current storyboard (and written) when it is missing or invalid. Undefined when off.
 */
export async function activeBeatGrid(
  projectDir: string,
  project: Pick<ProjectFile, 'beatSync'>,
  film: FilmForGrid,
): Promise<Result<BeatsFile | undefined, StageError>> {
  if (projectBeatSync(project) !== 'auto') return ok(undefined);
  const existing = await readJson(projectDir, BEATS_FILE, beatsFileSchema);
  if (existing !== undefined) return ok(existing);
  const grid = gridForFilm(film);
  const written = await writeProjectJson(projectDir, BEATS_FILE, beatsFileSchema, grid);
  return written.ok ? ok(grid) : err(written.error);
}

export async function writeBeatSyncReport(
  projectDir: string,
  report: BeatSyncReport,
): Promise<Result<BeatSyncReport, StageError>> {
  return writeProjectJson(projectDir, BEAT_SYNC_REPORT_FILE, beatSyncReportSchema, report);
}

/** Cues the sound stage moved onto the grid. */
export interface SnappedCues {
  /** The sound director's hits / risers (default design). */
  readonly director: number;
  /** Whooshes of the final cue list (scene accents, Claude's cues). */
  readonly whooshes: number;
}

/** Sound stage: the report over the final cues (keeps the storyboard's nudge statistics). */
export async function reportSoundSync(
  projectDir: string,
  grid: BeatsFile,
  shots: readonly StoryboardShot[],
  cues: readonly SfxCueLike[],
  snapped: SnappedCues,
): Promise<Result<BeatSyncReport, StageError>> {
  const previous = await readJson(projectDir, BEAT_SYNC_REPORT_FILE, beatSyncReportSchema);
  const times = new GridTimes(grid);
  return writeBeatSyncReport(
    projectDir,
    beatSyncReport({
      cuts: cutStats(shots, times),
      nudges: previous?.nudges,
      whooshes: whooshStats(cues, shots, times),
      cues: { snapped: snapped.director + snapped.whooshes, whooshes: snapped.whooshes },
    }),
  );
}
