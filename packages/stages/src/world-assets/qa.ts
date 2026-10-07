/**
 * QA of the film's world assets by code (PLAN.md#13.15 phase 2; Claude's self-report is not
 * trusted): the files in the world's format (the engine's own parse: left-out files are
 * findings), `assets/cast.json` valid and pointing at defined ids, every asset drawn alone through
 * the world's scene API into contact sheets (1x + thumbnail, the CLI's sheet scenes rendered by
 * the same engine as preview and export), then the Haiku critic on the sheets: recognisable at
 * thumbnail size, in style and palette, distinct from its siblings.
 */
import {
  composeWorldAssetSheet,
  readWorldAssetFiles,
  WORLD_ASSET_SHEET_SHOT_ID,
  worldAssetFileProblems,
  worldAssetSet,
  worldAssetSheetPages,
  worldAssetSheetPaths,
  type WorldAssetFiles,
  type WorldAssetSheetPage,
} from '@reelforge/cli/service';
import { err, ok, type Result } from '@reelforge/claude-bridge';
import type { WorldAssetSet } from '@reelforge/engine';
import { encodePng } from '@reelforge/engine/raster';
import type { World } from '@reelforge/kit';
import { validateCriticReply } from '@reelforge/prompts';
import { writeAtomic } from '@reelforge/project';
import {
  WORLD_CAST_FILE,
  worldAssetsDir,
  worldCastFileSchema,
  type WorldAssetWorld,
} from '@reelforge/shared';
import { readProjectText, writeProjectText } from '../files.js';
import { inProject } from '../paths.js';
import type { SceneJob } from '../scenes/job.js';
import { renderShot } from '../scenes/render.js';
import { render } from '../stages/repair.js';
import { stageError, type StageError } from '../types.js';
import { criticWorldPromptVars } from '../worlds.js';

/** What a world-assets QA round needs from the scene job. */
export type WorldAssetsJob = Pick<SceneJob, 'ctx' | 'frames' | 'settings' | 'styleId'> & {
  readonly world: World;
  readonly id: WorldAssetWorld;
};

export interface WorldAssetsQa {
  /** Problems to fix (empty = the set passed). */
  readonly findings: readonly string[];
  /** Project-relative contact sheets. */
  readonly sheets: readonly string[];
  readonly notes: readonly string[];
  /** The set as the scenes will see it. */
  readonly set: WorldAssetSet;
}

/** Critic variables that judge a shot, not an asset sheet. */
const SHOT_ONLY = new Set(['worldChecklist', 'worldMoment', 'worldMomentCheck']);

const describe = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/** The project's asset files (a read error is a stage error). */
export async function readAssetFiles(
  projectDir: string,
  id: WorldAssetWorld,
): Promise<Result<WorldAssetFiles, StageError>> {
  try {
    const files = await readWorldAssetFiles(projectDir, id);
    return ok(files ?? { world: id, files: [], ignored: [] });
  } catch (error) {
    return err(stageError('io', `cannot read ${worldAssetsDir(id)}: ${describe(error)}`));
  }
}

/** cast.json findings and the names it gives the ids (for the critic). */
async function castCheck(
  projectDir: string,
  set: WorldAssetSet,
): Promise<Result<{ findings: string[]; names: Map<string, string> }, StageError>> {
  const text = await readProjectText(projectDir, WORLD_CAST_FILE);
  if (!text.ok) return text;
  const names = new Map<string, string>();
  if (text.value === undefined)
    return ok({ findings: [`${WORLD_CAST_FILE} was not written`], names });
  let value: unknown;
  try {
    value = JSON.parse(text.value);
  } catch (error) {
    return ok({ findings: [`${WORLD_CAST_FILE} is not valid JSON: ${describe(error)}`], names });
  }
  const parsed = worldCastFileSchema.safeParse(value);
  if (!parsed.success) {
    const issues = parsed.error.issues.map(
      (issue) => `${issue.path.join('.') || '(file)'}: ${issue.message}`,
    );
    return ok({ findings: [`${WORLD_CAST_FILE} is invalid: ${issues.join('; ')}`], names });
  }
  const known = new Set(set.ids.all);
  for (const entry of parsed.data.entries) names.set(entry.id, entry.name);
  const findings = parsed.data.entries
    .filter((entry) => !known.has(entry.id))
    .map((entry) => `${WORLD_CAST_FILE}: "${entry.id}" is not defined by any asset file`);
  return ok({ findings, names });
}

