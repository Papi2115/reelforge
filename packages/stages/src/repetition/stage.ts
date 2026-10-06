/**
 * Repetition control in the project (PLAN.md#12.23, ADR-019; only with project.json
 * `repetitionControl: "auto"`): the final review and the Sound cues stage analyse the film
 * (read-only) into `.reelforge/repetitions.json` + a readable `.reelforge/repetitions.md`,
 * keeping the user's Ignore / Apply decisions by item id. Apply (from the UI) swaps SFX in
 * cues.json or transitions in storyboard.json — never a locked shot's — or returns the
 * shot-variant build to queue; phrases are report only.
 */
import { err, ok, type Result } from '@reelforge/claude-bridge';
import { CuesFileSchema } from '@reelforge/pipeline';
import {
  projectRepetitionControl,
  REPETITIONS_FILE,
  REPETITIONS_REPORT_FILE,
  repetitionsFileSchema,
  storyboardFileSchema,
  wordsFileSchema,
  type ProjectFile,
  type RepetitionItem,
  type RepetitionStatus,
  type RepetitionsFile,
} from '@reelforge/shared';
import type { z } from 'zod';
import {
  readProjectText,
  requireProjectJson,
  writeProjectJson,
  writeProjectText,
} from '../files.js';
import { readLockedShots } from '../locks.js';
import { FILES } from '../paths.js';
import type { Loaded } from '../snapshot.js';
import { SCENE_STUB_MARKER } from '../stages/scene-stub.js';
import { effectiveLookMode } from '../worlds.js';
import { stageError, type StageError, type StageRequest } from '../types.js';
import { countItems, findRepetitions, type RepetitionFilm } from './analyse.js';
import { applySfxChanges, applyTransitionChanges, type Applied } from './apply.js';

async function readOptional<S extends z.ZodType>(
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
    return undefined; // not JSON: analysed as if the file were missing
  }
}

/** Everything the analysis looks at, read from the project. */
export async function loadRepetitionFilm(
  projectDir: string,
  project: ProjectFile,
): Promise<Result<RepetitionFilm, StageError>> {
  const storyboard = await requireProjectJson(projectDir, FILES.storyboard, storyboardFileSchema);
  if (!storyboard.ok) return storyboard;
  const locked = await readLockedShots(projectDir);
  if (!locked.ok) return locked;
  const sources = new Map<string, string>();
  for (const shot of storyboard.value.shots) {
    const source = await readProjectText(projectDir, shot.scene);
    if (source.ok && source.value !== undefined && !source.value.startsWith(SCENE_STUB_MARKER)) {
      sources.set(shot.id, source.value);
    }
  }
  const cues = await readOptional(projectDir, FILES.cues, CuesFileSchema);
  const words = await readOptional(projectDir, FILES.words, wordsFileSchema);
  return ok({
    shots: storyboard.value.shots,
    sources,
    cues: cues?.sfx ?? [],
    words: words?.words ?? [],
    locked: locked.value,
    lookMode: effectiveLookMode(project),
    seed: project.seed,
  });
}

/** Markdown version of the analysis (`.reelforge/repetitions.md`). */
export function formatRepetitionReport(file: RepetitionsFile): string {
  const { counts } = file;
  const lines = [
    '# Repetitions',
    '',
    `${String(file.items.length)} found (${String(counts.open)} open): ${String(counts.visual)} visual, ${String(counts.template)} template, ${String(counts.transition)} transition, ${String(counts.sfx)} SFX, ${String(counts.phrase)} phrase.`,
    '',
  ];
  for (const entry of file.items) {
    const mark = entry.severity === 'warning' ? '⚠' : 'ℹ';
    const status = entry.status === 'open' ? '' : ` [${entry.status}]`;
    const locked = entry.locked ? ' (locked)' : '';
    lines.push(`- ${mark} ${entry.kind}: ${entry.text}${locked}${status}`);
    for (const change of entry.changes) {
      lines.push(`  - ${change.target}: ${change.from} -> ${change.to}`);
    }
  }
  return `${lines.join('\n')}\n`;
}

function withStatuses(
  fresh: RepetitionsFile,
  previous: RepetitionsFile | undefined,
  overrides: ReadonlyMap<string, RepetitionStatus> = new Map(),
): RepetitionsFile {
  const kept = new Map((previous?.items ?? []).map((entry) => [entry.id, entry.status]));
  const items = fresh.items.map((entry): RepetitionItem => ({
    ...entry,
    status: overrides.get(entry.id) ?? kept.get(entry.id) ?? 'open',
  }));
  return { ...fresh, items, counts: countItems(items) };
}

async function writeRepetitions(
  projectDir: string,
  file: RepetitionsFile,
): Promise<Result<RepetitionsFile, StageError>> {
  const written = await writeProjectJson(projectDir, REPETITIONS_FILE, repetitionsFileSchema, file);
  if (!written.ok) return written;
  const report = await writeProjectText(
    projectDir,
    REPETITIONS_REPORT_FILE,
    formatRepetitionReport(file),
  );
  return report.ok ? written : report;
}

/** Analyses the project and writes the files (statuses kept; `overrides` set some). */
export async function analyseRepetitions(
  projectDir: string,
  project: ProjectFile,
  overrides?: ReadonlyMap<string, RepetitionStatus>,
): Promise<Result<RepetitionsFile, StageError>> {
  const film = await loadRepetitionFilm(projectDir, project);
  if (!film.ok) return film;
  const previous = await readOptional(projectDir, REPETITIONS_FILE, repetitionsFileSchema);
  return writeRepetitions(
    projectDir,
    withStatuses(findRepetitions(film.value), previous, overrides),
  );
}

