/**
 * QA of a Grim Ink person or place by code (PLAN.md#14.11; Claude's self-report is not trusted):
 * the ink-module lint → the kit's contract and, for a person, the people validators (load.ts) →
 * the contact sheet rendered through the frame renderer like `reelforge people-preview` /
 * `places-preview` (pages not blank, the same page twice identical) → the Haiku critic on the
 * sheet, only when the code checks pass. `codeFailed` says the module cannot be trusted in a
 * scene (lint, contract, validator errors, render); critic findings alone keep it usable.
 */
import {
  INK_SHEET_SHOT_ID,
  inkPreviewPaths,
  inkSheet,
  inkSheetChecks,
  inkSheetDuration,
  inkSheetSource,
  inkSheetTimes,
} from '@reelforge/cli/service';
import { err, ok, type Result } from '@reelforge/claude-bridge';
import { formatDiagnostics, hasErrors, lintInkModule } from '@reelforge/engine';
import { encodePng } from '@reelforge/engine/raster';
import type { InkValidationFinding } from '@reelforge/kit';
import { validateCriticReply, worldPromptText } from '@reelforge/prompts';
import { writeAtomic } from '@reelforge/project';
import { kitExtensionFile } from '@reelforge/shared';
import { readProjectText, writeProjectText } from '../files.js';
import { inProject } from '../paths.js';
import type { SceneJob } from '../scenes/job.js';
import { renderShot } from '../scenes/render.js';
import { render } from '../stages/repair.js';
import { stageError, type StageError } from '../types.js';
import { designBrief, type InkModuleDesign } from './design.js';
import { checkInkModule } from './load.js';

/** What a QA round needs from the scene job. */
export type InkJob = Pick<SceneJob, 'ctx' | 'frames' | 'settings' | 'styleId' | 'words'>;

export interface InkQa {
  /** Problems to fix (empty = the module passed). */
  readonly findings: readonly string[];
  /** The module failed a code check (it must not reach the scenes as it is). */
  readonly codeFailed: boolean;
  /** Project-relative contact sheet, when it rendered. */
  readonly sheet: string | undefined;
  readonly notes: readonly string[];
}

/** Validator findings per rule in a prompt (a rule fails in many views and poses at once). */
const MAX_RULE_LINES = 8;

const describe = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const failed = (findings: readonly string[], sheet?: string): InkQa => ({
  findings,
  codeFailed: true,
  sheet,
  notes: [],
});

/** One line per rule: how often, where first, the message and the fix. */
export function groupedFindings(findings: readonly InkValidationFinding[]): string[] {
  const byCode = new Map<string, InkValidationFinding[]>();
  for (const finding of findings) {
    byCode.set(finding.code, [...(byCode.get(finding.code) ?? []), finding]);
  }
  return [...byCode.values()].slice(0, MAX_RULE_LINES).map((group) => {
    const [first] = group;
    if (first === undefined) return '';
    const where = [
      first.view === null ? undefined : `view ${String(first.view)}`,
      first.pose === null ? undefined : `pose ${first.pose}`,
    ].filter((part) => part !== undefined);
    const count = group.length === 1 ? '' : ` (${String(group.length)} cases)`;
    return `validator ${first.code}${count}${where.length === 0 ? '' : `, first at ${where.join(', ')}`}: ${first.message}; fix: ${first.fix}`;
  });
}

async function critique(
  job: InkJob,
  design: InkModuleDesign,
  sheet: string,
): Promise<Result<{ findings: string[]; notes: string[] }, StageError>> {
  const noun = design.kind === 'people' ? 'person' : 'place';
  const text = worldPromptText(job.styleId);
  // The world's medium, style and vibe check; never its shot checklist (a sheet is not a shot).
  const world =
    text === undefined
      ? {}
      : {
          world: 'Grim Ink',
          worldMedium: text.criticMedium,
          worldCriticStyle: text.criticStyle,
          worldVibe: text.vibe,
        };
  const prompt = render('critic', {
    imagePaths: sheet,
    intent: `ONE hand-built ${noun} of the film shown alone on a labelled contact sheet (${design.kind === 'people' ? 'six views x stand/akimbo/walk, then the 14 faces' : 'wide, x2 on its light, x3.2 on its first anchor'}): ${designBrief(design)}. ok = it reads as that one specific, grimy ${noun} in every tile; off-intent = it does not read as that ${noun}, the views disagree, or it breaks the style; blank/clipped as usual`,
    styleId: job.styleId,
    ...world,
  });
  if (!prompt.ok) return prompt;
  const turn = await job.ctx.claude({
    prompt: 'critic',
    text: prompt.value,
    purpose: 'qa',
    newSession: true,
    label: `critic ${noun} ${design.id}`,
    commit: false,
    detached: true,
  });
  if (!turn.ok) {
    if (turn.error.kind !== 'claude') return turn;
    return ok({ findings: [], notes: [`the ${noun} critic failed: ${turn.error.message}`] });
  }
  const reply = validateCriticReply(turn.value.reply, { expectedPaths: [sheet] });
  if (reply.value === undefined) {
    return ok({ findings: [], notes: [`the ${noun} critic's reply was not valid JSON`] });
  }
  const findings = reply.value.frames
    .filter((frame) => frame.verdict !== 'ok')
    .map((frame) => `the critic says "${frame.verdict}": ${frame.note}`);
  return ok({ findings, notes: [] });
}

