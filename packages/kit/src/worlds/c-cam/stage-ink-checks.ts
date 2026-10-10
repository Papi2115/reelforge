/**
 * Checked entry points of `env.ink` (stage-ink.ts, PLAN.md#14.12): the scene-facing wrappers that
 * turn a drifted call into a KitError naming the fix (a cut table out of range, an unknown pose,
 * expression or lettering face) and accept a project person handle (`kit.people.<id>`) wherever
 * the rig wants its character record. The kit's draw functions themselves stay unchecked (they
 * are also called by the kit's own code, frame after frame).
 */
import { KitError } from '../../errors.js';
import type { BrushEnv } from './draw/brushes.js';
import type { Character } from './draw/character.js';
import { coverage, type CoverageIssue, type SetBounds } from './draw/camera-coverage.js';
import { cutTableSchema, type Cut } from './draw/camera-schema.js';
import { resolveCut, type CameraClock, type ResolvedCut } from './draw/camera.js';
import { anchorWorld, anchors, type AnchorName, type AnchorOptions } from './draw/anchors.js';
import type { Placement, Point2 } from './draw/contact.js';
import { EXPR_NAMES, exprAt, isExprName, type ExprCue, type ExprName } from './draw/face.js';
import {
  drawFigure,
  type BodyPlacement,
  type DrawFigureOptions,
  type FigureView,
} from './draw/figure.js';
import type { Paint2D } from './draw/paint.js';
import { POSE_NAMES, pose, type BodyDims, type Pose, type PoseName } from './draw/poses.js';
import type { RigJoints } from './draw/rig-layers.js';
import { drawText, type DrawOptions, type LaidText } from './lettering/index.js';
import { FACE_NAMES, type FaceName, type InkSurface } from './lettering/types.js';
import { issuesText } from './modules/contract.js';
import type { InkPerson } from './modules/person.js';

/** A rig character record or a project person handle (`kit.people.<id>`). */
export type CharacterLike = Character | InkPerson;

/** A placed figure whose character may be a person handle. */
export interface PlacedFigureLike {
  readonly character: CharacterLike;
  readonly placement: Placement;
  readonly pose: Pose;
}

function isPerson(value: CharacterLike): value is InkPerson {
  return (value as { readonly kind?: unknown }).kind === 'person';
}

/** The rig record of a character or of a person handle. */
export function recordOf(value: CharacterLike): Character {
  if (typeof value !== 'object' || (value as unknown) === null) {
    throw new KitError(
      'invalid-params',
      'env.ink: character must be a person (ctx.kit.people.<id>) or its .character record',
    );
  }
  return isPerson(value) ? value.character : value;
}

function figureOf(fig: PlacedFigureLike): PlacedFigureLike & { readonly character: Character } {
  return { ...fig, character: recordOf(fig.character) };
}

/** A cut table checked against the schema (zoom, roll, ascending `at`, moves with an `end`). */
export function checkedCuts(cuts: unknown, label: string): readonly Cut[] {
  const parsed = cutTableSchema.safeParse(cuts);
  if (parsed.success) return parsed.data;
  throw new KitError(
    'invalid-params',
    `env.ink.${label}: invalid cut table (${issuesText(parsed.error)}); see reelforge kit-docs ink-camera`,
  );
}

const isPoseName = (name: unknown): name is PoseName =>
  typeof name === 'string' && (POSE_NAMES as readonly string[]).includes(name);

const isFace = (name: unknown): name is FaceName =>
  typeof name === 'string' && (FACE_NAMES as readonly string[]).includes(name);

function checkExpr(name: unknown): ExprName {
  if (typeof name === 'string' && isExprName(name)) return name;
  throw new KitError(
    'invalid-params',
    `env.ink.exprAt: unknown expression ${JSON.stringify(name)}; one of ${EXPR_NAMES.join(', ')}`,
  );
}

function finite(value: unknown): boolean {
  return typeof value === 'number' && Number.isFinite(value);
}

function checkTextOptions(text: unknown, options: unknown): void {
  const where = 'env.ink.drawText(text, { face, size, x, y, seed, fill, … })';
  if (typeof text !== 'string') {
    throw new KitError('invalid-params', `${where}: the text must be a string (first argument)`);
  }
  if (typeof options !== 'object' || options === null) {
    throw new KitError('invalid-params', `${where}: options must be an object`);
  }
  const o = options as Readonly<Record<string, unknown>>;
  if (!isFace(o['face'])) {
    throw new KitError('invalid-params', `${where}: face must be one of ${FACE_NAMES.join(', ')}`);
  }
  for (const key of ['size', 'x', 'y', 'seed']) {
    if (!finite(o[key])) {
      throw new KitError('invalid-params', `${where}: ${key} must be a finite number`);
    }
  }
  if (typeof o['fill'] !== 'string') {
    throw new KitError('invalid-params', `${where}: fill must be a colour (e.g. env.C.INK)`);
  }
}

/** The scene-facing wrappers (`g`-free; drawText gets its surface from the stage). */
export const CHECKED = Object.freeze({
  resolveCut: (cuts: readonly Cut[], t: number, clock?: CameraClock): ResolvedCut =>
    resolveCut(checkedCuts(cuts, 'resolveCut'), t, clock),
  coverage: (cuts: readonly Cut[], setBounds?: SetBounds): CoverageIssue[] =>
    coverage(checkedCuts(cuts, 'coverage'), setBounds),
  pose: (name: PoseName, D: BodyDims, ph?: number, over?: Partial<Pose>): Pose => {
    if (!isPoseName(name)) {
      throw new KitError(
        'invalid-params',
        `env.ink.pose: unknown pose ${JSON.stringify(name)}; one of ${POSE_NAMES.join(', ')}`,
      );
    }
    return pose(name, D, ph, over);
  },
  exprAt: (cues: readonly ExprCue[], t: number): ExprName => {
    for (const cue of cues) checkExpr(cue[1]);
    return exprAt(cues, t);
  },
  drawFigure: (
    g: Paint2D,
    env: BrushEnv,
    character: CharacterLike,
    placement: BodyPlacement,
    figurePose: Pose,
    view: FigureView,
    expr: string | undefined,
    t: number,
    opts?: DrawFigureOptions,
  ): RigJoints =>
    drawFigure(g, env, recordOf(character), placement, figurePose, view, expr, t, opts),
  anchors: (
    character: CharacterLike,
    view: FigureView,
    figurePose: Pose,
    opts?: AnchorOptions,
  ): ReturnType<typeof anchors> => anchors(recordOf(character), view, figurePose, opts),
  anchorWorld: (fig: PlacedFigureLike, name: AnchorName, opts?: AnchorOptions): Point2 | null =>
    anchorWorld(figureOf(fig), name, opts),
});

/** `env.ink.drawText(text, options)` bound to a frame's surface. */
export function boundDrawText(
  surface: InkSurface,
): (text: string, options: DrawOptions) => LaidText {
  return (text, options) => {
    checkTextOptions(text, options);
    return drawText(text, surface, options);
  };
}
