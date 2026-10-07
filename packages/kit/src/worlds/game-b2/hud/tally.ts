/**
 * The intermission tally screen (showcase shot 8, js/intermission.js): a woodgrain plate with a
 * smoked-glass panel over the level frozen behind it (or the live view, or the dark), the
 * chapter title, counters ticking up row by row (the running one in BULB), EST. tags, a pencil
 * underline, the coffee ring on the plate, then the misregistered rubber stamp thumping onto the
 * plate's corner (shadow anticipation, overshoot, shake with decay). Enters with Doom's screen
 * melt of the frame before it, leaves through a Bayer dissolve or a melt. Pure in t.
 */
import { Bmp, handStroke, rotate } from '../core/bitmap.js';
import { drawText, textWidth, typedCount } from '../core/font.js';
import { bayer, clamp, clamp01, EASES, hash3, seg, vnoise } from '../core/rand.js';
import { C, dimMap, T } from '../palette.js';
import { SCREEN_H, SCREEN_W } from '../view/output.js';
import { plate } from './plate.js';
import { EST_X, MELT_S, VALUE_X, valueWidth, type TallyPlan } from './tally-plan.js';

const GHOST = dimMap(0.3, [0.9, 0.95, 1.1]);
const SHADE = dimMap(0.55, [1, 1, 1]);
const stamps = new Map<string, { ink: Bmp; shadow: Bmp }>();
let meltDelays: Float32Array | undefined;

/** The rubber stamp: three frames, the word, a ghost second impression, thinning ink, a smudge. */
function stampOf(word: string): { ink: Bmp; shadow: Bmp } {
  const hit = stamps.get(word);
  if (hit !== undefined) return hit;
  const scale = 4;
  const w = textWidth(word, scale) + 24;
  const h = 7 * scale + 18;
  const ink = new Bmp(w, h);
  ink.frame(0, 0, w, h, C.ACCENT);
  ink.frame(1, 1, w - 2, h - 2, C.ACCENT);
  ink.frame(4, 4, w - 8, h - 8, C.ACCENT);
  drawText(ink, word, 12, 9, C.ACCENT, scale);
  const raw = new Bmp(w + 8, h + 6);
  for (let y = 0; y < h; y += 1)
    for (let x = 0; x < w; x += 1)
      if (ink.d[y * w + x] !== T && hash3(x, y, 41) < 0.4) raw.px(x + 5, y + 1, C.ACCENT_D);
  for (let y = 0; y < h; y += 1)
    for (let x = 0; x < w; x += 1) {
      if (ink.d[y * w + x] === T) continue;
      const thin = 0.04 + 0.34 * (x / w) ** 3 + (vnoise(x, y, 6, 43) > 0.72 ? 0.3 : 0);
      if (hash3(x, y, 42) < thin) continue;
      raw.px(x + 1, y + 3, hash3(x, y, 44) < 0.08 ? C.ACCENT_D : C.ACCENT);
    }
  for (let k = 0; k < 9; k += 1) raw.px(1 - (k >> 2), h + 1 - k * 0.6, C.ACCENT_D);
  const block = new Bmp(raw.w, raw.h, C.VOID);
  const made = { ink: rotate(raw, -8), shadow: rotate(block, -8) };
  stamps.set(word, made);
  return made;
}

/** Doom's wipe offsets: a clamped random walk, each 4 px column at most a step from its neighbour. */
function delays(): Float32Array {
  if (meltDelays !== undefined) return meltDelays;
  const out = new Float32Array(SCREEN_W / 4);
  let v = hash3(1, 2, 3) * 0.26;
  for (let i = 0; i < out.length; i += 1) {
    v = clamp(v + (Math.floor(hash3(i, 9, 81) * 3) - 1) * 0.0165, 0, 0.26);
    out[i] = v;
  }
  meltDelays = out;
  return out;
}

function coffeeRing(b: Bmp, x0: number, y0: number, x1: number, y1: number): void {
  const cx = x0 + 9;
  const cy = y1 - 6;
  for (let a = 0; a < 360; a += 0.8) {
    const r = 19 + Math.sin(a * 0.05) * 0.9;
    const x = cx + Math.cos((a * Math.PI) / 180) * r;
    const y = cy + Math.sin((a * Math.PI) / 180) * r * 0.94;
    if (x < x0 || y < y0 || x >= x1 || y >= y1 || hash3(Math.floor(a), 3, 5) > 0.82) continue;
    b.px(x, y, C.BROWN);
    if (a > 280 || a < 20) b.px(x + 1, y, C.UMBER);
  }
}

