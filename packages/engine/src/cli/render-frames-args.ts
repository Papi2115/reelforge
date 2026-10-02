/** Argument parsing for `render:frames` (pure, unit-tested). */
import { parseArgs } from 'node:util';

export const RENDER_FRAMES_USAGE = `usage: pnpm render:frames -- (--scene <file.js> | --manifest <file.json>) --at <t,t,...> [options]
Renders frames through the sandboxed engine harness (headless Chromium, SwiftShader) and prints
the PNG paths, one per line.
  --scene <file>       scene module; rendered as a single shot starting at t=0
  --manifest <file>    render manifest JSON; shots[].scene.source may be omitted (read from
                       shots[].scene.file, relative to the manifest)
  --at <list>          comma-separated times in seconds (global video time)
  --out <dir>          output directory (default: packages/engine/out/frames/<name>)
  --preset <id>        style preset id (sets manifest.style)
  --words <file>       words.json for ctx.anchor (--scene only; default: words.json next to
                       the scene, else ../timing/words.json, else ../words.json)
  --duration <s>       shot length for --scene (default: max(5, last --at + 1))
  --seed <n>           project seed for --scene (default 2115)
  --no-lint            render even when the determinism lint reports errors`;

export interface RenderFramesArgs {
  readonly scene: string | undefined;
  readonly manifest: string | undefined;
  readonly times: readonly number[];
  readonly out: string | undefined;
  readonly preset: string | undefined;
  readonly words: string | undefined;
  readonly duration: number | undefined;
  readonly seed: number | undefined;
  readonly lint: boolean;
  readonly help: boolean;
}

export class UsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UsageError';
  }
}

export function parseTimes(text: string): number[] {
  const times = text
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part !== '')
    .map((part) => {
      const value = Number(part);
      if (!Number.isFinite(value) || value < 0) {
        throw new UsageError(`--at: "${part}" is not a time in seconds (>= 0)`);
      }
      return value;
    });
  if (times.length === 0) throw new UsageError('--at needs at least one time, e.g. --at 0,2.5,5');
  return times;
}

function optionalNumber(
  name: string,
  text: string | undefined,
  valid: (value: number) => boolean,
): number | undefined {
  if (text === undefined) return undefined;
  const value = Number(text);
  if (!valid(value)) throw new UsageError(`--${name}: "${text}" is not valid`);
  return value;
}

const OPTIONS = {
  scene: { type: 'string' },
  manifest: { type: 'string' },
  at: { type: 'string' },
  out: { type: 'string' },
  preset: { type: 'string' },
  words: { type: 'string' },
  duration: { type: 'string' },
  seed: { type: 'string' },
  'no-lint': { type: 'boolean', default: false },
  help: { type: 'boolean', default: false },
} as const;

function parseRaw(
  argv: readonly string[],
): ReturnType<typeof parseArgs<{ options: typeof OPTIONS }>> {
  try {
    return parseArgs({
      // pnpm forwards the `--` separator of `pnpm render:frames -- --scene ...`.
      args: argv.filter((arg) => arg !== '--'),
      strict: true,
      allowPositionals: false,
      options: OPTIONS,
    });
  } catch (error) {
    throw new UsageError(error instanceof Error ? error.message : String(error));
  }
}

export function parseRenderFramesArgs(argv: readonly string[]): RenderFramesArgs {
  const { values } = parseRaw(argv);
  const help = values.help;
  if (!help) {
    if ((values.scene === undefined) === (values.manifest === undefined)) {
      throw new UsageError('pass exactly one of --scene <file> or --manifest <file>');
    }
    if (values.at === undefined) throw new UsageError('--at is required, e.g. --at 0,2.5,5');
    if (
      values.manifest !== undefined &&
      (values.words ?? values.duration ?? values.seed) !== undefined
    ) {
      throw new UsageError('--words, --duration and --seed only apply to --scene');
    }
  }
  return {
    scene: values.scene,
    manifest: values.manifest,
    times: values.at === undefined ? [] : parseTimes(values.at),
    out: values.out,
    preset: values.preset,
    words: values.words,
    duration: optionalNumber(
      'duration',
      values.duration,
      (value) => Number.isFinite(value) && value > 0,
    ),
    seed: optionalNumber(
      'seed',
      values.seed,
      (value) => Number.isInteger(value) && value >= 0 && value <= 0xffffffff,
    ),
    lint: !values['no-lint'],
    help,
  };
}

/** `s00_hello` + 2.5 -> `s00_hello_t2.500.png` (sortable, filesystem-safe on Windows). */
export function frameFileName(name: string, t: number): string {
  return `${name}_t${t.toFixed(3)}.png`;
}