/** Renders one sheet page and writes its PNG; a string = why it did not render. */
async function sheetPage(
  job: WorldAssetsJob,
  page: WorldAssetSheetPage,
): Promise<Result<{ sheet: string; failure: string | undefined }, StageError>> {
  const { ctx } = job;
  const paths = worldAssetSheetPaths(page.page);
  const scene = await writeProjectText(ctx.projectDir, paths.scene, page.source);
  if (!scene.ok) return scene;
  const rendered = await renderShot(
    job.frames,
    {
      projectDir: ctx.projectDir,
      shotId: WORLD_ASSET_SHEET_SHOT_ID,
      times: [page.time],
      cards: false,
      standalone: { scene: paths.scene, duration: page.duration },
    },
    ctx.signal,
  );
  if (!rendered.ok) return rendered;
  const result = rendered.value;
  const frame = result.ok ? result.frames[0]?.image : undefined;
  const failure = result.ok ? undefined : result.error;
  const size = result.ok ? result : { width: 640, height: 360 };
  try {
    await writeAtomic(
      inProject(ctx.projectDir, paths.sheet),
      encodePng(composeWorldAssetSheet(page, frame, size, failure)),
    );
  } catch (error) {
    return err(stageError('io', `cannot write ${paths.sheet}: ${describe(error)}`));
  }
  return ok({ sheet: paths.sheet, failure });
}

function criticIntent(
  job: WorldAssetsJob,
  pages: readonly WorldAssetSheetPage[],
  names: ReadonlyMap<string, string>,
): string {
  const listed = pages
    .map(
      (page) =>
        `sheet ${String(page.page)} (${page.kind}): ${page.ids.map((id) => (names.has(id) ? `${id} = ${names.get(id) ?? ''}` : id)).join(', ')}`,
    )
    .join('; ');
  return `contact sheets of this film's own ${job.world.label} assets, each thing drawn alone by the world's kit (top: 1x; bottom: the same frame with each thing at most 64 px wide). ${listed}. ok = every thing reads as what its name says at the small size, in the world's style and palette, and siblings are distinct (two people never identical unless intended); off-intent = name the thing that fails and why (unrecognisable, off-palette, a twin of another); blank/clipped as usual`;
}

async function critique(
  job: WorldAssetsJob,
  pages: readonly WorldAssetSheetPage[],
  sheets: readonly string[],
  names: ReadonlyMap<string, string>,
): Promise<Result<{ findings: string[]; notes: string[] }, StageError>> {
  // The world's medium, style and vibe; not the shot checklist (focal point, traces, moments).
  const world = Object.fromEntries(
    Object.entries(criticWorldPromptVars(job.world)).filter(([key]) => !SHOT_ONLY.has(key)),
  );
  const prompt = render('critic', {
    imagePaths: sheets.join(', '),
    intent: criticIntent(job, pages, names),
    styleId: job.styleId,
    ...world,
  });
  if (!prompt.ok) return prompt;
  const turn = await job.ctx.claude({
    prompt: 'critic',
    text: prompt.value,
    purpose: 'qa',
    newSession: true,
    label: 'critic world assets',
    commit: false,
    detached: true,
  });
  if (!turn.ok) {
    if (turn.error.kind !== 'claude') return turn;
    return ok({ findings: [], notes: [`the world-assets critic failed: ${turn.error.message}`] });
  }
  const reply = validateCriticReply(turn.value.reply, { expectedPaths: [...sheets] });
  if (reply.value === undefined) {
    return ok({ findings: [], notes: ["the world-assets critic's reply was not valid JSON"] });
  }
  const findings = reply.value.frames
    .filter((frame) => frame.verdict !== 'ok')
    .map((frame) => `${frame.path}: the critic says "${frame.verdict}": ${frame.note}`);
  return ok({ findings, notes: [] });
}

/** One QA round of `assets/<world>/` as it is on disk. */
export async function worldAssetsQaRound(
  job: WorldAssetsJob,
): Promise<Result<WorldAssetsQa, StageError>> {
  const { ctx } = job;
  const files = await readAssetFiles(ctx.projectDir, job.id);
  if (!files.ok) return files;
  const set = worldAssetSet(files.value);
  const findings = worldAssetFileProblems(files.value).map((problem) =>
    problem.message.startsWith(problem.file)
      ? problem.message
      : `${problem.file}: ${problem.message}`,
  );
  if (files.value.files.length === 0)
    findings.push(`no asset file was written in ${worldAssetsDir(job.id)}/`);
  const cast = await castCheck(ctx.projectDir, set);
  if (!cast.ok) return cast;
  findings.push(...cast.value.findings);
  const pages = worldAssetSheetPages(set);
  const sheets: string[] = [];
  for (const page of pages) {
    const drawn = await sheetPage(job, page);
    if (!drawn.ok) return drawn;
    sheets.push(drawn.value.sheet);
    if (drawn.value.failure !== undefined) {
      findings.push(
        `sheet ${String(page.page)} (${page.kind}: ${page.ids.join(', ')}) does not render: ${drawn.value.failure}`,
      );
    }
  }
  if (findings.length > 0 || sheets.length === 0 || !job.settings.critic || !ctx.hasClaude) {
    return ok({ findings, sheets, notes: [], set });
  }
  const judged = await critique(job, pages, sheets, cast.value.names);
  if (!judged.ok) return judged;
  return ok({ findings: judged.value.findings, sheets, notes: judged.value.notes, set });
}
