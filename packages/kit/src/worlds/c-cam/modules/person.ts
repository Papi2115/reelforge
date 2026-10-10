/**
 * Project people of the Grim Ink world (PLAN.md#14.8): `definePerson` checks a person module
 * (contract.ts) and turns it into the rig's `Character` plus the handle scenes call as
 * `kit.people.<id>`: `draw(g, env, { x, y, s, view, pose, expr, t, ... })` draws the person through
 * the rig (`drawFigure`, the fixed figure order); `pose(name, ph, over)` resolves a library pose for
 * the person's own dimensions `D`.
 */
import { KitError } from '../../../errors.js';
import { DEFAULT_ENV, type BrushEnv } from '../draw/brushes.js';
import type { Character, NeckSpec } from '../draw/character.js';
import type { FaceState } from '../draw/face.js';
import {
  drawFigure,
  type BodyPlacement,
  type DrawFigureOptions,
  type FigureView,
} from '../draw/figure.js';
import type { Paint2D } from '../draw/paint.js';
import { POSE_NAMES, pose as libraryPose, type Pose, type PoseName } from '../draw/poses.js';
import type { RigJoints } from '../draw/rig-layers.js';
import { VIEWS, type View, type ViewIndex } from '../draw/rig-views.js';
import { issuesText, personModuleSchema, type PersonModule } from './contract.js';
import { inkTools, type InkTools } from './ink-tools.js';
import { paintPersonSheet } from './sheet.js';

/** Hooks of `draw` get the ink toolbox (people modules have no imports). */
export type PersonHook = (J: RigJoints, ink: InkTools) => void;

/** Everything `draw` takes besides g and env; all optional. */
export interface PersonDrawOptions
  extends Partial<BodyPlacement>, Omit<DrawFigureOptions, 'beforeHand' | 'after'> {
  /** View name or signed ring yaw (-3..3, negative = facing screen-left); default `front`. */
  readonly view?: FigureView;
  /** Pose name (default `stand`) or a pose from `person.pose(name, ph, over)`. */
  readonly pose?: PoseName | Pose;
  /** Phase of a cyclic pose (`walk`, `jig`...) or the pointing side for `point`. */
  readonly ph?: number;
  /** Expression (default the person's `defaultExpr`, else `deadpan`). */
  readonly expr?: string;
  /** Shot time for blinks and talk (default `env.t`, else 0). */
  readonly t?: number;
  /** Drawn under the near hand (props held in the hand). */
  readonly beforeHand?: PersonHook;
  /** Drawn over everything (things over the hands). */
  readonly after?: PersonHook;
}

/** A stage env (`t`) or a camera env (`zoom`, `lw`); without a zoom the ink width is zoom 1's. */
export interface ZoomEnv {
  readonly zoom?: unknown;
  readonly lw?: unknown;
  readonly t?: unknown;
}

/** `kit.people.<id>`. */
export interface InkPerson {
  readonly kind: 'person';
  readonly id: string;
  readonly name: string;
  /** Project-relative module path (messages). */
  readonly file: string;
  /** Rig dimensions (poses, contacts). */
  readonly D: Character['D'];
  /** The rig's character record (validators, contact helpers). */
  readonly character: Character;
  /** A library pose for this person's dimensions (`stand`, `akimbo`, `walk`...). */
  pose(name: PoseName, ph?: number, over?: Partial<Pose>): Pose;
  /** Draws the person (feet at x, y); returns the solved joints (figure space). */
  draw(g: Paint2D, env: ZoomEnv | undefined, opts?: PersonDrawOptions): RigJoints;
  /** Contact-sheet page (0 the six views x stand/akimbo/walk, 1 the 14 faces) on a 1920x1080 stage. */
  sheet(g: Paint2D, page: number): void;
}

/** The brush env of a stage / camera env (zoom 1 without one). */
export function brushEnvOf(env: ZoomEnv | undefined): BrushEnv {
  const zoom = env?.zoom;
  const lw = env?.lw;
  return typeof zoom === 'number' && typeof lw === 'number' ? { zoom, lw } : DEFAULT_ENV;
}

function isView(view: unknown): view is View {
  return typeof view === 'string' && (VIEWS as readonly string[]).includes(view);
}

function checkView(view: unknown, label: string): FigureView {
  if (typeof view === 'number' && Number.isInteger(view) && Math.abs(view) <= 3) return view;
  if (isView(view)) return view;
  throw new KitError(
    'invalid-params',
    `${label}: view must be one of ${VIEWS.join(', ')} or a ring yaw -3..3 (negative = facing screen-left), got ${JSON.stringify(view)}`,
  );
}

function isPoseName(name: string): name is PoseName {
  return (POSE_NAMES as readonly string[]).includes(name);
}

function isPose(value: unknown): value is Pose {
  return typeof value === 'object' && value !== null && 'hL' in value && 'fL' in value;
}

