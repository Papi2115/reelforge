/**
 * Built-in SFX recipes, synthesized offline in pure Node (deterministic; no OfflineAudioContext /
 * Chromium). Each recipe has 3-5 designed variants; `seed % variants` picks one and the seed also
 * drives its micro-variation, so repeated cues do not sound identical. Every clip is 48 kHz
 * stereo, DC-free, faded at both edges and levelled to a per-category loudness (loudest 50 ms
 * K-weighted window, so sub-heavy and bright sounds are judged like the ear does) under a -3 dBFS
 * peak ceiling, so a cue's `gainDb` is relative to a consistent reference.
 * Recipe names are documented in docs/sfx.md.
 */
import { type StereoClip } from './clip.js';
import { kWeighted, maxWindowRms } from './analysis.js';
import { Biquad, MIX_SAMPLE_RATE, dbToGain, mulberry32, peakOf, secondsToFrames } from './dsp.js';
import type { FfmpegError } from '../ffmpeg/errors.js';
import type { Result } from '../result.js';
import { boom, hit, hitSoft, pop, snap, stamp } from './sfx/impact.js';
import type { SfxCategory, SfxDefinition } from './sfx/layers.js';
import { downer, riser, swooshIn, swooshOut, whoosh, whooshImpact } from './sfx/motion.js';
import {
  bubble,
  bubbleUp,
  cameraShutter,
  glitch,
  paper,
  scribble,
  typewriter,
} from './sfx/texture.js';
import { chime, coin, ding, sparkle } from './sfx/tonal.js';
import {
  blip,
  blipDown,
  blipUp,
  click,
  errorBuzz,
  notification,
  success,
  tick,
  tock,
} from './sfx/ui.js';
import {
  dataPing,
  measureBlipSfx,
  pencilScratch,
  plotterPen,
  relayClick,
  rulerTickSfx,
} from './sfx/blueprint.js';
import { chimeUp, flatTick, shapePop, swooshSoft, textSnap, whooshFlat } from './sfx/flat-2d.js';
import { chair, ledBlipSfx, paperShuffle, serverWhir, softKeys } from './sfx/diorama.js';
import { birdChirp, hornBlip, servoSfx, trafficPass } from './sfx/diorama-world.js';
import {
  errorBeep,
  keyClick,
  keyboard,
  mouseClick,
  terminalTickSfx,
  windowClose,
  windowOpen,
} from './sfx/retro-ui.js';
import { crtZap, diskSeek, modemHandshake } from './sfx/retro-ui-machines.js';
import {
  boardChime,
  boardTap,
  boardTick,
  capPop,
  eraserSwipe,
  markerSqueak,
  markerStroke,
} from './sfx/whiteboard.js';
import {
  pageFlip,
  paperPop,
  paperRustle,
  paperSlide,
  scissorSnip,
  tapeTear,
  woodTick,
} from './sfx/paper-cutout.js';
import { glassCrack } from './sfx/glass.js';
import { writeWavAtomic } from './wav.js';

export type { SfxCategory } from './sfx/layers.js';

/**
 * The first eight are the original v1 names (kept in this order); new names are appended. The
 * look palettes' recipes (PLAN.md#12.24: retro-ui, diorama, blueprint) follow the voxel set.
 */
export const SFX_RECIPES = [
  'whoosh',
  'click',
  'hit',
  'typewriter',
  'riser',
  'glitch',
  'tick',
  'pop',
  'swoosh-in',
  'swoosh-out',
  'whoosh-impact',
  'downer',
  'hit-soft',
  'boom',
  'stamp',
  'snap',
  'bubble',
  'bubble-up',
  'scribble',
  'paper',
  'camera-shutter',
  'tock',
  'blip',
  'blip-up',
  'blip-down',
  'notification',
  'success',
  'error-buzz',
  'ding',
  'chime',
  'coin',
  'sparkle',
  // retro-ui palette
  'key-click',
  'keyboard',
  'mouse-click',
  'window-open',
  'window-close',
  'disk-seek',
  'modem',
  'crt-zap',
  'error-beep',
  'terminal-tick',
  // diorama palette
  'soft-keys',
  'chair',
  'paper-shuffle',
  'server-whir',
  'led-blip',
  'traffic-pass',
  'horn-blip',
  'bird-chirp',
  'servo',
  // blueprint palette
  'pencil-scratch',
  'plotter-pen',
  'ruler-tick',
  'measure-blip',
  'relay-click',
  'data-ping',
  // flat-2d palette
  'shape-pop',
  'swoosh-soft',
  'whoosh-flat',
  'flat-tick',
  'chime-up',
  'text-snap',
  // whiteboard palette
  'marker-stroke',
  'marker-squeak',
  'cap-pop',
  'eraser-swipe',
  'board-tap',
  'board-chime',
  'board-tick',
  // paper-cutout palette
  'paper-rustle',
  'paper-slide',
  'scissor-snip',
  'tape-tear',
  'paper-pop',
  'wood-tick',
  'page-flip',
  // wow transitions (ADR-028)
  'glass-crack',
] as const;
export type SfxRecipe = (typeof SFX_RECIPES)[number];

