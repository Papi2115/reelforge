/**
 * Checks of a prop turntable (PLAN.md#7.4), by code: the prop rendered (non-blank views), its
 * size is sane for the kit's scale (the hero is 2 units tall), no part floats (the kit's own
 * structure rule, `kit.voxel.inspect`), and seeking the same view twice gives the same pixels.
 */
import { computeFrameStats } from '@reelforge/engine/raster';
import { z } from 'zod';
import { blankFrameNote } from '../render/blank.js';
import { METRICS_CUE, type TurntableFrame } from './turntable.js';

/** Largest side of a prop, in scene units (0.3: a phone; 4: a small shed). */
export const PROP_SIZE_RANGE = { min: 0.3, max: 4 } as const;

export const propMetricsSchema = z.object({
  size: z.tuple([z.number(), z.number(), z.number()]),
  meshes: z.int().nonnegative(),
  voxels: z.int().nonnegative(),
  floatingParts: z.array(z.string()),
});
export type PropMetrics = z.infer<typeof propMetricsSchema>;

export type PropCheckId = 'metrics' | 'blank' | 'size' | 'floating' | 'deterministic';

export interface PropCheck {
  readonly id: PropCheckId;
  readonly ok: boolean;
  readonly message: string;
}

/** The inspection the turntable scene reported, if any. */
export function parsePropMetrics(
  cues: readonly { readonly name: string }[],
): PropMetrics | undefined {
  const cue = cues.find((candidate) => candidate.name.startsWith(METRICS_CUE));
  if (cue === undefined) return undefined;
  try {
    const parsed = propMetricsSchema.safeParse(JSON.parse(cue.name.slice(METRICS_CUE.length)));
    return parsed.success ? parsed.data : undefined;
  } catch (error) {
    if (error instanceof SyntaxError) return undefined;
    throw error;
  }
}

function units(value: number): string {
  return value.toFixed(2);
}

function sizeCheck(metrics: PropMetrics): PropCheck {
  const [x, y, z] = metrics.size;
  const largest = Math.max(x, y, z);
  const described = `${units(x)} x ${units(y)} x ${units(z)} units (w x h x d)`;
  const { min, max } = PROP_SIZE_RANGE;
  if (metrics.voxels === 0 || largest <= 0) {
    return {
      id: 'size',
      ok: false,
      message: 'the prop has no voxels: build() returned an empty object',
    };
  }
  if (largest < min || largest > max) {
    return {
      id: 'size',
      ok: false,
      message: `${described}: the largest side must be ${String(min)}-${String(max)} units (the hero is 2 units tall, a desk 1); change voxelSize in kit.voxel.mesh`,
    };
  }
  return {
    id: 'size',
    ok: true,
    message: `${described}, ${String(metrics.voxels)} voxels in ${String(metrics.meshes)} mesh(es)`,
  };
}

function sameBytes(first: Uint8Array, second: Uint8Array): boolean {
  if (first.length !== second.length) return false;
  for (let index = 0; index < first.length; index += 1) {
    if (first[index] !== second[index]) return false;
  }
  return true;
}

export interface TurntableInput {
  readonly angles: readonly number[];
  /** Rendered frames (angle i at t = i + 0.5, the repeat of angle 0 at t = angles.length + 0.5). */
  readonly frames: readonly TurntableFrame[];
  readonly cues: readonly { readonly name: string }[];
}

function frameAt(frames: readonly TurntableFrame[], t: number): TurntableFrame | undefined {
  return frames.find((frame) => Math.abs(frame.t - t) < 1e-6);
}

export function turntableChecks(input: TurntableInput): PropCheck[] {
  const checks: PropCheck[] = [];
  const metrics = parsePropMetrics(input.cues);
  if (metrics === undefined) {
    checks.push({
      id: 'metrics',
      ok: false,
      message: 'the turntable did not report the prop (did kit.props.<name>() build?)',
    });
  } else {
    checks.push(sizeCheck(metrics));
    checks.push(
      metrics.floatingParts.length === 0
        ? { id: 'floating', ok: true, message: 'every part is connected or rests on the ground' }
        : { id: 'floating', ok: false, message: metrics.floatingParts.join('; ') },
    );
  }
  const blank = input.angles.flatMap((angle, index) => {
    const frame = frameAt(input.frames, index + 0.5);
    const note =
      frame === undefined ? 'not rendered' : blankFrameNote(computeFrameStats(frame.image.data));
    return note === undefined ? [] : [`${String(angle)} deg: ${note}`];
  });
  checks.push(
    blank.length === 0
      ? {
          id: 'blank',
          ok: true,
          message: `${String(input.angles.length)} views rendered, none blank`,
        }
      : { id: 'blank', ok: false, message: blank.join('; ') },
  );
  const first = frameAt(input.frames, 0.5);
  const repeat = frameAt(input.frames, input.angles.length + 0.5);
  const deterministic =
    first !== undefined && repeat !== undefined && sameBytes(first.image.data, repeat.image.data);
  checks.push(
    deterministic
      ? { id: 'deterministic', ok: true, message: 'the same view rendered twice is identical' }
      : {
          id: 'deterministic',
          ok: false,
          message:
            'the first view differs when rendered again: build() or its methods keep state between calls or use randomness outside ctx.rng',
        },
  );
  return checks;
}