/** Renders the contact sheet; `failure` = why it is not usable. */
async function contactSheet(
  job: InkJob,
  design: InkModuleDesign,
  label: string,
): Promise<Result<{ sheet: string | undefined; failures: string[] }, StageError>> {
  const { ctx } = job;
  const paths = inkPreviewPaths(design.kind, design.id);
  const scene = await writeProjectText(
    ctx.projectDir,
    paths.scene,
    inkSheetSource(design.kind, design.id),
  );
  if (!scene.ok) return scene;
  const rendered = await renderShot(
    job.frames,
    {
      projectDir: ctx.projectDir,
      shotId: INK_SHEET_SHOT_ID,
      times: inkSheetTimes(design.kind),
      cards: false,
      standalone: { scene: paths.scene, duration: inkSheetDuration(design.kind) },
    },
    ctx.signal,
  );
  if (!rendered.ok) return rendered;
  const result = rendered.value;
  if (!result.ok) return ok({ sheet: undefined, failures: [`it does not load: ${result.error}`] });
  const failures = inkSheetChecks(design.kind, result.frames)
    .filter((check) => !check.ok)
    .map((check) => `${check.id}: ${check.message}`);
  const sheet = `${paths.dir}/qa-${label}.png`;
  try {
    await writeAtomic(
      inProject(ctx.projectDir, sheet),
      encodePng(inkSheet(design.kind, design.id, result.frames, result)),
    );
  } catch (error) {
    return err(stageError('io', `cannot write ${sheet}: ${describe(error)}`));
  }
  return ok({ sheet, failures });
}

/** One QA round of `kit-ext/<kind>/<id>.js` as it is on disk; `label` names the sheet. */
export async function inkQaRound(
  job: InkJob,
  design: InkModuleDesign,
  label: string,
): Promise<Result<InkQa, StageError>> {
  const { ctx } = job;
  const file = kitExtensionFile(design.kind, design.id);
  const source = await readProjectText(ctx.projectDir, file);
  if (!source.ok) return source;
  if (source.value === undefined) return ok(failed([`${file} was not written`]));
  const lint = lintInkModule(source.value, { filename: file }, design.kind);
  if (hasErrors(lint)) {
    const errors = lint.filter((diagnostic) => diagnostic.severity === 'error');
    return ok(failed([`lint errors:\n${formatDiagnostics(file, errors)}`]));
  }
  const checked = checkInkModule(design.kind, file, source.value);
  if (!checked.ok) return ok(failed([checked.error]));
  const findings = checked.report?.findings ?? [];
  const errors = groupedFindings(findings.filter((finding) => finding.severity === 'error'));
  const warnings = groupedFindings(findings.filter((finding) => finding.severity === 'warn'));
  const drawn = await contactSheet(job, design, label);
  if (!drawn.ok) return drawn;
  const { sheet } = drawn.value;
  const code = [...errors, ...drawn.value.failures];
  if (code.length > 0) return ok({ ...failed(code, sheet), notes: warnings });
  if (sheet === undefined || !job.settings.critic || !ctx.hasClaude) {
    return ok({ findings: [], codeFailed: false, sheet, notes: warnings });
  }
  const judged = await critique(job, design, sheet);
  if (!judged.ok) return judged;
  return ok({
    findings: judged.value.findings,
    codeFailed: false,
    sheet,
    notes: [...warnings, ...judged.value.notes],
  });
}
