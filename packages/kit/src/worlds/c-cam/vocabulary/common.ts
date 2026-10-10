/**
 * Grim Ink vocabulary (PLAN.md#14.20), shared parts: the checked entry point every family uses
 * (`vocabItem`: a zod options schema, a one-line doc and its params line, a pure draw function
 * `(g, e, opts)`), the material / palette tones, wear marks, and the value every prop returns (its
 * box, named points to put hands and other things ON, an optional label spot and light). No module
 * state; every wobble comes from the seed through the hash.
 */
import { z } from 'zod';
import { KitError } from '../../../errors.js';
import { C, hash, rnd } from '../core.js';
import { brushStroke, type BrushEnv } from '../draw/brushes.js';
import type { Point2 } from '../draw/contact.js';
import { stain } from '../draw/grime.js';
import type { Paint2D } from '../draw/paint.js';

export const VOCAB_FAMILIES = ['props', 'instruments', 'crowd', 'acting', 'fx'] as const;
export type VocabFamily = (typeof VOCAB_FAMILIES)[number];

/** `reelforge kit-docs <topic>` of a family. */
export const vocabTopic = (family: VocabFamily): string => `ink-${family}`;

function issues(error: z.ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.map(String).join('.') || 'options'}: ${issue.message}`)
    .join('; ');
}

/** Parses the options of `env.ink.<family>.<name>` or throws a KitError naming the docs topic. */
export function parseOptions<S extends z.ZodType>(
  family: VocabFamily,
  name: string,
  schema: S,
  value: unknown,
): z.output<S> {
  const parsed = schema.safeParse(value ?? {});
  if (parsed.success) return parsed.data;
  throw new KitError(
    'invalid-params',
    `env.ink.${family}.${name}: ${issues(parsed.error)}; see reelforge kit-docs ${vocabTopic(family)}`,
  );
}

/** Docs of one entry: what it is (one line) and its options (`key = default (range)`, …). */
export interface VocabDoc {
  readonly doc: string;
  readonly params: string;
  /** What it returns, when that is not the common `Drawn`. */
  readonly returns?: string;
}

/** An entry that draws: `(g, e, opts)` with `e` = `cam.env` (or a figure's env). */
export interface DrawItem extends VocabDoc {
  readonly schema: z.ZodType;
  readonly draw: (g: Paint2D, e: BrushEnv, o: never) => unknown;
}

/** An entry that only computes (acting choreography, a shake offset): `(opts)`. */
export interface PureItem extends VocabDoc {
  readonly schema: z.ZodType;
  readonly run: (o: never) => unknown;
}

export type DrawFamily<T extends Readonly<Record<string, DrawItem>>> = {
  readonly [K in keyof T]: (
    g: Paint2D,
    e: BrushEnv,
    opts?: z.input<T[K]['schema']>,
  ) => ReturnType<T[K]['draw']>;
};

export type PureFamily<T extends Readonly<Record<string, PureItem>>> = {
  readonly [K in keyof T]: (opts?: z.input<T[K]['schema']>) => ReturnType<T[K]['run']>;
};

/** The scene-facing functions of drawing entries: options checked, then drawn. */
export function checkedDraws<T extends Readonly<Record<string, DrawItem>>>(
  family: VocabFamily,
  items: T,
): DrawFamily<T> {
  const out: Record<string, unknown> = {};
  for (const [name, item] of Object.entries(items)) {
    out[name] = (g: Paint2D, e: BrushEnv, opts?: unknown): unknown =>
      item.draw(g, e, parseOptions(family, name, item.schema, opts) as never);
  }
  return Object.freeze(out) as unknown as DrawFamily<T>;
}

/** The scene-facing functions of computing entries: options checked, then run. */
export function checkedRuns<T extends Readonly<Record<string, PureItem>>>(
  family: VocabFamily,
  items: T,
): PureFamily<T> {
  const out: Record<string, unknown> = {};
  for (const [name, item] of Object.entries(items)) {
    out[name] = (opts?: unknown): unknown =>
      item.run(parseOptions(family, name, item.schema, opts) as never);
  }
  return Object.freeze(out) as unknown as PureFamily<T>;
}

// ---- options shared by many entries ----

export const coord = z.number().min(-1e5).max(1e5);
export const seedSchema = z.number().int().min(0).max(1e6);
/** Grime 0 (new) .. 1 (filthy, chipped). */
export const wearSchema = z.number().min(0).max(1).default(0.3);
export const sizeSchema = z.number().min(0.1).max(8).default(1);
export const rotSchema = z.number().min(-720).max(720).default(0);
export const timeSchema = z.number().min(-1e4).max(1e4).default(0);
export const unit = z.number().min(0).max(1);

/** Wood, metal, cloth and the like: `[fill, shade]` pairs in the palette's muddy range. */
export const MATERIALS = {
  wood: ['#4e3b2b', '#36281d'],
  paleWood: ['#7a5c3e', '#57402b'],
  iron: ['#3b3a36', '#26241f'],
  steel: ['#77786f', '#53544c'],
  brass: [C.GOLD, C.GOLD_D],
  straw: ['#a08a52', '#7a6838'],
  paper: ['#b1a888', '#8f8566'],
  cloth: [C.LINEN, C.LINEN_D],
  leather: ['#6c4a30', '#4a3220'],
  stone: [C.STONE, C.STONE_D],
  clay: ['#8a4a32', '#663523'],
  glass: ['#6f8079', '#4e5c57'],
  paint: ['#5c6650', '#424a39'],
} as const satisfies Readonly<Record<string, readonly [string, string]>>;

export type Material = keyof typeof MATERIALS;

const SHADED = Object.keys(C).filter((k) => !k.endsWith('_D') && `${k}_D` in C);
const TONE_NAMES = [...Object.keys(MATERIALS), ...SHADED] as [string, ...string[]];

/** A material name or a palette token that has a `_D` shade (`CLAY`, `OLIVE`, `RUST`, …). */
export const toneSchema = z.enum(TONE_NAMES);
export type ToneName = z.infer<typeof toneSchema>;
export const TONES: readonly string[] = TONE_NAMES;

/** `[fill, shade]` of a tone name. */
export function toneOf(name: string): readonly [fill: string, shade: string] {
  const material = (MATERIALS as Readonly<Record<string, readonly [string, string]>>)[name];
  if (material) return material;
  const palette = C as Readonly<Record<string, string>>;
  return [palette[name] ?? C.STONE, palette[`${name}_D`] ?? C.STONE_D];
}

// ---- results ----

/** Where to letter a word ON the thing: call `env.ink.drawText(text, { …spot, face, seed, fill })`. */
export interface LabelSpot {
  readonly x: number;
  /** Baseline of a centred word of cap height `size`. */
  readonly y: number;
  readonly size: number;
  readonly rot: number;
  readonly align: 'center';
  /** Width (px) the word should fit: shrink `size` for a long word. */
  readonly fit: number;
}

/** The label spot of a word centred on (x, cy): spread it into `drawText` (y is the baseline). */
export function spot(x: number, cy: number, size: number, fit: number, rot = 0): LabelSpot {
  return { x, y: cy + size / 2, size, rot, align: 'center', fit };
}

/** A warm light the scene draws BEHIND people: `env.ink.pool(g, x, y, rx, ry, color, alpha)`. */
export interface LightSpec {
  readonly x: number;
  readonly y: number;
  readonly rx: number;
  readonly ry: number;
  readonly color: string;
  readonly alpha: number;
}

/** What a prop or instrument returns. */
export interface Drawn {
  /** World box `[x0, y0, x1, y1]`. */
  readonly box: readonly [number, number, number, number];
  /** Named points (grip, tip, top, mouth, handle…) to put a palm or another thing ON. */
  readonly points: Readonly<Record<string, Point2>>;
  readonly label?: LabelSpot;
  readonly labels?: readonly LabelSpot[];
  readonly light?: LightSpec;
}

/** Rotates local point (lx, ly) by deg about the origin and adds (x, y). */
export function place(x: number, y: number, deg: number, lx: number, ly: number): Point2 {
  const a = (deg * Math.PI) / 180;
  return [x + lx * Math.cos(a) - ly * Math.sin(a), y + lx * Math.sin(a) + ly * Math.cos(a)];
}

/** Axis box of points after the same transform. */
export function boxOf(pts: readonly Point2[]): Drawn['box'] {
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}

/** Draws `body` in a local frame at (x, y) rotated by deg and scaled by k. */
export function local(
  g: Paint2D,
  x: number,
  y: number,
  deg: number,
  k: number,
  body: () => void,
): void {
  g.save();
  g.translate(x, y);
  if (deg) g.rotate((deg * Math.PI) / 180);
  if (k !== 1) g.scale(k, k);
  body();
  g.restore();
}

/** Grime on a rectangle (local or world px): stains, scratches and chips by `wear` 0..1. */
export function wearMarks(
  g: Paint2D,
  e: BrushEnv,
  box: readonly [number, number, number, number],
  wear: number,
  seed: number,
): void {
  if (wear <= 0.05) return;
  const [x0, y0, x1, y1] = box;
  const w = x1 - x0;
  const h = y1 - y0;
  // Marks keep a hand size (a stain is never bigger than a few hand spans); big surfaces get more.
  const spread = Math.min(4, Math.max(1, (w * h) / (420 * 420)));
  const n = Math.round(wear * 4 * spread);
  for (let i = 0; i < n; i += 1) {
    const sx = x0 + w * rnd(0.15, 0.85, seed, i, 1);
    const sy = y0 + h * rnd(0.2, 0.8, seed, i, 2);
    const sw = Math.min(w * rnd(0.12, 0.3, seed, i, 3), rnd(70, 180, seed, i, 9));
    const sh = Math.min(h * rnd(0.1, 0.25, seed, i, 4), rnd(40, 110, seed, i, 10));
    stain(g, e, sx, sy, sw, sh, seed + i);
  }
  for (let i = 0; i < Math.round(wear * 5 * spread); i += 1) {
    const sx = x0 + w * hash(seed, i, 5);
    const sy = y0 + h * hash(seed, i, 6);
    const len = Math.min(Math.min(w, h) * rnd(0.1, 0.3, seed, i, 7), 90);
    brushStroke(g, e, [sx, sy, sx + len, sy + len * rnd(-0.4, 0.4, seed, i, 8)], {
      w: 2.5,
      color: 'rgba(22,18,14,0.55)',
      seed: seed + 20 + i,
      taper: false,
    });
  }
}
