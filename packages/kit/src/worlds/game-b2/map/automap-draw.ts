/**
 * Drawing pieces of the Game B2 automap (the showcase's automap.js): hand-ruled pen lines drawn
 * on up to a share (the tip glows while drawing; dashed for what we have not seen), floor fills,
 * the player arrow, the objective diamond, the one accent pickup pixel, a crossed spot, labels
 * typed beside rooms with a pencil tick, hand lettering on a stair-step baseline and the legend.
 * Pure drawing: positions in screen px, times already resolved.
 */
import { handStroke, type Bmp } from '../core/bitmap.js';
import { drawText, textWidth, typedCount } from '../core/font.js';
import { bayer, EASES, hash3, seg } from '../core/rand.js';
import { C } from '../palette.js';
import type { PenLine } from './rooms.js';

/** Map origin: screen px of cell (0, 0), px per cell and the room-wise hand offsets. */
export interface MapFrame {
  readonly ox: number;
  readonly oy: number;
  readonly s: number;
  /** Seeded 1 px offset per area (rooms traced one at a time). */
  readonly jitter: (area: number) => readonly [number, number];
}

export type PenStyle = 'solid' | 'dashed' | 'dotted';

/** A pen line drawn from its start (or end, `flip`) up to `frac`; the tip glows while drawing. */
export function pen(
  b: Bmp,
  frame: MapFrame,
  line: PenLine,
  flip: boolean,
  frac: number,
  colour: number,
  style: PenStyle,
): void {
  if (frac <= 0) return;
  const [jx, jy] = frame.jitter(line.area);
  const from = Math.round(line.a0 * frame.s) - line.over0;
  const to = Math.round(line.a1 * frame.s) - 1 + line.over1;
  const n = to - from;
  const q = Math.round(line.q * frame.s) - (line.side > 0 ? 1 : 0);
  const count = Math.floor(n * Math.min(1, frac));
  for (let k = 0; k <= count; k += 1) {
    if (style === 'dashed' && (k + line.phase) % line.period >= line.on) continue;
    if (style === 'dotted' && (k + line.phase) % 4 !== 0) continue;
    const along = flip ? to - k : from + k;
    const jogged = line.jogAt > 0 && k > line.jogAt * n ? q + line.jog : q;
    const c = k === count && frac < 1 ? C.TUBE : colour;
    if (line.h) b.px(frame.ox + jx + along, frame.oy + jy + jogged, c);
    else b.px(frame.ox + jx + jogged, frame.oy + jy + along, c);
  }
}

/** Dithered floor cells (`level` share of the pixels), `paint(x, y, mx, my)` per pixel. */
export function fillCells(
  b: Bmp,
  frame: MapFrame,
  cells: readonly (readonly [number, number])[],
  area: number,
  level: number,
  paint: (x: number, y: number, mx: number, my: number) => void,
): void {
  if (level <= 0) return;
  const [jx, jy] = frame.jitter(area);
  for (const [cx, cy] of cells) {
    const x0 = Math.round(frame.ox + cx * frame.s) + jx;
    const y0 = Math.round(frame.oy + cy * frame.s) + jy;
    const x1 = Math.round(frame.ox + (cx + 1) * frame.s) + jx;
    const y1 = Math.round(frame.oy + (cy + 1) * frame.s) + jy;
    for (let y = Math.max(0, y0); y < Math.min(b.h, y1); y += 1)
      for (let x = Math.max(0, x0); x < Math.min(b.w, x1); x += 1)
        if (bayer(x, y) < level) paint(x, y, x - Math.round(frame.ox), y - Math.round(frame.oy));
  }
}

/** The player arrow (a VOID rim under it), `k` = size. */
export function arrow(b: Bmp, x: number, y: number, a: number, colour: number, k: number): void {
  const tri = (m: number): number[] => [
    x + Math.cos(a) * 8 * m,
    y + Math.sin(a) * 8 * m,
    x + Math.cos(a + 2.5) * 6 * m,
    y + Math.sin(a + 2.5) * 6 * m,
    x + Math.cos(a - 2.5) * 6 * m,
    y + Math.sin(a - 2.5) * 6 * m,
  ];
  b.poly(tri(1.35 * k), C.VOID);
  b.poly(tri(k), colour);
}

/** The objective diamond: anticipation, pop, then a slow uneven pulse. */
export function diamond(b: Bmp, x: number, y: number, t: number, at: number): void {
  if (t < at - 0.08) return;
  const k = t < at ? 1 - seg(t, at - 0.08, at) * 0.4 : EASES.outBack(seg(t, at, at + 0.24));
  const pulse = t > at + 0.4 && Math.sin((t - at) * 7.6 + Math.sin(t * 2.1)) > 0.35;
  const r = (pulse ? 6 : 5) * k;
  const cx = Math.round(x);
  const cy = Math.round(y);
  b.poly([cx, cy - r - 1.5, cx + r + 1.5, cy, cx, cy + r + 1.5, cx - r - 1.5, cy], C.VOID);
  b.poly([cx, cy - r, cx + r, cy, cx, cy + r, cx - r, cy], pulse ? C.BULB : C.SAND_L);
}