/** The still part (backdrop, plate, panel, title, rule, coffee ring), built once per plan. */
export function tallyBase(tally: TallyPlan, backdrop: Uint8Array | undefined): Bmp {
  const base = new Bmp(SCREEN_W, SCREEN_H, tally.backdrop === 'live' ? T : C.VOID);
  if (tally.backdrop === 'freeze' && backdrop !== undefined) base.d.set(backdrop);
  const [px, py, pw, ph] = tally.plate;
  plate(base, px, py, pw, ph);
  const [x0, y0, x1, y1] = [px + 7, py + 7, px + pw - 7, py + ph - 7];
  for (let y = y0; y < y1; y += 1)
    for (let x = x0; x < x1; x += 1) {
      const under = backdrop?.[y * SCREEN_W + x] ?? C.VOID;
      const glass = tally.backdrop === 'freeze' ? (GHOST[under] ?? C.VOID) : C.VOID;
      base.d[y * SCREEN_W + x] = bayer(x, y) < 0.62 ? C.SHADOW : glass;
    }
  base.rect(x0, y0, x1 - x0, 1, C.VOID);
  base.rect(x0, y0, 1, y1 - y0, C.VOID);
  if (tally.title !== '') drawText(base, tally.title, 54, 44, C.TUNGSTEN, 3, { shadow: C.VOID });
  if (tally.sub !== '') drawText(base, tally.sub, 56, 71, C.SAND, 2, { jitter: 70 });
  if (tally.title !== '') handStroke(base, [54, 93, 170, 94, 318, 92], C.SLATE, 79, 2, 1);
  coffeeRing(base, x0, y0, x1, y1);
  return base;
}

/** A value right-aligned at xRight with a real descending comma. */
function drawValue(b: Bmp, text: string, xRight: number, y: number, c: number): void {
  let x = xRight - valueWidth(text);
  for (const ch of text) {
    if (ch === ',') {
      for (const [px, py] of [
        [x + 2, y + 10],
        [x + 2, y + 12],
        [x, y + 14],
      ] as const) {
        b.rect(px + 2, py + 2, 2, 2, C.VOID);
        b.rect(px, py, 2, 2, c);
      }
      x += 6;
    } else x = drawText(b, ch, x, y, c, 2, { shadow: C.VOID });
  }
}

function drawRows(b: Bmp, tally: TallyPlan, t: number): void {
  let ruled = false;
  for (const row of tally.rows) {
    if (t < row.at) continue;
    if (row.role !== 'count' && !ruled) {
      handStroke(b, [54, row.y - 6, 150, row.y - 5, 312, row.y - 7], C.SLATE, 83, 2, 1);
      ruled = true;
    }
    const reference = row.role !== 'count';
    drawText(b, row.label, 54, row.y, C.SAND, 2, { jitter: row.jitter });
    const k = typedCount(row.times, t);
    const text = k === 0 ? row.zero : (row.texts[k - 1] ?? '');
    const live = t < row.landed + 0.12;
    drawValue(b, text, VALUE_X, row.y, live ? C.BULB : reference ? C.PUTTY : C.PAPER);
    if (row.est) drawText(b, 'EST.', EST_X, row.y, C.SAND, 2);
    if (row.underline) {
      const w = valueWidth(row.final);
      const y = row.y + 18;
      const p1 = seg(t, row.landed + 0.25, row.landed + 0.49);
      const p2 = seg(t, row.landed + 0.55, row.landed + 0.67);
      if (p1 > 0)
        handStroke(
          b,
          [VALUE_X - w - 3, y, VALUE_X - w * 0.4, y + 1, VALUE_X + 3, y - 1],
          C.GREY,
          91,
          2.2,
          p1,
        );
      if (p2 > 0)
        handStroke(
          b,
          [VALUE_X - 4, y + 2, VALUE_X - w * 0.55, y + 3, VALUE_X - w + 6, y + 2],
          C.GREY,
          92,
          2.6,
          p2,
        );
    }
  }
}

/** Scaled, centred blit of a stamp bitmap; `shade` turns it into a shadow on what is below. */
function blitScaled(
  b: Bmp,
  src: Bmp,
  scale: number,
  cx: number,
  cy: number,
  shade?: Uint8Array,
): void {
  const w = Math.round(src.w * scale);
  const h = Math.round(src.h * scale);
  const x0 = Math.round(cx - w / 2);
  const y0 = Math.round(cy - h / 2);
  for (let dy = 0; dy < h; dy += 1) {
    const y = y0 + dy;
    if (y < 0 || y >= b.h) continue;
    const sy = Math.min(src.h - 1, Math.floor(dy / scale));
    for (let dx = 0; dx < w; dx += 1) {
      const x = x0 + dx;
      if (x < 0 || x >= b.w) continue;
      const c = src.d[sy * src.w + Math.min(src.w - 1, Math.floor(dx / scale))] ?? T;
      if (c === T) continue;
      const i = y * b.w + x;
      b.d[i] = shade === undefined ? c : (shade[b.d[i] ?? T] ?? C.VOID);
    }
  }
}