const DEFINITIONS: Readonly<Record<SfxRecipe, SfxDefinition>> = {
  whoosh,
  click,
  hit,
  typewriter,
  riser,
  glitch,
  tick,
  pop,
  'swoosh-in': swooshIn,
  'swoosh-out': swooshOut,
  'whoosh-impact': whooshImpact,
  downer,
  'hit-soft': hitSoft,
  boom,
  stamp,
  snap,
  bubble,
  'bubble-up': bubbleUp,
  scribble,
  paper,
  'camera-shutter': cameraShutter,
  tock,
  blip,
  'blip-up': blipUp,
  'blip-down': blipDown,
  notification,
  success,
  'error-buzz': errorBuzz,
  ding,
  chime,
  coin,
  sparkle,
  'key-click': keyClick,
  keyboard,
  'mouse-click': mouseClick,
  'window-open': windowOpen,
  'window-close': windowClose,
  'disk-seek': diskSeek,
  modem: modemHandshake,
  'crt-zap': crtZap,
  'error-beep': errorBeep,
  'terminal-tick': terminalTickSfx,
  'soft-keys': softKeys,
  chair,
  'paper-shuffle': paperShuffle,
  'server-whir': serverWhir,
  'led-blip': ledBlipSfx,
  'traffic-pass': trafficPass,
  'horn-blip': hornBlip,
  'bird-chirp': birdChirp,
  servo: servoSfx,
  'pencil-scratch': pencilScratch,
  'plotter-pen': plotterPen,
  'ruler-tick': rulerTickSfx,
  'measure-blip': measureBlipSfx,
  'relay-click': relayClick,
  'data-ping': dataPing,
  'shape-pop': shapePop,
  'swoosh-soft': swooshSoft,
  'whoosh-flat': whooshFlat,
  'flat-tick': flatTick,
  'chime-up': chimeUp,
  'text-snap': textSnap,
  'marker-stroke': markerStroke,
  'marker-squeak': markerSqueak,
  'cap-pop': capPop,
  'eraser-swipe': eraserSwipe,
  'board-tap': boardTap,
  'board-chime': boardChime,
  'board-tick': boardTick,
  'paper-rustle': paperRustle,
  'paper-slide': paperSlide,
  'scissor-snip': scissorSnip,
  'tape-tear': tapeTear,
  'paper-pop': paperPop,
  'wood-tick': woodTick,
  'page-flip': pageFlip,
  'glass-crack': glassCrack,
};

const mapRecipes = <T>(pick: (definition: SfxDefinition) => T): Readonly<Record<SfxRecipe, T>> =>
  Object.fromEntries(SFX_RECIPES.map((recipe) => [recipe, pick(DEFINITIONS[recipe])])) as Record<
    SfxRecipe,
    T
  >;

/** Default length per recipe (seconds); `durationS` on a cue overrides it. */
export const SFX_DEFAULT_DURATION_S = mapRecipes((definition) => definition.durationS);
export const SFX_CATEGORY = mapRecipes((definition) => definition.category);
/** Variant names per recipe; `seed % length` selects one. */
export const SFX_VARIANTS = mapRecipes((definition) =>
  definition.variants.map((variant) => variant.name),
);
/** One-line intended use per recipe (docs/sfx.md, Sound panel tooltips). */
export const SFX_USE = mapRecipes((definition) => definition.use);

