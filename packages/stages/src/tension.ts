/**
 * Tension map plumbing (PLAN.md#12.22, ADR-017): reading `tension.json`, the curve table the
 * storyboard prompt gets, and Claude's proposal of the curve (the `tension` prompt, Sonnet):
 * run at the start of the Storyboard stage when the project's map is `auto` and no usable curve
 * exists, or on demand ("Propose with Claude", storyboard action `tension`). A curve the user
 * drew or edited, or locked, is never replaced by a storyboard re-run; locked shots keep the
 * tension they had (pins). Projects with the map `off` never get here.
 */
import { rm } from 'node:fs/promises';
import { err, ok, type Result } from '@reelforge/claude-bridge';
import { validateTension } from '@reelforge/prompts';
import {
  lockedShotPins,
  normalizeTensionPoints,
  projectTensionMap,
  storyboardFileSchema,
  TENSION_FILE,
  TENSION_FILE_VERSION,
  tensionFileSchema,
  tensionSpans,
  type ProjectFile,
  type StoryboardShot,
  type TensionFile,
  type WordsFile,
  wordsFileSchema,
} from '@reelforge/shared';
import {
  readProjectText,
  requireProjectJson,
  writeProjectJson,
  writeProjectText,
} from './files.js';
import { readLockedShots } from './locks.js';
import { FILES, inProject } from './paths.js';
import {
  checkWithRepair,
  errorLines,
  render,
  warningLines,
  type OutputCheck,
} from './stages/repair.js';
import { stageError, type StageContext, type StageError, type StageSummary } from './types.js';

export type TensionState =
  | { readonly status: 'missing' }
  | { readonly status: 'ok'; readonly file: TensionFile; readonly text: string }
  | { readonly status: 'invalid'; readonly text: string; readonly message: string };

/** A Claude curve older than the narration by more than this (s) is proposed again. */
const DURATION_DRIFT_S = 1;
const MIN_POINTS = 4;

export async function readTension(projectDir: string): Promise<Result<TensionState, StageError>> {
  const text = await readProjectText(projectDir, TENSION_FILE);
  if (!text.ok) return text;
  if (text.value === undefined) return ok({ status: 'missing' });
  let raw: unknown;
  try {
    raw = JSON.parse(text.value);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return ok({ status: 'invalid', text: text.value, message: `not valid JSON: ${reason}` });
  }
  const parsed = tensionFileSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const message = first === undefined ? 'invalid' : `${first.path.join('.')}: ${first.message}`;
    return ok({ status: 'invalid', text: text.value, message });
  }
  return ok({ status: 'ok', file: parsed.data, text: text.value });
}

/** Length of the narration (s): the end of the last timed word. */
export function narrationS(words: WordsFile): number {
  return words.words.at(-1)?.tEnd ?? 0;
}

/** `m:ss` for the prompt table. */
function clock(seconds: number): string {
  const whole = Math.round(seconds);
  return `${String(Math.floor(whole / 60))}:${String(whole % 60).padStart(2, '0')}`;
}

/** The curve as the storyboard prompt reads it: one line per segment. */
export function tensionTable(
  file: Pick<TensionFile, 'points' | 'segments'>,
  durationS: number,
): string {
  return tensionSpans(file, durationS)
    .map((span) => {
      const label = span.label === undefined ? '' : ` "${span.label}"`;
      return `- ${span.from.toFixed(1)}–${span.to.toFixed(1)} s (${clock(span.from)}–${clock(span.to)}): ${span.kind}${label}, tension ${span.mean.toFixed(2)}, target shot length ~${span.targetS.toFixed(1)} s`;
    })
    .join('\n');
}

/** True when a storyboard run should ask Claude for a (new) curve. */
export function needsProposal(state: TensionState, durationS: number): boolean {
  if (state.status !== 'ok') return true;
  const { file } = state;
  if (file.source !== 'claude' || file.locked === true) return false;
  const last = file.points.at(-1)?.t ?? 0;
  return Math.abs(last - durationS) > DURATION_DRIFT_S;
}

/** Why a curve cannot be proposed again right now (undefined = it can). */
export function proposalBlocked(state: TensionState): string | undefined {
  return state.status === 'ok' && state.file.locked === true
    ? 'the tension curve is locked: unlock it in the Tension panel first'
    : undefined;
}

