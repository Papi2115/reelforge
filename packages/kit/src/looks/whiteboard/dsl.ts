/**
 * The compact stroke language of `whiteboardSketch`: one string per thing to draw, coordinates in
 * 640x360-frame pixels, an optional ink name at the end (`'arrow 200 180 420 180 red'`).
 *
 *   line x1 y1 x2 y2 [...]     polyline             curve x1 y1 cx cy x2 y2 [x3 y3]  Bezier
 *   arrow x1 y1 x2 y2          straight arrow       arrow x1 y1 cx cy x2 y2          curved arrow
 *   box x y w h [r]            rectangle            circle cx cy r [ry]              circle/ellipse
 *   bracket x1 y1 x2 y2 [d]    curly bracket        underline x y w                  underline
 *   zigzag x1 y1 x2 y2 [n] [a] zigzag               hatch x y w h [gap]              scribble fill
 *   dot x y [r]                filled dot           write x y TEXT...                handwriting
 *   <doodle> x y [size]        built-in doodle centred at x y, size = box edge (default 100)
 */
import { KitError } from '../../errors.js';
import { DOODLE_NAMES, DOODLES, isDoodle } from './doodles.js';
import {
  arrowHead,
  bezier,
  curlyBracket,
  ellipse,
  transform,
  zigzag,
  type Point,
  type Polyline,
} from './geometry.js';

export type Figure =
  | { readonly kind: 'pen'; readonly paths: readonly Polyline[] }
  | { readonly kind: 'write'; readonly text: string; readonly x: number; readonly y: number };

export interface ParsedStroke {
  readonly figure: Figure;
  /** Trailing ink / palette name, if any. */
  readonly color: string | undefined;
}

export const PRIMITIVES = [
  'line',
  'curve',
  'arrow',
  'box',
  'circle',
  'bracket',
  'underline',
  'zigzag',
  'hatch',
  'dot',
  'write',
] as const;

const NUMBER = /^-?\d+(?:\.\d+)?$/;

function pairs(values: readonly number[]): Point[] {
  const result: Point[] = [];
  for (let index = 0; index + 1 < values.length; index += 2) {
    result.push([values[index] ?? 0, values[index + 1] ?? 0]);
  }
  return result;
}

function boxPath(x: number, y: number, w: number, h: number, r: number): Point[] {
  if (r <= 0) {
    return [
      [x + 2, y],
      [x + w, y],
      [x + w, y + h],
      [x, y + h],
      [x, y - 2],
    ];
  }
  const radius = Math.min(r, w / 2, h / 2);
  const corner = (cx: number, cy: number, from: number): Point[] =>
    ellipse(cx, cy, radius, radius, from, from + Math.PI / 2, 3);
  return [
    ...corner(x + w - radius, y + radius, -Math.PI / 2),
    ...corner(x + w - radius, y + h - radius, 0),
    ...corner(x + radius, y + h - radius, Math.PI / 2),
    ...corner(x + radius, y + radius, Math.PI),
    [x + radius + 3, y],
  ];
}

function hatch(x: number, y: number, w: number, h: number, gap: number): Point[] {
  const points: Point[] = [];
  const step = Math.max(2, gap);
  const slant = Math.min(step, h / 3);
  for (let column = 0, index = 0; column <= w; column += step / 2, index += 1) {
    points.push(index % 2 === 0 ? [x + column, y + h] : [x + Math.min(w, column + slant), y]);
  }
  return points;
}

type Builder = (values: readonly number[]) => Polyline[] | undefined;

