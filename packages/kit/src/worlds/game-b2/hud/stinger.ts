/**
 * The loud HUD moments of look C `rpg-boss`: a big stinger word whose letters slam in one by one
 * on uneven beats (each lands with an overshoot, a few degrees off true, a hard umber shadow) and
 * fall out under gravity when it ends; damage numbers that pop off the meter or the boss bar,
 * rise and dissolve; and a shake of the whole HUD with decay. Pure functions of t.
 */
import { Bmp, rotate } from '../core/bitmap.js';
import { drawText, textWidth } from '../core/font.js';
import { bayer, EASES, hash3, seg } from '../core/rand.js';
import { C, T } from '../palette.js';

export interface Stinger {
  readonly text: string;
  readonly x: number;
  readonly y: number;
  readonly scale: number;
  /** Landing time per character (spaces included, they land nothing). */
  readonly lands: readonly number[];
  readonly until: number;
  readonly seed: number;
}

export interface Damage {
  readonly text: string;
  readonly at: number;
  readonly x: number;
  readonly y: number;
  readonly colour: number;
}

export interface Shake {
  readonly at: number;
  readonly amp: number;
}

const letters = new Map<string, Bmp>();

function letter(ch: string, scale: number, tilt: number): Bmp {
  const key = `${ch}:${String(scale)}:${String(tilt)}`;
  const hit = letters.get(key);
  if (hit !== undefined) return hit;
  const w = textWidth(ch, scale) + 4;
  const b = new Bmp(w, 7 * scale + 4);
  drawText(b, ch, 2, 2, C.UMBER, scale);
  const top = new Bmp(w, 7 * scale + 4);
  drawText(top, ch, 0, 0, C.BULB, scale);
  b.blit(top, 0, 0);
  const out = tilt === 0 ? b : rotate(b, tilt);
  letters.set(key, out);
  return out;
}

/** Landing beats: uneven, a longer beat between words. */
export function stingerLands(text: string, at: number, seed: number): number[] {
  const out: number[] = [];
  let t = at;
  for (let i = 0; i < text.length; i += 1) {
    const gap = 0.06 + hash3(seed, i, 13) * 0.08 + (text[i - 1] === ' ' ? 0.14 : 0);
    t += i === 0 ? 0 : gap;
    out.push(t);
  }
  return out;
}

function blitScaled(b: Bmp, src: Bmp, cx: number, cy: number, k: number): void {
  const w = Math.round(src.w * k);
  const h = Math.round(src.h * k);
  const x0 = Math.round(cx - w / 2);
  const y0 = Math.round(cy - h / 2);
  for (let dy = 0; dy < h; dy += 1)
    for (let dx = 0; dx < w; dx += 1) {
      const c = src.d[Math.floor(dy / k) * src.w + Math.floor(dx / k)] ?? T;
      if (c !== T) b.px(x0 + dx, y0 + dy, c);
    }
}

export function drawStinger(b: Bmp, stinger: Stinger, t: number): void {
  const { text, scale, lands, until, seed } = stinger;
  if (t < (lands[0] ?? until) || t >= until) return;
  let x = stinger.x;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text.charAt(i);
    const advance = textWidth(ch, scale) + scale;
    const land = lands[i] ?? until;
    if (ch === ' ' || t < land) {
      x += ch === ' ' ? 3 * scale + scale : advance;
      continue;
    }
    const tilt = Math.round((hash3(seed, i, 5) - 0.5) * 8);
    const bmp = letter(ch, scale, tilt);
    const pop = EASES.outBack(seg(t, land, land + 0.12));
    const k = 1.7 - 0.7 * pop;
    const jy = Math.round((hash3(seed, i, 6) - 0.5) * 4);
    const fallAt = until - 0.45 + hash3(seed, i, 7) * 0.15;
    const drop = t > fallAt ? 900 * (t - fallAt) ** 2 : 0;
    blitScaled(b, bmp, x + advance / 2, stinger.y + bmp.h / 2 + jy - (1 - pop) * 8 + drop, k);
    x += advance;
  }
}

/** A damage number: pops with an overshoot, rises, holds a beat and dissolves (0.95 s). */
export function drawDamage(b: Bmp, damage: Damage, t: number): void {
  const dt = t - damage.at;
  if (dt < 0 || dt >= 0.95) return;
  const rise = EASES.out(seg(dt, 0, 0.7)) * 18;
  const pop = EASES.outBack(seg(dt, 0, 0.14));
  const fade = seg(dt, 0.65, 0.95);
  const scale = pop < 0.9 ? 3 : 2;
  const w = textWidth(damage.text, scale);
  const x0 = Math.round(damage.x - w / 2);
  const y0 = Math.round(damage.y - rise);
  const layer = new Bmp(w + 2, 7 * scale + 2);
  drawText(layer, damage.text, 0, 0, damage.colour, scale, { shadow: C.VOID });
  for (let y = 0; y < layer.h; y += 1)
    for (let x = 0; x < layer.w; x += 1) {
      const c = layer.d[y * layer.w + x] ?? T;
      if (c !== T && bayer(x0 + x, y0 + y) >= fade) b.px(x0 + x, y0 + y, c);
    }
}

/** Offset of the whole HUD at t (shakes with decay, summed). */
export function hudShake(shakes: readonly Shake[], t: number): readonly [number, number] {
  let dx = 0;
  let dy = 0;
  for (const { at, amp } of shakes) {
    const dt = t - at;
    if (dt < 0 || dt > 0.6) continue;
    const a = amp * Math.exp(-dt * 8);
    dx += a * Math.sin(dt * 47 + 1) * 0.5;
    dy += a * Math.cos(dt * 61);
  }
  return [Math.round(dx), Math.round(dy)];
}

/** Shifts the HUD screen by (dx, dy) in place; what slides in is transparent. */
export function shiftScreen(b: Bmp, dx: number, dy: number): void {
  if (dx === 0 && dy === 0) return;
  const src = b.d.slice();
  b.d.fill(T);
  for (let y = 0; y < b.h; y += 1) {
    const sy = y - dy;
    if (sy < 0 || sy >= b.h) continue;
    for (let x = 0; x < b.w; x += 1) {
      const sx = x - dx;
      if (sx >= 0 && sx < b.w) b.d[y * b.w + x] = src[sy * b.w + sx] ?? T;
    }
  }
}
