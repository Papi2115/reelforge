/**
 * The closed word lists of the Grim Ink (c-cam) drawing API, read from the modules that define
 * them, for the docs the runtime Claude reads (`reelforge kit-docs ink-*`, PLAN.md#14.10): views,
 * poses, expressions, hand kinds, cut eases, camera ranges, lettering faces and palette names. Data
 * only; the functions stay in their modules.
 */
import { C } from './core.js';
import { CUT_EASES, ROT_MAX, ZOOM_MAX, ZOOM_MIN } from './draw/camera-schema.js';
import { EXPR_NAMES } from './draw/face.js';
import { HAND_KINDS } from './draw/hand.js';
import { POSE_NAMES } from './draw/poses.js';
import { VIEWS } from './draw/rig-views.js';
import { FACE_NAMES } from './lettering/types.js';

export interface CCamVocabulary {
  readonly views: readonly string[];
  readonly poses: readonly string[];
  readonly expressions: readonly string[];
  readonly hands: readonly string[];
  readonly cutEases: readonly string[];
  readonly zoom: readonly [min: number, max: number];
  readonly maxRoll: number;
  readonly letterFaces: readonly string[];
  readonly palette: readonly string[];
}

export const C_CAM_VOCABULARY: CCamVocabulary = Object.freeze({
  views: VIEWS,
  poses: POSE_NAMES,
  expressions: EXPR_NAMES,
  hands: HAND_KINDS,
  cutEases: CUT_EASES,
  zoom: Object.freeze([ZOOM_MIN, ZOOM_MAX] as const),
  maxRoll: ROT_MAX,
  letterFaces: FACE_NAMES,
  palette: Object.freeze(Object.keys(C)),
});
