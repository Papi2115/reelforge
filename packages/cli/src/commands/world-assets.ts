/**
 * `reelforge world-assets [check | sheet]` (PLAN.md#13.15 phase 2): the film's own world assets
 * (`assets/<world>/*.json`). `check` lists the files and ids per kind with every problem (a file
 * left out of `ctx.worldAssets`, an id a scene uses that nobody defines, a cast.json entry that
 * points at nothing); `sheet` renders each asset alone through the world's own scene API into
 * contact sheets (1x + thumbnail) to Read.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { isWorldAssetWorld, worldAssetsDir } from '@reelforge/shared';
import { COMMON_OPTIONS, parseCommandArgs } from '../args.js';
import { result, type Command, type CommandContext, type CommandResult } from '../command.js';
import { ProjectError, UsageError } from '../errors.js';
import { countBySeverity, formatProblem, plural, verdictLine } from '../format.js';
import { readProjectFiles, type ProjectFiles } from '../project/files.js';
import { projectPath } from '../project/paths.js';
import { renderSetup, requireProject, type ShotPlan } from '../project/shots.js';
import { worldAssetProblems } from '../project/world-asset-checks.js';
import { worldAssetSet, type WorldAssetFiles } from '../project/world-assets.js';
import { writePng } from '../render/output.js';
import { renderShots } from '../render/run.js';
import { SHEET_SHOT_ID, worldAssetSheetPages } from '../world-assets/sheet-scenes.js';
import { countSheetRound, sheetRoundLine } from '../world-assets/rounds.js';
import { composeWorldAssetSheet, worldAssetSheetPaths } from '../world-assets/sheet.js';

export const WORLD_ASSETS_USAGE = `usage: reelforge world-assets [check | sheet] [--json]
The film's own world assets: assets/<world>/*.json of a world project (sketchbook, comic,
game-b2, game-b1), which every scene gets as ctx.worldAssets (format and the one line that loads
them: reelforge kit-docs world-assets).
  check (default)  files and ids per kind, every problem: a file left out (invalid JSON, the
                   world's format, a duplicate id, too many), an id a scene uses that nobody
                   defines, an assets/cast.json entry that points at nothing
  sheet            draws every asset alone through the world's own scene API into contact
                   sheets (.reelforge/frames/world-assets/sheet-<n>.png, 1x + thumbnail): Read
                   them - is each one recognisable as what it is at thumbnail size, in the
                   world's style, distinct from its siblings? Counts its rounds per design
                   session and warns after 2 (the world-assets turn allows 2)
Exit code: 0 ok, 1 problems found, 2 usage error.`;

function worldFiles(files: ProjectFiles): WorldAssetFiles {
  const project = requireProject(files);
  if (files.worldAssets === undefined || !isWorldAssetWorld(project.style)) {
    throw new ProjectError(
      `the project's style "${project.style}" is not a world: it has no world assets`,
      'world assets belong to sketchbook, comic, game-b2 and game-b1 projects',
    );
  }
  return files.worldAssets;
}

async function check(context: CommandContext): Promise<CommandResult> {
  const files = await readProjectFiles(context.root);
  const assets = worldFiles(files);
  const set = worldAssetSet(assets);
  const problems = await worldAssetProblems(files);
  const { errors, warnings } = countBySeverity(problems);
  const kinds = Object.entries(set.ids.byKind).filter(([, ids]) => ids.length > 0);
  const lines = [
    `${worldAssetsDir(set.world)}: ${plural(assets.files.length, 'file')}, ${plural(set.files.length, 'loaded')}`,
    ...(kinds.length === 0
      ? ['  (no assets yet)']
      : kinds.map(([kind, ids]) => `  ${kind.padEnd(11)} ${ids.join(', ')}`)),
  ];
  if (problems.length > 0) lines.push('problems:', ...problems.map(formatProblem));
  lines.push(
    `${plural(errors, 'error')}, ${plural(warnings, 'warning')}`,
    verdictLine(errors, 'fix the files or scenes and run reelforge world-assets check again'),
  );
  return result(errors, lines, {
    world: set.world,
    files: set.files,
    ids: set.ids.byKind,
    problems,
    errors,
    warnings,
  });
}

async function writeScene(root: string, relative: string, source: string): Promise<void> {
  const file = projectPath(root, relative);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, source);
}

async function sheet(context: CommandContext): Promise<CommandResult> {
  const files = await readProjectFiles(context.root);
  const set = worldAssetSet(worldFiles(files));
  const round = await countSheetRound(context.root, new Date());
  const pages = worldAssetSheetPages(set);
  if (pages.length === 0) {
    const lines = [
      'no world assets to draw',
      sheetRoundLine(round),
      verdictLine(0, 'write assets/<world>/*.json first'),
    ];
    return result(0, lines, { sheets: [], round });
  }
  const setup = renderSetup(files, { withoutWords: true });
  const plans: ShotPlan[] = [];
  for (const page of pages) {
    const paths = worldAssetSheetPaths(page.page);
    await writeScene(context.root, paths.scene, page.source);
    plans.push({
      id: SHEET_SHOT_ID,
      t0: 0,
      t1: page.duration,
      file: paths.scene,
      source: page.source,
      standalone: true,
    });
  }
  const outcomes = await renderShots(
    setup,
    plans.map((plan, index) => ({ plan, times: [pages[index]?.time ?? 0] })),
    { cards: false },
  );
  const sheets: string[] = [];
  const failures: string[] = [];
  for (const [index, page] of pages.entries()) {
    const render = outcomes[index]?.render;
    const frame = render?.ok === true ? render.frames[0]?.image : undefined;
    const failure = render === undefined ? 'lint failed' : render.ok ? undefined : render.error;
    if (failure !== undefined)
      failures.push(`page ${String(page.page)} (${page.kind}): ${failure}`);
    const size = render?.ok === true ? render : { width: 640, height: 360 };
    const target = projectPath(context.root, worldAssetSheetPaths(page.page).sheet);
    sheets.push(await writePng(target, composeWorldAssetSheet(page, frame, size, failure)));
  }
  const lines = [
    `${plural(set.ids.all.length, 'asset')} of ${set.world} on ${plural(pages.length, 'sheet')} (Read each):`,
    ...sheets.map((file) => `  ${file}`),
    ...failures.map((failure) => `failed: ${failure}`),
    sheetRoundLine(round),
    verdictLine(failures.length, 'fix the asset files and run reelforge world-assets sheet again'),
  ];
  return result(failures.length, lines, { world: set.world, sheets, failures, round });
}

export const worldAssetsCommand: Command = {
  name: 'world-assets',
  summary: "check or draw the film's own world assets (assets/<world>/*.json)",
  usage: WORLD_ASSETS_USAGE,
  async run(argv, context) {
    const { positionals } = parseCommandArgs(argv, COMMON_OPTIONS, true);
    const [action = 'check', ...extra] = positionals;
    if (extra.length > 0) throw new UsageError('world-assets takes one action: check or sheet');
    if (action === 'check') return check(context);
    if (action === 'sheet') return sheet(context);
    throw new UsageError(`unknown action "${action}": check or sheet`);
  },
};
