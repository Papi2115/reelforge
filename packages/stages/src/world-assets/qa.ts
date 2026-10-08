/**
 * QA of the film's world assets by code (PLAN.md#13.15 phase 2; Claude's self-report is not
 * trusted): the files in the world's format (the engine's own parse: left-out files are
 * findings), `assets/cast.json` valid and pointing at defined ids, the contact sheets (1x +
 * thumbnail, the CLI's sheet scenes rendered by the same engine as preview and export), no person
 * the narration does not name (names.ts), then each asset alone at film size and the blind Haiku
 * critic naming each crop (legibility.ts).
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
import { writeAtomic } from '@reelforge/project';
import {
  WORLD_CAST_FILE,
  worldAssetsDir,
  worldCastFileSchema,
  type WorldAssetWorld,
  type WorldCastEntry,
} from '@reelforge/shared';
import { readProjectText, writeProjectText } from '../files.js';
import { FILES, inProject } from '../paths.js';
import type { SceneJob } from '../scenes/job.js';
import { renderShot } from '../scenes/render.js';
import { stageError, type StageError } from '../types.js';
import { legibilityQa } from './legibility.js';
import { assetFacts, inventedPeopleFindings, type AssetFacts } from './names.js';

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

/** cast.json findings and its entries (the names and kinds of the ids). */
async function castCheck(
  projectDir: string,
  set: WorldAssetSet,
): Promise<Result<{ findings: string[]; entries: WorldCastEntry[] }, StageError>> {
  const text = await readProjectText(projectDir, WORLD_CAST_FILE);
  if (!text.ok) return text;
  if (text.value === undefined)
    return ok({ findings: [`${WORLD_CAST_FILE} was not written`], entries: [] });
  let value: unknown;
  try {
    value = JSON.parse(text.value);
  } catch (error) {
    const finding = `${WORLD_CAST_FILE} is not valid JSON: ${describe(error)}`;
    return ok({ findings: [finding], entries: [] });
  }
  const parsed = worldCastFileSchema.safeParse(value);
  if (!parsed.success) {
    const issues = parsed.error.issues.map(
      (issue) => `${issue.path.join('.') || '(file)'}: ${issue.message}`,
    );
    return ok({ findings: [`${WORLD_CAST_FILE} is invalid: ${issues.join('; ')}`], entries: [] });
  }
  const known = new Set(set.ids.all);
  const findings = parsed.data.entries
    .filter((entry) => !known.has(entry.id))
    .map((entry) => `${WORLD_CAST_FILE}: "${entry.id}" is not defined by any asset file`);
  return ok({ findings, entries: parsed.data.entries });
}

/** People the narration does not name (no script yet: nothing to check against). */
async function peopleCheck(
  projectDir: string,
  facts: readonly AssetFacts[],
): Promise<Result<string[], StageError>> {
  const script = await readProjectText(projectDir, FILES.script);
  if (!script.ok) return script;
  return ok(script.value === undefined ? [] : inventedPeopleFindings(script.value, facts));
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
  const facts = assetFacts(files.value, set, cast.value.entries);
  const people = await peopleCheck(ctx.projectDir, facts);
  if (!people.ok) return people;
  if (findings.length > 0 || sheets.length === 0) {
    return ok({ findings: [...findings, ...people.value], sheets, notes: [], set });
  }
  const legible = await legibilityQa(job, set, facts);
  if (!legible.ok) return legible;
  return ok({
    findings: [...legible.value.findings, ...people.value],
    sheets,
    notes: legible.value.notes,
    set,
  });
}
