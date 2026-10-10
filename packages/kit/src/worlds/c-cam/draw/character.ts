/**
 * C-CAM character contract (PLAN.md#14.5): the rig dimensions `D` and the `Character` record a
 * person module provides (task 14.8 loads project modules against `characterSchema`). Data fields
 * (dimensions, neck table, tones, arm / leg styles) are validated by zod; the view-specific drawing
 * (torso, head, optional neck) are functions, checked only for being functions (`z.custom`).
 *
 * Derived from the cast files of `docs/concepts/c-cam-style/films/03-apollo-11/js/cast/*.js` and
 * `docs/04-CHARACTER_GUIDE.md` §1-§5. Divergences from the cast files:
 *  - one data record instead of an IIFE that registers `ST.CAST.<id> = { name, D, draw }`: the
 *    fixed draw order (`draw`) belongs to the rig (`FIGURE_ORDER`, rig-layers.ts), the character
 *    only supplies its per-view torso and head drawings, its `NECK` table (`neck`) and styles;
 *  - `hsz` is required in `D` (film 3 keeps it there; film 1 kept it on the cast record);
 *  - the head scale (1.05-1.2 in the films, hard-coded per file) is the data field `headScale`;
 *  - a custom neck drawing is `drawNeck` (the name `neck` is the per-view table);
 *  - added (from the c-plus `CHARACTER_CONTRACT.md` §5): optional `faceAnchors`, head-local face
 *    points per view (the rig's `anchors` places them in figure space; no jaw rule in C).
 *
 * Public API: `rigDimsSchema`, `RigDims`, `HeadBox`, `neckSpecSchema`, `NeckSpec`, `neckBase`,
 * `neckHead`, `tonesSchema`, `Tones`, `TorsoDraw`, `HeadDraw`, `NeckDraw`, `FACE_ANCHOR_NAMES`,
 * `FaceAnchorName`, `faceAnchorTableSchema`, `FaceAnchorTable`, `FaceAnchors`, `Character`,
 * `characterSchema`.
 */
import { z } from 'zod';
import type { BrushEnv } from './brushes.js';
import type { FaceState } from './face.js';
import type { Paint2D } from './paint.js';
import { bodyDimsSchema } from './poses.js';
import { armStyleSchema, legStyleSchema, type ArmStyle, type LegStyle } from './rig-limbs.js';
import type { ViewIndex } from './rig-views.js';

const num = z.number();

/** Face-guard box: head centre x per view, top and bottom (body y) and half width. */
const headBoxSchema = z
  .object({
    x: z.tuple([num, num, num, num]).readonly(),
    top: num,
    bottom: num,
    hw: z.number().positive(),
  })
  .readonly();

export type HeadBox = z.infer<typeof headBoxSchema>;

/** Everything the rig reads from a character's dimension record `D` (body-space px). */
export const rigDimsSchema = z
  .object({
    ...bodyDimsSchema.unwrap().shape,
    /** Hip height (negative: above the feet). */
    hy: num,
    /** Sideways component of the default elbow pole (0.6-0.9; default 0.7). */
    elbowOut: num.optional(),
    /** Crown height (scale of the turnaround sheet). */
    top: num.optional(),
    /** Hand (mitten) size. */
    hsz: z.number().positive(),
    /** Face-guard box; without it hands may cross the face (crowds). */
    head: headBoxSchema.optional(),
  })
  .readonly();

export type RigDims = z.infer<typeof rigDimsSchema>;

/**
 * Where the head sits in one view: `[x, y]` (no visible neck, the head sits on the collar) or
 * `[baseX, baseY, headX, headY]` (a neck from base to head). The head is placed at the last pair.
 */
export const neckSpecSchema = z.union([
  z.tuple([num, num]).readonly(),
  z.tuple([num, num, num, num]).readonly(),
]);

export type NeckSpec = z.infer<typeof neckSpecSchema>;

/** Neck base `[x, y]` (its y is the neck line `armLayer` compares raised hands with). */
export function neckBase(n: NeckSpec): readonly [x: number, y: number] {
  return [n[0], n[1]];
}

/** Head origin `[x, y]`: the last pair of the neck spec. */
export function neckHead(n: NeckSpec): readonly [x: number, y: number] {
  return n.length === 4 ? [n[2], n[3]] : [n[0], n[1]];
}

