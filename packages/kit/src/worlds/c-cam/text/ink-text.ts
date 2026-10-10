/**
 * `ink.text(text, { role, x, y, size, fill, outline, align, rot })` of the Grim Ink world
 * (PLAN.md#14.18): the prototypes' `ST.label` (brushes.js) with the role's system font, drawn by
 * the kit on the stage canvas (`fillText` / `strokeText`, round joins, middle baseline, the
 * current transform), or, when the role's font is not installed, the world's CC0 ink-stroke
 * lettering at the same cap height with the outline as a wider ink ribbon under the fill. The
 * string is the first argument (the anti-slop text guard reads it). Pure function of its inputs
 * and of the machine's installed fonts.
 */
import { KitError } from '../../../errors.js';
import type { Paint2D } from '../draw/paint.js';
import { drawText, measureText, type InkLayer } from '../lettering/index.js';
import { FACES } from '../lettering/layout.js';
import { paintInkSurface } from '../lettering/paint-surface.js';
import {
  ROLE_SPECS,
  TEXT_ROLES,
  roleUsesSystemFont,
  type MeasureTarget,
  type TextRole,
} from './roles.js';

/** The canvas text calls the kit makes (the stage's raw 2D context; never handed to a scene). */
export interface TextTarget extends MeasureTarget {
  textAlign: CanvasTextAlign;
  textBaseline: CanvasTextBaseline;
  lineJoin: CanvasLineJoin;
  fillStyle: string | CanvasGradient | CanvasPattern;
  strokeStyle: string | CanvasGradient | CanvasPattern;
  lineWidth: number;
  save(): void;
  restore(): void;
  translate(x: number, y: number): void;
  rotate(angle: number): void;
  fillText(text: string, x: number, y: number): void;
  strokeText(text: string, x: number, y: number): void;
}

export type TextAlign = 'left' | 'center' | 'right';

export interface InkTextOptions {
  readonly role: TextRole;
  /** Anchor: x per `align`, y = the vertical middle of the capitals (the prototypes' 'middle'). */
  readonly x: number;
  readonly y: number;
  /** Font size in px (default: the role's: caption 46, poster 120, title 150, label 40...). */
  readonly size?: number | undefined;
  readonly fill?: string | undefined;
  /** Outline colour; `false` = none (default: the role's: ink for caption / poster / title). */
  readonly outline?: string | false | undefined;
  /** Outline width in px (default: the role's share of the size: caption 11 at 46 px). */
  readonly outlineWidth?: number | undefined;
  readonly align?: TextAlign | undefined;
  /** Rotation about the anchor, degrees. */
  readonly rot?: number | undefined;
  /** Seed of the fallback lettering's wobble (default 1). */
  readonly seed?: number | undefined;
}

export interface InkTextResult {
  /** Advance width in px of the drawn line. */
  readonly width: number;
  /** True when the CC0 lettering stood in for the role's system font. */
  readonly fallback: boolean;
}

export interface ResolvedText {
  readonly role: TextRole;
  readonly x: number;
  readonly y: number;
  readonly size: number;
  readonly fill: string;
  readonly outline: string | undefined;
  readonly outlineWidth: number;
  readonly align: TextAlign;
  readonly rot: number;
  readonly seed: number;
}

const finite = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

function fail(message: string): never {
  throw new KitError(
    'invalid-params',
    `env.ink.text(text, { role, x, y, size?, fill?, outline?, align?, rot? }): ${message}`,
  );
}

/** Checks the call and fills in the role's defaults. */
export function resolveText(text: unknown, options: unknown): ResolvedText {
  if (typeof text !== 'string') fail('the text must be a string (first argument)');
  if (typeof options !== 'object' || options === null) fail('options must be an object');
  const o = options as Partial<Record<keyof InkTextOptions, unknown>>;
  const role = o.role;
  if (typeof role !== 'string' || !(TEXT_ROLES as readonly string[]).includes(role)) {
    fail(`role must be one of ${TEXT_ROLES.join(', ')}`);
  }
  const spec = ROLE_SPECS[role as TextRole];
  if (!finite(o.x) || !finite(o.y)) fail('x and y must be finite numbers');
  const size = o.size ?? spec.size;
  if (!finite(size) || size <= 0) fail('size must be a positive number of px');
  const align = o.align ?? 'center';
  if (align !== 'left' && align !== 'center' && align !== 'right') {
    fail('align must be left, center or right');
  }
  const fill = o.fill ?? spec.fill;
  if (typeof fill !== 'string') fail('fill must be a colour string');
  const outline = o.outline === false ? undefined : (o.outline ?? spec.outline);
  if (outline !== undefined && typeof outline !== 'string')
    fail('outline must be a colour or false');
  const outlineWidth = o.outlineWidth ?? spec.outlineScale * size;
  const rot = o.rot ?? 0;
  const seed = o.seed ?? 1;
  if (!finite(outlineWidth) || !finite(rot) || !finite(seed)) {
    fail('outlineWidth, rot and seed must be finite numbers');
  }
  return {
    role: role as TextRole,
    x: o.x,
    y: o.y,
    size,
    fill,
    outline,
    outlineWidth,
    align,
    rot,
    seed,
  };
}

