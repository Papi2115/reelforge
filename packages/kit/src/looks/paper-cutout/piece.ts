/**
 * Paper pieces: every prop of the look is a KitObject whose content is a set of sprites on depth
 * layers, posed from t. A piece draws nothing by itself: `stage.place(piece, { layer, x, y })` binds
 * it to a paper stage (stage.ts), which poses it on every `stage.update(t)`, keeps its anchors in
 * world space for `ctx.annotate`, and composites it with drop shadows. Motion runs on a
 * stop-motion clock (`fps`, default 8): poses change only on whole frames of that clock, with a
 * small seeded wobble, so movement feels hand-placed but stays a pure function of t.
 */
import { hashCell } from '../../env/shared.js';
import { KitError } from '../../errors.js';
import { createKitObject, type KitObject } from '../../object.js';
import type { KitTools } from '../../registry.js';
import type { PaperColors } from './colors.js';
import type { Sprite } from './sprite.js';

/** One sprite of a posed piece. */
export interface PosedPart {
  readonly sprite: Sprite;
  /** Layer offset from the layer the piece was added to (0 = same layer). */
  readonly layer?: number | undefined;
  /** Pivot position in frame pixels relative to the piece origin. */
  readonly x: number;
  readonly y: number;
  /** Pivot inside the sprite (pixels from its top-left corner). */
  readonly pivot: readonly [number, number];
  readonly shadow?: boolean | undefined;
}

/** A named point of a posed piece: frame pixels relative to the origin, on a layer offset. */
export interface PieceAnchor {
  readonly x: number;
  readonly y: number;
  readonly layer?: number | undefined;
}

export interface PiecePose {
  readonly parts: readonly PosedPart[];
  readonly anchors: Readonly<Record<string, PieceAnchor>>;
}

/** What a piece learns when it is added to a stage. */
export interface PieceContext {
  readonly colors: PaperColors;
  /** Frame pixels per 640x360 reference pixel. */
  readonly s: number;
  /** Frame size in pixels. */
  readonly width: number;
  readonly height: number;
  /** Extra width (px) strips need on each side so camera pans never reach their ends. */
  readonly margin: number;
  /** Stop-motion clock. */
  readonly clock: StopMotion;
  /** Seed of the stage + this piece (for wobble). */
  readonly seed: number;
  /** Placement of the origin in frame pixels (strips centre themselves on the frame). */
  readonly originX: number;
  readonly originY: number;
  /** Pixels strips must reach below their origin to cover the frame bottom in any pan. */
  readonly below: number;
}

export interface PieceModel {
  readonly kitType: string;
  /** Default layer and origin (640x360 reference pixels) when `stage.place` gives none. */
  readonly placement: { readonly layer: number; readonly x: number; readonly y: number };
  /** Called once by `stage.place`: returns the pose function of the piece. */
  bind(context: PieceContext): (t: number) => PiecePose;
}

const MODELS = new WeakMap<object, PieceModel>();

/** The model of a paper piece (undefined for any other object). */
export function pieceModel(value: unknown): PieceModel | undefined {
  return typeof value === 'object' && value !== null ? MODELS.get(value) : undefined;
}

/** A paper piece object: a KitObject placed through `stage.place`. */
export function createPiece(tools: KitTools, model: PieceModel): KitObject {
  const object = createKitObject(tools.three, { kitType: model.kitType });
  MODELS.set(object, model);
  return object;
}

/** Throws the error scenes see when they pass something that is not a paper piece. */
export function notAPiece(call: string): never {
  throw new KitError(
    'invalid-params',
    `${call}: expected a paper piece (kit.props.paperHills/paperTrees/paperClouds/paperBuildings/paperRoom/paperPuppet/paperSign/paperLabel/paperCard/paperStack)`,
  );
}

/** Stop-motion clock: frames of `fps` per second, wobble per frame and piece. */
export interface StopMotion {
  readonly fps: number;
  /** Index of the stop-motion frame showing time t. */
  frame(t: number): number;
  /** t snapped down to its stop-motion frame (what animated pieces pose from). */
  time(t: number): number;
  /** Seeded jitter in [-amount, amount] px for a frame (whole pixels). */
  jitter(frame: number, salt: number, amount: number): number;
}

export function stopMotion(fps: number, wobble: number, seed: number): StopMotion {
  const frame = (t: number): number => Math.floor(t * fps + 1e-6);
  return {
    fps,
    frame,
    time: (t) => frame(t) / fps,
    jitter: (index, salt, amount) => {
      const range = Math.round(amount * wobble);
      if (range <= 0) return 0;
      return Math.floor(hashCell(index, salt, 17, seed) * (range * 2 + 1)) - range;
    },
  };
}

/** Smoothstep ease (0..1). */
export function ease(k: number): number {
  const clamped = k <= 0 ? 0 : k >= 1 ? 1 : k;
  return clamped * clamped * (3 - 2 * clamped);
}

/** Memoises a sprite builder on a string key (re-cut only when the key changes). */
export function memo<T>(build: (key: string) => T): (key: string) => T {
  let lastKey: string | undefined;
  let last: T | undefined;
  return (key) => {
    if (key !== lastKey || last === undefined) {
      last = build(key);
      lastKey = key;
    }
    return last;
  };
}
