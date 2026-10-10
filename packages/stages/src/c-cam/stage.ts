/**
 * The people-and-places step of a Grim Ink (`c-cam`) film (PLAN.md#14.11): before the first scene,
 * every person and place the storyboard tags (`cast:` / `place:`, design.ts) gets its own module,
 * hand-built for this narration by one c-cam-build turn each (builder.ts: QA by code + critic, at
 * most one fix, a placeholder when it still fails). Runs once per storyboard
 * (`.reelforge/ink-modules.json` keeps its hash); a new storyboard builds only the modules it adds.
 * The `c-cam-modules` action runs it on request and also retries every module that is not built
 * clean (placeholders, critic findings, missing files). Never for another style, never in a short.
 */
import { existsSync } from 'node:fs';
import { err, ok, type Result } from '@reelforge/claude-bridge';
import { C_CAM_ID } from '@reelforge/kit';
import {
  INK_MODULES_REPORT_FILE,
  INK_MODULES_REPORT_VERSION,
  kitExtensionFile,
  type InkModuleRecord,
} from '@reelforge/shared';
import { inProject } from '../paths.js';
import type { SceneJob } from '../scenes/job.js';
import { stageError, type StageError, type StageSummary } from '../types.js';
import { storyboardHash } from '../world-assets/report.js';
import { worldScope } from '../worlds.js';
import { buildInkModule, nounOf } from './builder.js';
import { inkModuleDesigns } from './design.js';
import { readInkModulesReport, saveInkModulesReport } from './report.js';

export type InkModulesStatus = 'skipped' | 'up-to-date' | 'built';

export interface InkModulesOutcome {
  readonly status: InkModulesStatus;
  /** One line for the stage summary. */
  readonly message: string;
  readonly records: readonly InkModuleRecord[];
  /** Project-relative module files of the film. */
  readonly outputs: readonly string[];
  readonly warnings: readonly string[];
}

const skipped = (message: string): InkModulesOutcome => ({
  status: 'skipped',
  message,
  records: [],
  outputs: [],
  warnings: [],
});

/** A Grim Ink film: the world when offered, or its style with experimental worlds on. */
export function isCCamFilm(job: Pick<SceneJob, 'ctx' | 'world' | 'styleId' | 'short'>): boolean {
  if (job.short !== undefined) return false;
  if (job.world?.id === C_CAM_ID) return true;
  return job.styleId === C_CAM_ID && worldScope(job.ctx.settings).experimental === true;
}

const SYMBOL: Readonly<Record<InkModuleRecord['status'], string>> = {
  built: '✓',
  warning: '⚠',
  placeholder: '⚠ placeholder',
};

function summary(records: readonly InkModuleRecord[]): string {
  const part = (kind: InkModuleRecord['kind']): string | undefined => {
    const ofKind = records.filter((entry) => entry.kind === kind);
    if (ofKind.length === 0) return undefined;
    return `${kind}: ${ofKind.map((entry) => `${entry.id} ${SYMBOL[entry.status]}`).join(', ')}`;
  };
  const parts = [part('people'), part('places')].filter((text) => text !== undefined);
  return parts.length === 0 ? 'no people or places tagged' : parts.join('; ');
}

/** Keep the module as it is (no turn): its file exists and the request does not retry it. */
function keeps(previous: InkModuleRecord | undefined, exists: boolean, force: boolean): boolean {
  if (!exists || previous === undefined) return false;
  return !force || previous.status === 'built';
}

/**
 * Builds (or keeps) the film's people and places. `force`: the `c-cam-modules` action (run even
 * when the storyboard did not change and retry what is not built clean).
 */
export async function ensureCCamModules(
  job: SceneJob,
  options: { readonly force: boolean },
): Promise<Result<InkModulesOutcome, StageError>> {
  if (!isCCamFilm(job)) return ok(skipped('not a Grim Ink film'));
  const { ctx } = job;
  const hash = await storyboardHash(ctx.projectDir);
  if (!hash.ok) return hash;
  if (hash.value === undefined) return ok(skipped('no storyboard yet'));
  const report = await readInkModulesReport(ctx.projectDir);
  if (!report.ok) return report;
  const previous = report.value;
  const exists = (entry: Pick<InkModuleRecord, 'file'>): boolean =>
    existsSync(inProject(ctx.projectDir, entry.file));
  if (!options.force && previous?.storyboardHash === hash.value && previous.modules.every(exists)) {
    return ok({
      status: 'up-to-date',
      message: `${summary(previous.modules)} (kept)`,
      records: previous.modules,
      outputs: previous.modules.map((entry) => entry.file),
      warnings: [],
    });
  }
  const { designs, dropped } = inkModuleDesigns(job.shots);
  const warnings = dropped.map(
    ({ kind, id }) => `${kind} ${id} not built: the film already has the most ${kind} modules`,
  );
  const needsTurn = designs.some((design) => {
    const file = kitExtensionFile(design.kind, design.id);
    const before = previous?.modules.find((entry) => entry.file === file);
    return !keeps(before, exists({ file }), options.force);
  });
  if (needsTurn && !ctx.hasClaude) {
    return ok(skipped('Claude is not connected: people and places not built'));
  }
  const records: InkModuleRecord[] = [];
  for (const design of designs) {
    const file = kitExtensionFile(design.kind, design.id);
    const before = previous?.modules.find((entry) => entry.file === file);
    const onDisk = exists({ file });
    if (before !== undefined && keeps(before, onDisk, options.force)) {
      records.push(before);
      continue;
    }
    ctx.step(`${nounOf(design).toLowerCase()} ${design.id}`);
    const built = await buildInkModule(job, design, before, {
      existing: onDisk && before === undefined,
    });
    if (!built.ok) return built;
    records.push(built.value);
  }
  // Modules of earlier storyboards stay on disk (a scene may still draw them) and in the report.
  const kept = (previous?.modules ?? []).filter(
    (entry) => !records.some((record) => record.file === entry.file) && exists(entry),
  );
  const saved = await saveInkModulesReport(ctx.projectDir, {
    version: INK_MODULES_REPORT_VERSION,
    storyboardHash: hash.value,
    modules: [...records, ...kept],
    updatedAt: ctx.now().toISOString(),
  });
  if (!saved.ok) return saved;
  const unclean = records.filter((entry) => entry.status !== 'built');
  return ok({
    status: 'built',
    message: summary(records),
    records,
    outputs: records.map((entry) => entry.file),
    warnings: [
      ...warnings,
      ...unclean.map(
        (entry) =>
          `${entry.kind} ${entry.id} ${SYMBOL[entry.status]}: ${entry.findings.join(' | ')}`,
      ),
    ],
  });
}

/** `{ stage: 'scenes', action: 'c-cam-modules' }`: the film's people and places again. */
export async function cCamModulesAction(job: SceneJob): Promise<Result<StageSummary, StageError>> {
  if (!isCCamFilm(job)) {
    return err(
      stageError('invalid-input', "people and places: this project's style is not Grim Ink"),
    );
  }
  const outcome = await ensureCCamModules(job, { force: true });
  if (!outcome.ok) return outcome;
  const { value } = outcome;
  const counts = { built: 0, warning: 0, placeholder: 0 };
  for (const entry of value.records) counts[entry.status] += 1;
  return ok({
    message: `People and places: ${value.message}`,
    outputs: [...value.outputs, INK_MODULES_REPORT_FILE],
    changed: value.status === 'built',
    warnings: [...value.warnings],
    metrics: { inkModules: value.records.length, ...counts },
    commitMessage: `People and places: ${value.message}`,
    keepStatus: true,
  });
}
