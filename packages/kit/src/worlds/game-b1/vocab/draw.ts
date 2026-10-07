/**
 * Drawing the film's vocabulary inside the TV (the painter's `g.draw`, `g.field`, `g.ball`,
 * `g.missile`, `g.box`, `g.counter`), with the 2600 rules intact: a vocabulary sprite is one
 * player (its NUSIZ copies are the same player, so they count once on a scanline), the playfield
 * scrolls in whole 4-unit blocks, balls and missiles are 1 / 2 / 4 / 8 units wide, and an
 * in-picture counter must say what real number it counts.
 */
import { KitError } from '../../../errors.js';
import type { TvPainter } from '../tv/painter.js';
import { BLOCK, blockRuns, type B1Playfield } from './playfield.js';
import type { B1Sprite } from './sprite.js';

export interface VocabLookup {
  sprite(id: string): B1Sprite;
  playfield(id: string): B1Playfield;
}

export interface DrawOptions {
  /** A fixed frame (otherwise the sprite animates at its fps with the painter's t). */
  readonly frame?: number;
  /** One-shot: plays the frames once from `at` (nothing before, nothing after). */
  readonly at?: number;
  /** Frame offset: two deer of one herd never step together. */
  readonly phase?: number;
  readonly face?: 'left' | 'right';
  readonly squash?: number;
  readonly flicker?: boolean;
  readonly playfield?: boolean;
  /** The whole sprite in one ink (a hit flash, a silhouette). */
  readonly colour?: string;
  /** NUSIZ stretch override (a boss swelling). */
  readonly size?: 1 | 2 | 4;
}

function fail(message: string): never {
  throw new KitError('invalid-params', `kit.fx.b1Screen() tv painter: ${message}`);
}

/** The frame index at t, or undefined when a one-shot is not playing. */
export function frameAt(s: B1Sprite, t: number, o: DrawOptions): number | undefined {
  const n = s.frames.length;
  if (o.frame !== undefined) {
    if (!Number.isInteger(o.frame) || o.frame < 0 || o.frame >= n)
      fail(`draw("${s.id}"): frame ${String(o.frame)} (it has ${String(n)}: 0-${String(n - 1)})`);
    return o.frame;
  }
  if (o.at !== undefined) {
    const k = Math.floor((t - o.at) * s.fps + 1e-6);
    return k >= 0 && k < n ? k : undefined;
  }
  return (((Math.floor(t * s.fps + 1e-6) + (o.phase ?? 0)) % n) + n) % n;
}

export function drawSprite(
  g: TvPainter,
  v: VocabLookup,
  id: string,
  x: number,
  y: number,
  o: DrawOptions,
): void {
  const s = v.sprite(id);
  const f = frameAt(s, g.t, o);
  if (f === undefined) return;
  const rows = s.frames[f] ?? [];
  g.sprite(rows, o.colour ?? s.colours, Math.round(x), Math.round(y), {
    stretch: o.size ?? s.size,
    rowH: s.rowH,
    flip: o.face !== undefined && o.face !== s.faces,
    ...(o.squash === undefined ? {} : { squash: o.squash }),
    ...(o.flicker === undefined ? {} : { flicker: o.flicker }),
    ...(o.playfield === undefined ? {} : { playfield: o.playfield }),
    copies: s.copies,
  });
}

/** The sprite's box in TV units at x, y (all its copies), for visual collisions. */
export function spriteBox(v: VocabLookup, id: string, x: number, y: number, size?: 1 | 2 | 4) {
  const s = v.sprite(id);
  const w = s.width * (size ?? s.size) + (s.copies[s.copies.length - 1] ?? 0);
  return { x, y, w, h: s.height * s.rowH };
}

export interface FieldOptions {
  /** Whole 4-unit blocks the line is rotated left by (coarse scroll). */
  readonly shift?: number;
  /** Every row in one ink (the colour register rewritten: a bleach, a flash). */
  readonly colour?: string;
  /** Only rows [from, to) (a reveal, a line-by-line change). */
  readonly rows?: readonly [number, number];
}

export function drawField(
  g: TvPainter,
  v: VocabLookup,
  id: string,
  y: number,
  o: FieldOptions = {},
): number {
  const f = v.playfield(id);
  const [from, to] = o.rows ?? [0, f.lines.length];
  let top = y;
  f.lines.forEach((line, i) => {
    const h = f.heights[i] ?? 1;
    const name = o.colour ?? f.colours[i];
    if (name !== null && name !== undefined && i >= from && i < to)
      for (const [start, len] of blockRuns(line, o.shift ?? 0))
        g.rect(start * BLOCK, top, len * BLOCK, h, name);
    top += h;
  });
  return f.height;
}

const OBJECT_WIDTHS = [1, 2, 4, 8];

/** A ball or a missile: 1, 2, 4 or 8 units wide, any height, one ink; outside the player limit. */
export function drawObject(
  g: TvPainter,
  what: 'ball' | 'missile',
  x: number,
  y: number,
  o: { readonly w?: number; readonly h?: number; readonly colour: string },
): void {
  const w = o.w ?? 1;
  if (!OBJECT_WIDTHS.includes(w))
    fail(`${what}: w ${String(w)}; a 2600 ${what} is 1, 2, 4 or 8 units wide`);
  g.rect(Math.round(x), Math.round(y), w, o.h ?? 2, o.colour);
}

const GENERIC = [
  'score',
  'points',
  'counter',
  'number',
  'value',
  'total',
  'count',
  'stuff',
  'things',
];

export interface CounterSpec {
  /** What real number of the narration it counts ("trees felled since 1990"). */
  readonly means: string;
  readonly keys: readonly (readonly [number, number])[];
  readonly x: number;
  readonly y: number;
  readonly colour: string;
  readonly digits?: number;
  readonly cell?: readonly [number, number];
}

/** An in-picture counter (Score Block digits): only for a number the narration really gives. */
export function drawCounter(g: TvPainter, c: CounterSpec): number {
  const means = c.means.trim().toLowerCase();
  if (means.length < 6 || GENERIC.includes(means))
    fail(
      `counter(): means "${c.means}" says nothing; name the real number it counts ("oaks left in the valley")`,
    );
  if (c.keys.length === 0) fail('counter(): give keys [[t, value], ...] from the narration');
  let value = c.keys[0]?.[1] ?? 0;
  for (const [at, v] of c.keys) if (g.t >= at) value = v;
  const text = String(Math.max(0, Math.round(value))).padStart(c.digits ?? 1, '0');
  g.score(text, c.x, c.y, { colour: c.colour, ...(c.cell === undefined ? {} : { cell: c.cell }) });
  return value;
}
