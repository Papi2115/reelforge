/**
 * Live co-direction in the runtime (PLAN.md#12.14, ADR-023): per-shot overrides of the manifest
 * (`shot.direction`) applied on top of the built scenes without rebuilding them — a rate remap
 * between the shot's visual hits (composed with any reveal-moment slow motion), and on the
 * finished frame a palette tone shift, a nearest-neighbour zoom and host overlay marks. Shots
 * without a direction never reach this code: their clock and frames are the plain ones.
 */
import {
  rateWindows,
  remapTime,
  type ManifestShot,
  type ShotDirection,
  type TimeRemapWindow,
} from '@reelforge/shared';
import { applyTone, applyZoom, compositeOverlay, type ToneMaps } from './direction-frame.js';
import { createOverlayPainter, type OverlayPainter } from './direction-overlays.js';
import { paletteShiftMap, shotClock, type ShotClock } from './moments.js';
import type { ResolvedStyle } from './style.js';

/** What the director needs of a built shot: its visual hits (global seconds). */
export interface ShotHits {
  readonly anchors: readonly { readonly t: number }[];
  readonly cues: readonly { readonly t: number }[];
}

/** Windows of a shot's `rate` direction (film seconds); empty without one. */
export function directionWindows(
  shot: Pick<ManifestShot, 't0' | 't1'>,
  direction: ShotDirection | undefined,
  hits: ShotHits,
): TimeRemapWindow[] {
  const rate = direction?.rate;
  if (rate === undefined || rate === 1) return [];
  const times = [...hits.anchors, ...hits.cues].map((hit) => hit.t);
  return rateWindows(shot, rate, times);
}

/**
 * Scene clock of a shot: the direction's rate windows first (film time), then the reveal-moment
 * remap. Both are identity outside their windows and monotone, so every hit outside both keeps
 * its time. Undefined when the shot has neither (the runtime's plain local time).
 */
export function directedClock(
  shot: Pick<ManifestShot, 't0' | 'timeRemap'>,
  windows: readonly TimeRemapWindow[],
): ShotClock | undefined {
  const moments = shotClock(shot);
  if (windows.length === 0) return moments;
  return (localTime) => {
    const t = shot.t0 + localTime;
    const inside = windows.some((window) => t > window.from && t < window.to);
    const directed = inside ? remapTime(windows, t) - shot.t0 : localTime;
    return moments?.(directed) ?? directed;
  };
}

/** The direction parts that change pixels of the finished frame. */
export interface FrameDirection {
  readonly dim: number;
  readonly zoom: number;
  readonly overlays: NonNullable<ShotDirection['overlays']>;
}

export function frameDirection(direction: ShotDirection | undefined): FrameDirection | undefined {
  if (direction === undefined) return undefined;
  const dim = direction.dim ?? 0;
  const zoom = direction.zoom ?? 1;
  const overlays = direction.overlays ?? [];
  if (dim === 0 && zoom === 1 && overlays.length === 0) return undefined;
  return { dim, zoom, overlays };
}

/** Blend of the outgoing and incoming shot's frame directions during a transition. */
export function blendFrameDirections(
  outgoing: FrameDirection | undefined,
  current: FrameDirection | undefined,
  progress: number,
): FrameDirection | undefined {
  if (outgoing === undefined && current === undefined) return undefined;
  const zoom = (outgoing?.zoom ?? 1) * (1 - progress) + (current?.zoom ?? 1) * progress;
  // The tone has a sign: the shot that dominates the picture keeps its own.
  const dim = progress < 0.5 ? (outgoing?.dim ?? 0) : (current?.dim ?? 0);
  return {
    dim,
    zoom,
    overlays: [...(outgoing?.overlays ?? []), ...(current?.overlays ?? [])],
  };
}

export interface FrameDirector {
  /** `frame` with the direction applied at film time t (a new buffer owned by the director). */
  apply(frame: Uint8Array, direction: FrameDirection, t: number): Uint8Array<ArrayBuffer>;
}

export function createFrameDirector(style: ResolvedStyle, seed: number): FrameDirector {
  const { width, height } = style;
  let tones: ToneMaps | undefined;
  let painter: OverlayPainter | undefined;
  const snapCache = new Map<number, number>();
  const buffers = [new Uint8Array(width * height * 4), new Uint8Array(width * height * 4)];
  return {
    apply(frame, direction, t) {
      let source: Uint8Array = frame;
      let target = 0;
      const next = (): Uint8Array<ArrayBuffer> => {
        const buffer = buffers[target] ?? new Uint8Array(width * height * 4);
        target = 1 - target;
        return buffer;
      };
      if (direction.dim !== 0) {
        tones ??= {
          lighter: paletteShiftMap(style.swatches, style.variation, 'lighter'),
          darker: paletteShiftMap(style.swatches, style.variation, 'darker'),
        };
        const out = next();
        applyTone(source, width, tones, direction.dim, out);
        source = out;
      }
      if (direction.zoom > 1) {
        const out = next();
        applyZoom(source, width, height, direction.zoom, out);
        source = out;
      }
      const out = next();
      out.set(source);
      if (direction.overlays.length > 0) {
        painter ??= createOverlayPainter({
          width,
          height,
          palette: style.palette,
          safeArea: style.safeArea,
          seed,
        });
        const surface = painter.paint(direction.overlays, t);
        if (surface !== undefined) compositeOverlay(out, surface.pixels, style.post.lut, snapCache);
      }
      return out.slice();
    },
  };
}
