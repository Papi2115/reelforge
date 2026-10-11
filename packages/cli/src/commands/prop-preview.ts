/**
 * `reelforge prop-preview <name>`: a project prop (`kit-ext/props/<name>.js`, PLAN.md#7.4) alone
 * on a neutral stage from several angles, through the same renderer as scenes, as one labelled
 * sheet (Read it) plus the code checks: lint, non-blank views, sane size, no floating parts and
 * determinism.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { formatDiagnostics, hasErrors, lintPropModule } from '@reelforge/engine';
import { normalizePropName, propExtensionFile } from '@reelforge/shared';
import { COMMON_OPTIONS, parseCommandArgs } from '../args.js';
import { result, type Command } from '../command.js';
import { ProjectError, UsageError } from '../errors.js';
import { plural, verdictLine } from '../format.js';
import { readProjectFiles } from '../project/files.js';
import { projectPath } from '../project/paths.js';
import { renderSetup, type ShotPlan } from '../project/shots.js';
import { writePng } from '../render/output.js';
import { renderShots } from '../render/run.js';
import { turntableChecks, parsePropMetrics, type PropCheck } from '../props/checks.js';
import {
  DEFAULT_ANGLES,
  propPreviewPaths,
  TURNTABLE_SHOT_ID,
  turntableDuration,
  turntableSheet,
  turntableSource,
  turntableTimes,
} from '../props/turntable.js';

export const PROP_PREVIEW_USAGE = `usage: reelforge prop-preview <name> [--angles 0,90,180,270] [--json]
Renders the project prop kit-ext/props/<name>.js alone on a neutral stage, one view per angle
(degrees, 0 = front), through the same renderer as the scenes, into ONE labelled image (Read it),
and checks it by code: prop lint, views not blank, size (largest side 0.3-4 units; the hero is
2 units tall), no floating parts (kit.voxel.inspect), the same view twice gives the same pixels.
Writing a prop: reelforge kit-docs prop-module.
Exit code: 0 ok, 1 problems (lint errors, prop failed to load, a check failed), 2 usage error.`;

const OPTIONS = { ...COMMON_OPTIONS, angles: { type: 'string' } } as const;
const MAX_ANGLES = 8;

export function parseAngles(text: string | undefined): number[] {
  if (text === undefined) return [...DEFAULT_ANGLES];
  const angles = text
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part !== '')
    .map((part) => {
      const value = Number(part);
      if (!Number.isFinite(value)) throw new UsageError(`--angles: "${part}" is not a number`);
      return value;
    });
  if (angles.length === 0 || angles.length > MAX_ANGLES) {
    throw new UsageError(
      `--angles takes 1-${String(MAX_ANGLES)} angles in degrees, e.g. 0,90,180,270`,
    );
  }
  return angles;
}

function checkLine(check: PropCheck): string {
  return `  ${check.ok ? 'ok  ' : 'FAIL'}  ${check.id.padEnd(13)} ${check.message}`;
}

async function writeScene(root: string, relative: string, source: string): Promise<void> {
  const file = projectPath(root, relative);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, source);
}

export const propPreviewCommand: Command = {
  name: 'prop-preview',
  summary: 'turntable sheet + checks of a project prop (kit-ext/props/<name>.js)',
  usage: PROP_PREVIEW_USAGE,
  async run(argv, context) {
    const { values, positionals } = parseCommandArgs(argv, OPTIONS, true);
    const [input] = positionals;
    if (input === undefined || positionals.length > 1) {
      throw new UsageError('pass one prop name, e.g. reelforge prop-preview fridge');
    }
    const name = normalizePropName(input.replace(/^kit\.props\./, '').replace(/\.js$/, ''));
    if (name === undefined) throw new UsageError(`"${input}" is not a prop name`);
    const angles = parseAngles(values.angles);
    const files = await readProjectFiles(context.root);
    // A turntable resolves no anchors: it works before "Words timed" (and with a broken words file).
    const setup = renderSetup(files, { withoutWords: true });
    const file = propExtensionFile(name);
    const extension = setup.kitExtensions.find(
      (candidate) => candidate.name === name && (candidate.kind ?? 'props') === 'props',
    );
    if (extension === undefined) {
      throw new ProjectError(
        `${file} does not exist`,
        'write the prop module first (see reelforge kit-docs prop-module)',
      );
    }
    const lint = lintPropModule(extension.source, { filename: file });
    if (hasErrors(lint)) {
      const lines = [
        formatDiagnostics(file, lint),
        verdictLine(1, 'fix the lint errors, then run reelforge prop-preview again'),
      ];
      return result(1, lines, { name, file, lint, checks: [] });
    }
    const paths = propPreviewPaths(name);
    const source = turntableSource(name, angles);
    await writeScene(context.root, paths.scene, source);
    const plan: ShotPlan = {
      id: TURNTABLE_SHOT_ID,
      t0: 0,
      t1: turntableDuration(angles),
      file: paths.scene,
      source,
      standalone: true,
    };
    const [outcome] = await renderShots(setup, [{ plan, times: turntableTimes(angles) }], {
      cards: false,
    });
    const render = outcome?.render;
    if (!render?.ok) {
      const error = render === undefined ? 'the turntable scene did not pass lint' : render.error;
      const lines = [
        `prop ${name} · ${file}`,
        `failed to load: ${error}`,
        verdictLine(1, 'fix the prop module, then run reelforge prop-preview again'),
      ];
      return result(1, lines, { name, file, lint, error, checks: [] });
    }
    const checks = turntableChecks({ angles, frames: render.frames, cues: render.cues });
    const sheet = await writePng(
      projectPath(context.root, paths.sheet),
      turntableSheet(name, angles, render.frames, render),
    );
    const failed = checks.filter((check) => !check.ok);
    const warnings = lint.filter((diagnostic) => diagnostic.severity === 'warning');
    const lines = [
      `prop ${name} · ${file} · ${plural(angles.length, 'view')} at ${angles.join(', ')} deg`,
      `turntable sheet (Read it: is it clearly a ${name}?): ${sheet}`,
      'checks:',
      ...checks.map(checkLine),
      ...(warnings.length > 0 ? [formatDiagnostics(file, warnings)] : []),
      verdictLine(failed.length, 'fix the prop module and run reelforge prop-preview again'),
    ];
    return result(failed.length, lines, {
      name,
      file,
      sheet,
      angles,
      checks,
      metrics: parsePropMetrics(render.cues) ?? null,
      lint,
    });
  },
};
