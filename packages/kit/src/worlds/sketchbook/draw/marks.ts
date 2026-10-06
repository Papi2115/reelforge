/**
 * Timed marks of a Sketchbook page: strokes (a pen line drawn from its start to its end over
 * [t0, t0 + dur]) and pencil fills (a hatch revealed along its sweep). Marks are data built once;
 * the renderer (ink.ts) draws them for any t. Writing turns text into one stroke per glyph stroke
 * with a seeded, uneven pace (gaps between letters and longer ones between words).
 */
import { INK } from '../inks.js';
import { layoutText, type TextLayout } from './lettering.js';
import { rnd, type EaseName } from './math.js';
import { polyLen, type Pts } from './paths.js';

export const TOOL_NAMES = [
  'felt',
  'fine',
  'bic',
  'red',
  'marker',
  'pencil',
  'cpencil',
  'hi',
] as const;
export type ToolName = (typeof TOOL_NAMES)[number];

export const PEN_NAMES = ['felt', 'red', 'bic', 'pencil', 'cpencil', 'marker', 'hi'] as const;
export type PenName = (typeof PEN_NAMES)[number];

export type NibKind = 'round' | 'bic' | 'chisel' | 'pencil' | 'cpencil';

export interface Tool {
  readonly color: number;
  readonly width: number;
  readonly kind: NibKind;
  /** Chisel nib length / angle / thickness. */
  readonly len: number;
  readonly deg: number;
  readonly thick: number;
  /** Writes only over paper-like pixels (highlighter). */
  readonly under: boolean;
  readonly pen: PenName;
  /** Drawing speed, page px per second. */
  readonly speed: number;
}

function tool(spec: Partial<Tool> & Pick<Tool, 'color' | 'kind' | 'pen' | 'speed'>): Tool {
  return { width: 1, len: 0, deg: 0, thick: 1, under: false, ...spec };
}

export const TOOLS: Readonly<Record<ToolName, Tool>> = {
  felt: tool({ color: INK.INK, width: 2, kind: 'round', pen: 'felt', speed: 520 }),
  fine: tool({ color: INK.INK, width: 1, kind: 'round', pen: 'felt', speed: 420 }),
  bic: tool({ color: INK.BIC, width: 1, kind: 'bic', pen: 'bic', speed: 300 }),
  red: tool({ color: INK.RED, width: 2, kind: 'round', pen: 'red', speed: 560 }),
  marker: tool({
    color: INK.INK,
    kind: 'chisel',
    len: 10,
    deg: -40,
    thick: 2,
    pen: 'marker',
    speed: 1300,
  }),
  pencil: tool({ color: INK.GRAPHITE, width: 1, kind: 'pencil', pen: 'pencil', speed: 380 }),
  cpencil: tool({ color: INK.ORANGE, width: 2, kind: 'cpencil', pen: 'cpencil', speed: 600 }),
  hi: tool({
    color: INK.HILITE,
    kind: 'chisel',
    len: 17,
    deg: 90,
    thick: 4,
    under: true,
    pen: 'hi',
    speed: 700,
  }),
};

/** A stroke's shape; `source` marks redraw it from t (animated poses, carried things). */
export interface Shape {
  readonly pts: Pts;
  readonly corners: readonly boolean[] | null;
}
export type ShapeSource = (t: number) => Shape;

interface MarkBase {
  readonly t0: number;
  readonly dur: number;
  readonly seed: number;
  /** The visible hand holds the pen while this mark is drawn. */
  readonly held: boolean;
  readonly pen: PenName;
  readonly color: number;
}

export interface StrokeMark extends MarkBase {
  readonly type: 'stroke';
  readonly shape: Shape;
  readonly source: ShapeSource | undefined;
  readonly tool: ToolName;
  readonly width: number;
  readonly len: number;
  readonly deg: number;
  readonly thick: number;
  /** Line-boil amplitude (1 = the seeded 1 px wobble, 0 = printed). */
  readonly boil: number;
  /** Boil cadence (redraws per second, 8-12). */
  readonly fps: number;
  readonly smooth: boolean;
  readonly ease: EaseName;
}

export interface FillMark extends MarkBase {
  readonly type: 'fill';
  readonly poly: Pts;
  readonly source: ((t: number) => Pts) | undefined;
  /** Hatch spacing (px) and direction (1 = "\", -1 = "/"). */
  readonly spacing: number;
  readonly dir: 1 | -1;
  /** Extra speckles between the hatch lines (crayon tooth). */
  readonly dense: boolean;
}

export type Mark = StrokeMark | FillMark;

export interface StrokeOptions {
  readonly tool?: ToolName | undefined;
  readonly color?: number | undefined;
  readonly width?: number | undefined;
  readonly t0?: number | undefined;
  readonly dur?: number | undefined;
  readonly speed?: number | undefined;
  readonly seed: number;
  readonly corners?: readonly boolean[] | null | undefined;
  readonly source?: ShapeSource | undefined;
  readonly held?: boolean | undefined;
  readonly boil?: number | undefined;
  readonly fps?: number | undefined;
  readonly smooth?: boolean | undefined;
  readonly ease?: EaseName | undefined;
  readonly len?: number | undefined;
  readonly deg?: number | undefined;
  readonly thick?: number | undefined;
}