/** Over the plate's right edge, under the last row (it breaks the plate's frame). */
function stampAt(tally: TallyPlan): readonly [number, number] {
  const [px, py, pw, ph] = tally.plate;
  const last = tally.rows.at(-1)?.y ?? py + ph - 80;
  return [px + pw + 28, Math.max(py + ph - 50, last + 44)];
}

function drawStamp(b: Bmp, tally: TallyPlan, t: number): void {
  const stamp = tally.stamp;
  if (stamp === undefined || t < stamp.at - 0.16) return;
  const { ink, shadow } = stampOf(stamp.text);
  const [sx, sy] = stampAt(tally);
  if (t < stamp.at) {
    const a = EASES.in(seg(t, stamp.at - 0.16, stamp.at));
    blitScaled(b, shadow, 1.45 - 0.45 * a, sx + 14 * (1 - a), sy + 11 * (1 - a), SHADE);
    return;
  }
  const dt = t - stamp.at;
  blitScaled(b, ink, 1 + 0.11 * Math.exp(-dt * 15) * Math.cos(dt * 36), sx, sy);
}

function shakeOf(tally: TallyPlan, t: number): readonly [number, number] {
  const dt = t - (tally.stamp?.at ?? Number.POSITIVE_INFINITY);
  if (dt < 0 || dt > 0.5) return [0, 0];
  const a = Math.exp(-dt * 9);
  return [Math.round(1.6 * a * Math.sin(dt * 44 + 1)), Math.round(3.4 * a * Math.cos(dt * 57))];
}

/** Columns of `from` slide down by the melt at share s (0..1); below them `under` shows. */
function melt(out: Uint8Array, from: Uint8Array, s: number): void {
  const d = delays();
  for (let column = 0; column < d.length; column += 1) {
    const p = clamp01((s - (d[column] ?? 0)) / (1 - 0.26));
    const off = Math.round(SCREEN_H * p ** 1.5);
    if (off >= SCREEN_H) continue;
    for (let y = SCREEN_H - 1; y >= off; y -= 1) {
      const src = (y - off) * SCREEN_W;
      const dst = y * SCREEN_W;
      for (let x = column * 4; x < column * 4 + 4; x += 1) out[dst + x] = from[src + x] ?? T;
    }
  }
}

/**
 * Paints the tally over the HUD screen `b` at t. `base` = tallyBase(); `before` = the frame the
 * melt slides away (the view and HUD at `at`), `work` a scratch screen.
 */
export function drawTally(
  b: Bmp,
  tally: TallyPlan,
  t: number,
  base: Bmp,
  before: Uint8Array | undefined,
  work: Bmp,
): void {
  if (t < tally.at || t >= tally.until) return;
  work.d.set(base.d);
  drawRows(work, tally, t);
  drawStamp(work, tally, t);
  const [dx, dy] = shakeOf(tally, t);
  const out = b.d;
  if (dx === 0 && dy === 0 && tally.backdrop !== 'live') out.set(work.d);
  else
    for (let y = 0; y < SCREEN_H; y += 1) {
      const sy = clamp(y - dy, 0, SCREEN_H - 1);
      for (let x = 0; x < SCREEN_W; x += 1) {
        const c = work.d[sy * SCREEN_W + clamp(x - dx, 0, SCREEN_W - 1)] ?? T;
        if (c !== T || tally.backdrop !== 'live') out[y * SCREEN_W + x] = c;
      }
    }
  if (tally.enter === 'melt' && t < tally.at + MELT_S && before !== undefined)
    melt(out, before, (t - tally.at) / MELT_S);
  if (t < tally.outAt) return;
  if (tally.exit === 'melt') {
    const from = out.slice();
    out.fill(T);
    melt(out, from, seg(t, tally.outAt, tally.until));
    return;
  }
  if (tally.exit === 'dissolve') {
    const dark = seg(t, tally.outAt, tally.outAt + 0.3);
    const clear = seg(t, tally.outAt + 0.4, tally.until);
    for (let y = 0; y < SCREEN_H; y += 1)
      for (let x = 0; x < SCREEN_W; x += 1) {
        const threshold = bayer(x, y);
        if (threshold < clear) out[y * SCREEN_W + x] = T;
        else if (threshold < dark) out[y * SCREEN_W + x] = C.VOID;
      }
  }
}
