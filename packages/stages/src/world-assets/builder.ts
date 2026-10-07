/**
 * The world-assets step (PLAN.md#13.15 phase 2, like the prop builder of the voxel films): before
 * the first scene of a world film, an Opus turn designs the film's OWN recurring things from its
 * narration (characters, key props, sprites, textures, icons, a place for every place of the
 * narration) as `assets/<world>/*.json` + `assets/cast.json`; QA by code and the Haiku critic on
 * contact sheets (world-assets/qa.ts) with one fix turn; anything the turn wrote outside those
 * files is put back, junk in the asset folder (an empty probe, a file defining nothing, a
 * misnamed file) is removed (junk.ts); the set is committed path-limited ("World assets built
 * ✓"). Runs once per storyboard (`.reelforge/world-assets.json` keeps its hash); a set with
 * findings is kept (⚠: the scene QA still catches undefined ids), a step that cannot run never
 * fails the scenes.
 */
import { existsSync } from 'node:fs';
import { readSheetRounds, startSheetRounds, worldAssetSet } from '@reelforge/cli/service';
import { ok, type Result } from '@reelforge/claude-bridge';
import {
  isWorldAssetWorld,
  MAX_WORLD_ASSET_SHEET_ROUNDS,
  WORLD_CAST_FILE,
  worldAssetsDir,
} from '@reelforge/shared';
import { inProject } from '../paths.js';
import type { SceneJob } from '../scenes/job.js';
import { render } from '../stages/repair.js';
import type { StageError } from '../types.js';
import { discardOutsideWrites, snapshotProject } from './guard.js';
import { droppedNote, dropJunkAssetFiles } from './junk.js';
import { worldAssetsPromptVars } from './prompt.js';
import {
  readAssetFiles,
  worldAssetsQaRound,
  type WorldAssetsJob,
  type WorldAssetsQa,
} from './qa.js';
import { readWorldAssetsReport, saveWorldAssetsReport, storyboardHash } from './report.js';

/** world-assets turns per storyboard: the design and one fix with the QA findings. */
export const WORLD_ASSET_ATTEMPTS = 2;

/** Turn failures that leave the step with findings (not the stage failed). */
const TURN_LEVEL_FAILURES = new Set<StageError['kind']>(['claude', 'validation', 'invalid-input']);

export type WorldAssetsStatus = 'skipped' | 'up-to-date' | 'built' | 'warning' | 'failed';

export interface WorldAssetsOutcome {
  readonly status: WorldAssetsStatus;
  /** One line for the stage summary. */
  readonly message: string;
  readonly ids: readonly string[];
  /** Project-relative files of the set (asset files + cast.json). */
  readonly outputs: readonly string[];
  readonly warnings: readonly string[];
}

const skipped = (message: string): WorldAssetsOutcome => ({
  status: 'skipped',
  message,
  ids: [],
  outputs: [],
  warnings: [],
});

/** The world job of a scene job, or undefined outside a world with assets. */
export function worldAssetsJob(job: SceneJob): WorldAssetsJob | undefined {
  const world = job.world;
  if (world === undefined || !isWorldAssetWorld(world.id)) return undefined;
  return {
    ctx: job.ctx,
    frames: job.frames,
    settings: job.settings,
    styleId: job.styleId,
    world,
    id: world.id,
  };
}

const describe = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/**
 * How many `world-assets sheet` rounds the turn ran (the CLI counts them in a session file the
 * step starts before the turn; best effort: a counter that cannot be read is a note, never an
 * error). More than the prompt's 2 is a note in the stage summary (real run Comic 2: ~20).
 */
async function sheetRoundsNote(projectDir: string, attempt: number): Promise<string[]> {
  try {
    const rounds = (await readSheetRounds(projectDir))?.rounds ?? 0;
    if (rounds <= MAX_WORLD_ASSET_SHEET_ROUNDS) return [];
    return [
      `world-assets turn ${String(attempt)} ran ${String(rounds)} sheet rounds (the prompt allows ${String(MAX_WORLD_ASSET_SHEET_ROUNDS)})`,
    ];
  } catch (error) {
    return [`world-assets turn ${String(attempt)}: sheet rounds not counted (${describe(error)})`];
  }
}

/** undefined = the turn ran; a string = it failed for this step only. */
async function designTurn(
  job: WorldAssetsJob,
  attempt: number,
  findings: readonly string[],
): Promise<Result<string | undefined, StageError>> {
  const { ctx } = job;
  const existing = await readAssetFiles(ctx.projectDir, job.id);
  if (!existing.ok) return existing;
  const prompt = render(
    'world-assets',
    worldAssetsPromptVars(job.world, job.id, {
      existing: [...worldAssetSet(existing.value).ids.all],
      findings,
      attempt,
    }),
  );
  if (!prompt.ok) return prompt;
  const snapshot = await snapshotProject(ctx.projectDir, job.id);
  if (!snapshot.ok) return snapshot;
  try {
    await startSheetRounds(ctx.projectDir, ctx.now());
  } catch (error) {
    ctx.warn(`world assets: cannot start the sheet round counter: ${describe(error)}`);
  }
  const turn = await ctx.claude({
    prompt: 'world-assets',
    text: prompt.value,
    purpose: 'main',
    newSession: true,
    label: 'world assets',
    commit: false,
    detached: true,
  });
  const discarded = await discardOutsideWrites(snapshot.value);
  if (!discarded.ok) return discarded;
  for (const file of discarded.value) {
    ctx.warn(
      `the world-assets turn changed ${file}; change discarded (it may write only ${worldAssetsDir(job.id)}/ and ${WORLD_CAST_FILE})`,
    );
  }
  if (turn.ok) return ok(undefined);
  return TURN_LEVEL_FAILURES.has(turn.error.kind) ? ok(turn.error.message) : turn;
}

