/**
 * One Grim Ink person or place (PLAN.md#14.11, like the prop builder): a c-cam-build turn (Opus)
 * writes `kit-ext/<people|places>/<id>.js`, QA by code checks it (qa.ts) with at most ONE fix
 * turn, and the module is committed alone ("Person <id> built ✓"). A module that still fails a
 * code check never blocks the film: it moves to `.reelforge/ink-failed/` and a plain sketched
 * placeholder takes its id (⚠, "Person <id> placeholder ⚠"), so every scene that draws it still
 * renders. Critic findings alone keep the module (⚠). The turn may write only its own module file:
 * anything else it changes in the project is put back afterwards (write-guard.ts, a warning).
 */
import { existsSync } from 'node:fs';
import { mkdir, rename } from 'node:fs/promises';
import path from 'node:path';
import { err, ok, type Result } from '@reelforge/claude-bridge';
import {
  INK_MODULES_FAILED_DIR,
  kitExtensionFile,
  type InkModuleRecord,
  type InkModuleStatus,
} from '@reelforge/shared';
import { writeProjectText } from '../files.js';
import { inProject } from '../paths.js';
import { render } from '../stages/repair.js';
import { stageError, type StageError } from '../types.js';
import { restoreTurnWrites, snapshotTurnWrites } from '../write-guard.js';
import { designBrief, type InkModuleDesign } from './design.js';
import { placeholderSource } from './placeholder.js';
import { cCamBuildVars } from './prompt.js';
import { inkQaRound, type InkJob, type InkQa } from './qa.js';

/** c-cam-build turns per module: the build and ONE fix with the QA findings. */
export const INK_BUILD_ATTEMPTS = 2;

/** Turn failures that fail the module (not the stage). */
const MODULE_LEVEL_FAILURES = new Set<StageError['kind']>([
  'claude',
  'validation',
  'invalid-input',
]);

const describe = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

export const nounOf = (design: Pick<InkModuleDesign, 'kind'>): string =>
  design.kind === 'people' ? 'Person' : 'Place';

/** undefined = the turn ran; a string = it failed for this module only. */
async function buildTurn(
  job: InkJob,
  design: InkModuleDesign,
  attempt: number,
  findings: readonly string[],
): Promise<Result<string | undefined, StageError>> {
  const prompt = render('c-cam-build', cCamBuildVars(design, job.words, { findings, attempt }));
  if (!prompt.ok) return prompt;
  const file = kitExtensionFile(design.kind, design.id);
  const snapshot = await snapshotTurnWrites(
    job.ctx.projectDir,
    `the c-cam-build turn of ${file}`,
    (written) => written === file,
  );
  if (!snapshot.ok) return snapshot;
  const turn = await job.ctx.claude({
    prompt: 'c-cam-build',
    text: prompt.value,
    purpose: 'main',
    newSession: true,
    label: `c-cam-build ${design.id}`,
    commit: false,
    detached: true,
  });
  const discarded = await restoreTurnWrites(snapshot.value);
  if (!discarded.ok) return discarded;
  for (const changed of discarded.value) {
    job.ctx.warn(
      `the c-cam-build turn of ${file} changed ${changed}; change discarded (it may write only ${file})`,
    );
  }
  if (turn.ok) return ok(undefined);
  return MODULE_LEVEL_FAILURES.has(turn.error.kind) ? ok(turn.error.message) : turn;
}

/** A module that failed its code checks moves aside; the placeholder takes its id. */
async function replaceWithPlaceholder(
  job: InkJob,
  design: InkModuleDesign,
): Promise<Result<void, StageError>> {
  const { projectDir } = job.ctx;
  const file = kitExtensionFile(design.kind, design.id);
  const from = inProject(projectDir, file);
  if (existsSync(from)) {
    const to = inProject(projectDir, `${INK_MODULES_FAILED_DIR}/${design.kind}/${design.id}.js`);
    try {
      await mkdir(path.dirname(to), { recursive: true });
      await rename(from, to);
    } catch (error) {
      return err(stageError('io', `cannot move ${file} aside: ${describe(error)}`));
    }
  }
  const name = `${design.id} (placeholder)`;
  const written = await writeProjectText(
    projectDir,
    file,
    placeholderSource(design.kind, design.id, name),
  );
  return written.ok ? ok(undefined) : written;
}

