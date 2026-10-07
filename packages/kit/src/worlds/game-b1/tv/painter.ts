/**
 * The picture INSIDE the TV, painted with Atari 2600 rules (the painter's `g`). Units are 2600
 * "TV units": 160 x 180, each a 4 x 2 px wide pixel of the 640x360 picture. Rules the API keeps:
 * - Sprites are bit rows ('#' / '.', <= 16 bits = two players side by side) with ONE colour per
 *   row (a colour name or a list per row); they may stretch (NUSIZ 1/2/4) and squash.
 * - At most `flickerLimit` (2) sprites share a scanline: when more do, every crowded sprite
 *   flickers on alternate frames, as a 2600 kernel does (`flicker: false` keeps the hero solid;
 *   `playfield: true` draws resting objects as playfield, outside the sprite limit).
 * - Playfield = 20 blocks of 4 units per half, repeated or mirrored; colour bands change per line.
 * Calls are recorded in order and replayed at the end of the painter, so the flicker rule can
 * see every sprite of the frame; the replay keeps the call order (z order).
 */
import { KitError } from '../../../errors.js';
import type { IndexCanvas } from '../core/canvas.js';
import { joy, missingGlyphs, score } from '../core/fonts.js';
import { clamp01, EASES, frameOf, hash, lerp, seg, shake, typed, typedEnd } from '../core/math.js';
import { colorOfSwatch, REMAP_NAMES, REMAPS, type RemapName } from '../palette.js';
import { attractPicture, garbage } from './idle.js';

export const TV_H = 180;
export const UNIT_X = 4;
export const UNIT_Y = 2;
const MAX_SPRITE_BITS = 16;

export interface SpriteOptions {
  readonly stretch?: number;
  readonly rowH?: number;
  readonly flip?: boolean;
  /** Vertical scale 0..1 anchored at the bottom row (landing squash, input-lag crouch). */
  readonly squash?: number;
  /** Drawn as playfield: never counted by or subject to the sprite flicker rule. */
  readonly playfield?: boolean;
  /** false = never flickers (the hero), still counted. */
  readonly flicker?: boolean;
}

export interface CartOptions extends SpriteOptions {
  readonly scale?: number;
  readonly body?: string;
  readonly label?: string;
  /** Tumbling in the air: upright / sideways every 3 frames (`phase` offsets it). */
  readonly tumble?: boolean;
  readonly phase?: number;
}

interface Op {
  readonly draw: () => void;
  /** Scanlines (TV units) of a sprite; undefined = not a sprite. */
  readonly lines?: readonly [number, number];
  readonly flicker?: boolean;
}

const CART = ['.####.', '######', '#....#', '#....#', '#....#', '#....#', '######'];
const CART_SIDE = ['#######', '#.....#', '#.....#', '#.....#', '######.'];

function fail(message: string): never {
  throw new KitError('invalid-params', `kit.fx.b1Screen() tv painter: ${message}`);
}

export function colour(name: string, what: string): number {
  const index = colorOfSwatch(name);
  if (index === undefined) fail(`${what}: "${name}" is not a game-b1 colour`);
  return index;
}

export class TvPainter {
  private ops: Op[] = [];
  private ox = 0;
  private oy = 0;
  readonly frame: number;
  readonly util = { seg, lerp, clamp01, ease: EASES, hash, shake, typed, typedEnd, frameOf };

  constructor(
    private readonly cv: IndexCanvas,
    readonly t: number,
    private readonly flickerLimit = 2,
  ) {
    this.frame = frameOf(t);
  }

  /** Origin offset in px (shakes): applies to the calls after it. */
  offset(dx: number, dy: number): void {
    this.ox = Math.round(dx);
    this.oy = Math.round(dy);
  }

  private push(draw: (ox: number, oy: number) => void, sprite?: Omit<Op, 'draw'>): void {
    const { ox, oy } = this;
    this.ops.push({
      draw: () => {
        draw(ox, oy);
      },
      ...sprite,
    });
  }

  rect(x: number, y: number, w: number, h: number, name: string): void {
    const c = colour(name, 'rect');
    this.push((ox, oy) => {
      this.cv.rect(ox + x * UNIT_X, oy + y * UNIT_Y, w * UNIT_X, h * UNIT_Y, c);
    });
  }

  dither(x: number, y: number, w: number, h: number, name: string, level: number): void {
    const c = colour(name, 'dither');
    this.push((ox, oy) => {
      this.cv.dither(ox + x * UNIT_X, oy + y * UNIT_Y, w * UNIT_X, h * UNIT_Y, c, level);
    });
  }

