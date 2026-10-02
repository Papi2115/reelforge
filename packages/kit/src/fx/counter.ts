/**
 * `kit.fx.counter`: a 3D odometer - chunky voxel digits on rolling drums behind a bezel window,
 * counting from `from` to `to` between `start` and `end`. Thousands separators, decimals,
 * prefix/suffix units ("$", "KB"); leading zeros stay blank until the number grows into them.
 */
import type * as THREE from 'three';
import { z } from 'zod';
import { createKitObject, type KitObject } from '../object.js';
import { defineFx, type KitTools } from '../registry.js';
import { normalizeText } from './font.js';
import { asFx, EASES, easeParam, progress, timeParam } from './shared.js';
import { glyphSet, voxelSizeFor } from './text.js';

export const counterFormat = z.object({
  decimals: z.number().int().min(0).max(4).default(0).describe('Digits after the decimal point'),
  separator: z
    .string()
    .max(1)
    .default(',')
    .describe("Thousands separator: ',', '.', ' ' or '' for none"),
  point: z.string().length(1).default('.').describe('Decimal point character'),
  prefix: z.string().max(6).default('').describe('Text before the number, e.g. "$"'),
  suffix: z.string().max(8).default('').describe('Text after the number, e.g. "KB" or "%"'),
});

export type CounterFormat = z.output<typeof counterFormat>;

export const counterParams = z.object({
  from: z.number().default(0).describe('Value before start'),
  to: z.number().default(100).describe('Value from end on'),
  start: timeParam.default(0).describe('Local time counting starts'),
  end: timeParam.default(2).describe('Local time the target is reached'),
  ease: easeParam.default('easeOutCubic'),
  format: counterFormat.default({
    decimals: 0,
    separator: ',',
    point: '.',
    prefix: '',
    suffix: '',
  }),
  digits: z.number().int().min(1).max(12).default(1).describe('Minimum integer digit wheels'),
  roll: z
    .enum(['odometer', 'snap'])
    .default('odometer')
    .describe('odometer = digits roll on drums, snap = digits change instantly'),
  height: z.number().positive().default(1).describe('Digit height in units'),
  color: z.string().default('text').describe('Digit colour (palette name)'),
  glow: z.boolean().default(true).describe('Unlit digits (always readable)'),
  frame: z.boolean().default(true).describe('Bezel and dark backing around the digits'),
  frameColor: z.string().default('ground').describe('Bezel colour (palette name)'),
});

export type CounterParams = z.output<typeof counterParams>;

const MAX_SCALED = 1e15;

/** Counter value at time t (eased from `from` to `to` between start and end). */
export function counterValue(params: CounterParams, t: number): number {
  const k = EASES[params.ease](progress(t, params.start, params.end));
  return params.from + (params.to - params.from) * k;
}

/** |value| scaled to whole units of the last decimal, snapped when within float noise. */
function scaled(value: number, decimals: number): number {
  const raw = Math.min(MAX_SCALED, Math.abs(value) * 10 ** decimals);
  const rounded = Math.round(raw);
  return Math.abs(raw - rounded) < 1e-6 ? rounded : raw;
}

/**
 * Odometer wheel positions (continuous digit values 0..10, least significant first) of a
 * scaled value: a wheel turns only while every lower wheel rolls from 9 to 0.
 */
export function odometerWheels(scaledValue: number, wheels: number): number[] {
  return Array.from({ length: wheels }, (_, index) => {
    const unit = 10 ** index;
    const base = Math.floor(scaledValue / unit) % 10;
    if (index === 0) return scaledValue % 10;
    const lower = scaledValue % unit;
    const carry = Math.max(0, lower - (unit - 1));
    return base + carry;
  });
}

