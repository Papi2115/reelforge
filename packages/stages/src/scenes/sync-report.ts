/**
 * Sync report (PLAN.md §3.3, #7.7): loads every shot through the engine (build only, no frames:
 * the dry run records the anchors and sfx cues each scene declares), compares every event with
 * its spoken word (±150 ms) and writes `.reelforge/sync-report.json` for the UI. No Claude.
 */
import { err, ok, type Result } from '@reelforge/claude-bridge';
import { AnchorIndex, CuesFileSchema } from '@reelforge/pipeline';
import {
  SYNC_REPORT_VERSION,
  projectFileSchema,
  storyboardFileSchema,
  syncReportSchema,
  wordsFileSchema,
  type ShotSync,
  type SyncReport,
} from '@reelforge/shared';
import { requireProjectJson, writeProjectJson } from '../files.js';
import { FILES, inProject } from '../paths.js';
import { loadJson } from '../snapshot.js';
import { stageError, type StageError } from '../types.js';
import { SYNC_TOLERANCE_S, shotSync, shotSyncEvents, type TimedCue } from './sync.js';
import { renderShot } from './render.js';
import type { FrameRenderer } from './tools.js';

export interface SyncReportOptions {
  readonly projectDir: string;
  readonly frames: FrameRenderer;
  readonly signal: AbortSignal;
  /** Only these shots (default: all). */
  readonly shots?: readonly string[] | undefined;
  readonly now?: () => Date;
}

async function projectCues(projectDir: string): Promise<readonly TimedCue[]> {
  const cues = await loadJson(inProject(projectDir, FILES.cues), CuesFileSchema);
  if (cues.status !== 'ok') return [];
  return cues.value.sfx.map((cue) => ({ t: cue.t, name: cue.name ?? cue.file ?? 'sfx' }));
}

async function anchorIndex(projectDir: string): Promise<AnchorIndex | undefined> {
  const [words, project] = await Promise.all([
    loadJson(inProject(projectDir, FILES.words), wordsFileSchema),
    loadJson(inProject(projectDir, FILES.project), projectFileSchema),
  ]);
  if (words.status !== 'ok') return undefined;
  const lang = project.status === 'ok' ? project.value.language : 'en';
  return new AnchorIndex(words.value.words, { lang });
}

export async function syncReport(
  options: SyncReportOptions,
): Promise<Result<SyncReport, StageError>> {
  const { projectDir, frames, signal } = options;
  const storyboard = await requireProjectJson(projectDir, FILES.storyboard, storyboardFileSchema);
  if (!storyboard.ok) return storyboard;
  const wanted = options.shots === undefined ? undefined : new Set(options.shots);
  const shots = storyboard.value.shots.filter((shot) => wanted?.has(shot.id) ?? true);
  const [cues, words] = await Promise.all([projectCues(projectDir), anchorIndex(projectDir)]);
  const results: ShotSync[] = [];
  for (const shot of shots) {
    if (signal.aborted) return err(stageError('cancelled', 'cancelled'));
    const rendered = await renderShot(
      frames,
      { projectDir, shotId: shot.id, times: [], cards: false },
      signal,
    );
    if (!rendered.ok) return rendered;
    const render = rendered.value;
    if (!render.ok) {
      results.push(shotSync(shot, [], render.error));
      continue;
    }
    const events = shotSyncEvents({
      shot,
      anchors: render.anchors,
      sceneCues: render.cues,
      projectCues: cues.filter((cue) => cue.t >= shot.t0 && cue.t < shot.t1),
      words,
    });
    results.push(shotSync(shot, events));
  }
  const events = results.flatMap((shot) => shot.events);
  const report: SyncReport = {
    version: SYNC_REPORT_VERSION,
    createdAt: (options.now?.() ?? new Date()).toISOString(),
    toleranceMs: Math.round(SYNC_TOLERANCE_S * 1000),
    shots: results,
    summary: {
      shots: results.length,
      events: events.length,
      ok: events.filter((event) => event.verdict === 'ok').length,
      problems: results.reduce((sum, shot) => sum + shot.problems, 0),
      failedShots: results.filter((shot) => shot.error !== undefined).length,
    },
  };
  const written = await writeProjectJson(projectDir, FILES.syncReport, syncReportSchema, report);
  return written.ok ? ok(written.value) : written;
}