function record(
  job: InkJob,
  design: InkModuleDesign,
  status: InkModuleStatus,
  previous: InkModuleRecord | undefined,
  attempts: number,
  qa: Pick<InkQa, 'findings' | 'sheet' | 'notes'>,
): InkModuleRecord {
  return {
    kind: design.kind,
    id: design.id,
    status,
    file: kitExtensionFile(design.kind, design.id),
    brief: designBrief(design),
    shots: design.shots.map((shot) => shot.id),
    attempts: (previous?.attempts ?? 0) + attempts,
    ...(qa.sheet === undefined ? {} : { sheet: qa.sheet }),
    findings: [...qa.findings],
    notes: [...qa.notes],
    updatedAt: job.ctx.now().toISOString(),
  };
}

/**
 * Builds one module (or checks one already on disk first, `existing`) and returns its record;
 * the module file is committed alone.
 */
export async function buildInkModule(
  job: InkJob,
  design: InkModuleDesign,
  previous: InkModuleRecord | undefined,
  options: { readonly existing: boolean },
): Promise<Result<InkModuleRecord, StageError>> {
  const { ctx } = job;
  const noun = nounOf(design);
  const file = kitExtensionFile(design.kind, design.id);
  const notes: string[] = [];
  let qa: InkQa | undefined;
  let findings: readonly string[] = [];
  let attempts = 0;
  if (options.existing) {
    // Written earlier (by hand, or an interrupted run): check it before any turn.
    const checked = await inkQaRound(job, design, 'existing');
    if (!checked.ok) return checked;
    qa = checked.value;
    findings = qa.findings;
  }
  while ((qa === undefined || findings.length > 0) && attempts < INK_BUILD_ATTEMPTS) {
    attempts += 1;
    const what = `${noun.toLowerCase()} ${design.id}`;
    ctx.step(`${what}: ${attempts === 1 && qa === undefined ? 'building' : 'fix'}`);
    const turn = await buildTurn(job, design, attempts, findings);
    if (!turn.ok) return turn;
    if (turn.value !== undefined) notes.push(`c-cam-build turn ${String(attempts)}: ${turn.value}`);
    ctx.step(`${what}: QA ${String(attempts)}`);
    const round = await inkQaRound(job, design, String(attempts));
    if (!round.ok) return round;
    qa = round.value;
    findings = turn.value === undefined ? qa.findings : [turn.value, ...qa.findings];
  }
  const last = qa ?? { findings, codeFailed: true, sheet: undefined, notes: [] };
  const details = { findings, sheet: last.sheet, notes: [...notes, ...last.notes] };
  if (findings.length === 0) {
    await ctx.commit(`${noun} ${design.id} built ✓`, [file]);
    return ok(record(job, design, 'built', previous, attempts, details));
  }
  if (!last.codeFailed) {
    ctx.warn(`${noun.toLowerCase()} ${design.id} kept with findings: ${findings.join(' | ')}`);
    await ctx.commit(`${noun} ${design.id} built ⚠`, [file]);
    return ok(record(job, design, 'warning', previous, attempts, details));
  }
  const replaced = await replaceWithPlaceholder(job, design);
  if (!replaced.ok) return replaced;
  ctx.warn(
    `${noun.toLowerCase()} ${design.id} could not be built (a plain placeholder stands in): ${findings.join(' | ')}`,
  );
  await ctx.commit(`${noun} ${design.id} placeholder ⚠`, [file]);
  return ok(record(job, design, 'placeholder', previous, attempts, details));
}
