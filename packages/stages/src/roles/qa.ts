/**
 * QA of a project role by code (PLAN.md#12.20, ADR-026; Claude's self-report is not trusted): the
 * role file and the accessories it uses parse (kit schemas) → spec checks (outfit colours,
 * palette, face, accessories on valid slots) → lineup render through the scene renderer (4 angles
 * + 2 poses: height within the pack's range, views not blank, vibe guard, determinism) → lineup
 * sheet → Haiku critic ("a sibling of the pack?"). The critic runs only when the code checks pass.
 */
import {
  LINEUP_SHOT_ID,
  lineupChecks,
  lineupDuration,
  lineupSheet,
  lineupSource,
  lineupTimes,
  readCastRoles,
  rolePreviewPaths,
  type CastRoleFiles,
} from '@reelforge/cli/service';
import { err, ok, type Result } from '@reelforge/claude-bridge';
import { resolveStyle, type VibeStyle } from '@reelforge/engine';
import { encodePng } from '@reelforge/engine/raster';
import { checkProjectCast, roleSpecChecks, type ProjectCast } from '@reelforge/kit';
import { validateCriticReply } from '@reelforge/prompts';
import { writeAtomic } from '@reelforge/project';
import { CAST_ACCESSORIES_DIR, castRoleFile } from '@reelforge/shared';
import { writeProjectText } from '../files.js';
import { inProject } from '../paths.js';
import type { SceneJob } from '../scenes/job.js';
import { renderShot } from '../scenes/render.js';
import { render } from '../stages/repair.js';
import { stageError, type StageError } from '../types.js';

/** What a role QA round needs from the scene job. */
export type RoleJobContext = Pick<SceneJob, 'ctx' | 'frames' | 'settings' | 'styleId'>;

export interface RoleQaResult {
  /** The role file parses (the scenes can use it, with ⚠ when findings are left). */
  readonly usable: boolean;
  /** Problems to fix (empty = the role passed). */
  readonly findings: readonly string[];
  /** Project accessory ids the role uses. */
  readonly accessories: readonly string[];
  /** Project-relative lineup sheet, when the role rendered. */
  readonly sheet: string | undefined;
  readonly notes: readonly string[];
}

const describe = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

function unusable(findings: string[]): RoleQaResult {
  return { usable: false, findings, accessories: [], sheet: undefined, notes: [] };
}

async function castFiles(projectDir: string): Promise<Result<CastRoleFiles, StageError>> {
  try {
    return ok(await readCastRoles(projectDir));
  } catch (error) {
    return err(stageError('io', `cannot read characters/: ${describe(error)}`));
  }
}

/** The project's style for the vibe guard; undefined when it cannot be resolved. */
function vibeStyle(job: RoleJobContext): VibeStyle | undefined {
  const { project } = job.ctx.snapshot;
  const palette = project.status === 'ok' ? project.value.palette : undefined;
  try {
    return resolveStyle({ style: job.styleId, ...(palette ? { palette } : {}) });
  } catch (error) {
    if (error instanceof Error) return undefined;
    throw error;
  }
}

async function critique(
  job: RoleJobContext,
  id: string,
  description: string,
  sheet: string,
): Promise<Result<{ findings: string[]; notes: string[] }, StageError>> {
  const prompt = render('critic', {
    imagePaths: sheet,
    intent: `ONE character shown alone on a plain stage, 4 angles and 2 poses: the project role "${id}" (${description}). ok = it clearly reads as this profession AND looks like a sibling of the character pack (same chibi proportions with a big head, chunky voxel boxes, two-dot eyes, flat palette colours, at most 4 outfit colours); off-intent = it does not read as the profession, or it looks off-style next to the pack; blank/clipped as usual`,
    styleId: job.styleId,
  });
  if (!prompt.ok) return prompt;
  const turn = await job.ctx.claude({
    prompt: 'critic',
    text: prompt.value,
    purpose: 'qa',
    newSession: true,
    label: `critic role ${id}`,
    commit: false,
    detached: true,
  });
  if (!turn.ok) {
    if (turn.error.kind !== 'claude') return turn;
    return ok({ findings: [], notes: [`the role critic failed: ${turn.error.message}`] });
  }
  const reply = validateCriticReply(turn.value.reply, { expectedPaths: [sheet] });
  if (reply.value === undefined) {
    return ok({ findings: [], notes: ["the role critic's reply was not valid JSON"] });
  }
  const findings = reply.value.frames
    .filter((frame) => frame.verdict !== 'ok')
    .map((frame) => `the critic says "${frame.verdict}": ${frame.note}`);
  return ok({ findings, notes: [] });
}

