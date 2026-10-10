/**
 * `pnpm render:frames`: renders PNG frames of a scene or manifest through the same sandboxed
 * engine harness the app and the render tests use (headless Chromium + SwiftShader).
 */
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  renderManifestSchema,
  wordsFileSchema,
  type RenderManifest,
  type WordsFile,
} from '@reelforge/shared';
import { z } from 'zod';
import { formatDiagnostics, hasErrors } from '../lint/diagnostics.js';
import { lintManifestScenes } from '../lint/manifest.js';
import { renderStyleProblem, STYLE_REGISTRY } from '../presets/index.js';
import { launchHarnessBrowser } from './harness-session.js';
import type { CliIo } from './io.js';
import { DEFAULT_FRAMES_DIR } from './paths.js';
import { encodePng } from './png.js';
import { sceneInkModules } from './render-frames-modules.js';
import {
  frameFileName,
  parseRenderFramesArgs,
  RENDER_FRAMES_USAGE,
  UsageError,
  type RenderFramesArgs,
} from './render-frames-args.js';

const DEFAULT_SEED = 2115;
const DEFAULT_FPS = 30;
const MIN_SCENE_DURATION = 5;

/** A manifest file may omit scene sources; they are read from `scene.file`. */
const manifestFileSchema = z.looseObject({
  shots: z.array(
    z.looseObject({
      scene: z.looseObject({ file: z.string().min(1), source: z.string().optional() }),
    }),
  ),
});

interface Inputs {
  readonly manifest: RenderManifest;
  /** Base name of the output frames. */
  readonly name: string;
}

function issuesText(error: z.ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('; ');
}

