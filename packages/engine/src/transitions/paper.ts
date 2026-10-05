/**
 * Paper-like content-texture transitions (ADR-028, family `texture`): the outgoing picture rolls
 * up like a sheet (`paper-roll`), peels off from a corner like a book page (`page-turn`) or is
 * scrubbed off by a kitchen sponge (`sponge-wipe`). Directions and streaks come from the seed;
 * shading is ordered dither between palette colours. Every pixel is a copy of A or B or a palette
 * colour.
 */
import { bayerThreshold, hashOf, unit, type Composition, type Compositor } from './pixels.js';
import { dither, endFrames, lerp, phase, shade, smoothstep } from './wow.js';

/** Paper ramp (light -> dark) in the palette: cream, tan, rust, outline. */
function paperTones({ tones }: Composition): readonly [number, number, number, number] {
  return [tones.nearest(0xf4e9d8), tones.nearest(0xc49a7a), tones.nearest(0x7d321c), tones.darkest];
}

/** The paper colour at a shading level 0 (lit) .. 3 (outline), dithered between steps. */
function paperShade(
  ramp: readonly [number, number, number, number],
  level: number,
  x: number,
  y: number,
): number {
  const clamped = Math.min(3, Math.max(0, level));
  const step = Math.floor(clamped);
  const next = Math.min(3, step + 1);
  const pick = clamped - step > bayerThreshold(x >> 1, y >> 1) ? next : step;
  return ramp[pick] ?? ramp[0];
}

const ROLL_START_RADIUS = 14;
const ROLL_END_RADIUS = 46;
const ROLL_SHADOW = 14;

/** Distance from the start edge along the roll's travel, and the frame's length that way. */
function rollAxis(
  direction: number,
  width: number,
  height: number,
): (x: number, y: number) => number {
  if (direction === 0) return (_x, y) => height - 1 - y;
  if (direction === 1) return (_x, y) => y;
  if (direction === 2) return (x) => width - 1 - x;
  return (x) => x;
}

/** Frame index of paper coordinate `s` (along the roll's travel) in the row/column of (x, y). */
function rollSource(
  direction: number,
  width: number,
  height: number,
): (x: number, y: number, s: number) => number {
  if (direction === 0) return (x, _y, s) => (height - 1 - s) * width + x;
  if (direction === 1) return (x, _y, s) => s * width + x;
  if (direction === 2) return (_x, y, s) => y * width + (width - 1 - s);
  return (_x, y, s) => y * width + s;
}

/** acos(1 - 2w) / pi for w in [0, 1] (Abramowitz-Stegun 4.4.45 polynomial, no trigonometry). */
function arcShare(w: number): number {
  const cosine = 1 - 2 * w;
  const t = Math.abs(cosine);
  const angle = Math.sqrt(1 - t) * (1.5707288 + t * (-0.2121144 + t * (0.074261 - 0.0187293 * t)));
  return (cosine >= 0 ? angle : Math.PI - angle) / Math.PI;
}

/**
 * Paper roll: the picture rolls up from an edge (bottom, top, right or left from the seed) into a
 * growing cylinder: the picture wraps around it (foreshortened toward its edges, shaded by
 * dither, a dark outline), the paper's start shows its cream back; B lies under it with a soft
 * dithered shadow.
 */
export const paperRoll: Compositor = (c) => {
  if (endFrames(c)) return;
  const { width, height, a, b, out, p, seed, tones } = c;
  const direction = seed % 4;
  const length = direction < 2 ? height : width;
  const axis = rollAxis(direction, width, height);
  const source = rollSource(direction, width, height);
  const growth = (ROLL_END_RADIUS ** 2 - ROLL_START_RADIUS ** 2) / length;
  const start = -2 * ROLL_START_RADIUS - 2;
  const end = length + ROLL_SHADOW + 2;
  const front = lerp(start, end, smoothstep(p));
  const radius = Math.sqrt(ROLL_START_RADIUS ** 2 + growth * Math.max(0, front));
  const ramp = paperTones(c);
  for (let y = 0; y < height; y += 1) {
    const row = y * width;
    for (let x = 0; x < width; x += 1) {
      const s = axis(x, y);
      const index = row + x;
      if (s < front) {
        const pixel = b[index] ?? 0;
        const near = 1 - (front - s) / ROLL_SHADOW;
        out[index] = near > 0 ? shade(pixel, tones.darkest, 0.65 * near, x, y) : pixel;
      } else if (s < front + 2 * radius) {
        const toA = front + 2 * radius - s;
        const turn = arcShare((s - front) / (2 * radius));
        const paper = Math.floor(front + 2 * radius - Math.PI * radius * (1 - turn));
        // Lit around 0.62 of the way from the B side, the underside darkest.
        const level = turn < 0.62 ? (0.62 - turn) * 1.9 : (turn - 0.62) * 1.1;
        let pixel: number;
        if (s - front < 2 || toA < 1) pixel = tones.darkest;
        else if (toA < 2) pixel = ramp[1];
        else if (paper < 0) pixel = paperShade(ramp, level * 3, x, y);
        else {
          pixel = shade(
            a[source(x, y, Math.min(length - 1, paper))] ?? 0,
            tones.darkest,
            level,
            x,
            y,
          );
        }
        out[index] = pixel;
      } else out[index] = a[index] ?? 0;
    }
  }
};