/** Problems of the role file and of the accessory files (they may be why the role fails). */
function fileFindings(id: string, files: CastRoleFiles, cast: ReturnType<typeof checkProjectCast>) {
  const file = castRoleFile(id);
  if (!files.roles.some((entry) => entry.id === id)) return [`${file} was not written`];
  const own = cast.problems.find((problem) => problem.file === file);
  if (own === undefined) return [];
  const accessories = cast.problems
    .filter((problem) => problem.file.startsWith(`${CAST_ACCESSORIES_DIR}/`))
    .flatMap((problem) => problem.errors.map((error) => `${problem.file}: ${error}`));
  return [...own.errors.map((error) => `${file}: ${error}`), ...accessories];
}

function usedAccessories(id: string, cast: ProjectCast): string[] {
  const spec = cast.roles.get(id)?.spec;
  if (spec === undefined) return [];
  const ids = [...spec.accessories.map((ref) => ref.id), ...(spec.held ? [spec.held.id] : [])];
  return ids.filter((name) => cast.accessories.has(name));
}

async function lineup(
  job: RoleJobContext,
  id: string,
  label: string,
): Promise<Result<{ findings: string[]; sheet: string | undefined }, StageError>> {
  const { ctx } = job;
  const paths = rolePreviewPaths(id);
  const scene = await writeProjectText(ctx.projectDir, paths.scene, lineupSource(id));
  if (!scene.ok) return scene;
  const rendered = await renderShot(
    job.frames,
    {
      projectDir: ctx.projectDir,
      shotId: LINEUP_SHOT_ID,
      times: lineupTimes(),
      cards: false,
      standalone: { scene: paths.scene, duration: lineupDuration() },
    },
    ctx.signal,
  );
  if (!rendered.ok) return rendered;
  const result = rendered.value;
  if (!result.ok)
    return ok({ findings: [`the role does not render: ${result.error}`], sheet: undefined });
  const checks = lineupChecks({ frames: result.frames, cues: result.cues, style: vibeStyle(job) });
  const sheet = `${paths.dir}/qa-${label}.png`;
  try {
    await writeAtomic(
      inProject(ctx.projectDir, sheet),
      encodePng(lineupSheet(id, result.frames, result)),
    );
  } catch (error) {
    return err(stageError('io', `cannot write ${sheet}: ${describe(error)}`));
  }
  const findings = checks
    .filter((check) => !check.ok)
    .map((check) => `${check.id}: ${check.message}`);
  return ok({ findings, sheet });
}

/** One QA round of `characters/roles/<id>.json` as it is on disk; `label` names the sheet. */
export async function roleQaRound(
  job: RoleJobContext,
  id: string,
  description: string,
  label: string,
): Promise<Result<RoleQaResult, StageError>> {
  const files = await castFiles(job.ctx.projectDir);
  if (!files.ok) return files;
  const checked = checkProjectCast(files.value);
  const broken = fileFindings(id, files.value, checked);
  if (broken.length > 0) return ok(unusable(broken));
  const { cast } = checked;
  const role = cast.roles.get(id);
  if (role === undefined) return ok(unusable([`${castRoleFile(id)} did not load`]));
  const specFindings = roleSpecChecks(role.spec, cast)
    .filter((check) => !check.ok)
    .map((check) => `${check.id}: ${check.message}`);
  const drawn = await lineup(job, id, label);
  if (!drawn.ok) return drawn;
  const { sheet } = drawn.value;
  const findings = [...specFindings, ...drawn.value.findings];
  const base = { usable: true, accessories: usedAccessories(id, cast), sheet };
  if (findings.length > 0 || sheet === undefined || !job.settings.critic || !job.ctx.hasClaude) {
    return ok({ ...base, findings, notes: [] });
  }
  const judged = await critique(job, id, description, sheet);
  if (!judged.ok) return judged;
  return ok({ ...base, findings: judged.value.findings, notes: judged.value.notes });
}
