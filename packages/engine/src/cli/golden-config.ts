/**
 * Golden-frame comparison settings: `test/goldens/golden-config.json` (versioned, zod-validated)
 * with per-golden overrides, then environment overrides on top:
 * - REELFORGE_GOLDEN_CONFIG: path of an alternative config file;
 * - REELFORGE_GOLDEN_CHANNEL_TOLERANCE: max per-channel delta (0..255) for a pixel to still match;
 * - REELFORGE_GOLDEN_MAX_DIFF_SHARE: max share (0..1) of differing pixels per frame.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { GOLDEN_ROOT } from './paths.js';

export const GOLDEN_CONFIG_VERSION = 1;
export const DEFAULT_GOLDEN_CONFIG_FILE = path.join(GOLDEN_ROOT, 'golden-config.json');

const toleranceSchema = z.object({
  /** A pixel matches when every RGBA channel differs by at most this much (0 = exact). */
  channelTolerance: z.int().min(0).max(255),
  /** A frame matches when at most this share of its pixels differ. */
  maxDiffShare: z.number().min(0).max(1),
});
export type GoldenTolerance = z.infer<typeof toleranceSchema>;

export const goldenConfigSchema = toleranceSchema.extend({
  version: z.literal(GOLDEN_CONFIG_VERSION),
  /** Per-golden (file name without .png) overrides. */
  overrides: z.record(z.string(), toleranceSchema.partial()).default({}),
});
export type GoldenConfig = z.infer<typeof goldenConfigSchema>;

/** Used when no config file exists: exact pixels, 0.2 % of the frame may differ. */
export const DEFAULT_GOLDEN_CONFIG: GoldenConfig = {
  version: GOLDEN_CONFIG_VERSION,
  channelTolerance: 0,
  maxDiffShare: 0.002,
  overrides: {},
};

type Env = Readonly<Record<string, string | undefined>>;

export function loadGoldenConfig(env: Env = process.env): GoldenConfig {
  const file = env['REELFORGE_GOLDEN_CONFIG'] ?? DEFAULT_GOLDEN_CONFIG_FILE;
  if (!existsSync(file)) {
    if (env['REELFORGE_GOLDEN_CONFIG'] !== undefined) {
      throw new Error(`REELFORGE_GOLDEN_CONFIG points to a missing file: ${file}`);
    }
    return DEFAULT_GOLDEN_CONFIG;
  }
  const parsed = goldenConfigSchema.safeParse(JSON.parse(readFileSync(file, 'utf8')));
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('; ');
    throw new Error(`invalid golden config ${file}: ${details}`);
  }
  return parsed.data;
}

function envNumber(env: Env, name: string, schema: z.ZodType<number>): number | undefined {
  const raw = env[name];
  if (raw === undefined || raw.trim() === '') return undefined;
  const parsed = schema.safeParse(Number(raw));
  if (!parsed.success) throw new Error(`${name}="${raw}" is not a valid value`);
  return parsed.data;
}

/** Effective tolerance of one golden: config -> per-golden override -> environment. */
export function goldenTolerance(
  name: string,
  config: GoldenConfig,
  env: Env = process.env,
): GoldenTolerance {
  const override = config.overrides[name] ?? {};
  return {
    channelTolerance:
      envNumber(
        env,
        'REELFORGE_GOLDEN_CHANNEL_TOLERANCE',
        toleranceSchema.shape.channelTolerance,
      ) ??
      override.channelTolerance ??
      config.channelTolerance,
    maxDiffShare:
      envNumber(env, 'REELFORGE_GOLDEN_MAX_DIFF_SHARE', toleranceSchema.shape.maxDiffShare) ??
      override.maxDiffShare ??
      config.maxDiffShare,
  };
}