export function strokeMark(pts: Pts, options: StrokeOptions): StrokeMark {
  const name = options.tool ?? 'felt';
  const spec = TOOLS[name];
  const shape: Shape = { pts, corners: options.corners ?? null };
  const length = polyLen(options.source ? options.source(options.t0 ?? 0).pts : pts);
  return {
    type: 'stroke',
    shape,
    source: options.source,
    tool: name,
    color: options.color ?? spec.color,
    width: options.width ?? spec.width,
    len: options.len ?? spec.len,
    deg: options.deg ?? spec.deg,
    thick: options.thick ?? spec.thick,
    t0: options.t0 ?? 0,
    dur: options.dur ?? Math.max(0.04, length / (options.speed ?? spec.speed)),
    seed: options.seed,
    boil: options.boil ?? 1,
    fps: options.fps ?? 10,
    held: options.held ?? true,
    smooth: options.smooth ?? true,
    ease: options.ease ?? 'hand',
    pen: spec.pen,
  };
}

export interface FillOptions {
  readonly color: number;
  readonly t0?: number | undefined;
  readonly dur?: number | undefined;
  readonly seed: number;
  readonly spacing?: number | undefined;
  readonly dir?: 1 | -1 | undefined;
  readonly held?: boolean | undefined;
  readonly pen?: PenName | undefined;
  readonly dense?: boolean | undefined;
  readonly source?: ((t: number) => Pts) | undefined;
}

export function fillMark(poly: Pts, options: FillOptions): FillMark {
  return {
    type: 'fill',
    poly,
    source: options.source,
    color: options.color,
    t0: options.t0 ?? 0,
    dur: options.dur ?? 0.4,
    seed: options.seed,
    spacing: options.spacing ?? 3,
    dir: options.dir ?? 1,
    held: options.held ?? true,
    pen: options.pen ?? 'cpencil',
    dense: options.dense ?? false,
  };
}

/** Rescales the timing of marks[from..] into [t0, t1] (a choreography budget); returns t1. */
export function fitMarks(marks: Mark[], from: number, t0: number, t1: number): number {
  let first = Infinity;
  let last = -Infinity;
  for (let i = from; i < marks.length; i += 1) {
    const mark = marks[i];
    if (!mark) continue;
    first = Math.min(first, mark.t0);
    last = Math.max(last, mark.t0 + mark.dur);
  }
  if (!(last > first)) return t1;
  const k = (t1 - t0) / (last - first);
  for (let i = from; i < marks.length; i += 1) {
    const mark = marks[i];
    if (!mark) continue;
    marks[i] = { ...mark, t0: t0 + (mark.t0 - first) * k, dur: mark.dur * k };
  }
  return t1;
}

export interface WriteOptions extends TextLayout {
  readonly tool?: ToolName | undefined;
  readonly color?: number | undefined;
  readonly width?: number | undefined;
  readonly t0?: number | undefined;
  /** End of the writing budget (the pace is squeezed or stretched to land on it). */
  readonly t1?: number | undefined;
  readonly speed?: number | undefined;
  /** Scales the pauses between letters and words. */
  readonly gapScale?: number | undefined;
  readonly boil?: number | undefined;
  readonly fps?: number | undefined;
  /** The visible hand writes it (default true). */
  readonly held?: boolean | undefined;
  readonly len?: number | undefined;
  readonly deg?: number | undefined;
  readonly thick?: number | undefined;
  /** Maps the laid-out page points (text written on a sheet that moves). */
  readonly source?: ((pts: Pts, corners: readonly boolean[]) => ShapeSource) | undefined;
}

/** Writes text as timed strokes into `marks`; returns the end time. */
export function writeMarks(marks: Mark[], text: string, options: WriteOptions): number {
  const laid = layoutText(text, options);
  const name = options.tool ?? 'felt';
  const from = marks.length;
  const speed = options.speed ?? TOOLS[name].speed * (options.hand === 'marker' ? 1 : 0.55);
  const seed = (options.seed | 0) * 131 + 17;
  const gapScale = options.gapScale ?? 1;
  let t = options.t0 ?? 0;
  let lastChar = -1;
  laid.strokes.forEach((stroke, i) => {
    if (lastChar >= 0 && stroke.char !== lastChar) {
      const wordGap = text.slice(lastChar + 1, stroke.char).includes(' ');
      t += (wordGap ? rnd(0.09, 0.22, seed, i, 1) : rnd(0.015, 0.07, seed, i, 2)) * gapScale;
    } else if (lastChar >= 0) t += rnd(0.01, 0.045, seed, i, 3) * gapScale;
    const dur = Math.max(0.035, (polyLen(stroke.pts) / speed) * rnd(0.85, 1.2, seed, i, 4));
    marks.push(
      strokeMark(stroke.pts, {
        tool: name,
        corners: stroke.corners,
        source: options.source?.(stroke.pts, stroke.corners),
        t0: t,
        dur,
        seed: seed + i * 13,
        color: options.color,
        width: options.width,
        boil: options.boil,
        fps: options.fps,
        held: options.held,
        len: options.len,
        deg: options.deg,
        thick: options.thick,
      }),
    );
    t += dur;
    lastChar = stroke.char;
  });
  return options.t1 !== undefined ? fitMarks(marks, from, options.t0 ?? 0, options.t1) : t;
}