/** Fold direction (from the peeled corner into the page) per corner, before normalising. */
const PAGE_DIRECTIONS: readonly (readonly [number, number])[] = [
  [-1, -0.62],
  [1, -0.62],
  [-1, 0.62],
  [1, 0.62],
];
const PAGE_SHADOW = 12;

/**
 * Page turn: the picture peels off from a corner (from the seed) along a straight fold that
 * sweeps across; the folded flap shows the paper back (curl shading by dither) and casts a shadow
 * on both shots; B lies under the page.
 */
export const pageTurn: Compositor = (c) => {
  if (endFrames(c)) return;
  const { width, height, a, b, out, p, seed, tones } = c;
  const corner = seed % 4;
  const [rawX, rawY] = PAGE_DIRECTIONS[corner] ?? [-1, -0.62];
  const norm = Math.sqrt(rawX * rawX + rawY * rawY);
  const dx = rawX / norm;
  const dy = rawY / norm;
  const ox = rawX < 0 ? width : 0;
  const oy = rawY < 0 ? height : 0;
  const reach = Math.abs(dx) * width + Math.abs(dy) * height;
  const fold = smoothstep(p) * (reach + PAGE_SHADOW);
  const ramp = paperTones(c);
  for (let y = 0; y < height; y += 1) {
    const row = y * width;
    for (let x = 0; x < width; x += 1) {
      const index = row + x;
      const s = (x + 0.5 - ox) * dx + (y + 0.5 - oy) * dy;
      if (s < fold) {
        const near = 1 - (fold - s) / PAGE_SHADOW;
        const pixel = b[index] ?? 0;
        out[index] = near > 0 ? shade(pixel, tones.darkest, 0.7 * near, x, y) : pixel;
        continue;
      }
      const lift = s - fold;
      const mx = x + 0.5 - 2 * lift * dx;
      const my = y + 0.5 - 2 * lift * dy;
      const outside = Math.max(-mx, mx - width, -my, my - height);
      if (lift < fold && outside <= 0) {
        const depth = lift / Math.max(1, fold);
        const level =
          outside > -1.5 ? 3 : depth < 0.04 ? 1.6 : depth < 0.14 ? 0 : 0.4 + depth * 1.3;
        out[index] = paperShade(ramp, level, x, y);
      } else {
        const pixel = a[index] ?? 0;
        const shadow = lift < fold + 8 && outside > 0 && outside < 7;
        out[index] = shadow ? shade(pixel, tones.darkest, 0.5, x, y) : pixel;
      }
    }
  }
};

const SPONGE_PASSES = 3;
const PASS_START = 0.03;
const PASS_LENGTH = 0.28;
const SPONGE_WIDTH = 0.17;
const SPONGE_CORNER = 10;
const SMEAR_FADE_FROM = 0.84;
const SMEAR_FADE_TO = 0.97;

interface Sponge {
  readonly cx: number;
  readonly cy: number;
  readonly halfW: number;
  readonly halfH: number;
}

/** Sponge colours: foam, pores, green scouring pad, its dark line. */
interface SpongeTones {
  readonly foam: number;
  readonly pore: number;
  readonly pad: number;
  readonly padDark: number;
}

/** The sponge pixel at (x, y), or undefined off the sponge. */
function spongePixel(
  sponge: Sponge,
  colours: SpongeTones,
  c: Composition,
  x: number,
  y: number,
): number | undefined {
  const lx = Math.abs((x & ~1) + 1 - sponge.cx);
  const ly = (y & ~1) + 1 - sponge.cy;
  const ax = lx - (sponge.halfW - SPONGE_CORNER);
  const ay = Math.abs(ly) - (sponge.halfH - SPONGE_CORNER);
  const corner = ax > 0 && ay > 0 ? Math.sqrt(ax * ax + ay * ay) : Math.max(ax, ay);
  if (corner > SPONGE_CORNER) return undefined;
  if (corner > SPONGE_CORNER - 2) return c.tones.darkest;
  const top = ly + sponge.halfH;
  const padHeight = sponge.halfH * 0.5;
  if (top < padHeight) return top > padHeight - 3 ? colours.padDark : colours.pad;
  if (top < padHeight + 3) return c.tones.brightest;
  const cell = hashOf(c.seed ^ 0x51ed270b, Math.floor((x - sponge.cx + 512) / 6), y >> 2);
  return unit(cell) < 0.16 ? colours.pore : colours.foam;
}

