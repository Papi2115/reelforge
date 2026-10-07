/**
 * The bars of the Game B2 HUD; every one carries story data (QUALITY.md §6): the compass plate
 * (year that rolls when the story jumps in time, heading tape, objective marker, the place typed
 * under it), the threat meter (HP-style, only for the thing really in danger), status effects,
 * the boss bar (only for the central problem) and the film-progress strip with checkpoint flags.
 */
import { Bmp } from '../core/bitmap.js';
import { drawText, textWidth } from '../core/font.js';
import { clamp, EASES, seg } from '../core/rand.js';
import { C } from '../palette.js';
import type { Camera } from '../ray/camera.js';
import { inset, plate } from './plate.js';

export interface YearKey {
  readonly at: number;
  readonly year: string;
  readonly place: string;
}

export interface Compass {
  readonly at: number;
  readonly until: number;
  readonly years: readonly YearKey[];
  readonly targets: readonly { readonly at: number; readonly pos: readonly [number, number] }[];
}

export interface Meter {
  readonly label: string;
  readonly at: number;
  readonly until: number;
  readonly segments: number;
  /** [t, value 0..segments] keys, eased in-out between them. */
  readonly keys: readonly (readonly [number, number])[];
}

export interface Status {
  readonly label: string;
  readonly icon: 'hourglass' | 'waves' | 'alarm';
  readonly at: number;
  readonly until: number;
}

export interface Boss {
  readonly name: string;
  readonly label: string;
  readonly at: number;
  readonly until: number;
  /** [t, share 0..1] keys; each step lands with an overshoot. */
  readonly keys: readonly (readonly [number, number])[];
}

export interface Progress {
  readonly at: number;
  readonly until: number;
  /** Share of the film done at the shot's start and end (0..1). */
  readonly from: number;
  readonly to: number;
  readonly chapters: readonly number[];
}

export interface Checkpoint {
  readonly label: string;
  readonly at: number;
  readonly until: number;
}

/** Slide-in share of a persistent HUD element (1 = in place). */
export function presence(t: number, at: number, until: number): number {
  return Math.min(EASES.out(seg(t, at, at + 0.3)), 1 - seg(t, until - 0.25, until));
}

function keyAt<T extends { readonly at: number }>(list: readonly T[], t: number): T | undefined {
  return list.filter((key) => key.at <= t).at(-1);
}

function yearRoll(b: Bmp, compass: Compass, t: number, x: number, y: number): void {
  const index = compass.years.findLastIndex((key) => key.at <= t);
  const current = compass.years[index];
  if (current === undefined) return;
  const previous = compass.years[index - 1];
  const u = EASES.outBack(seg(t, current.at, current.at + 0.42));
  const clip = new Bmp(46, 18);
  const dir = previous !== undefined && Number(previous.year) > Number(current.year) ? -1 : 1;
  if (previous !== undefined && u < 1)
    drawText(clip, previous.year, 2, 2 - dir * 18 * u, C.BULB, 2);
  drawText(clip, current.year, 2, 2 + dir * 18 * (1 - u), C.BULB, 2);
  b.blit(clip, x, y);
}