  /** Horizontal colour bands, top-down: stops [[y, colour], ...], the last one runs to y1. */
  bands(x: number, w: number, stops: readonly (readonly [number, string])[], y1 = TV_H): void {
    stops.forEach(([y, name], i) => {
      const end = stops[i + 1]?.[0] ?? y1;
      if (end > y) this.rect(x, y, w, end - y, name);
    });
  }

  /** 2600 playfield: 20 bits ('#'/'.') of 4-unit blocks for the left half, repeated or mirrored. */
  playfield(y: number, h: number, bits: string, name: string, options: { mirror?: boolean } = {}) {
    if (bits.length !== 20)
      fail(`playfield bits must be 20 characters (got ${String(bits.length)})`);
    const c = colour(name, 'playfield');
    this.push((ox, oy) => {
      for (let i = 0; i < 20; i += 1) {
        if (bits[i] !== '#') continue;
        const right = options.mirror === false ? 20 + i : 39 - i;
        for (const block of [i, right])
          this.cv.rect(ox + block * 16, oy + y * UNIT_Y, 16, h * UNIT_Y, c);
      }
    });
  }

  /** A sprite: bit rows with one colour per row (a name, or a list per row; null skips a row). */
  sprite(
    rows: readonly string[],
    colours: string | readonly (string | null)[],
    x: number,
    y: number,
    options: SpriteOptions = {},
  ): void {
    const width = Math.max(0, ...rows.map((row) => row.length));
    if (rows.length === 0 || width > MAX_SPRITE_BITS)
      fail(`a sprite has 1+ rows of <= ${String(MAX_SPRITE_BITS)} bits (got ${String(width)})`);
    const perRow = rows.map((_, i) => {
      const name = typeof colours === 'string' ? colours : colours[Math.min(i, colours.length - 1)];
      return name === null || name === undefined ? -1 : colour(name, `sprite row ${String(i)}`);
    });
    const rowH = options.rowH ?? 1;
    const squash = clamp01(options.squash ?? 1);
    const shown = Math.max(1, Math.round(rows.length * squash));
    const top = y + (rows.length - shown) * rowH;
    this.push(
      (ox, oy) => {
        for (let i = 0; i < shown; i += 1) {
          const src = Math.min(rows.length - 1, Math.floor((i / shown) * rows.length));
          this.bits(ox, oy, rows[src] ?? '', perRow[src] ?? -1, x, top + i * rowH, options);
        }
      },
      this.spriteMeta(top, shown * rowH, options),
    );
  }

  private bits(
    ox: number,
    oy: number,
    row: string,
    c: number,
    x: number,
    y: number,
    o: SpriteOptions,
  ) {
    if (c < 0) return;
    const st = o.stretch ?? 1;
    const rowH = o.rowH ?? 1;
    for (let k = 0; k < row.length; k += 1) {
      const bit = o.flip === true ? row[row.length - 1 - k] : row[k];
      if (bit === '#')
        this.cv.rect(ox + (x + k * st) * UNIT_X, oy + y * UNIT_Y, st * UNIT_X, rowH * UNIT_Y, c);
    }
  }

  private spriteMeta(top: number, height: number, o: SpriteOptions): Omit<Op, 'draw'> | undefined {
    if (o.playfield === true) return undefined;
    return { lines: [Math.floor(top), Math.ceil(top + height)], flicker: o.flicker !== false };
  }

  /** A cartridge as the console draws it: grey body, label rows, a coloured stripe. */
  cart(x: number, y: number, stripe: string, options: CartOptions = {}): void {
    const k = options.scale ?? 1;
    const body = colour(options.body ?? 'greyDark', 'cart body');
    const label = colour(options.label ?? 'cream', 'cart label');
    const band = colour(stripe, 'cart stripe');
    const sideways =
      options.tumble === true && (Math.floor(this.frame / 3) + (options.phase ?? 0)) % 2 !== 0;
    const top = sideways ? y + k : y;
    const height = (sideways ? CART_SIDE.length : CART.length) * k;
    this.push(
      (ox, oy) => {
        const r = (rx: number, ry: number, w: number, h: number, c: number) => {
          this.cv.rect(ox + rx * UNIT_X, oy + ry * UNIT_Y, w * UNIT_X, h * UNIT_Y, c);
        };
        const rows = sideways ? CART_SIDE : CART;
        rows.forEach((row, i) => {
          this.bits(ox, oy, row, body, x, top + i * k, { stretch: k, rowH: k });
        });
        if (sideways) {
          r(x + k, y + 2 * k, 5 * k, 2 * k, band);
          return;
        }
        r(x + k, y + 2 * k, 4 * k, k, label);
        r(x + k, y + 3 * k, 4 * k, 2 * k, band);
        r(x + k, y + 5 * k, 4 * k, k, label);
      },
      this.spriteMeta(top, height, options),
    );
  }

