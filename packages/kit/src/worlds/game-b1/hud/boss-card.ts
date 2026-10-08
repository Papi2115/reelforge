/**
 * The boss card (in-game: drawn into the TV picture, so it gets the CRT): "BOSS n" types with an
 * irregular hand, the name slams in Box Art from a side (travel, overshoot, decaying shake) on a
 * playfield plate with a stepped edge, then the HP segments arrive unevenly, in a real unit or
 * unlabelled. Each lost segment flashes white and shakes the card; `defeat` = flicker death.
 * Only for the central problem of the film (QUALITY.md §6).
 */
import type { IndexCanvas } from '../core/canvas.js';
import { boxArt, boxMask, joy, joyWidth } from '../core/fonts.js';
import { clamp01, EASES, frameOf, hash, shake, typed } from '../core/math.js';
import { C } from '../palette.js';

export interface BossHp {
  readonly n: number;
  readonly label: string;
  /** [t, value] steps; the bar starts full (n). */
  readonly keys: readonly (readonly [number, number])[];
  readonly segW: number;
}

export interface BossSpec {
  readonly at: number;
  readonly num: number;
  readonly name: string;
  readonly from: 'left' | 'right' | 'top';
  readonly x: number;
  readonly y: number;
  readonly seed: number;
  readonly hp: BossHp | undefined;
  readonly defeat: number | undefined;
}

const SCALE = 3;

/** HP value at t and the times each segment was lost. */
function hpState(hp: BossHp, t: number): { value: number; lost: (number | undefined)[] } {
  let value = hp.n;
  const lost: (number | undefined)[] = [];
  for (const [at, next] of hp.keys) {
    if (t < at) break;
    for (let i = Math.ceil(value) - 1; i >= Math.ceil(next); i -= 1) lost[i] = at;
    value = next;
  }
  return { value, lost };
}

/** The decaying shake of every lost segment (the card is hit). */
function hitShake(spec: BossSpec, t: number): { x: number; y: number } {
  let x = 0;
  let y = 0;
  spec.hp?.keys.forEach(([at], i) => {
    const s = shake(t, at, 3, 10, spec.seed + 300 + i);
    x += s.x * 2;
    y += s.y * 2;
  });
  return { x, y };
}

export function drawBossCard(cv: IndexCanvas, spec: BossSpec, t: number): void {
  const u = t - spec.at;
  if (u < 0) return;
  const gone = spec.defeat === undefined ? 0 : clamp01((t - spec.defeat) / 0.62);
  if (gone >= 1) return;
  const hit = hitShake(spec, t);
  const ox = spec.x + hit.x;
  const oy = spec.y + hit.y;
  const tag = `BOSS ${String(spec.num)}`;
  const shown = typed(tag, t, spec.at, spec.seed, 16);
  if (shown > 0) {
    cv.rect(ox - 3, oy - 3, joyWidth(tag.slice(0, shown), 2) + 6, 18, C.VOID);
    joy(cv, tag.slice(0, shown), ox, oy, 2, C.TAN);
  }
  const ts = u - 0.42;
  if (ts >= 0) nameSlam(cv, spec, t, ts, ox, oy, gone);
  if (spec.hp !== undefined) drawHp(cv, spec, spec.hp, t, ox, oy);
}

function nameSlam(
  cv: IndexCanvas,
  spec: BossSpec,
  t: number,
  ts: number,
  ox: number,
  oy: number,
  gone: number,
): void {
  const nameW = boxMask(spec.name, SCALE).w + 2;
  const nameH = 6 * SCALE;
  let p = 0;
  if (ts < 0.13) p = 1 - EASES.in(ts / 0.13);
  else if (ts < 0.2) p = -0.03 * Math.sin(((ts - 0.13) / 0.07) * Math.PI);
  const dist = spec.from === 'top' ? 90 : 300;
  const dir = spec.from === 'right' ? 1 : -1;
  const dx = spec.from === 'top' ? 0 : dir * p * dist;
  const dy = spec.from === 'top' ? -p * dist : 0;
  const sh = shake(t, spec.at + 0.55, 4, 10, spec.seed + 5);
  const nx = ox + dx + sh.x;
  const ny = oy + 17 + dy + sh.y;
  // plate: a playfield band with a stepped right edge
  cv.rect(nx - 6, ny - 4, nameW + 6, nameH + 9, C.VOID);
  cv.rect(nx + nameW, ny, 8, nameH + 5, C.VOID);
  cv.rect(nx + nameW + 8, ny + 6, 8, nameH - 1, C.VOID);
  const flicker = gone > 0 && frameOf(t) % 2 === 0;
  if (!flicker)
    boxArt(cv, spec.name, nx, ny, SCALE, { fill: C.CREAM, extrude: C.RUST, key: C.VOID });
}

function drawHp(cv: IndexCanvas, spec: BossSpec, hp: BossHp, t: number, ox: number, oy: number) {
  const u = t - spec.at;
  const y = oy + 17 + 6 * SCALE + 12;
  let x = ox;
  if (hp.label.length > 0) {
    cv.rect(x - 3, y - 3, joyWidth(hp.label, 2) + 8, 18, C.VOID);
    x += joy(cv, hp.label, x, y, 2, C.TAN) + 7;
  }
  const { value, lost } = hpState(hp, t);
  for (let i = 0; i < hp.n; i += 1) {
    // segments arrive with uneven delays
    const arrive = 0.62 + i * 0.07 + hash(spec.seed, i, 21) * 0.06;
    if (u < arrive) break;
    const sx = x + i * (hp.segW + 2);
    const pop = u - arrive < 0.06 ? -2 : 0;
    cv.rect(sx - 1, y - 1 + pop, hp.segW + 2, 14, C.VOID);
    const fill = clamp01(value - i);
    const since = lost[i] === undefined ? -1 : t - (lost[i] ?? 0);
    if (since >= 0 && since < 0.07) cv.rect(sx, y + pop, hp.segW, 12, C.WHITE);
    else if (fill > 0) {
      cv.rect(sx, y + pop, Math.round(hp.segW * fill), 12, C.CRIMSON);
      cv.rect(sx, y + pop, Math.round(hp.segW * fill), 2, C.ORANGE);
    } else {
      cv.rect(sx, y + pop, hp.segW, 12, C.WALNUT_D);
      cv.px(sx + 3 + (i % 3), y + 4 + pop, C.TEAK);
      cv.px(sx + 4 + (i % 3), y + 5 + pop, C.TEAK);
    }
  }
}
