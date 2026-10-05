/**
 * Transition kit (PLAN.md#12.15, ADR-011): pixel transitions between two post-fx frames. The
 * engine renders the outgoing shot (A) and the incoming shot (B) through the full post pass, then
 * `compositeTransition` picks, per pixel, a pixel of A or B (masks from progress, an ordered-dither
 * threshold, geometry and a seed) or a palette tone, so the result stays in the style palette.
 * Preview and export both get their frames from `EngineRuntime.seek`, so they share this code.
 * Styles and their metadata come from `@reelforge/shared` (`TRANSITION_STYLES`).
 */
import {
  TRANSITION_STYLE_IDS,
  TRANSITION_STYLES,
  type TransitionFocus,
  type TransitionStyle,
  type TransitionStyleId,
} from '@reelforge/shared';
import {
  ditherDissolve,
  glitchCut,
  iris,
  mosaicReveal,
  pixelWipe,
  scanlineSweep,
} from './basic.js';
import { cubeSmash } from './cube-smash.js';
import { diveIn, diveOut } from './dive.js';
import { enterBinoculars, enterKeyhole, enterLens, enterWindow } from './enter.js';
import { crtZoom, drawOver, pixelSortMelt, tileFlip } from './looks.js';
import { pageTurn, paperRoll, spongeWipe } from './paper.js';
import {
  CENTRE_FOCUS,
  clamp01,
  createTones,
  pixelView,
  type Compositor,
  type TransitionFrame,
  type Tones,
} from './pixels.js';
import { shatter } from './shatter.js';

export { createTones, type TransitionFrame, type Tones } from './pixels.js';

/** A transition style with its compositor. */
export interface EngineTransition extends TransitionStyle {
  readonly composite: Compositor;
}

const COMPOSITORS: Readonly<Record<TransitionStyleId, Compositor>> = {
  'pixel-wipe': pixelWipe,
  'dither-dissolve': ditherDissolve,
  'glitch-cut': glitchCut,
  iris,
  'scanline-sweep': scanlineSweep,
  'mosaic-reveal': mosaicReveal,
  'crt-zoom': crtZoom,
  'tile-flip': tileFlip,
  'draw-over': drawOver,
  'pixel-sort-melt': pixelSortMelt,
  'enter-lens': enterLens,
  'enter-binoculars': enterBinoculars,
  'enter-window': enterWindow,
  'enter-keyhole': enterKeyhole,
  'paper-roll': paperRoll,
  'cube-smash': cubeSmash,
  'sponge-wipe': spongeWipe,
  'page-turn': pageTurn,
  shatter,
  'dive-in': diveIn,
  'dive-out': diveOut,
};

export const TRANSITIONS: Readonly<Record<TransitionStyleId, EngineTransition>> =
  Object.fromEntries(
    TRANSITION_STYLE_IDS.map((id) => [
      id,
      { ...TRANSITION_STYLES[id], composite: COMPOSITORS[id] },
    ]),
  ) as Record<TransitionStyleId, EngineTransition>;

/** The engine transition of a storyboard style id; undefined for unknown ids. */
export function findTransition(style: string | undefined): EngineTransition | undefined {
  if (style === undefined) return undefined;
  return (TRANSITION_STYLE_IDS as readonly string[]).includes(style)
    ? TRANSITIONS[style as TransitionStyleId]
    : undefined;
}

export interface TransitionParams {
  /** Style palette (0xRRGGBB, project overrides included): the tones a transition may draw. */
  readonly palette: readonly number[];
  /** Subject point of a wow transition (storyboard `transitionIn.focus`); default the centre. */
  readonly focus?: TransitionFocus | undefined;
}

const toneCache = new WeakMap<readonly number[], Tones>();

function tonesOf(palette: readonly number[]): Tones {
  const cached = toneCache.get(palette);
  if (cached !== undefined) return cached;
  const tones = createTones(palette);
  toneCache.set(palette, tones);
  return tones;
}

/**
 * Composites one transition frame: `progress` 0 = A, 1 = B; `seed` (uint32) varies the pattern
 * per transition. Writes into `out` when given (same size), otherwise into a new buffer. Pure:
 * the same inputs always give the same bytes.
 */
export function compositeTransition(
  style: TransitionStyleId,
  params: TransitionParams,
  a: TransitionFrame,
  b: TransitionFrame,
  progress: number,
  seed: number,
  out?: Uint8Array<ArrayBuffer>,
): Uint8Array<ArrayBuffer> {
  const { width, height } = a;
  const bytes = width * height * 4;
  if (b.width !== width || b.height !== height) {
    throw new RangeError(
      `transition frames differ in size: ${String(width)}x${String(height)} vs ${String(b.width)}x${String(b.height)}`,
    );
  }
  if (a.data.length !== bytes || b.data.length !== bytes) {
    throw new RangeError(`transition frames must be RGBA8 ${String(width)}x${String(height)}`);
  }
  const target = out ?? new Uint8Array(bytes);
  if (target.length !== bytes) throw new RangeError('transition output has the wrong size');
  COMPOSITORS[style]({
    width,
    height,
    a: pixelView(a.data),
    b: pixelView(b.data),
    out: new Uint32Array(target.buffer, target.byteOffset, bytes >>> 2),
    p: clamp01(progress),
    seed: seed >>> 0,
    tones: tonesOf(params.palette),
    focus: params.focus ?? CENTRE_FOCUS,
  });
  return target;
}

/** Palette of a style as 0xRRGGBB numbers (from `ResolvedStyle.swatches`). */
export function paletteNumbers(swatches: Readonly<Record<string, string>>): number[] {
  return Object.values(swatches).map((hex) => Number.parseInt(hex.slice(1), 16));
}