/** Text of a value as the counter shows it at rest, e.g. "$1,024 KB". */
export function formatCounter(value: number, format: CounterFormat): string {
  const fixed = Math.abs(value).toFixed(format.decimals);
  const [whole = '0', fraction] = fixed.split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, format.separator);
  const number = fraction === undefined ? grouped : `${grouped}${format.point}${fraction}`;
  const sign = value < 0 && Number(fixed) !== 0 ? '-' : '';
  const suffix = format.suffix.length > 0 ? ` ${format.suffix}` : '';
  return `${sign}${format.prefix}${number}${suffix}`;
}

function integerDigits(value: number): number {
  return Math.max(1, Math.floor(Math.abs(value)).toString().length);
}

/** Wrapped offset of digit `digit` from wheel position `wheel`, in [-5, 5). */
export function drumOffset(digit: number, wheel: number): number {
  return ((((digit - wheel) % 10) + 15) % 10) - 5;
}

type Cell =
  | { readonly kind: 'wheel'; readonly wheel: number; readonly x: number }
  | {
      readonly kind: 'static';
      readonly char: string;
      readonly x: number;
      /** Wheel whose appearance shows this glyph (separators), -1 = always. */
      readonly after: number;
      readonly floating: boolean;
    };

/** Window rows (digit + 1 above/below) and bezel bar rows, in digit voxels. */
const WINDOW_ROWS = 9;
const BAR_ROWS = 5;
const SIDE_COLUMNS = 2;

/** Bezel frame in front of the drums and a dark backing behind them. */
function bezel(
  tools: KitTools,
  params: CounterParams,
  width: number,
  radius: number,
): [KitObject, KitObject] {
  const voxel = voxelSizeFor(params.height);
  const columns = Math.round(width / voxel) + 2 + 2 * SIDE_COLUMNS;
  const rows = WINDOW_ROWS + 2 * BAR_ROWS;
  const frame = tools.voxel.generate(
    [columns, rows, 2],
    (x, y) =>
      x < SIDE_COLUMNS || x >= columns - SIDE_COLUMNS || y < BAR_ROWS || y >= rows - BAR_ROWS
        ? 1
        : 0,
    [params.frameColor],
  );
  // Grid z = -0.5 at the origin: the bezel stands just in front of the digits (depth 2).
  const front = tools.voxel.mesh(frame, { voxelSize: voxel, pivot: [columns / 2, rows / 2, -0.5] });
  const inner = [columns - 2 * SIDE_COLUMNS, WINDOW_ROWS, 1] as const;
  const backing = tools.voxel.mesh(tools.voxel.box(inner, 'shadow'), {
    voxelSize: voxel,
    pivot: [inner[0] / 2, inner[1] / 2, 1],
    ao: 0,
  });
  backing.position.z = -radius * 0.5;
  return [front, backing];
}