/**
 * Sponge wipe: a kitchen sponge scrubs across in three passes (left, right, left), wiping A off
 * band by band with wavy edges; wet streaks of A trail behind it and dry up by the end.
 */
export const spongeWipe: Compositor = (c) => {
  if (endFrames(c)) return;
  const { width, height, a, out, p, seed, tones } = c;
  const band = height / SPONGE_PASSES;
  const halfW = (SPONGE_WIDTH * width) / 2;
  const halfH = band * 0.6;
  const colours: SpongeTones = {
    foam: tones.nearest(0xffb26b),
    pore: tones.nearest(0xff8c42),
    pad: tones.nearest(0x2f8a5f),
    padDark: tones.nearest(0x0b0f2a),
  };
  const dry = 1 - phase(p, SMEAR_FADE_FROM, SMEAR_FADE_TO);
  const passes = Array.from({ length: SPONGE_PASSES }, (_, pass) => {
    const q = phase(p, PASS_START + pass * PASS_LENGTH, PASS_START + (pass + 1) * PASS_LENGTH);
    const travel = lerp(-halfW - 4, width + halfW + 4, smoothstep(q));
    const cx = pass % 2 === 0 ? travel : width - travel;
    const sponge: Sponge = { cx, cy: (pass + 0.5) * band + 5 * triangle(cx / 72), halfW, halfH };
    return { q, sponge };
  });
  for (let y = 0; y < height; y += 1) {
    const row = y * width;
    for (let x = 0; x < width; x += 1) {
      const index = row + x;
      const edge = 7 * unit(hashOf(seed, x >> 3, 9));
      let pixel = a[index] ?? 0;
      for (let pass = SPONGE_PASSES - 1; pass >= 0; pass -= 1) {
        const state = passes[pass];
        if (state === undefined || state.q <= 0) continue;
        if (y < pass * band - edge || y >= (pass + 1) * band + 7 - edge) continue;
        const { cx } = state.sponge;
        const behind = pass % 2 === 0 ? cx - halfW - x : x - cx - halfW;
        if (behind < 0) continue;
        pixel = wiped(c, x, y, index, pass, behind, dry);
        break;
      }
      out[index] = pixel;
    }
  }
  for (const { q, sponge } of passes) {
    if (q > 0 && q < 1) drawSponge(c, sponge, colours);
  }
};

/** Triangle wave in [-1, 1] with period 1. */
function triangle(t: number): number {
  return 4 * Math.abs(t - Math.floor(t) - 0.5) - 1;
}

/** A wiped pixel: B, with streaks of A (and a little foam) close behind the sponge. */
function wiped(
  c: Composition,
  x: number,
  y: number,
  index: number,
  pass: number,
  behind: number,
  dry: number,
): number {
  const pixel = c.b[index] ?? 0;
  const streak = hashOf(c.seed ^ 0x1b873593, y >> 1, pass);
  if (unit(streak) < 0.3) {
    const length = 30 + 100 * unit(hashOf(streak, 1));
    const wet = (1 - behind / length) * 0.7 * dry;
    if (wet > 0) {
      if (behind < 22 && unit(hashOf(c.seed, x >> 1, y >> 1)) < 0.08) return c.tones.brightest;
      return dither(pixel, c.a[index] ?? 0, wet, x, y);
    }
  }
  return pixel;
}

function drawSponge(c: Composition, sponge: Sponge, colours: SpongeTones): void {
  const { width, height, out, tones } = c;
  const x0 = Math.max(0, Math.floor(sponge.cx - sponge.halfW));
  const x1 = Math.min(width, Math.ceil(sponge.cx + sponge.halfW + 6));
  const y0 = Math.max(0, Math.floor(sponge.cy - sponge.halfH));
  const y1 = Math.min(height, Math.ceil(sponge.cy + sponge.halfH + 6));
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      const index = y * width + x;
      const pixel = spongePixel(sponge, colours, c, x, y);
      if (pixel !== undefined) out[index] = pixel;
      else if (spongePixel(sponge, colours, c, x - 5, y - 5) !== undefined) {
        out[index] = shade(out[index] ?? 0, tones.darkest, 0.5, x, y);
      }
    }
  }
}
