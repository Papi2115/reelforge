/**
 * Golden frames (PNG) for render tests. Goldens are backend-specific (ADR-002): the harness
 * renders with SwiftShader, so they live in `test/goldens/swiftshader/` and must never be
 * compared with GPU renders. On a mismatch the actual frame, the golden and a red diff image are
 * written to `out/golden-diff/<backend>/`. Set REELFORGE_UPDATE_GOLDENS=1 (or run
 * `pnpm test:render -- --update-goldens`) to rewrite goldens; missing goldens are written
 * locally but fail on CI.
 */
import { existsSync } from 'node:fs';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { countDifferingPixels, diffImage } from './frame-stats.js';
import { goldenTolerance, loadGoldenConfig, type GoldenTolerance } from './golden-config.js';
import { GOLDEN_DIFF_DIR, GOLDEN_ROOT } from './paths.js';
import { decodePng, encodePng, type RgbaImage } from './png.js';

export const GOLDEN_BACKEND = 'swiftshader';
export const GOLDEN_DIR = path.join(GOLDEN_ROOT, GOLDEN_BACKEND);

export interface GoldenResult {
  readonly name: string;
  readonly status: 'match' | 'written';
  readonly differingPixels: number;
  readonly differingShare: number;
  readonly tolerance: GoldenTolerance;
}

export interface GoldenOptions {
  readonly goldenDir?: string;
  readonly diffDir?: string;
  /** Rewrite the golden instead of comparing (default: REELFORGE_UPDATE_GOLDENS=1). */
  readonly update?: boolean;
  /** On CI a missing golden is a failure instead of being written (default: CI is set). */
  readonly ci?: boolean;
}

export class GoldenMismatchError extends Error {
  readonly files: readonly string[];

  constructor(message: string, files: readonly string[]) {
    super(message);
    this.name = 'GoldenMismatchError';
    this.files = files;
  }
}

function percent(share: number): string {
  return `${(share * 100).toFixed(3)}%`;
}

function resolveTolerance(
  name: string,
  tolerance: number | Partial<GoldenTolerance> | undefined,
): GoldenTolerance {
  const configured = goldenTolerance(name, loadGoldenConfig());
  if (typeof tolerance === 'number') return { ...configured, maxDiffShare: tolerance };
  return { ...configured, ...tolerance };
}

async function writeDiffFiles(
  name: string,
  diffDir: string,
  images: { actual: RgbaImage; expected?: RgbaImage; diff?: RgbaImage },
): Promise<string[]> {
  await mkdir(diffDir, { recursive: true });
  const written: string[] = [];
  // Absent images are absent keys (exactOptionalPropertyTypes), so every entry is an image.
  for (const [kind, image] of Object.entries(images)) {
    const file = path.join(diffDir, `${name}.${kind}.png`);
    await writeFile(file, encodePng(image));
    written.push(file);
  }
  return written;
}

async function removeStaleDiffs(name: string, diffDir: string): Promise<void> {
  await Promise.all(
    ['actual', 'expected', 'diff'].map((kind) =>
      rm(path.join(diffDir, `${name}.${kind}.png`), { force: true }),
    ),
  );
}

/**
 * Compares `frame` with the golden `<name>.png`. `tolerance` overrides the configured one (a
 * number is a max differing-pixel share). Throws GoldenMismatchError when it does not match.
 */
export async function compareWithGolden(
  name: string,
  frame: RgbaImage,
  tolerance?: number | Partial<GoldenTolerance>,
  options: GoldenOptions = {},
): Promise<GoldenResult> {
  const goldenDir = options.goldenDir ?? GOLDEN_DIR;
  const diffDir = options.diffDir ?? path.join(GOLDEN_DIFF_DIR, GOLDEN_BACKEND);
  const update = options.update ?? process.env['REELFORGE_UPDATE_GOLDENS'] === '1';
  const ci = options.ci ?? process.env['CI'] !== undefined;
  const effective = resolveTolerance(name, tolerance);
  const file = path.join(goldenDir, `${name}.png`);
  await removeStaleDiffs(name, diffDir);

  if (update || (!existsSync(file) && !ci)) {
    await mkdir(goldenDir, { recursive: true });
    await writeFile(file, encodePng(frame));
    return { name, status: 'written', differingPixels: 0, differingShare: 0, tolerance: effective };
  }
  if (!existsSync(file)) {
    throw new GoldenMismatchError(
      `golden ${name}: ${file} is missing (CI never writes goldens; run pnpm test:render -- --update-goldens locally and commit it)`,
      [],
    );
  }
  const expected = decodePng(await readFile(file));
  if (expected.width !== frame.width || expected.height !== frame.height) {
    const files = await writeDiffFiles(name, diffDir, { actual: frame });
    throw new GoldenMismatchError(
      `golden ${name}: size ${String(expected.width)}x${String(expected.height)} != ${String(frame.width)}x${String(frame.height)}; actual frame written to ${files.join(', ')}`,
      files,
    );
  }
  const differingPixels = countDifferingPixels(
    expected.data,
    frame.data,
    effective.channelTolerance,
  );
  const differingShare = differingPixels / (frame.width * frame.height);
  if (differingShare > effective.maxDiffShare) {
    const files = await writeDiffFiles(name, diffDir, {
      actual: frame,
      expected,
      diff: diffImage(expected, frame, effective.channelTolerance),
    });
    throw new GoldenMismatchError(
      `golden ${name}: ${String(differingPixels)} px (${percent(differingShare)}) differ by more than ${String(effective.channelTolerance)}/255, ` +
        `tolerance ${percent(effective.maxDiffShare)}; wrote ${files.join(', ')}`,
      files,
    );
  }
  return { name, status: 'match', differingPixels, differingShare, tolerance: effective };
}
