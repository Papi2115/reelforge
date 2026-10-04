/**
 * `reelforge cast preview <id>`: a project role (or a cast member) alone on a neutral stage, four
 * angles and two poses, through the same renderer as the scenes, as ONE labelled sheet (Read it)
 * plus the checks by code: the spec (outfit colours, palette, face, accessories on valid slots)
 * and the render (height within the pack's range, views not blank, vibe guard, determinism).
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { resolveStyle } from '@reelforge/engine';
import { CAST, checkProjectCast, roleSpecChecks, type ProjectCast } from '@reelforge/kit';
import { castRoleId, castRoleFile } from '@reelforge/shared';
import { lineupChecks, parseRoleMetrics, type RoleCheck } from '../cast/checks.js';
import {
  LINEUP_SHOT_ID,
  lineupDuration,
  lineupSheet,
  lineupSource,
  lineupTimes,
  rolePreviewPaths,
} from '../cast/lineup.js';
import { result, type CommandResult } from '../command.js';
import { ProjectError, UsageError } from '../errors.js';
import { verdictLine } from '../format.js';
import { readCastRoles, type CastRoleFiles } from '../project/cast-roles.js';
import { readProjectFiles } from '../project/files.js';
import { projectPath } from '../project/paths.js';
import { renderSetup, type ShotPlan } from '../project/shots.js';
import { writePng } from '../render/output.js';
import { renderShots } from '../render/run.js';

export function checkLine(check: RoleCheck): string {
  return `  ${check.ok ? 'ok  ' : 'FAIL'}  ${check.id.padEnd(14)} ${check.message}`;
}

/** The project's cast as the engine would load it (invalid files are reported, not loaded). */
export function projectCastOf(files: CastRoleFiles): ReturnType<typeof checkProjectCast> {
  return checkProjectCast({ roles: files.roles, accessories: files.accessories });
}

async function writeScene(root: string, relative: string, source: string): Promise<void> {
  const file = projectPath(root, relative);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, source);
}

function specChecksOf(id: string, cast: ProjectCast): RoleCheck[] {
  const role = cast.roles.get(id);
  return role === undefined ? [] : roleSpecChecks(role.spec, cast);
}

export async function castPreview(root: string, input: string): Promise<CommandResult> {
  const id = castRoleId(input.replace(/\.json$/, '').replace(/^characters\/roles\//, ''));
  if (id === undefined) throw new UsageError(`"${input}" is not a role id`);
  const castFiles = await readCastRoles(root);
  const { cast, problems } = projectCastOf(castFiles);
  const own = problems.find((problem) => problem.file === castRoleFile(id));
  if (own !== undefined) {
    const lines = [
      `role ${id} · ${own.file} is invalid:`,
      ...own.errors.map((error) => `  ${error}`),
      verdictLine(
        own.errors.length,
        `fix it (reelforge cast check ${own.file}), then preview again`,
      ),
    ];
    return result(own.errors.length, lines, { id, file: own.file, errors: own.errors, checks: [] });
  }
  if (!cast.roles.has(id) && !(CAST as readonly string[]).includes(id)) {
    throw new ProjectError(
      `${castRoleFile(id)} does not exist`,
      'write the role spec first (see reelforge kit-docs characters), or name a cast member',
    );
  }
  const files = await readProjectFiles(root);
  // A lineup resolves no anchors: it works before "Words timed".
  const setup = renderSetup(files, { withoutWords: true });
  const paths = rolePreviewPaths(id);
  const source = lineupSource(id);
  await writeScene(root, paths.scene, source);
  const plan: ShotPlan = {
    id: LINEUP_SHOT_ID,
    t0: 0,
    t1: lineupDuration(),
    file: paths.scene,
    source,
    standalone: true,
  };
  const [outcome] = await renderShots(setup, [{ plan, times: lineupTimes() }], { cards: false });
  const render = outcome?.render;
  if (!render?.ok) {
    const error = render === undefined ? 'the lineup scene did not pass lint' : render.error;
    const lines = [
      `role ${id}`,
      `failed to load: ${error}`,
      verdictLine(1, 'fix the role file, then run reelforge cast preview again'),
    ];
    return result(1, lines, { id, error, checks: [] });
  }
  const style = resolveStyle({ style: setup.style, palette: setup.palette });
  const checks = [
    ...specChecksOf(id, cast),
    ...lineupChecks({ frames: render.frames, cues: render.cues, style }),
  ];
  const sheet = await writePng(
    projectPath(root, paths.sheet),
    lineupSheet(id, render.frames, render),
  );
  const failed = checks.filter((check) => !check.ok);
  const lines = [
    `role ${id} · 4 angles + 2 poses`,
    `lineup sheet (Read it: does it read as a ${id} and look like a sibling of the pack?): ${sheet}`,
    'checks:',
    ...checks.map(checkLine),
    verdictLine(failed.length, 'fix the role file and run reelforge cast preview again'),
  ];
  return result(failed.length, lines, {
    id,
    sheet,
    checks,
    metrics: parseRoleMetrics(render.cues) ?? null,
  });
}