export function drawCompass(b: Bmp, compass: Compass, t: number, cam: Camera | undefined): void {
  const alpha = presence(t, compass.at, compass.until);
  if (alpha <= 0) return;
  const y0 = 14 - Math.round((1 - alpha) * 34);
  plate(b, 20, y0, 212, 26);
  inset(b, 25, y0 + 4, 46, 18);
  yearRoll(b, compass, t, 25, y0 + 4);
  const tx = 76;
  const tw = 150;
  const ty = y0 + 4;
  inset(b, tx, ty, tw, 18);
  const bearing = (cam?.yaw ?? 0) + 90;
  const scale = tw / 124;
  for (let deg = 0; deg < 360; deg += 15) {
    const rel = ((deg - bearing + 540) % 360) - 180;
    if (Math.abs(rel) > 60) continue;
    const x = Math.round(tx + tw / 2 + rel * scale);
    if (deg % 90 === 0)
      drawText(
        b,
        ['N', 'E', 'S', 'W'][deg / 90] ?? 'N',
        x - 2,
        ty + 6,
        deg === 0 ? C.PAPER : C.PUTTY,
      );
    else b.rect(x, ty + (deg % 45 === 0 ? 9 : 11), 1, deg % 45 === 0 ? 5 : 3, C.SLATE);
  }
  const target = keyAt(compass.targets, t);
  if (target !== undefined && cam !== undefined) {
    const heading = (Math.atan2(target.pos[1] - cam.y, target.pos[0] - cam.x) * 180) / Math.PI + 90;
    const rel = clamp(((heading - bearing + 540) % 360) - 180, -58, 58);
    const mx = Math.round(tx + tw / 2 + rel * scale);
    b.poly([mx - 3, ty + 3, mx, ty, mx + 3, ty + 3, mx, ty + 6], C.SAND_L);
  }
  b.rect(tx + tw / 2, ty + 15, 1, 3, C.BULB);
  b.rect(tx + tw / 2 - 1, ty + 16, 3, 2, C.BULB);
  const year = keyAt(compass.years, t);
  if (year !== undefined && year.place !== '' && alpha > 0.9) {
    const n = Math.floor(
      seg(t, year.at + 0.3, year.at + 0.3 + year.place.length * 0.045) * year.place.length,
    );
    drawText(b, year.place.slice(0, n), 24, y0 + 30, C.PUTTY, 1, { shadow: C.VOID });
  }
}

/** The meter's level (segments) at t. */
export function meterLevel(meter: Meter, t: number): number {
  const keys = meter.keys;
  const first = keys[0];
  if (first === undefined) return meter.segments;
  if (t < first[0]) return first[1];
  for (let i = 1; i < keys.length; i += 1) {
    const [t1, v1] = keys[i] ?? first;
    const [t0, v0] = keys[i - 1] ?? first;
    if (t < t1) return v0 + (v1 - v0) * EASES.inOut(seg(t, t0, t1));
  }
  return keys.at(-1)?.[1] ?? meter.segments;
}

/** The threat meter and the status effects under the compass; returns the next free row. */
export function drawMeterAndStatus(
  b: Bmp,
  meter: Meter | undefined,
  statuses: readonly Status[],
  t: number,
): void {
  let y = 58;
  if (meter !== undefined && presence(t, meter.at, meter.until) > 0) {
    const level = meterLevel(meter, t);
    const appear = seg(t, meter.at, meter.at + 0.7);
    const labelW = textWidth(meter.label);
    b.rect(22, y - 2, labelW + 10 + meter.segments * 8 + 6, 11, C.VOID);
    b.rect(22, y - 2, labelW + 10 + meter.segments * 8 + 6, 1, C.CHAR);
    drawText(b, meter.label, 25, y, C.SAND);
    let x = 25 + labelW + 6;
    for (let k = 0; k < meter.segments; k += 1) {
      const w = 6 + (k % 3 === 1 ? 1 : 0);
      if (appear * meter.segments * (1 + 0.15 * Math.sin(k)) > k) {
        const fill = level - k;
        const losing =
          fill <= 0 &&
          fill > -1.2 &&
          (t * 7) % 1 < 0.5 &&
          meterLevel(meter, t - 0.6) > level + 0.05;
        b.rect(x, y, w, 6, losing ? C.CLAY : fill >= 1 ? C.FLUO : fill > 0 ? C.SAGE : C.CHAR);
      }
      x += w + (k % 4 === 2 ? 3 : 2);
    }
    y += 14;
  }
  for (const status of statuses) {
    if (t < status.at || t >= status.until) continue;
    const pop = EASES.outBack(seg(t, status.at, status.at + 0.25));
    const out = seg(t, status.until - 0.3, status.until);
    b.rect(22, y - 2, 11, 11, C.VOID);
    const tone =
      status.icon === 'hourglass' ? C.TUNGSTEN : status.icon === 'alarm' ? C.CLAY : C.FLUO;
    if (status.icon === 'hourglass') {
      b.poly([24, y, 31, y, 27.5, y + 3.5], tone);
      b.poly([27.5, y + 3.5, 31, y + 7, 24, y + 7], tone);
      b.rect(26, y + 5, 3, 2, C.BULB);
    } else if (status.icon === 'alarm') {
      b.ellipse(27.5, y + 4, 3.5, 3.5, tone);
      b.rect(27, y + 2, 1, 3, C.VOID);
    } else
      for (let k = 0; k < 3; k += 1)
        for (let xx = 0; xx < 8; xx += 1) b.px(24 + xx, y + k * 3 + (xx % 4 < 2 ? 0 : 1), tone);
    const label = status.label.slice(0, Math.floor(pop * status.label.length * (1 - out)));
    drawText(b, label, 37, y, tone, 1, { shadow: C.VOID });
    y += 14;
  }
}