/** Primitive builders: undefined = wrong number of values. */
const BUILDERS: Readonly<Record<Exclude<(typeof PRIMITIVES)[number], 'write'>, Builder>> = {
  line: (v) => (v.length >= 4 && v.length % 2 === 0 ? [pairs(v)] : undefined),
  curve: (v) => (v.length === 6 || v.length === 8 ? [bezier(pairs(v))] : undefined),
  arrow: (v) => {
    if (v.length !== 4 && v.length !== 6) return undefined;
    const points = pairs(v);
    const shaft = v.length === 4 ? points : bezier(points);
    const tip = shaft.at(-1) ?? [0, 0];
    const back = shaft[Math.max(0, shaft.length - 3)] ?? shaft[0] ?? tip;
    const length = Math.hypot(tip[0] - (points[0]?.[0] ?? 0), tip[1] - (points[0]?.[1] ?? 0));
    return [shaft, arrowHead(back, tip, Math.min(12, Math.max(6, length * 0.18)))];
  },
  box: ([x = 0, y = 0, w = 0, h = 0, r = 0, ...rest]) =>
    rest.length === 0 && w > 0 && h > 0 ? [boxPath(x, y, w, h, r)] : undefined,
  circle: (v) => {
    const [cx = 0, cy = 0, rx = 0, ry = rx] = v;
    if (v.length < 3 || v.length > 4 || rx <= 0 || ry <= 0) return undefined;
    return [ellipse(cx, cy, rx, ry, -1.75, -1.75 + Math.PI * 2.07, 3)];
  },
  bracket: (v) => {
    if (v.length !== 4 && v.length !== 5) return undefined;
    const [a, b] = pairs(v.slice(0, 4));
    return a && b ? [curlyBracket(a, b, v[4] ?? 10)] : undefined;
  },
  underline: ([x = 0, y = 0, w = 0, ...rest]) =>
    rest.length === 0 && w > 0
      ? [
          bezier([
            [x, y],
            [x + w / 2, y + 2.5],
            [x + w, y - 1],
          ]),
        ]
      : undefined,
  zigzag: (v) => {
    if (v.length < 4 || v.length > 6) return undefined;
    const [a, b] = pairs(v.slice(0, 4));
    return a && b ? [zigzag(a, b, v[4] ?? 6, v[5] ?? 8)] : undefined;
  },
  hatch: ([x = 0, y = 0, w = 0, h = 0, gap = 8, ...rest]) =>
    rest.length === 0 && w > 0 && h > 0 ? [hatch(x, y, w, h, gap)] : undefined,
  dot: ([x = 0, y = 0, r = 2.5, ...rest]) => {
    if (rest.length > 0) return undefined;
    const rings: Point[][] = [];
    for (let radius = r; radius > 0.5; radius -= 1.5) {
      rings.push(ellipse(x, y, radius, radius, 0, Math.PI * 2, 2));
    }
    return [rings.flat().concat([[x, y]])];
  },
};

const USAGE: Readonly<Record<string, string>> = {
  line: 'line x1 y1 x2 y2 [x3 y3 ...]',
  curve: 'curve x1 y1 cx cy x2 y2 [x3 y3]',
  arrow: 'arrow x1 y1 x2 y2 | arrow x1 y1 cx cy x2 y2',
  box: 'box x y w h [radius]',
  circle: 'circle cx cy r [ry]',
  bracket: 'bracket x1 y1 x2 y2 [depth]',
  underline: 'underline x y width',
  zigzag: 'zigzag x1 y1 x2 y2 [teeth] [amplitude]',
  hatch: 'hatch x y w h [gap]',
  dot: 'dot x y [r]',
  write: 'write x y TEXT',
};

function fail(call: string, source: string, message: string): never {
  throw new KitError('invalid-params', `${call}: stroke "${source}": ${message}`);
}

/** Parses one stroke string (see the module comment); `call` names the template in errors. */
export function parseStroke(source: string, call: string): ParsedStroke {
  const tokens = source
    .trim()
    .split(/[\s,]+/)
    .filter((token) => token.length > 0);
  const op = tokens[0] ?? '';
  if (op === 'write') {
    const match = /^\s*write[\s,]+(-?[\d.]+)[\s,]+(-?[\d.]+)\s+(.+)$/s.exec(source);
    if (!match) fail(call, source, `expected ${USAGE['write'] ?? ''}`);
    return {
      figure: { kind: 'write', x: Number(match[1]), y: Number(match[2]), text: match[3] ?? '' },
      color: undefined,
    };
  }
  let index = 1;
  const values: number[] = [];
  while (index < tokens.length && NUMBER.test(tokens[index] ?? '')) {
    values.push(Number(tokens[index]));
    index += 1;
  }
  const words = tokens.slice(index);
  if (words.length > 1)
    fail(call, source, `unexpected "${words.join(' ')}" (one ink name at most)`);
  const color = words[0];
  if (isDoodle(op)) {
    const [x = 0, y = 0, size = 100, ...rest] = values;
    if (values.length < 2 || rest.length > 0 || size <= 0) {
      fail(call, source, `expected ${op} x y [size]`);
    }
    return { figure: { kind: 'pen', paths: transform(DOODLES[op](), size / 100, [x, y]) }, color };
  }
  const builder = (BUILDERS as Readonly<Record<string, Builder>>)[op];
  if (!builder) {
    fail(
      call,
      source,
      `unknown shape "${op}"; use ${PRIMITIVES.join(', ')} or a doodle (${DOODLE_NAMES.join(', ')})`,
    );
  }
  const paths = builder(values);
  if (!paths) fail(call, source, `expected ${USAGE[op] ?? op}`);
  return { figure: { kind: 'pen', paths }, color };
}