export const counter = defineFx({
  name: 'counter',
  description:
    'Odometer/counter: chunky voxel digits rolling on drums from `from` to `to` between start and end, with thousands separators, decimals and units (format: { separator, decimals, prefix, suffix: "KB" }). counter.valueAt(t) / counter.textAt(t) give the shown value. fx.update(t) every frame.',
  params: counterParams,
  anchors: { window: 'centre of the digit window (= the object origin)' },
  build(params, tools) {
    const { three } = tools;
    const { format } = params;
    const color = params.glow ? { color: params.color, glow: true } : params.color;
    const glyphs = glyphSet(tools, { height: params.height, color, bold: true, depth: 2 });
    const voxel = voxelSizeFor(params.height);
    const digitWidth = glyphs.width('0');
    const gap = voxel;
    const intWheels = Math.max(params.digits, integerDigits(params.from), integerDigits(params.to));
    const wheels = intWheels + format.decimals;
    const cells: Cell[] = [];
    let x = 0;
    const addStatic = (text: string, after: number, floating: boolean): void => {
      for (const char of normalizeText(text)) {
        cells.push({ kind: 'static', char, x, after, floating });
        x += (char === ' ' ? 3 * voxel : glyphs.width(char)) + gap;
      }
    };
    const signed = params.from < 0 || params.to < 0;
    if (signed) addStatic('-', -1, true);
    addStatic(format.prefix, -1, true);
    for (let wheel = wheels - 1; wheel >= 0; wheel -= 1) {
      cells.push({ kind: 'wheel', wheel, x });
      x += digitWidth + gap;
      const integer = wheel - format.decimals;
      if (integer > 0 && integer % 3 === 0 && format.separator.length > 0) {
        addStatic(format.separator, wheel, false);
      }
      if (wheel === format.decimals && format.decimals > 0) addStatic(format.point, -1, false);
    }
    if (format.suffix.length > 0) addStatic(` ${format.suffix}`, -1, false);
    const width = x - gap;
    const height = params.height;
    // Arc between neighbours ~1.13 digit heights; at +-36 degrees they sit behind the bezel.
    const radius = height * 1.8;
    const step = (Math.PI * 2) / 10;
    const object = createKitObject(three, { kitType: 'counter', anchors: { window: [0, 0, 0] } });
    const content = new three.Group();
    content.position.set(-width / 2, 0, 0);
    object.add(content);
    const statics: { mesh: THREE.Object3D; cell: Cell & { kind: 'static' } }[] = [];
    const drums: { wheel: number; digits: THREE.Object3D[] }[] = [];
    for (const cell of cells) {
      if (cell.kind === 'static') {
        const mesh = glyphs.mesh(cell.char);
        if (!mesh) continue;
        mesh.position.set(cell.x, -height / 2, 0);
        content.add(mesh);
        statics.push({ mesh, cell });
        continue;
      }
      const drum = new three.Group();
      drum.position.set(cell.x + digitWidth / 2, 0, -radius);
      content.add(drum);
      const digits = Array.from({ length: 10 }, (_, digit) => {
        const holder = new three.Group();
        const mesh = glyphs.mesh(String(digit));
        if (mesh) {
          mesh.position.set(-digitWidth / 2, -height / 2, radius);
          holder.add(mesh);
        }
        drum.add(holder);
        return holder;
      });
      drums.push({ wheel: cell.wheel, digits });
    }
    if (params.frame) object.add(...bezel(tools, params, width, radius));
    // With the bezel, neighbours roll in hidden behind it; without, only the middle shows.
    const reach = params.frame ? 1 : 0.5;
    const firstWheelX = cells.find((cell) => cell.kind === 'wheel')?.x ?? 0;
    const valueAt = (t: number): number => counterValue(params, t);
    const textAt = (t: number): string => formatCounter(valueAt(t), format);
    const fx = asFx(object, (t) => {
      const value = valueAt(t);
      const units = scaled(value, format.decimals);
      const positions = odometerWheels(units, wheels);
      let leftmost = format.decimals;
      for (const { wheel, digits } of drums) {
        const raw = positions[wheel] ?? 0;
        const position = params.roll === 'snap' ? Math.floor(raw + 1e-9) % 10 : raw;
        const integer = wheel > format.decimals;
        if (!integer || units >= 10 ** wheel - 1) leftmost = Math.max(leftmost, wheel);
        digits.forEach((holder, digit) => {
          const offset = drumOffset(digit, position);
          // Leading zeros stay blank until the number grows into the wheel.
          const blank = digit === 0 && integer && units < 10 ** wheel;
          holder.visible = Math.abs(offset) < reach && !blank;
          holder.rotation.x = offset * step;
        });
      }
      // Sign and prefix sit just left of the leftmost shown digit.
      const leftX = cells.find((cell) => cell.kind === 'wheel' && cell.wheel === leftmost)?.x;
      const shift = (leftX ?? firstWheelX) - firstWheelX;
      for (const { mesh, cell } of statics) {
        if (cell.floating) {
          mesh.position.x = cell.x + shift;
          mesh.visible = cell.char !== '-' || value < 0;
        } else {
          mesh.visible = cell.after < 0 || units >= 10 ** cell.after - 0.5;
        }
      }
    });
    return Object.assign(fx, { valueAt, textAt });
  },
});