function resolvePose(character: Character, value: unknown, ph: number, label: string): Pose {
  if (typeof value === 'string' && isPoseName(value)) return libraryPose(value, character.D, ph);
  if (isPose(value)) return value;
  throw new KitError(
    'invalid-params',
    `${label}: pose must be a pose name (${POSE_NAMES.join(', ')}) or person.pose(name, ph, over), got ${JSON.stringify(value)}`,
  );
}

/** The rig character of a checked module: its drawings get the ink toolbox. */
function characterOf(module: PersonModule): Character {
  const { torso, head, drawNeck, ...data } = module;
  const neck =
    drawNeck === undefined
      ? {}
      : {
          drawNeck: (g: Paint2D, env: BrushEnv, view: ViewIndex, spec: NeckSpec) => {
            drawNeck(g, inkTools(g, env), view, spec);
          },
        };
  return Object.freeze({
    ...data,
    torso: (g: Paint2D, env: BrushEnv, view: ViewIndex) => {
      torso(g, inkTools(g, env), view);
    },
    head: (g: Paint2D, env: BrushEnv, view: ViewIndex, face: FaceState) => {
      head(g, inkTools(g, env), view, face);
    },
    ...neck,
  });
}

function figureOptions(g: Paint2D, opts: PersonDrawOptions): DrawFigureOptions {
  const { headYaw, headDy, layer, talk, look, beforeHand, after } = opts;
  return {
    ...(headYaw === undefined ? {} : { headYaw }),
    ...(headDy === undefined ? {} : { headDy }),
    ...(layer === undefined ? {} : { layer }),
    ...(talk === undefined ? {} : { talk }),
    ...(look === undefined ? {} : { look }),
    ...(beforeHand === undefined
      ? {}
      : {
          beforeHand: (J: RigJoints, env: BrushEnv) => {
            beforeHand(J, inkTools(g, env));
          },
        }),
    ...(after === undefined
      ? {}
      : {
          after: (J: RigJoints, env: BrushEnv) => {
            after(J, inkTools(g, env));
          },
        }),
  };
}

function timeOf(env: ZoomEnv | undefined, opts: PersonDrawOptions, label: string): number {
  const t = opts.t ?? (typeof env?.t === 'number' ? env.t : 0);
  if (!Number.isFinite(t)) {
    throw new KitError('invalid-params', `${label}: t must be a finite time in seconds`);
  }
  return t;
}

function placementOf(opts: PersonDrawOptions): BodyPlacement {
  return {
    x: opts.x ?? 0,
    y: opts.y ?? 0,
    s: opts.s ?? 1,
    ...(opts.lean === undefined ? {} : { lean: opts.lean }),
    ...(opts.bow === undefined ? {} : { bow: opts.bow }),
  };
}

/** Checks a person module value and builds its handle (throws an `invalid-extension` KitError). */
export function definePerson(value: unknown, file = 'person'): InkPerson {
  const parsed = personModuleSchema.safeParse(value);
  if (!parsed.success) {
    throw new KitError(
      'invalid-extension',
      `${file}: \`export const person\` is invalid (${issuesText(parsed.error)}); see reelforge kit-docs people`,
    );
  }
  const character = characterOf(parsed.data);
  const label = `kit.people.${character.id}`;
  return Object.freeze({
    kind: 'person' as const,
    id: character.id,
    name: character.name,
    file,
    D: character.D,
    character,
    pose: (name: PoseName, ph = 0, over: Partial<Pose> = {}): Pose => ({
      ...resolvePose(character, name, ph, `${label}.pose`),
      ...over,
    }),
    draw(g: Paint2D, env: ZoomEnv | undefined, opts: PersonDrawOptions = {}): RigJoints {
      const where = `${label}.draw`;
      const t = timeOf(env, opts, where);
      const P = resolvePose(character, opts.pose ?? 'stand', opts.ph ?? 0, where);
      const V = checkView(opts.view ?? 'front', where);
      const at = placementOf(opts);
      return drawFigure(
        g,
        brushEnvOf(env),
        character,
        at,
        P,
        V,
        opts.expr,
        t,
        figureOptions(g, opts),
      );
    },
    sheet: (g: Paint2D, page: number): void => {
      paintPersonSheet(g, character, page);
    },
  });
}

/** A person module namespace (`{ person }`) as a handle; throws `invalid-extension`. */
export function personFromModule(namespace: unknown, file: string): InkPerson {
  const value: unknown =
    typeof namespace === 'object' && namespace !== null
      ? (namespace as Record<string, unknown>)['person']
      : undefined;
  if (typeof value !== 'object' || value === null) {
    throw new KitError(
      'invalid-extension',
      `${file}: missing \`export const person = { id, name, D, neck, headScale, seed, tones, arm, leg, torso(g, ink, view), head(g, ink, view, face) }\``,
    );
  }
  return definePerson(value, file);
}