function maxPoints(durationS: number): number {
  return Math.min(40, Math.max(8, Math.round(durationS / 8)));
}

/** Claude's curve made tidy: points cleaned and spanning [0, durationS], locked shots pinned. */
export function proposedCurve(
  written: TensionFile,
  durationS: number,
  previous: TensionFile | undefined,
  shots: readonly StoryboardShot[],
  locked: ReadonlySet<string>,
): TensionFile {
  const points = normalizeTensionPoints(written.points, durationS);
  const last = points.at(-1);
  if (last !== undefined && last.t < durationS - 1e-3) {
    points.push({ t: Math.round(durationS * 1000) / 1000, v: last.v });
  }
  const pins = lockedShotPins(previous, shots, locked);
  return {
    version: TENSION_FILE_VERSION,
    source: 'claude',
    points,
    ...(written.segments === undefined ? {} : { segments: written.segments }),
    ...(pins.length === 0 ? {} : { pins }),
    ...(written.note === undefined ? {} : { note: written.note }),
  };
}

async function existingShots(projectDir: string): Promise<StoryboardShot[]> {
  const text = await readProjectText(projectDir, FILES.storyboard);
  if (!text.ok || text.value === undefined) return [];
  try {
    const parsed = storyboardFileSchema.safeParse(JSON.parse(text.value));
    return parsed.success ? parsed.data.shots : [];
  } catch {
    return []; // an unreadable storyboard has no shots to pin
  }
}

export interface ProposalOutcome {
  /** The curve written (undefined: Claude wrote none and the stage goes on without one). */
  readonly file: TensionFile | undefined;
  readonly warnings: readonly string[];
  readonly repairs: number;
}

interface WrittenCheck extends OutputCheck<TensionFile> {
  /** False when the turn left tension.json as it was (or wrote none). */
  readonly written: boolean;
}

async function checkWritten(
  ctx: StageContext,
  before: string | undefined,
  durationS: number,
): Promise<WrittenCheck> {
  const text = await readProjectText(ctx.projectDir, TENSION_FILE);
  if (!text.ok) {
    return { value: undefined, problems: [text.error.message], warnings: [], written: true };
  }
  if (text.value === undefined || text.value === before) {
    const problems = [`${TENSION_FILE} was not written`];
    return { value: undefined, problems, warnings: [], written: false };
  }
  const report = validateTension(text.value, { durationS });
  return {
    value: report.value,
    problems: errorLines(report.issues),
    warnings: warningLines(report.issues),
    written: true,
  };
}

/** Puts back the curve that was there before an invalid proposal (or removes the proposal). */
async function discardProposal(
  projectDir: string,
  before: string | undefined,
): Promise<Result<void, StageError>> {
  if (before !== undefined) return writeProjectText(projectDir, TENSION_FILE, before);
  try {
    await rm(inProject(projectDir, TENSION_FILE), { force: true });
    return ok(undefined);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return err(stageError('io', `cannot remove the invalid ${TENSION_FILE}: ${reason}`));
  }
}

/**
 * One tension turn (+ one repair when Claude wrote an invalid curve). `required`: a missing or
 * still invalid curve fails (the user asked for it); otherwise it is a warning, the previous
 * file is left as it was, and the storyboard goes on without a new curve.
 */