/** Named colours; `skin` and `skinD` (its shadow) are required, any other names are free. */
export const tonesSchema = z
  .object({ skin: z.string().min(1), skinD: z.string().min(1) })
  .catchall(z.string().min(1))
  .readonly();

export type Tones = z.infer<typeof tonesSchema>;

/** Torso for a view, in figure space (feet at the origin), drawn already shifted by the bob. */
export type TorsoDraw = (g: Paint2D, env: BrushEnv, view: ViewIndex) => void;

/** Head for a view in head-local units: origin = top of the neck, +x = the way the head faces. */
export type HeadDraw = (g: Paint2D, env: BrushEnv, view: ViewIndex, face: FaceState) => void;

/** Custom neck drawing for a view (default: the rig's neck tube from `neckBase` to `neckHead`). */
export type NeckDraw = (g: Paint2D, env: BrushEnv, view: ViewIndex, neck: NeckSpec) => void;

/** Named face points (validators and face contact read them; c-plus `CHARACTER_CONTRACT.md` §5). */
export const FACE_ANCHOR_NAMES = ['chin', 'cheek', 'nose', 'mouth', 'ear', 'forehead'] as const;

export type FaceAnchorName = (typeof FACE_ANCHOR_NAMES)[number];

const point2 = z.tuple([num, num]).readonly();

/** Face points of one head view, head-local `[x, y]` (as `HeadDraw`); any of them may be absent. */
export const faceAnchorTableSchema = z
  .object({
    chin: point2.exactOptional(),
    cheek: point2.exactOptional(),
    nose: point2.exactOptional(),
    mouth: point2.exactOptional(),
    ear: point2.exactOptional(),
    forehead: point2.exactOptional(),
  })
  .readonly();

export type FaceAnchorTable = z.infer<typeof faceAnchorTableSchema>;

/** One face table per head view: front, three-quarter, profile, back. */
export type FaceAnchors = readonly [
  FaceAnchorTable,
  FaceAnchorTable,
  FaceAnchorTable,
  FaceAnchorTable,
];

/** A hand-built person: data plus its view-specific drawings. */
export interface Character {
  /** kebab-case id (`old-baker`). */
  readonly id: string;
  /** Display name (`'The Commander'`). */
  readonly name: string;
  readonly D: RigDims;
  /** `NECK[v]` per view: front, three-quarter, profile, back. */
  readonly neck: readonly [NeckSpec, NeckSpec, NeckSpec, NeckSpec];
  /** Head scale relative to the body (1.05-1.2 in the films). */
  readonly headScale: number;
  /** Seed block of this character (stable ink wobble). */
  readonly seed: number;
  readonly tones: Tones;
  readonly arm: ArmStyle;
  readonly leg: LegStyle;
  /** Expression when the scene names none (default `deadpan`). */
  readonly defaultExpr?: string;
  readonly torso: TorsoDraw;
  readonly head: HeadDraw;
  readonly drawNeck?: NeckDraw;
  /** Head-local face points per head view (optional). */
  readonly faceAnchors?: FaceAnchors;
}

const isFunction = (v: unknown): boolean => typeof v === 'function';

export const characterSchema: z.ZodType<Character> = z
  .object({
    id: z.string().regex(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/),
    name: z.string().min(1),
    D: rigDimsSchema,
    neck: z.tuple([neckSpecSchema, neckSpecSchema, neckSpecSchema, neckSpecSchema]).readonly(),
    headScale: z.number().positive(),
    seed: num,
    tones: tonesSchema,
    arm: armStyleSchema,
    leg: legStyleSchema,
    defaultExpr: z.string().min(1).exactOptional(),
    torso: z.custom<TorsoDraw>(isFunction, { message: 'torso must be a function' }),
    head: z.custom<HeadDraw>(isFunction, { message: 'head must be a function' }),
    drawNeck: z
      .custom<NeckDraw>(isFunction, { message: 'drawNeck must be a function' })
      .exactOptional(),
    faceAnchors: z
      .tuple([
        faceAnchorTableSchema,
        faceAnchorTableSchema,
        faceAnchorTableSchema,
        faceAnchorTableSchema,
      ])
      .readonly()
      .exactOptional(),
  })
  .readonly();