  /** Joy text (CAPS) at unit position x, y; `type` types it with an irregular cadence. */
  text(
    text: string,
    x: number,
    y: number,
    options: {
      colour: string;
      size?: number;
      wobble?: number;
      type?: { at: number; cps?: number };
    },
  ): number {
    const upper = text.toUpperCase();
    const missing = missingGlyphs(upper, 'joy');
    if (missing.length > 0) fail(`text "${text}": cannot draw ${missing.join(' ')}`);
    const c = colour(options.colour, 'text');
    const shown =
      options.type === undefined
        ? upper
        : upper.slice(
            0,
            typed(upper, this.t, options.type.at, 7 + upper.length, options.type.cps ?? 18),
          );
    const size = options.size ?? 2;
    this.push((ox, oy) => {
      joy(this.cv, shown, ox + x * UNIT_X, oy + y * UNIT_Y, size, c, options.wobble);
    });
    return shown.length;
  }

  /** Score Block digits (the 2600 score kernel) with cells of [w, h] px. */
  score(
    text: string,
    x: number,
    y: number,
    options: { colour: string; cell?: readonly [number, number] },
  ) {
    const missing = missingGlyphs(text, 'score');
    if (missing.length > 0) fail(`score "${text}": cannot draw ${missing.join(' ')}`);
    const c = colour(options.colour, 'score');
    const [cw, ch] = options.cell ?? [12, 10];
    this.push((ox, oy) => {
      score(this.cv, text, ox + x * UNIT_X, oy + y * UNIT_Y, cw, ch, c);
    });
  }

  /**
   * Remaps everything painted so far (dim, flash, drain, ghost, cycle1-3 = attract mode); `rows`
   * = [y0, y1) in TV units limits it to a band (lights going out line by line, a drain).
   */
  remap(name: string, level?: number, rows?: readonly [number, number]): void {
    if (!Object.hasOwn(REMAPS, name)) fail(`remap "${name}": use ${REMAP_NAMES.join(', ')}`);
    const table = REMAPS[name as RemapName];
    const [y0, y1] = rows ?? [0, TV_H];
    this.push(() => {
      const top = Math.round(y0 * UNIT_Y);
      this.cv.remap(0, top, this.cv.w, Math.round(y1 * UNIT_Y) - top, table, level);
    });
  }

  /** The idle attract-mode picture (colour bands cycling every 1.9 s). */
  attract(): void {
    this.push(() => {
      attractPicture(this.cv, 0, 0, this.cv.w, this.cv.h, this.t);
    });
  }

  /** A garbage frame: what a 2600 shows while a cartridge rocks in the slot. */
  garbage(seed = 5): void {
    this.push(() => {
      garbage(this.cv, 0, 0, this.cv.w, this.cv.h, this.frame, seed);
    });
  }

  /**
   * A rect in square px of the 640x360 picture: ONLY for a thing that is not of the 2600 (a later
   * console's cartridge drawn in finer pixels, a new generation); everything else stays wide.
   */
  rectPx(x: number, y: number, w: number, h: number, name: string): void {
    const c = colour(name, 'rectPx');
    this.push((ox, oy) => {
      this.cv.rect(ox + x, oy + y, w, h, c);
    });
  }

  /** Free drawing in px on the picture's canvas (the escape hatch; keep the 2600 rules). */
  raw(draw: (cv: IndexCanvas) => void): void {
    this.push(() => {
      draw(this.cv);
    });
  }

  /** Replays the recorded calls with the sprite flicker rule. */
  flush(): void {
    const occupancy = new Uint8Array(TV_H + 64);
    for (const op of this.ops) {
      if (op.lines === undefined) continue;
      for (let y = Math.max(0, op.lines[0]); y < Math.min(occupancy.length, op.lines[1]); y += 1)
        occupancy[y] = (occupancy[y] ?? 0) + 1;
    }
    let crowded = 0;
    for (const op of this.ops) {
      if (op.lines !== undefined && op.flicker === true) {
        let peak = 0;
        for (let y = Math.max(0, op.lines[0]); y < Math.min(occupancy.length, op.lines[1]); y += 1)
          peak = Math.max(peak, occupancy[y] ?? 0);
        if (peak > this.flickerLimit) {
          crowded += 1;
          if ((this.frame + crowded) % 2 === 0) continue;
        }
      }
      op.draw();
    }
    this.ops = [];
  }
}
