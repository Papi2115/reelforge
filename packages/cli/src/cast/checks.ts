/**
 * Checks of a role lineup (PLAN.md#12.20, ADR-026), by code: the role spec checks of the kit
 * (outfit colours, palette, face, accessories on valid slots) plus the render: views not blank,
 * height within the pack's range (+-15 %), every pixel a palette colour (vibe guard) and the same
 * view rendered twice is identical.
 */
import { vibeGuard, type VibeStyle } from '@reelforge/engine';
import { computeFrameStats } from '@reelforge/engine/raster';
import type { RoleSpecCheck } from '@reelforge/kit';
import { z } from 'zod';
import { blankFrameNote } from '../render/blank.js';
import { LINEUP_VIEWS, ROLE_METRICS_CUE, type LineupFrame, type LineupView } from './lineup.js';

/** How far a role may be shorter/taller than the pack's shortest/tallest member. */
export const HEIGHT_TOLERANCE = 0.15;

export const roleMetricsSchema = z.object({
  size: z.tuple([z.number(), z.number(), z.number()]),
  packHeight: z.tuple([z.number(), z.number()]),
});
export type RoleMetrics = z.infer<typeof roleMetricsSchema>;

export type RoleCheckId =
  RoleSpecCheck['id'] | 'metrics' | 'height' | 'blank' | 'vibe' | 'deterministic';

export interface RoleCheck {
  readonly id: RoleCheckId;
  readonly ok: boolean;
  readonly message: string;
}

export function parseRoleMetrics(
  cues: readonly { readonly name: string }[],
): RoleMetrics | undefined {
  const cue = cues.find((candidate) => candidate.name.startsWith(ROLE_METRICS_CUE));
  if (cue === undefined) return undefined;
  try {
    const parsed = roleMetricsSchema.safeParse(JSON.parse(cue.name.slice(ROLE_METRICS_CUE.length)));
    return parsed.success ? parsed.data : undefined;
  } catch (error) {
    if (error instanceof SyntaxError) return undefined;
    throw error;
  }
}

function heightCheck(metrics: RoleMetrics): RoleCheck {
  const height = metrics.size[1];
  const [shortest, tallest] = metrics.packHeight;
  const min = shortest * (1 - HEIGHT_TOLERANCE);
  const max = tallest * (1 + HEIGHT_TOLERANCE);
  const range = `${min.toFixed(2)}-${max.toFixed(2)}`;
  return height >= min && height <= max
    ? { id: 'height', ok: true, message: `${height.toFixed(2)} units tall (pack ${range})` }
    : {
        id: 'height',
        ok: false,
        message: `${height.toFixed(2)} units tall, outside the pack's ${range}: use the standard body (kid only for children) and keep hats/props within the pack's proportions`,
      };
}

function frameAt(frames: readonly LineupFrame[], t: number): LineupFrame | undefined {
  return frames.find((frame) => Math.abs(frame.t - t) < 1e-6);
}

function sameBytes(first: Uint8Array, second: Uint8Array): boolean {
  if (first.length !== second.length) return false;
  for (let index = 0; index < first.length; index += 1) {
    if (first[index] !== second[index]) return false;
  }
  return true;
}

export interface LineupCheckInput {
  readonly frames: readonly LineupFrame[];
  readonly cues: readonly { readonly name: string }[];
  /** The project's style (vibe guard); undefined = not checked. */
  readonly style?: VibeStyle | undefined;
  readonly views?: readonly LineupView[];
}

function viewChecks(input: LineupCheckInput, views: readonly LineupView[]): RoleCheck[] {
  const blank: string[] = [];
  const offPalette: string[] = [];
  views.forEach((view, index) => {
    const frame = frameAt(input.frames, index + 0.5);
    const name = `${view.pose} ${String(view.angle)} deg`;
    if (frame === undefined) {
      blank.push(`${name}: not rendered`);
      return;
    }
    const note = blankFrameNote(computeFrameStats(frame.image.data));
    if (note !== undefined) blank.push(`${name}: ${note}`);
    if (input.style !== undefined) {
      const report = vibeGuard(frame.image, input.style);
      if (!report.ok) offPalette.push(`${name}: ${report.issues.join(', ')}`);
    }
  });
  return [
    blank.length === 0
      ? { id: 'blank', ok: true, message: `${String(views.length)} views rendered, none blank` }
      : { id: 'blank', ok: false, message: blank.join('; ') },
    ...(input.style === undefined
      ? []
      : [
          offPalette.length === 0
            ? { id: 'vibe' as const, ok: true, message: 'every pixel is a palette colour' }
            : { id: 'vibe' as const, ok: false, message: offPalette.join('; ') },
        ]),
  ];
}

/** The render checks of a lineup. */
export function lineupChecks(input: LineupCheckInput): RoleCheck[] {
  const views = input.views ?? LINEUP_VIEWS;
  const metrics = parseRoleMetrics(input.cues);
  const first = frameAt(input.frames, 0.5);
  const repeat = frameAt(input.frames, views.length + 0.5);
  const deterministic =
    first !== undefined && repeat !== undefined && sameBytes(first.image.data, repeat.image.data);
  return [
    metrics === undefined
      ? {
          id: 'metrics',
          ok: false,
          message: 'the lineup did not report the role (did kit.cast.person(id) build?)',
        }
      : heightCheck(metrics),
    ...viewChecks(input, views),
    deterministic
      ? { id: 'deterministic', ok: true, message: 'the same view rendered twice is identical' }
      : {
          id: 'deterministic',
          ok: false,
          message: 'the first view differs when rendered again (report this: roles are data)',
        },
  ];
}