export async function proposeTension(
  ctx: StageContext,
  words: WordsFile,
  state: TensionState,
  required: boolean,
): Promise<Result<ProposalOutcome, StageError>> {
  const durationS = narrationS(words);
  const prompt = render('tension', {
    durationS: durationS.toFixed(1),
    minPoints: MIN_POINTS,
    maxPoints: maxPoints(durationS),
  });
  if (!prompt.ok) return prompt;
  ctx.step('Mapping the tension', 5);
  const before = state.status === 'missing' ? undefined : state.text;
  const turn = await ctx.claude({
    prompt: 'tension',
    text: prompt.value,
    purpose: 'main',
    newSession: false,
    label: 'tension',
  });
  if (!turn.ok) return turn;
  const first = await checkWritten(ctx, before, durationS);
  const checked = !first.written
    ? ok({ ...first, repairs: 0 })
    : await checkWithRepair({
        ctx,
        prompt: 'tension',
        purpose: 'main',
        file: TENSION_FILE,
        label: 'tension',
        check: () => checkWritten(ctx, before, durationS),
      });
  if (!checked.ok) return checked;
  const { value, problems, warnings, repairs } = checked.value;
  if (problems.length > 0 || value === undefined) {
    const message = `no tension curve: ${problems.join('; ')}`;
    if (required) return err(stageError('validation', message, [...problems]));
    const discarded = await discardProposal(ctx.projectDir, before);
    if (!discarded.ok) return discarded;
    return ok({ file: undefined, warnings: [message, ...warnings], repairs });
  }
  const locked = await readLockedShots(ctx.projectDir);
  if (!locked.ok) return locked;
  const previous = state.status === 'ok' ? state.file : undefined;
  const curve = proposedCurve(
    value,
    durationS,
    previous,
    await existingShots(ctx.projectDir),
    locked.value,
  );
  const written = await writeProjectJson(ctx.projectDir, TENSION_FILE, tensionFileSchema, curve);
  if (!written.ok) return written;
  return ok({ file: written.value, warnings, repairs });
}

/**
 * The curve the storyboard steers by: the existing one, or Claude's proposal when there is no
 * usable one (an invalid file is reported and left alone). Undefined = no curve this run.
 */
export async function storyboardTension(
  ctx: StageContext,
  words: WordsFile,
): Promise<Result<ProposalOutcome, StageError>> {
  const state = await readTension(ctx.projectDir);
  if (!state.ok) return state;
  if (state.value.status === 'invalid') {
    return ok({
      file: undefined,
      warnings: [`${TENSION_FILE} is invalid (${state.value.message}): the storyboard ignores it`],
      repairs: 0,
    });
  }
  if (!needsProposal(state.value, narrationS(words))) {
    return ok({
      file: state.value.status === 'ok' ? state.value.file : undefined,
      warnings: [],
      repairs: 0,
    });
  }
  return proposeTension(ctx, words, state.value, false);
}

/** Storyboard prompt variables: the curve table, or none (map off / no curve). */
export function storyboardTensionVars(
  curve: Pick<TensionFile, 'points' | 'segments'> | undefined,
  words: WordsFile,
): Readonly<Record<string, string>> {
  return curve === undefined ? {} : { tension: tensionTable(curve, narrationS(words)) };
}

function peakLine(file: TensionFile): string {
  const peak = file.points.reduce((best, point) => (point.v > best.v ? point : best));
  return `peak ${peak.v.toFixed(2)} at ${clock(peak.t)}`;
}

/**
 * Storyboard action `tension` ("Propose with Claude" in the Tension panel): a fresh curve from
 * Claude replaces the current one (unless it is locked); storyboard.json and the stage status
 * stay as they were (the next Storyboard run reads the new curve).
 */
export async function runTensionProposal(
  ctx: StageContext,
): Promise<Result<StageSummary, StageError>> {
  const words = await requireProjectJson(ctx.projectDir, FILES.words, wordsFileSchema);
  if (!words.ok) return words;
  const state = await readTension(ctx.projectDir);
  if (!state.ok) return state;
  const blocked = proposalBlocked(state.value);
  if (blocked !== undefined) return err(stageError('invalid-input', blocked));
  const outcome = await proposeTension(ctx, words.value, state.value, true);
  if (!outcome.ok) return outcome;
  const { file, warnings, repairs } = outcome.value;
  if (file === undefined) return err(stageError('validation', 'no tension curve was written'));
  const message = `tension curve proposed: ${String(file.points.length)} points, ${peakLine(file)}`;
  return ok({
    message,
    outputs: [TENSION_FILE],
    changed: false,
    keepStatus: true,
    warnings,
    metrics: { points: file.points.length, repairs },
    commitMessage: `Tension: proposed by Claude (${String(file.points.length)} points, ${peakLine(file)})`,
  });
}

/**
 * The curve the sound design and other readers use: tension.json when the project's map is
 * `auto` and the file is valid, else undefined (exactly the behaviour without a map).
 */
export async function activeTension(
  projectDir: string,
  project: Pick<ProjectFile, 'tensionMap'>,
): Promise<TensionFile | undefined> {
  if (projectTensionMap(project) !== 'auto') return undefined;
  const state = await readTension(projectDir);
  return state.ok && state.value.status === 'ok' ? state.value.file : undefined;
}