/** The CSS font of a role at a size: the prototype's own string. */
export function roleFont(role: TextRole, size: number): string {
  const spec = ROLE_SPECS[role];
  return `${spec.weight === '' ? '' : `${spec.weight} `}${String(size)}px ${spec.stack}`;
}

function systemText(target: TextTarget, text: string, r: ResolvedText): number {
  target.save();
  target.translate(r.x, r.y);
  if (r.rot !== 0) target.rotate((r.rot * Math.PI) / 180);
  target.font = roleFont(r.role, r.size);
  target.textAlign = r.align;
  target.textBaseline = 'middle';
  target.lineJoin = 'round';
  if (r.outline !== undefined && r.outlineWidth > 0) {
    target.strokeStyle = r.outline;
    target.lineWidth = r.outlineWidth;
    target.strokeText(text, 0, 0);
  }
  target.fillStyle = r.fill;
  target.fillText(text, 0, 0);
  const width = target.measureText(text).width;
  target.restore();
  return width;
}

/** Cap height of the fallback lettering for a role at a font size. */
export function fallbackCap(role: TextRole, size: number): number {
  return ROLE_SPECS[role].capScale * size;
}

/** Layers of the fallback: the outline as a wider ink ribbon under the fill. */
function fallbackLayers(r: ResolvedText, cap: number): InkLayer[] {
  const spec = ROLE_SPECS[r.role];
  const base = (spec.inkWeight ?? FACES[spec.face].weight) * cap;
  if (r.outline === undefined || r.outlineWidth <= 0) return [{ fill: r.fill }];
  return [{ fill: r.outline, widthScale: 1 + r.outlineWidth / base }, { fill: r.fill }];
}

function fallbackText(g: Paint2D, text: string, r: ResolvedText): number {
  const face = ROLE_SPECS[r.role].face;
  const cap = fallbackCap(r.role, r.size);
  drawText(text, paintInkSurface(g), {
    face,
    size: cap,
    x: r.x,
    y: r.y + cap / 2,
    seed: r.seed,
    align: r.align,
    rot: r.rot,
    track: ROLE_SPECS[r.role].track,
    ...(ROLE_SPECS[r.role].inkWeight === undefined
      ? {}
      : { width: (ROLE_SPECS[r.role].inkWeight ?? 0) * cap }),
    fill: r.fill,
    layers: fallbackLayers(r, cap),
  });
  return measureText(text, cap, face, ROLE_SPECS[r.role].track);
}

/**
 * Draws one line of text in a role (see the module comment); `target` is the stage's own canvas
 * context (undefined in Node and in tests: always the fallback).
 */
export function inkText(
  g: Paint2D,
  target: TextTarget | undefined,
  text: string,
  options: InkTextOptions,
): InkTextResult {
  const r = resolveText(text, options);
  if (target !== undefined && roleUsesSystemFont(target, r.role)) {
    return { width: systemText(target, text, r), fallback: false };
  }
  return { width: fallbackText(g, text, r), fallback: true };
}

/** Advance width of a line in a role, as `inkText` would draw it (wrapping captions). */
export function measureInkText(
  target: TextTarget | MeasureTarget | undefined,
  text: string,
  role: TextRole,
  size: number = ROLE_SPECS[role].size,
): number {
  if (target !== undefined && roleUsesSystemFont(target, role)) {
    const previous = target.font;
    target.font = roleFont(role, size);
    const width = target.measureText(text).width;
    target.font = previous;
    return width;
  }
  const spec = ROLE_SPECS[role];
  return measureText(text, fallbackCap(role, size), spec.face, spec.track);
}
