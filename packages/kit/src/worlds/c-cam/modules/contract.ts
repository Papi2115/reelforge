/**
 * Contract of the Grim Ink project modules (PLAN.md#14.8), like the prop contract (extensions.ts):
 *
 *   // kit-ext/people/<id>.js                     // kit-ext/places/<id>.js
 *   export const person = {                       export const place = {
 *     id, name, D, neck, headScale, seed, tones,    id, name, bounds: [w, h],
 *     arm, leg, defaultExpr?, faceAnchors?,         light?, anchors?, collide?,
 *     torso(g, ink, view) { ... },                  draw(g, ink, t) { ... },
 *     head(g, ink, view, face) { ... },           };
 *     drawNeck?(g, ink, view, neck) { ... },
 *   };
 *
 * A person is the rig's `Character` (draw/character.ts) whose drawings get the ink toolbox
 * (`ink`, ink-tools.ts) instead of a bare brush env: modules have no imports. A place is drawn in
 * its own px (origin top-left, y down, 1920x1080 = the frame at zoom 1). The data fields are plain
 * values (zod below; the engine's lint reads the literal ones statically), the functions are
 * checked for being functions. Ids are camelCase and equal the file name.
 */
import { z } from 'zod';
import { characterDataShape, type NeckSpec } from '../draw/character.js';
import type { FaceState } from '../draw/face.js';
import type { Paint2D } from '../draw/paint.js';
import type { ViewIndex } from '../draw/rig-views.js';
import type { InkTools } from './ink-tools.js';

/** camelCase, at most 40 characters (the prop name rule): `kit.people.<id>`. */
export const INK_MODULE_ID = /^[a-z][A-Za-z0-9]{0,39}$/;

const moduleId = z
  .string()
  .regex(INK_MODULE_ID, 'ids are camelCase identifiers equal to the file name, e.g. "oldBaker"');
const displayName = z.string().min(1).max(80);
const coordinate = z.number().min(-20000).max(20000);
const point2 = z.tuple([coordinate, coordinate]).readonly();
const isFunction = (value: unknown): boolean => typeof value === 'function';

/** Keys of `person` that are functions. */
export const PERSON_FUNCTION_KEYS: readonly string[] = ['torso', 'head', 'drawNeck'];
/** Keys of `place` that are functions. */
export const PLACE_FUNCTION_KEYS: readonly string[] = ['draw'];

/** Everything of `export const person` except its drawings. */
export const personDataSchema = z.strictObject({
  ...characterDataShape,
  id: moduleId,
  name: displayName,
});
export type PersonData = z.output<typeof personDataSchema>;

export type PersonTorso = (g: Paint2D, ink: InkTools, view: ViewIndex) => void;
export type PersonHead = (g: Paint2D, ink: InkTools, view: ViewIndex, face: FaceState) => void;
export type PersonNeck = (g: Paint2D, ink: InkTools, view: ViewIndex, neck: NeckSpec) => void;

/** A person module (`export const person`). */
export interface PersonModule extends PersonData {
  /** Torso per view, figure space (feet at the origin). */
  readonly torso: PersonTorso;
  /** Head per view, head-local units (origin = top of the neck, +x = the way the head faces). */
  readonly head: PersonHead;
  /** Custom neck (default: the rig's skin tube). */
  readonly drawNeck?: PersonNeck;
}

export const personModuleSchema: z.ZodType<PersonModule> = personDataSchema.extend({
  torso: z.custom<PersonTorso>(isFunction, { message: 'torso must be a function (g, ink, view)' }),
  head: z.custom<PersonHead>(isFunction, {
    message: 'head must be a function (g, ink, view, face)',
  }),
  drawNeck: z
    .custom<PersonNeck>(isFunction, { message: 'drawNeck must be a function (g, ink, view, neck)' })
    .exactOptional(),
});

/** The place's one warm light: a stepped pool of three flat ellipses (never a gradient). */
export const placeLightSchema = z.strictObject({
  x: coordinate,
  y: coordinate,
  rx: z.number().positive().max(20000),
  ry: z.number().positive().max(20000),
  color: z.string().min(1),
  /** Opacity of each step (0.04-0.12 in the films). */
  alpha: z.number().min(0).max(1).default(0.08),
});
export type PlaceLight = z.output<typeof placeLightSchema>;

/** An axis-aligned box `[x, y, w, h]` in place px. */
export const placeBoxSchema = z
  .tuple([coordinate, coordinate, z.number().positive(), z.number().positive()])
  .readonly();
export type PlaceBox = z.infer<typeof placeBoxSchema>;

/** Everything of `export const place` except `draw`. */
export const placeDataSchema = z.strictObject({
  id: moduleId,
  name: displayName,
  /** Size `[w, h]` of the drawing in place px (the frame is 1920x1080 at zoom 1). */
  bounds: z.tuple([z.number().min(320).max(20000), z.number().min(180).max(20000)]).readonly(),
  light: placeLightSchema.optional(),
  /** Named points (feet marks, the door, the counter top) scenes put people at. */
  anchors: z
    .record(z.string().regex(INK_MODULE_ID, 'anchor names are camelCase'), point2)
    .refine((anchors) => Object.keys(anchors).length <= 32, 'at most 32 anchors')
    .default({}),
  /** Solid boxes (counters, walls) people must not stand inside. */
  collide: z.array(placeBoxSchema).max(64).default([]),
});
export type PlaceData = z.output<typeof placeDataSchema>;

export type PlaceDraw = (g: Paint2D, ink: InkTools, t: number) => void;

/** A place module (`export const place`), parsed (defaults applied). */
export interface PlaceModule extends PlaceData {
  /** The place for time t (seconds), in place px; a pure function of t. */
  readonly draw: PlaceDraw;
}

export const placeModuleSchema = placeDataSchema.extend({
  draw: z.custom<PlaceDraw>(isFunction, { message: 'draw must be a function (g, ink, t)' }),
});

/** `path: message; ...` of a zod error (for one-line module errors). */
export function issuesText(error: z.ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.map(String).join('.') || 'module'}: ${issue.message}`)
    .join('; ');
}