/** The note a stage adds after its analysis ("Repetitions: 3 open (1 visual, 2 SFX)"). */
export function repetitionNote(file: RepetitionsFile): string | undefined {
  const open = file.items.filter((entry) => entry.status === 'open');
  if (open.length === 0) return undefined;
  const kinds = ['visual', 'template', 'transition', 'sfx', 'phrase'] as const;
  const parts = kinds
    .map((kind) => [kind, open.filter((entry) => entry.kind === kind).length] as const)
    .filter(([, count]) => count > 0)
    .map(([kind, count]) => `${String(count)} ${kind === 'sfx' ? 'SFX' : kind}`);
  return `Repetitions: ${String(open.length)} open (${parts.join(', ')})`;
}

/**
 * Final review / Sound cues: the analysis when the switch is on; a note when something is open
 * or the analysis failed (it never fails the stage).
 */
export async function reviewRepetitions(
  projectDir: string,
  project: Loaded<ProjectFile>,
): Promise<string[]> {
  if (project.status !== 'ok' || projectRepetitionControl(project.value) !== 'auto') return [];
  const analysed = await analyseRepetitions(projectDir, project.value);
  if (!analysed.ok) return [`Repetitions not analysed: ${analysed.error.message}`];
  const note = repetitionNote(analysed.value);
  return note === undefined ? [] : [note];
}

export interface RepetitionApplied {
  readonly message: string;
  /** Project files rewritten (commit them). */
  readonly files: readonly string[];
  /** Runs to queue (a shot-variant build per targeted shot). */
  readonly requests: readonly StageRequest[];
  readonly repetitions: RepetitionsFile;
}

async function rewriteRaw(
  projectDir: string,
  relative: string,
  apply: (raw: unknown) => Applied,
  validate: (json: unknown) => boolean,
): Promise<Result<number, StageError>> {
  const text = await readProjectText(projectDir, relative);
  if (!text.ok) return text;
  if (text.value === undefined) return err(stageError('not-ready', `${relative} is missing`));
  let raw: unknown;
  try {
    raw = JSON.parse(text.value);
  } catch (error) {
    return err(stageError('invalid-input', `${relative} is not valid JSON: ${String(error)}`));
  }
  const applied = apply(raw);
  if (applied.applied === 0) return ok(0);
  if (!validate(applied.json)) {
    return err(stageError('validation', `${relative} would become invalid; nothing changed`));
  }
  const written = await writeProjectText(
    projectDir,
    relative,
    `${JSON.stringify(applied.json, null, 2)}\n`,
  );
  return written.ok ? ok(applied.applied) : written;
}

/** Applies one open item (see the module comment) and re-analyses. */
export async function applyRepetition(
  projectDir: string,
  project: ProjectFile,
  id: string,
): Promise<Result<RepetitionApplied, StageError>> {
  const film = await loadRepetitionFilm(projectDir, project);
  if (!film.ok) return film;
  const target = findRepetitions(film.value).items.find((entry) => entry.id === id);
  if (target === undefined) return err(stageError('invalid-input', 'this repetition is gone'));
  if (target.action === 'none')
    return err(stageError('invalid-input', 'report only: nothing to apply'));
  if (target.changes.length === 0) {
    return err(
      stageError('invalid-input', target.locked ? 'its shots are locked' : 'no replacement found'),
    );
  }
  const locked = film.value.locked ?? new Set<string>();
  let files: string[] = [];
  let requests: StageRequest[] = [];
  let message: string;
  if (target.action === 'sfx') {
    const count = await rewriteRaw(
      projectDir,
      FILES.cues,
      (raw) => applySfxChanges(raw, target.changes, film.value.shots, locked),
      (json) => CuesFileSchema.safeParse(json).success,
    );
    if (!count.ok) return count;
    files = count.value > 0 ? [FILES.cues] : [];
    message = `Repetition: ${String(count.value)} ${target.subject} cue(s) swapped (${[...new Set(target.changes.map((change) => change.to))].join(', ')})`;
  } else if (target.action === 'transition') {
    const count = await rewriteRaw(
      projectDir,
      FILES.storyboard,
      (raw) => applyTransitionChanges(raw, target.changes, locked),
      (json) => storyboardFileSchema.safeParse(json).success,
    );
    if (!count.ok) return count;
    files = count.value > 0 ? [FILES.storyboard] : [];
    message = `Repetition: ${String(count.value)} ${target.subject} transition(s) re-picked`;
  } else {
    requests = target.changes
      .filter((change) => !locked.has(change.target))
      .map((change) => ({
        stage: 'scenes' as const,
        action: 'variants' as const,
        shots: [change.target],
        variants: { kind: 'generate' as const, count: 2, note: change.to },
      }));
    message = `Repetition: variants queued for ${target.changes.map((change) => change.target).join(', ')}`;
  }
  const repetitions = await analyseRepetitions(projectDir, project, new Map([[id, 'applied']]));
  if (!repetitions.ok) return repetitions;
  return ok({ message, files, requests, repetitions: repetitions.value });
}

/** Marks one item (Ignore / reopen), without analysing again. */
export async function setRepetitionStatus(
  projectDir: string,
  id: string,
  status: RepetitionStatus,
): Promise<Result<RepetitionsFile, StageError>> {
  const current = await readOptional(projectDir, REPETITIONS_FILE, repetitionsFileSchema);
  if (current === undefined) return err(stageError('not-ready', 'no repetition analysis yet'));
  if (!current.items.some((entry) => entry.id === id)) {
    return err(stageError('invalid-input', 'this repetition is gone'));
  }
  const items = current.items.map((entry) => (entry.id === id ? { ...entry, status } : entry));
  return writeRepetitions(projectDir, { ...current, items, counts: countItems(items) });
}