async function readJson(file: string): Promise<unknown> {
  const text = await readFile(file, 'utf8');
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new UsageError(
      `${file} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function validateManifest(input: unknown, origin: string): RenderManifest {
  const parsed = renderManifestSchema.safeParse(input);
  if (!parsed.success)
    throw new UsageError(`${origin}: invalid render manifest: ${issuesText(parsed.error)}`);
  return parsed.data;
}

/** Path for messages: relative to the working directory when inside it, with forward slashes. */
function displayPath(file: string, cwd: string): string {
  const relative = path.relative(cwd, file);
  const inside = relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative);
  return (inside ? relative : file).split(path.sep).join('/');
}

async function findWords(
  args: RenderFramesArgs,
  sceneFile: string,
  cwd: string,
): Promise<WordsFile | undefined> {
  const sceneDir = path.dirname(sceneFile);
  const candidates =
    args.words !== undefined
      ? [path.resolve(cwd, args.words)]
      : [
          path.join(sceneDir, 'words.json'),
          // Project layout: <project>/scenes/*.js + <project>/timing/words.json.
          path.join(path.dirname(sceneDir), 'timing', 'words.json'),
          path.join(path.dirname(sceneDir), 'words.json'),
        ];
  const file = candidates.find((candidate) => existsSync(candidate));
  if (file === undefined) {
    if (args.words !== undefined) throw new UsageError(`--words: ${args.words} does not exist`);
    return undefined;
  }
  const parsed = wordsFileSchema.safeParse(await readJson(file));
  if (!parsed.success)
    throw new UsageError(`${file}: invalid words file: ${issuesText(parsed.error)}`);
  return parsed.data;
}

async function sceneInputs(args: RenderFramesArgs, scene: string, cwd: string): Promise<Inputs> {
  const file = path.resolve(cwd, scene);
  const source = await readFile(file, 'utf8');
  const words = await findWords(args, file, cwd);
  const kitExtensions = await sceneInkModules(file);
  const lastTime = Math.max(...args.times);
  const manifest = validateManifest(
    {
      version: 1,
      fps: DEFAULT_FPS,
      seed: args.seed ?? DEFAULT_SEED,
      ...(words ? { words } : {}),
      ...(kitExtensions.length > 0 ? { kitExtensions } : {}),
      shots: [
        {
          id: 's00',
          t0: 0,
          t1: args.duration ?? Math.max(MIN_SCENE_DURATION, lastTime + 1),
          scene: { file: displayPath(file, cwd), source },
        },
      ],
    },
    scene,
  );
  return { manifest, name: path.basename(file, path.extname(file)) };
}

async function manifestInputs(manifestPath: string, cwd: string): Promise<Inputs> {
  const file = path.resolve(cwd, manifestPath);
  const raw = await readJson(file);
  const shape = manifestFileSchema.safeParse(raw);
  if (!shape.success) throw new UsageError(`${manifestPath}: ${issuesText(shape.error)}`);
  const shots = await Promise.all(
    shape.data.shots.map(async (shot) => {
      if (shot.scene.source !== undefined) return shot;
      const sceneFile = path.resolve(path.dirname(file), shot.scene.file);
      return { ...shot, scene: { ...shot.scene, source: await readFile(sceneFile, 'utf8') } };
    }),
  );
  const manifest = validateManifest({ ...shape.data, shots }, manifestPath);
  return { manifest, name: path.basename(file, path.extname(file)) };
}

/**
 * Applies `--preset`; experimental world styles (from `--preset` or the manifest) need
 * `--experimental`. An unknown manifest style is left to the engine's own error.
 */
function withPreset(
  manifest: RenderManifest,
  preset: string | undefined,
  experimental = false,
): RenderManifest {
  if (preset === undefined) {
    const style = manifest.style;
    const problem =
      style !== undefined && STYLE_REGISTRY.isExperimental(style)
        ? renderStyleProblem(STYLE_REGISTRY, style, experimental)
        : undefined;
    if (problem !== undefined) throw new UsageError(`manifest: ${problem}`);
    return manifest;
  }
  const problem = renderStyleProblem(STYLE_REGISTRY, preset, experimental);
  if (problem !== undefined) throw new UsageError(`--preset: ${problem}`);
  // The render size comes from the style unless the manifest pins it.
  return { ...manifest, style: preset };
}

/**
 * A `--scene` render runs at the frame rate its world is drawn for (Grim Ink: 24, so
 * `ctx.shot.fps` is what the app gives a project of that world); a manifest keeps its own.
 */
export function withWorldFps(manifest: RenderManifest): RenderManifest {
  const style = manifest.style;
  const fps = style === undefined ? undefined : STYLE_REGISTRY.entry(style)?.world?.fps;
  return fps === undefined ? manifest : { ...manifest, fps };
}

/** Lints every scene; prints diagnostics; true when rendering may proceed. */
function lintGate(manifest: RenderManifest, args: RenderFramesArgs, io: CliIo): boolean {
  let blocked = false;
  for (const result of lintManifestScenes(manifest)) {
    if (result.diagnostics.length === 0) continue;
    io.stderr(`${formatDiagnostics(result.file, result.diagnostics)}\n`);
    if (hasErrors(result.diagnostics)) blocked = true;
  }
  if (blocked && args.lint) {
    io.stderr('render:frames: the determinism lint reported errors (fix them or pass --no-lint)\n');
    return false;
  }
  return true;
}

async function renderFrames(
  inputs: Inputs,
  args: RenderFramesArgs,
  outDir: string,
  io: CliIo,
): Promise<number> {
  const browser = await launchHarnessBrowser();
  try {
    const page = await browser.open();
    const info = await page.load(inputs.manifest);
    io.stderr(
      `render:frames: ${String(info.width)}x${String(info.height)}, ${String(info.duration)} s, renderer ${info.gpu.renderer}\n`,
    );
    await mkdir(outDir, { recursive: true });
    for (const t of args.times) {
      const data = await page.frameAt(t);
      const file = path.join(outDir, frameFileName(inputs.name, t));
      await writeFile(file, encodePng({ width: info.width, height: info.height, data }));
      io.stdout(`${file}\n`);
    }
    for (const error of page.errors) io.stderr(`render:frames: page error: ${error}\n`);
    return page.errors.length > 0 ? 1 : 0;
  } finally {
    await browser.close();
  }
}

/** Entry of `render:frames`; returns the process exit code (0 ok, 1 render/lint failure, 2 usage). */
export async function runRenderFramesCli(
  argv: readonly string[],
  io: CliIo,
  cwd: string,
): Promise<number> {
  let args: RenderFramesArgs;
  let inputs: Inputs;
  try {
    args = parseRenderFramesArgs(argv);
    if (args.help) {
      io.stdout(`${RENDER_FRAMES_USAGE}\n`);
      return 0;
    }
    const base =
      args.scene !== undefined
        ? await sceneInputs(args, args.scene, cwd)
        : await manifestInputs(args.manifest ?? '', cwd);
    const preset = withPreset(base.manifest, args.preset, args.experimental);
    const styled = args.scene === undefined ? preset : withWorldFps(preset);
    // --format portrait renders the style upright (PLAN.md#13.18); absent keeps the manifest's.
    inputs = {
      ...base,
      manifest: args.format === undefined ? styled : { ...styled, format: args.format },
    };
  } catch (error) {
    if (!(error instanceof UsageError) && !(error instanceof Error && 'code' in error)) throw error;
    io.stderr(
      `render:frames: ${error.message}\n${error instanceof UsageError ? `${RENDER_FRAMES_USAGE}\n` : ''}`,
    );
    return 2;
  }
  if (!lintGate(inputs.manifest, args, io)) return 1;
  const outDir =
    args.out === undefined
      ? path.join(DEFAULT_FRAMES_DIR, inputs.name)
      : path.resolve(cwd, args.out);
  return renderFrames(inputs, args, outDir, io);
}