/** THE item of the story on the map (the only accent): pops in with a small drop. */
export function pickup(b: Bmp, x: number, y: number, t: number, at: number): void {
  if (t < at) return;
  const pop = EASES.outBack(seg(t, at, at + 0.2));
  const px = Math.round(x);
  const py = Math.round(y) - Math.round((1 - pop) * 3);
  b.rect(px - 3, py - 3, 7, 8, C.VOID);
  b.rect(px - 2, py - 2, 5, 6, C.ACCENT_D);
  b.rect(px - 1, py - 1, 3, 2, C.ACCENT);
}

/** A spot crossed out in two clay strokes (where something ended). */
export function cross(b: Bmp, x: number, y: number, t: number, at: number, seed: number): void {
  const p1 = seg(t, at, at + 0.14);
  const p2 = seg(t, at + 0.2, at + 0.32);
  if (p1 > 0) handStroke(b, [x - 5, y - 5, x + 5, y + 4], C.CLAY, seed, 1.5, p1, true);
  if (p2 > 0) handStroke(b, [x + 5, y - 5, x - 4, y + 5], C.CLAY, seed + 1, 1.5, p2, true);
}

export interface LabelLook {
  readonly name: string;
  readonly sub: string;
  readonly colour: number;
  readonly subColour: number;
  /** Type-in start and the pencil tick (done rooms), or -1. */
  readonly at: number;
  readonly tick: number;
  readonly seed: number;
}

/** A room label typed in (name then sub on the line under it) and its pencil tick. */
export function label(b: Bmp, x: number, y: number, look: LabelLook, t: number): void {
  if (t < look.at) return;
  const total = look.name.length + look.sub.length + 1;
  const pace = 0.025 * total * (0.8 + hash3(look.seed, 1, 1) * 0.5);
  const n = Math.floor(seg(t, look.at, look.at + pace) * total);
  drawText(b, look.name.slice(0, n), x, y, look.colour);
  const subCount = Math.max(0, n - look.name.length - 1);
  if (look.sub !== '') drawText(b, look.sub.slice(0, subCount), x, y + 10, look.subColour);
  if (look.tick >= 0 && t > look.tick)
    handStroke(
      b,
      [x - 13, y + 3, x - 10, y + 7, x - 3, y - 2 + (look.seed % 2)],
      C.SAGE,
      90 + look.seed * 7,
      1.5,
      seg(t, look.tick, look.tick + 0.16),
      true,
    );
}

/** Width of a label block (validator, collisions). */
export function labelSize(name: string, sub: string): readonly [number, number] {
  return [Math.max(textWidth(name), textWidth(sub)), sub === '' ? 7 : 17];
}

/** Hand lettering at 2x on a -2 degree stair-step baseline with a seeded 1 px wobble. */
export function handText(
  b: Bmp,
  text: string,
  x: number,
  y: number,
  colour: number,
  times: readonly number[],
  t: number,
  seed: number,
): void {
  const count = typedCount(times, t);
  let cx = x;
  for (let i = 0; i < Math.min(count, text.length); i += 1) {
    const ch = text.charAt(i);
    const wobble = hash3(seed, i, 3) < 0.22 ? 1 : 0;
    drawText(b, ch, cx, y + Math.round(-(cx - x) * 0.035) + wobble, colour, 2);
    cx += (textWidth(ch) + 1) * 2;
  }
}

/** Width of hand lettering at 2x. */
export function handTextWidth(text: string): number {
  let w = 0;
  for (const ch of text) w += (textWidth(ch) + 1) * 2;
  return w;
}

/** A two-stroke arrow from (x0, y0) bowing to (x1, y1): a shaft, then the head. */
export function noteArrow(
  b: Bmp,
  [x0, y0]: readonly [number, number],
  [x1, y1]: readonly [number, number],
  t: number,
  at: number,
  seed: number,
): void {
  const mx = (x0 + x1) / 2 + (y1 - y0) * 0.18;
  const my = (y0 + y1) / 2 - (x1 - x0) * 0.18;
  const shaft = seg(t, at, at + 0.2);
  if (shaft > 0) handStroke(b, [x0, y0, mx, my, x1, y1], C.SAND, seed, 3, shaft, true);
  const head = seg(t, at + 0.28, at + 0.37);
  if (head <= 0) return;
  const a = Math.atan2(y1 - my, x1 - mx);
  const wing = (turn: number): readonly [number, number] => [
    x1 - Math.cos(a + turn) * 9,
    y1 - Math.sin(a + turn) * 9,
  ];
  const [lx, ly] = wing(0.6);
  const [rx, ry] = wing(-0.6);
  handStroke(b, [lx, ly, x1, y1, rx, ry], C.SAND, seed + 1, 1.5, head, true);
}

/** The legend (texture level, bottom right above the caption band). */
export function legend(b: Bmp, done: string, ahead: string): void {
  const x = 520;
  if (done !== '') {
    b.rect(x, 296, 12, 1, C.SAGE);
    drawText(b, done, x + 18, 293, C.GREY);
  }
  if (ahead !== '') {
    for (let k = 0; k < 12; k += 1) if (k % 5 < 3) b.px(x + k, 308, C.SLATE);
    drawText(b, ahead, x + 18, 305, C.GREY);
  }
}
