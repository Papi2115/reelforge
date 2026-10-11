/**
 * Contract of the Grim Ink project modules (PLAN.md#14.8), like the prop contract (extensions.ts):
 *
 *   // kit-ext/people/<id>.js                     // kit-ext/places/<id>.js
 *   export const person = {                       export const place = {
 *     id, name, D, neck, headScale, seed, tones,    id, name, bounds: [w, h],
 *     arm, leg, defaultExpr?, faceAnchors?,         light?, anchors?, collide?,
 *     signatureGag?: { kind, note },                draw(g, ink, t, opts) { ... },
 *     torso(g, ink, view, p) { ... },               foreground?(g, ink, t, opts) { ... },
 *     head(g, ink, view, face, p) { ... },        };
 *     drawNeck?(g, ink, view, neck, p) { ... },
 *     arms?(p) { return { R: { hand: 'grip', front: true } }; },
 *     held?(g, ink, side, palm, p) { ... },
 *     beforeHand?(g, ink, J, view, p) { ... },
 *   };
 *
 * `p` = the shot's `props` (JSON-like values) plus `t`, the shot time: what the person carries or
 * does in this shot (the director's mug, the commander's gum). `opts` of a place = the shot's
 * place options (an alarm lit, the approach `k`); both are `{ t }` / `{}` when the shot names
 * none, so modules written for the shorter calls keep working.
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
import { HAND_KINDS, type HandKind } from '../draw/hand.js';
import type { RigJoints } from '../draw/rig-layers.js';
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
export const PERSON_FUNCTION_KEYS: readonly string[] = [
  'torso',
  'head',
  'drawNeck',
  'arms',
  'held',
  'beforeHand',
];
/** Keys of `place` that are functions. */
export const PLACE_FUNCTION_KEYS: readonly string[] = ['draw', 'foreground'];

/** A JSON-like value (shot props of a person, options of a place). */
export type InkJson = string | number | boolean | null | readonly InkJson[] | InkJsonObject;
export interface InkJsonObject {
  readonly [key: string]: InkJson;
}

const inkJson: z.ZodType<InkJson> = z.lazy(() =>
  z.union([
    z.string().max(400),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(inkJson).max(256),
    z.record(z.string().max(40), inkJson),
  ]),
);

/** Shot props / place options: an object of JSON-like values with identifier keys. */
export const inkOptionsSchema = z
  .record(z.string().regex(/^[A-Za-z_][A-Za-z0-9_]{0,39}$/, 'keys are identifiers'), inkJson)
  .refine((value) => Object.keys(value).length <= 32, 'at most 32 keys');
export type InkOptions = Readonly<Record<string, InkJson>>;

/** What a person's drawings get as `p`: the shot's props plus the shot time `t`. */
export type PersonProps = InkOptions & { readonly t: number };

/** Everything of `export const person` except its drawings. */
export const personDataSchema = z.strictObject({
  ...characterDataShape,
  id: moduleId,
  name: displayName,
});
export type PersonData = z.output<typeof personDataSchema>;

export type PersonTorso = (g: Paint2D, ink: InkTools, view: ViewIndex, p: PersonProps) => void;
export type PersonHead = (
  g: Paint2D,
  ink: InkTools,
  view: ViewIndex,
  face: FaceState,
  p: PersonProps,
) => void;
export type PersonNeck = (
  g: Paint2D,
  ink: InkTools,
  view: ViewIndex,
  neck: NeckSpec,
  p: PersonProps,
) => void;

/** Hand shape and "in front of the face" (layer 2 unless the arm is behind the body) of one arm. */
export interface ArmSetting {
  readonly hand?: HandKind | 'none' | undefined;
  readonly front?: boolean | undefined;
}
const armSettingSchema = z.strictObject({
  hand: z.enum([...HAND_KINDS, 'none']).optional(),
  front: z.boolean().optional(),
});
/** What `arms(p)` may return (undefined = the pose's hands, layers as usual). */
export const armSettingsSchema = z
  .strictObject({ L: armSettingSchema.optional(), R: armSettingSchema.optional() })
  .optional();
export type ArmSettings = z.output<typeof armSettingsSchema>;
/** `arms(p)`: per-shot hand shapes (a grip round the mug) and arms brought in front (a sip). */
export type PersonArms = (p: PersonProps) => unknown;
/** `held(g, ink, side, palm, p)`: drawn right before arm `side`, so the hand closes over it. */
export type PersonHeld = (
  g: Paint2D,
  ink: InkTools,
  side: 'L' | 'R',
  palm: readonly [number, number],
  p: PersonProps,
) => void;
/** `beforeHand(g, ink, J, view, p)`: between the head and the arms in front (a book in both hands). */
export type PersonBeforeHand = (
  g: Paint2D,
  ink: InkTools,
  J: RigJoints,
  view: ViewIndex,
  p: PersonProps,
) => void;

/** A person module (`export const person`). */
export interface PersonModule extends PersonData {
  /** Torso per view, figure space (feet at the origin). */
  readonly torso: PersonTorso;
  /** Head per view, head-local units (origin = top of the neck, +x = the way the head faces). */
  readonly head: PersonHead;
  /** Custom neck (default: the rig's skin tube). */
  readonly drawNeck?: PersonNeck;
  readonly arms?: PersonArms;
  readonly held?: PersonHeld;
  readonly beforeHand?: PersonBeforeHand;
}

export const personModuleSchema: z.ZodType<PersonModule> = personDataSchema.extend({
  torso: z.custom<PersonTorso>(isFunction, { message: 'torso must be a function (g, ink, view)' }),
  head: z.custom<PersonHead>(isFunction, {
    message: 'head must be a function (g, ink, view, face)',
  }),
  drawNeck: z
    .custom<PersonNeck>(isFunction, { message: 'drawNeck must be a function (g, ink, view, neck)' })
    .exactOptional(),
  arms: z
    .custom<PersonArms>(isFunction, { message: 'arms must be a function (p)' })
    .exactOptional(),
  held: z
    .custom<PersonHeld>(isFunction, { message: 'held must be a function (g, ink, side, palm, p)' })
    .exactOptional(),
  beforeHand: z
    .custom<PersonBeforeHand>(isFunction, {
      message: 'beforeHand must be a function (g, ink, J, view, p)',
    })
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

export type PlaceDraw = (g: Paint2D, ink: InkTools, t: number, opts: InkOptions) => void;

/** A place module (`export const place`), parsed (defaults applied). */
export interface PlaceModule extends PlaceData {
  /** The place for time t (seconds) and the shot's options, in place px; a pure function. */
  readonly draw: PlaceDraw;
  /** Drawn after the people: the front console row, door edges, smoke (optional). */
  readonly foreground?: PlaceDraw;
}

export const placeModuleSchema = placeDataSchema.extend({
  draw: z.custom<PlaceDraw>(isFunction, { message: 'draw must be a function (g, ink, t, opts)' }),
  foreground: z
    .custom<PlaceDraw>(isFunction, { message: 'foreground must be a function (g, ink, t, opts)' })
    .exactOptional(),
});

/** `path: message; ...` of a zod error (for one-line module errors). */
export function issuesText(error: z.ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.map(String).join('.') || 'module'}: ${issue.message}`)
    .join('; ');
}
