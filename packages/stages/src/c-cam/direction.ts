/**
 * The direction step of a Grim Ink (`c-cam`) film (PLAN.md#14.16): before the storyboard, one
 * Sonnet turn (`c-cam-direction`, a JSON reply, no file edits) plans the film's narrative accents
 * into `direction.json` (motifs, one signature gag per person with its arc, beats with intents and
 * framing progressions, accidents, the climax ECU, the title frame). The reply is checked
 * (validators/direction.ts); an invalid plan gets one fix turn; when Claude fails or the fix still
 * fails, a deterministic minimal plan from the script is written instead (⚠). Cached by the hash
 * of script.txt + timing/words.json: the Storyboard stage plans again only when they changed (a
 * plan without the hash is the user's and is kept). Sub-action `{ stage: 'storyboard', action:
 * 'direction' }` plans again on request. Never for another style, never in a short.
 */
import { createHash } from 'node:crypto';
import { err, ok, type Result } from '@reelforge/claude-bridge';
import { C_CAM_ID, C_CAM_VOCABULARY } from '@reelforge/kit';
import {
  cCamDirectionPromptVars,
  checkDirection,
  fallbackDirection,
  validateDirection,
  type DirectionCheckOptions,
} from '@reelforge/prompts';
import {
  DIRECTION_FILE,
  directionFileSchema,
  findGenrePreset,
  isShort,
  type DirectionFile,
  type ProjectFile,
  type WordsFile,
} from '@reelforge/shared';
import { readProjectText, writeProjectJson } from '../files.js';
import { FILES } from '../paths.js';
import { errorLines, render } from '../stages/repair.js';
import { stageError, type StageContext, type StageError } from '../types.js';
import { activeWorld, worldScope } from '../worlds.js';
import { styleDigest } from './prompt.js';

export type DirectionStatus = 'kept' | 'planned' | 'fallback' | 'skipped';

export interface DirectionOutcome {
  readonly status: DirectionStatus;
  /** The plan the storyboard follows (undefined: none this run). */
  readonly file: DirectionFile | undefined;
  readonly warnings: readonly string[];
  readonly repairs: number;
  /** Project-relative files written. */
  readonly outputs: readonly string[];
}

/** A Grim Ink film (not a short) whose world is offered. */
export function isCCamProject(
  project: Pick<ProjectFile, 'style' | 'kind' | 'short'>,
  ctx: Pick<StageContext, 'settings'>,
): boolean {
  if (isShort(project)) return false;
  return activeWorld(project.style, worldScope(ctx.settings))?.id === C_CAM_ID;
}

/** The cache key: script.txt and timing/words.json together. */
export function directionInputsHash(script: string, words: WordsFile): string {
  return createHash('sha256')
    .update(script)
    .update('\u0000')
    .update(JSON.stringify(words.words))
    .digest('hex');
}

type DirectionState =
  | { readonly status: 'missing' }
  | { readonly status: 'ok'; readonly file: DirectionFile }
  | { readonly status: 'invalid'; readonly message: string };

export async function readDirection(
  projectDir: string,
): Promise<Result<DirectionState, StageError>> {
  const text = await readProjectText(projectDir, DIRECTION_FILE);
  if (!text.ok) return text;
  if (text.value === undefined) return ok({ status: 'missing' });
  let raw: unknown;
  try {
    raw = JSON.parse(text.value);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return ok({ status: 'invalid', message: `not valid JSON: ${reason}` });
  }
  const parsed = directionFileSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const where = first === undefined ? 'invalid' : `${first.path.join('.')}: ${first.message}`;
    return ok({ status: 'invalid', message: where });
  }
  return ok({ status: 'ok', file: parsed.data });
}

const skipped = (warnings: readonly string[] = []): DirectionOutcome => ({
  status: 'skipped',
  file: undefined,
  warnings,
  repairs: 0,
  outputs: [],
});

function genreLine(project: Pick<ProjectFile, 'genrePreset'>): string | undefined {
  const preset = findGenrePreset(project.genrePreset);
  if (preset === undefined) return undefined;
  return `${preset.name} (${preset.scriptTone})`;
}

function repairText(problems: readonly string[]): string {
  return [
    'Your direction plan does not pass the app checks:',
    ...problems.map((problem) => `- ${problem}`),
    '',
    'Fix every point following the original rules and reply with the whole corrected JSON object only. Never ask a question.',
  ].join('\n');
}

interface Planned {
  readonly file: DirectionFile | undefined;
  readonly problems: readonly string[];
  readonly repairs: number;
}

/** The Claude turn + one fix turn; `file` undefined = no valid plan (the caller falls back). */
async function askClaude(
  ctx: StageContext,
  prompt: string,
  checks: DirectionCheckOptions,
): Promise<Result<Planned, StageError>> {
  ctx.step('Planning the direction', 3);
  let repairs = 0;
  let text = prompt;
  for (;;) {
    const turn = await ctx.claude({
      prompt: 'c-cam-direction',
      text,
      purpose: 'main',
      newSession: false,
      label: repairs === 0 ? 'direction' : 'direction repair',
    });
    if (!turn.ok) {
      if (turn.error.kind !== 'claude') return turn;
      return ok({ file: undefined, problems: [turn.error.message], repairs });
    }
    const report = validateDirection(turn.value.reply, checks);
    const problems = errorLines(report.issues);
    if (problems.length === 0 && report.value !== undefined) {
      return ok({ file: report.value, problems: [], repairs });
    }
    if (repairs >= 1) return ok({ file: undefined, problems, repairs });
    repairs += 1;
    ctx.step('Repairing the direction plan');
    text = repairText(problems);
  }
}

