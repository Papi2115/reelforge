/**
 * `reelforge people-preview <id>` / `reelforge places-preview <id>` (PLAN.md#14.8): a Grim Ink
 * project person (`kit-ext/people/<id>.js`) or place (`kit-ext/places/<id>.js`) as one labelled
 * contact sheet (Read it), rendered on the world's ink stage through the same engine as the
 * scenes, plus the code checks: module lint, pages not blank, the same page twice identical.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { formatDiagnostics, hasErrors, lintInkModule } from '@reelforge/engine';
import { C_CAM_ID } from '@reelforge/kit';
import { kitExtensionFile, normalizePropName } from '@reelforge/shared';
import { COMMON_OPTIONS, parseCommandArgs } from '../args.js';
import { result, type Command, type CommandResult } from '../command.js';
import { ProjectError, UsageError } from '../errors.js';
import { verdictLine } from '../format.js';
import {
  INK_SHEET_SHOT_ID,
  inkPreviewNoun,
  inkPreviewPaths,
  inkSheet,
  inkSheetChecks,
  inkSheetDuration,
  inkSheetSource,
  inkSheetTimes,
  type InkCheck,
  type InkPreviewKind,
} from '../ink/preview.js';
import { readProjectFiles } from '../project/files.js';
import { extensionsOfKind } from '../project/kit-ext.js';
import { projectPath } from '../project/paths.js';
import { renderSetup, type RenderSetup, type ShotPlan } from '../project/shots.js';
import { writePng } from '../render/output.js';
import { renderShots } from '../render/run.js';

function usage(kind: InkPreviewKind): string {
  const noun = inkPreviewNoun(kind);
  const sheet =
    kind === 'people'
      ? 'the six views (front, 3/4, profile, back, profile left, 3/4 left) x stand / akimbo / walk, then the 14 faces'
      : 'the place at three framings (wide, x2 on its light, x3.2 on its first anchor)';
  return `usage: reelforge ${kind}-preview <id> [--json]
Renders the Grim Ink ${noun} kit-ext/${kind}/<id>.js on the world's ink stage, through the same
engine as the scenes, into ONE labelled image (Read it): ${sheet}.
Checks by code: ${noun} module lint (determinism, contract, ink grammar), pages not blank, the
same page rendered twice gives the same pixels. Writing one: reelforge kit-docs ${kind}.
Exit code: 0 ok, 1 problems (lint errors, the module failed to load, a check failed), 2 usage error.`;
}

function checkLine(check: InkCheck): string {
  return `  ${check.ok ? 'ok  ' : 'FAIL'}  ${check.id.padEnd(13)} ${check.message}`;
}

async function writeScene(root: string, relative: string, source: string): Promise<void> {
  const file = projectPath(root, relative);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, source);
}

function parseId(kind: InkPreviewKind, positionals: readonly string[]): string {
  const [input] = positionals;
  if (input === undefined || positionals.length > 1) {
    throw new UsageError(`pass one id, e.g. reelforge ${kind}-preview nightBaker`);
  }
  const bare = input.replace(new RegExp(`^kit\\.${kind}\\.`), '').replace(/\.js$/, '');
  const id = normalizePropName(bare);
  if (id === undefined) throw new UsageError(`"${input}" is not a ${inkPreviewNoun(kind)} id`);
  return id;
}

/** The project's settings rendered in the Grim Ink style, landscape, without captions. */
function inkSetup(setup: RenderSetup): RenderSetup {
  return {
    ...setup,
    style: C_CAM_ID,
    format: undefined,
    captions: undefined,
    worldAssets: undefined,
  };
}

async function runPreview(
  kind: InkPreviewKind,
  argv: readonly string[],
  root: string,
): Promise<CommandResult> {
  const { positionals } = parseCommandArgs(argv, COMMON_OPTIONS, true);
  const id = parseId(kind, positionals);
  const noun = inkPreviewNoun(kind);
  const file = kitExtensionFile(kind, id);
  const files = await readProjectFiles(root);
  // A sheet resolves no anchors: it works before "Words timed" (and with a broken words file).
  const setup = inkSetup(renderSetup(files, { withoutWords: true }));
  const module = extensionsOfKind(setup.kitExtensions, kind).find((entry) => entry.name === id);
  if (module === undefined) {
    throw new ProjectError(
      `${file} does not exist`,
      `write the ${noun} module first (see reelforge kit-docs ${kind})`,
    );
  }
  const lint = lintInkModule(module.source, { filename: file }, kind);
  if (hasErrors(lint)) {
    const lines = [
      formatDiagnostics(file, lint),
      verdictLine(1, `fix the lint errors, then run reelforge ${kind}-preview again`),
    ];
    return result(1, lines, { id, file, lint, checks: [] });
  }
  const paths = inkPreviewPaths(kind, id);
  const source = inkSheetSource(kind, id);
  await writeScene(root, paths.scene, source);
  const plan: ShotPlan = {
    id: INK_SHEET_SHOT_ID,
    t0: 0,
    t1: inkSheetDuration(kind),
    file: paths.scene,
    source,
    standalone: true,
  };
  const [outcome] = await renderShots(setup, [{ plan, times: inkSheetTimes(kind) }], {
    cards: false,
  });
  const render = outcome?.render;
  if (!render?.ok) {
    const error = render === undefined ? 'the sheet scene did not pass lint' : render.error;
    const lines = [
      `${noun} ${id} · ${file}`,
      `failed to load: ${error}`,
      verdictLine(1, `fix the ${noun} module, then run reelforge ${kind}-preview again`),
    ];
    return result(1, lines, { id, file, lint, error, checks: [] });
  }
  const checks = inkSheetChecks(kind, render.frames);
  const sheet = await writePng(
    projectPath(root, paths.sheet),
    inkSheet(kind, id, render.frames, render),
  );
  const failed = checks.filter((check) => !check.ok);
  const warnings = lint.filter((diagnostic) => diagnostic.severity === 'warning');
  const lines = [
    `${noun} ${id} · ${file}`,
    `contact sheet (Read it: does it read as one specific, grimy ${noun}?): ${sheet}`,
    'checks:',
    ...checks.map(checkLine),
    ...(warnings.length > 0 ? [formatDiagnostics(file, warnings)] : []),
    verdictLine(failed.length, `fix the ${noun} module and run reelforge ${kind}-preview again`),
  ];
  return result(failed.length, lines, { id, file, sheet, checks, lint });
}

export const peoplePreviewCommand: Command = {
  name: 'people-preview',
  summary: 'contact sheet + checks of a Grim Ink person (kit-ext/people/<id>.js)',
  usage: usage('people'),
  run: (argv, context) => runPreview('people', argv, context.root),
};

export const placesPreviewCommand: Command = {
  name: 'places-preview',
  summary: 'contact sheet + checks of a Grim Ink place (kit-ext/places/<id>.js)',
  usage: usage('places'),
  run: (argv, context) => runPreview('places', argv, context.root),
};
