/**
 * Project places of the Grim Ink world (PLAN.md#14.8): `definePlace` checks a place module
 * (contract.ts) and builds the handle scenes call as `kit.places.<id>`: `draw(g, env, t, opts)`
 * paints the place in its own px (then its light pool, unless `{ light: false }`); every other key
 * of `opts` (JSON-like: `{ alarm: true, k: 0.4 }`) reaches the module's `draw(g, ink, t, opts)`.
 * `foreground(g, env, t, opts)` paints what stands in front of the people (the module's optional
 * `foreground`; nothing without one). `anchor(name)` returns a named point, `bounds`, `light`
 * and `collide` are the module's data. The contact sheet shows place, light and foreground.
 */
import { KitError } from '../../../errors.js';
import type { BrushEnv } from '../draw/brushes.js';
import type { Paint2D } from '../draw/paint.js';
import { pool } from '../draw/scenery.js';
import {
  inkOptionsSchema,
  issuesText,
  placeModuleSchema,
  type InkOptions,
  type PlaceBox,
  type PlaceDraw,
  type PlaceLight,
} from './contract.js';
import { inkTools } from './ink-tools.js';
import { brushEnvOf, type ZoomEnv } from './person.js';
import { paintPlaceSheet } from './sheet.js';

/** The shot's options of a place: `light` (default true) plus the module's own keys. */
export type PlaceDrawOptions = InkOptions & {
  /** Draw the light pool after the place (default true). */
  readonly light?: boolean;
};

/** `kit.places.<id>`. */
export interface InkPlace {
  readonly kind: 'place';
  readonly id: string;
  readonly name: string;
  /** Project-relative module path (messages). */
  readonly file: string;
  /** `[w, h]` in place px. */
  readonly bounds: readonly [number, number];
  readonly light: PlaceLight | undefined;
  readonly anchors: Readonly<Record<string, readonly [number, number]>>;
  readonly collide: readonly PlaceBox[];
  /** A named point `[x, y]` (throws listing the names when unknown). */
  anchor(name: string): readonly [number, number];
  /** The module draws a foreground (things in front of the people). */
  readonly hasForeground: boolean;
  /** Paints the place for time t (seconds) in place px with the current transform of g. */
  draw(g: Paint2D, env: ZoomEnv | undefined, t: number, opts?: PlaceDrawOptions): void;
  /** Paints the foreground (after the people), same transform and options; no-op without one. */
  foreground(g: Paint2D, env: ZoomEnv | undefined, t: number, opts?: InkOptions): void;
  /** Contact-sheet page (0 wide, 1 medium, 2 close) on a 1920x1080 stage. */
  sheet(g: Paint2D, page: number): void;
}

/** Checks a place module value and builds its handle (throws an `invalid-extension` KitError). */
export function definePlace(value: unknown, file = 'place'): InkPlace {
  const parsed = placeModuleSchema.safeParse(value);
  if (!parsed.success) {
    throw new KitError(
      'invalid-extension',
      `${file}: \`export const place\` is invalid (${issuesText(parsed.error)}); see reelforge kit-docs places`,
    );
  }
  const { draw: paint, foreground: front, ...data } = parsed.data;
  const label = `kit.places.${data.id}`;
  const anchors = Object.freeze({ ...data.anchors });
  const NONE: InkOptions = Object.freeze({});
  const paintAt = (g: Paint2D, env: BrushEnv, t: number, light: boolean, opts: InkOptions) => {
    paint(g, inkTools(g, env), t, opts);
    if (data.light && light) {
      pool(
        g,
        data.light.x,
        data.light.y,
        data.light.rx,
        data.light.ry,
        data.light.color,
        data.light.alpha,
      );
    }
  };
  return Object.freeze({
    kind: 'place' as const,
    id: data.id,
    name: data.name,
    file,
    bounds: data.bounds,
    light: data.light,
    anchors,
    collide: Object.freeze([...data.collide]),
    sheet(g: Paint2D, page: number): void {
      const sheetPlace = {
        bounds: data.bounds,
        light: data.light,
        anchors,
        draw: (inner: Paint2D, env: BrushEnv, t: number) => {
          paintAt(inner, env, t, true, NONE);
          if (front) front(inner, inkTools(inner, env), t, NONE);
        },
      };
      paintPlaceSheet(g, sheetPlace, page);
    },
    anchor(name: string): readonly [number, number] {
      const point = Object.hasOwn(anchors, name) ? anchors[name] : undefined;
      if (point !== undefined) return point;
      const names = Object.keys(anchors);
      throw new KitError(
        'invalid-anchor',
        `${label}.anchor("${name}"): no such anchor; ${names.length > 0 ? `defined: ${names.join(', ')}` : 'the place defines no anchors'}`,
      );
    },
    hasForeground: front !== undefined,
    draw(g: Paint2D, env: ZoomEnv | undefined, t: number, opts: PlaceDrawOptions = NONE): void {
      const { light, ...rest } = checked(`${label}.draw`, t, opts);
      paintAt(g, brushEnvOf(env), t, light !== false, Object.freeze(rest));
    },
    foreground(g: Paint2D, env: ZoomEnv | undefined, t: number, opts: InkOptions = NONE): void {
      const checkedOpts = checked(`${label}.foreground`, t, opts);
      if (front) drawWith(front, g, env, t, checkedOpts);
    },
  });
}

/** t finite and opts JSON-like, else an `invalid-params` KitError. */
function checked(where: string, t: number, opts: unknown): PlaceDrawOptions {
  if (!Number.isFinite(t)) {
    throw new KitError('invalid-params', `${where}: t must be a finite time in seconds`);
  }
  const parsed = inkOptionsSchema.safeParse(opts);
  if (!parsed.success) {
    throw new KitError(
      'invalid-params',
      `${where}: opts must be an object of plain values (numbers, strings, booleans, lists): ${issuesText(parsed.error)}`,
    );
  }
  const light = parsed.data['light'];
  if (light !== undefined && typeof light !== 'boolean') {
    throw new KitError('invalid-params', `${where}: opts.light must be true or false`);
  }
  return parsed.data;
}

function drawWith(
  paint: PlaceDraw,
  g: Paint2D,
  env: ZoomEnv | undefined,
  t: number,
  opts: InkOptions,
): void {
  const brush = brushEnvOf(env);
  paint(g, inkTools(g, brush), t, Object.freeze({ ...opts }));
}

/** A place module namespace (`{ place }`) as a handle; throws `invalid-extension`. */
export function placeFromModule(namespace: unknown, file: string): InkPlace {
  const value: unknown =
    typeof namespace === 'object' && namespace !== null
      ? (namespace as Record<string, unknown>)['place']
      : undefined;
  if (typeof value !== 'object' || value === null) {
    throw new KitError(
      'invalid-extension',
      `${file}: missing \`export const place = { id, name, bounds: [w, h], light, anchors, collide, draw(g, ink, t, opts), foreground?(g, ink, t, opts) }\``,
    );
  }
  return definePlace(value, file);
}