async function save(
  ctx: StageContext,
  file: DirectionFile,
): Promise<Result<DirectionFile, StageError>> {
  return writeProjectJson(ctx.projectDir, DIRECTION_FILE, directionFileSchema, file);
}

/**
 * The film's plan: kept when its inputs did not change (or the user owns it), else planned by
 * Claude, else the minimal plan. `force`: plan again even when the inputs did not change.
 */
export async function ensureDirection(
  ctx: StageContext,
  project: ProjectFile,
  words: WordsFile,
  options: { readonly force: boolean },
): Promise<Result<DirectionOutcome, StageError>> {
  const script = await readProjectText(ctx.projectDir, FILES.script);
  if (!script.ok) return script;
  if (script.value === undefined) return ok(skipped([`direction: ${FILES.script} is missing`]));
  const hash = directionInputsHash(script.value, words);
  const state = await readDirection(ctx.projectDir);
  if (!state.ok) return state;
  const current = state.value;
  if (!options.force && current.status === 'ok') {
    const hashOf = current.file.inputsHash;
    if (hashOf === undefined || hashOf === hash) {
      return ok({ status: 'kept', file: current.file, warnings: [], repairs: 0, outputs: [] });
    }
  }
  const gagKinds = C_CAM_VOCABULARY.gags;
  const checks: DirectionCheckOptions = {
    durationS: words.words.at(-1)?.tEnd ?? 0,
    gagKinds,
    script: script.value,
  };
  const notes: string[] =
    current.status === 'invalid' ? [`${DIRECTION_FILE} was invalid (${current.message})`] : [];
  let repairs = 0;
  if (ctx.hasClaude) {
    const genre = genreLine(project);
    const prompt = render(
      'c-cam-direction',
      cCamDirectionPromptVars({
        script: script.value,
        words,
        style: styleDigest(),
        gagKinds,
        ...(genre === undefined ? {} : { genre }),
      }),
    );
    if (!prompt.ok) return prompt;
    const planned = await askClaude(ctx, prompt.value, checks);
    if (!planned.ok) return planned;
    repairs = planned.value.repairs;
    if (planned.value.file !== undefined) {
      const saved = await save(ctx, { ...planned.value.file, source: 'claude', inputsHash: hash });
      if (!saved.ok) return saved;
      const outcome = { file: saved.value, warnings: notes, repairs, outputs: [DIRECTION_FILE] };
      return ok({ status: 'planned', ...outcome });
    }
    const why = planned.value.problems.slice(0, 3).join('; ');
    notes.push(
      `⚠ direction: Claude's plan failed (${why}); a minimal plan from the script is used`,
    );
  } else {
    notes.push('⚠ direction: Claude is not connected; a minimal plan from the script is used');
  }
  return writeFallback(ctx, {
    words,
    script: script.value,
    gagKinds,
    hash,
    checks,
    notes,
    repairs,
  });
}

async function writeFallback(
  ctx: StageContext,
  input: {
    readonly words: WordsFile;
    readonly script: string;
    readonly gagKinds: readonly string[];
    readonly hash: string;
    readonly checks: DirectionCheckOptions;
    readonly notes: readonly string[];
    readonly repairs: number;
  },
): Promise<Result<DirectionOutcome, StageError>> {
  const plan = fallbackDirection(input);
  const invalid =
    plan === undefined ||
    checkDirection(plan, input.checks).some((entry) => entry.severity === 'error');
  if (plan === undefined || invalid) {
    return ok(skipped([...input.notes, 'direction: the narration is too short for a plan']));
  }
  const saved = await save(ctx, { ...plan, inputsHash: input.hash });
  if (!saved.ok) return saved;
  return ok({
    status: 'fallback',
    file: saved.value,
    warnings: input.notes,
    repairs: input.repairs,
    outputs: [DIRECTION_FILE],
  });
}

/** One line on a plan for the stage summary and the commit. */
export function directionSummary(outcome: DirectionOutcome): string {
  const { file } = outcome;
  if (file === undefined) return 'no direction plan';
  const tag = outcome.status === 'fallback' ? ' (minimal plan ⚠)' : '';
  return `${String(file.beats.length)} beats, ${String(file.cast.length)} people, climax ${file.climax.beatRef}${tag}`;
}

/** Fails when the project is not a Grim Ink film (the action's guard). */
export function requireCCam(
  project: ProjectFile,
  ctx: Pick<StageContext, 'settings'>,
): Result<void, StageError> {
  return isCCamProject(project, ctx)
    ? ok(undefined)
    : err(stageError('invalid-input', "direction: this project's style is not Grim Ink"));
}
