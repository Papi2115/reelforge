/**
 * QA of a project prop by code (PLAN.md#7.4; Claude's self-report is not trusted): prop lint →
 * turntable render through the scene renderer (the CLI's `prop-preview` scene and checks: blank,
 * size, floating parts, determinism) → turntable sheet → Haiku critic ("is it recognisably a
 * <name>?"). The critic runs only when the code checks pass.
 */
import {
  DEFAULT_ANGLES,
  propPreviewPaths,
  TURNTABLE_SHOT_ID,
  turntableChecks,
  turntableDuration,
  turntableSheet,
  turntableSource,
  turntableTimes,
} from '@reelforge/cli/service';
import { err, ok, type Result } from '@reelforge/claude-bridge';
import { formatDiagnostics, hasErrors, lintPropModule } from '@reelforge/engine';
import { encodePng } from '@reelforge/engine/raster';
import { validateCriticReply } from '@reelforge/prompts';
import { writeAtomic } from '@reelforge/project';
import { propExtensionFile } from '@reelforge/shared';
import { readProjectText, writeProjectText } from '../files.js';
import { inProject } from '../paths.js';
import type { SceneJob } from '../scenes/job.js';
import { renderShot } from '../scenes/render.js';
import { render } from '../stages/repair.js';
import { stageError, type StageError } from '../types.js';

/** What a prop QA round needs from the scene job. */
export type PropJobContext = Pick<SceneJob, 'ctx' | 'frames' | 'settings' | 'styleId'>;

export interface PropQaResult {
  /** Problems to fix (empty = the prop passed). */
  readonly findings: readonly string[];
  /** Project-relative turntable sheet, when the prop rendered. */
  readonly sheet: string | undefined;
  readonly notes: readonly string[];
}

const failed = (findings: string[]): PropQaResult => ({ findings, sheet: undefined, notes: [] });

async function critique(
  job: PropJobContext,
  name: string,
  description: string,
  sheet: string,
  angles: number,
): Promise<Result<{ findings: string[]; notes: string[] }, StageError>> {
  const prompt = render('critic', {
    imagePaths: sheet,
    intent: `ONE voxel prop shown alone from ${String(angles)} angles on a plain stage: ${name} (${description}). ok = clearly recognisable as a ${name} from the views; off-intent = it does not read as a ${name}; blank/clipped as usual`,
    styleId: job.styleId,
  });
  if (!prompt.ok) return prompt;
  const turn = await job.ctx.claude({
    prompt: 'critic',
    text: prompt.value,
    purpose: 'qa',
    newSession: true,
    label: `critic prop ${name}`,
    commit: false,
    detached: true,
  });
  if (!turn.ok) {
    if (turn.error.kind !== 'claude') return turn;
    return ok({ findings: [], notes: [`the prop critic failed: ${turn.error.message}`] });
  }
  const reply = validateCriticReply(turn.value.reply, { expectedPaths: [sheet] });
  if (reply.value === undefined) {
    return ok({ findings: [], notes: ["the prop critic's reply was not valid JSON"] });
  }
  const findings = reply.value.frames
    .filter((frame) => frame.verdict !== 'ok')
    .map((frame) => `the critic says "${frame.verdict}": ${frame.note}`);
  return ok({ findings, notes: [] });
}

/** One QA round of `kit-ext/props/<name>.js` as it is on disk; `label` names the sheet. */
export async function propQaRound(
  job: PropJobContext,
  name: string,
  description: string,
  label: string,
): Promise<Result<PropQaResult, StageError>> {
  const { ctx } = job;
  const file = propExtensionFile(name);
  const source = await readProjectText(ctx.projectDir, file);
  if (!source.ok) return source;
  if (source.value === undefined) return ok(failed([`${file} was not written`]));
  const lint = lintPropModule(source.value, { filename: file });
  if (hasErrors(lint)) {
    const errors = lint.filter((diagnostic) => diagnostic.severity === 'error');
    return ok(failed([`lint errors:\n${formatDiagnostics(file, errors)}`]));
  }
  // Faster checks (ADR-027) look from fewer angles.
  const angles = job.settings.propAngles ?? DEFAULT_ANGLES;
  const paths = propPreviewPaths(name);
  const scene = await writeProjectText(ctx.projectDir, paths.scene, turntableSource(name, angles));
  if (!scene.ok) return scene;
  const rendered = await renderShot(
    job.frames,
    {
      projectDir: ctx.projectDir,
      shotId: TURNTABLE_SHOT_ID,
      times: turntableTimes(angles),
      cards: false,
      standalone: { scene: paths.scene, duration: turntableDuration(angles) },
    },
    ctx.signal,
  );
  if (!rendered.ok) return rendered;
  const result = rendered.value;
  if (!result.ok) return ok(failed([`the prop does not load: ${result.error}`]));
  const checks = turntableChecks({ angles, frames: result.frames, cues: result.cues });
  const findings = checks
    .filter((check) => !check.ok)
    .map((check) => `${check.id}: ${check.message}`);
  const sheet = `${paths.dir}/qa-${label}.png`;
  try {
    await writeAtomic(
      inProject(ctx.projectDir, sheet),
      encodePng(turntableSheet(name, angles, result.frames, result)),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return err(stageError('io', `cannot write ${sheet}: ${message}`));
  }
  if (findings.length > 0 || !job.settings.critic || !ctx.hasClaude) {
    return ok({ findings, sheet, notes: [] });
  }
  const judged = await critique(job, name, description, sheet, angles.length);
  if (!judged.ok) return judged;
  return ok({ findings: judged.value.findings, sheet, notes: judged.value.notes });
}