export const SFX_MIN_DURATION_S = 0.01;
export const SFX_MAX_DURATION_S = 10;
/** Peak ceiling of every synthesized SFX (linear, -3 dBFS). */
export const SFX_PEAK = dbToGain(-3);
/** Loudest 50 ms K-weighted window RMS per category (dB) before the peak ceiling applies. */
export const SFX_LEVEL_DB: Readonly<Record<SfxCategory, number>> = {
  motion: -15,
  impact: -13,
  texture: -16,
  ui: -17,
  tonal: -17,
};
const LEVEL_WINDOW_S = 0.05;
const FADE_IN_S = 0.001;
const FADE_OUT_S = 0.003;

export interface SfxSynthOptions {
  readonly seed: number;
  readonly durationS?: number | undefined;
}

export function sfxVariantIndex(recipe: SfxRecipe, seed: number): number {
  return (seed >>> 0) % DEFINITIONS[recipe].variants.length;
}

/** DC blocker + raised-cosine edge fades (first and last sample exactly 0). */
function cleanEdges(channel: Float32Array): void {
  const dc = new Biquad().highpass(20, 0.6);
  for (let index = 0; index < channel.length; index++) {
    channel[index] = dc.process(channel[index] ?? 0);
  }
  const fadeIn = Math.min(secondsToFrames(FADE_IN_S), channel.length);
  const fadeOut = Math.min(secondsToFrames(FADE_OUT_S), channel.length);
  for (let index = 0; index < fadeIn; index++) {
    channel[index] = (channel[index] ?? 0) * (0.5 - 0.5 * Math.cos((Math.PI * index) / fadeIn));
  }
  const last = channel.length - 1;
  for (let index = 0; index < fadeOut; index++) {
    channel[last - index] =
      (channel[last - index] ?? 0) * (0.5 - 0.5 * Math.cos((Math.PI * index) / fadeOut));
  }
}

function level(clip: StereoClip, targetDb: number): StereoClip {
  const window = secondsToFrames(LEVEL_WINDOW_S);
  const loudness = Math.max(
    maxWindowRms(kWeighted(clip.left), window),
    maxWindowRms(kWeighted(clip.right), window),
  );
  const peak = Math.max(peakOf(clip.left), peakOf(clip.right));
  if (peak === 0) return clip;
  const gain = Math.min(dbToGain(targetDb) / loudness, SFX_PEAK / peak);
  for (let index = 0; index < clip.left.length; index++) {
    clip.left[index] = (clip.left[index] ?? 0) * gain;
    clip.right[index] = (clip.right[index] ?? 0) * gain;
  }
  return clip;
}

/** Synthesizes `recipe` as a 48 kHz stereo clip (deterministic per seed); see the module comment. */
export function synthesizeSfx(recipe: SfxRecipe, options: SfxSynthOptions): StereoClip {
  const definition = DEFINITIONS[recipe];
  const durationS = Math.min(
    SFX_MAX_DURATION_S,
    Math.max(SFX_MIN_DURATION_S, options.durationS ?? definition.durationS),
  );
  const frames = secondsToFrames(durationS);
  const variant = definition.variants[sfxVariantIndex(recipe, options.seed)];
  if (variant === undefined) throw new Error(`sfx ${recipe} has no variants`);
  const rendered = variant.render({
    frames,
    durationS: frames / MIX_SAMPLE_RATE,
    rng: mulberry32(options.seed),
  });
  const clip = {
    left: rendered.left.slice(0, frames),
    right: rendered.right.slice(0, frames),
  };
  cleanEdges(clip.left);
  cleanEdges(clip.right);
  return level(clip, SFX_LEVEL_DB[definition.category]);
}

/** Writes a synthesized SFX as a stereo 48 kHz 16-bit WAV (e.g. for the SFX library preview). */
export function writeSfxWav(
  filePath: string,
  recipe: SfxRecipe,
  options: SfxSynthOptions,
): Promise<Result<void, FfmpegError>> {
  const clip = synthesizeSfx(recipe, options);
  return writeWavAtomic(filePath, [clip.left, clip.right], MIX_SAMPLE_RATE, 'pcm16');
}