function outcomeOf(
  job: WorldAssetsJob,
  qa: WorldAssetsQa | undefined,
  findings: readonly string[],
): WorldAssetsOutcome {
  const ids = qa?.set.ids.all ?? [];
  const cast = existsSync(inProject(job.ctx.projectDir, WORLD_CAST_FILE)) ? [WORLD_CAST_FILE] : [];
  const outputs = [...(qa?.set.files ?? []), ...cast];
  if (ids.length === 0) {
    return {
      status: 'failed',
      message: `world assets: none designed (${findings.join(' | ') || 'no files'})`,
      ids,
      outputs,
      warnings: [`world assets were not built: ${findings.join(' | ')}`],
    };
  }
  const count = `${String(ids.length)} world ${ids.length === 1 ? 'asset' : 'assets'}`;
  return findings.length === 0
    ? { status: 'built', message: `${count} ✓`, ids, outputs, warnings: [] }
    : {
        status: 'warning',
        message: `${count} ⚠`,
        ids,
        outputs,
        warnings: [
          `world assets of ${job.world.label} kept with findings: ${findings.join(' | ')}`,
        ],
      };
}

/**
 * Designs (or keeps) the film's world assets. `force`: run again even when the storyboard did
 * not change (the "world-assets" action); otherwise a set built for this storyboard is kept.
 */
export async function ensureWorldAssets(
  job: SceneJob,
  options: { readonly force: boolean },
): Promise<Result<WorldAssetsOutcome, StageError>> {
  const world = worldAssetsJob(job);
  if (world === undefined) return ok(skipped('not a world film'));
  const { ctx } = world;
  const hash = await storyboardHash(ctx.projectDir);
  if (!hash.ok) return hash;
  if (hash.value === undefined) return ok(skipped('no storyboard yet'));
  const report = await readWorldAssetsReport(ctx.projectDir);
  if (!report.ok) return report;
  const previous = report.value;
  if (!options.force && previous?.storyboardHash === hash.value && previous.status !== 'failed') {
    return ok({
      status: 'up-to-date',
      message: `${String(previous.ids.length)} world assets (kept)`,
      ids: previous.ids,
      outputs: previous.files,
      warnings: [],
    });
  }
  if (!ctx.hasClaude) return ok(skipped('Claude is not connected: world assets not designed'));
  const notes: string[] = [];
  let findings: readonly string[] = [];
  let qa: WorldAssetsQa | undefined;
  let attempts = 0;
  for (let attempt = 1; attempt <= WORLD_ASSET_ATTEMPTS; attempt += 1) {
    attempts = attempt;
    ctx.step(`world assets: ${attempt === 1 ? 'designing' : `fix ${String(attempt - 1)}`}`);
    const turn = await designTurn(world, attempt, findings);
    if (!turn.ok) return turn;
    if (turn.value !== undefined)
      notes.push(`world-assets turn ${String(attempt)} failed: ${turn.value}`);
    notes.push(...(await sheetRoundsNote(ctx.projectDir, attempt)));
    const junk = await dropJunkAssetFiles(ctx.projectDir, world.id, { badNames: false });
    if (!junk.ok) return junk;
    notes.push(...junk.value.map(droppedNote));
    ctx.step(`world assets: QA ${String(attempt)}`);
    const round = await worldAssetsQaRound(world);
    if (!round.ok) return round;
    qa = round.value;
    notes.push(...qa.notes);
    findings = turn.value === undefined ? qa.findings : [turn.value, ...qa.findings];
    if (findings.length === 0) break;
  }
  const misnamed = await dropJunkAssetFiles(ctx.projectDir, world.id, { badNames: true });
  if (!misnamed.ok) return misnamed;
  notes.push(...misnamed.value.map(droppedNote));
  const outcome = outcomeOf(world, qa, findings);
  const saved = await saveWorldAssetsReport(ctx.projectDir, {
    version: 1,
    world: world.id,
    storyboardHash: hash.value,
    status:
      outcome.status === 'warning' ? 'warning' : outcome.status === 'built' ? 'built' : 'failed',
    attempts,
    files: [...outcome.outputs],
    ids: [...outcome.ids],
    findings: [...findings],
    notes,
    ...(qa?.sheets[0] === undefined ? {} : { sheet: qa.sheets[0] }),
    updatedAt: ctx.now().toISOString(),
  });
  if (!saved.ok) return saved;
  if (outcome.outputs.length > 0) {
    // Only the world's files: nothing else of the project goes into this commit.
    await ctx.commit(`World assets built ${outcome.status === 'built' ? '✓' : '⚠'}`, [
      ...outcome.outputs,
    ]);
  }
  return ok({ ...outcome, warnings: [...outcome.warnings, ...notes] });
}