/** The boss bar: name typed in, the bar grows, each step of the problem lands with an overshoot. */
export function drawBoss(b: Bmp, boss: Boss, t: number): void {
  if (t < boss.at || t >= boss.until) return;
  const out = seg(t, boss.until - 0.4, boss.until);
  const x = 262;
  const y = 16 - Math.round(out * 30);
  drawText(
    b,
    boss.name.slice(0, Math.floor(seg(t, boss.at, boss.at + 0.45) * boss.name.length)),
    x,
    y,
    C.PAPER,
    1,
    { shadow: C.VOID },
  );
  const bw = Math.round(190 * EASES.out(seg(t, boss.at + 0.15, boss.at + 0.45)));
  b.rect(x, y + 11, bw, 9, C.VOID);
  b.frame(x, y + 11, bw, 9, C.PUTTY);
  let share = 0;
  let previous = 0;
  for (const [at, value] of boss.keys) {
    share += (value - previous) * EASES.outBack(seg(t, at + 0.1, at + 0.35));
    previous = value;
  }
  const fw = Math.round(clamp(share, 0, 1) * (bw - 4));
  if (fw > 0) b.rect(x + 2, y + 13, fw, 5, C.ACCENT);
  if (bw > 150 && boss.label !== '')
    drawText(b, boss.label, x + 198, y + 12, C.SAND, 1, { shadow: C.VOID });
}

/** Film progress strip under the minimap: bulb fill = how far the film is, flags = chapters. */
export function drawProgress(
  b: Bmp,
  progress: Progress,
  checkpoints: readonly Checkpoint[],
  t: number,
  shotLength: number,
): void {
  const alpha = presence(t, progress.at, progress.until);
  if (alpha <= 0) return;
  const x = 538;
  const y = 80 - Math.round((1 - alpha) * 90);
  plate(b, x, y, 86, 9);
  b.rect(x + 4, y + 3, 78, 3, C.VOID);
  const share =
    progress.from + (progress.to - progress.from) * clamp(t / Math.max(0.1, shotLength), 0, 1);
  b.rect(x + 4, y + 4, Math.round(78 * share), 1, C.BULB);
  for (const chapter of progress.chapters) {
    const fx = x + 4 + Math.round(78 * chapter);
    const reached = share >= chapter;
    b.rect(fx, y + 1, 1, 6, reached ? C.SAND_L : C.SLATE);
    b.rect(fx + 1, y + 1, 2, 2, reached ? C.CLAY : C.CHAR);
  }
  for (const checkpoint of checkpoints) {
    if (t < checkpoint.at || t >= checkpoint.until) continue;
    const n = Math.floor(
      seg(t, checkpoint.at + 0.2, checkpoint.at + 0.2 + checkpoint.label.length * 0.05) *
        checkpoint.label.length,
    );
    const back = seg(t, checkpoint.until - 0.4, checkpoint.until);
    const text = checkpoint.label.slice(0, Math.floor(n * (1 - back)));
    const pole = x + 4 + Math.round(78 * share);
    const lift = EASES.outBack(seg(t, checkpoint.at, checkpoint.at + 0.3));
    b.rect(pole, y + 8 - Math.round(7 * lift), 1, Math.round(7 * lift) + 1, C.SAND_L);
    if (lift > 0.5) b.poly([pole + 1, y + 1, pole + 6, y + 3, pole + 1, y + 5], C.CLAY);
    drawText(b, text, 624 - textWidth(checkpoint.label), y + 12, C.SAND_L, 1, { shadow: C.VOID });
  }
}
