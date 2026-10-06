/**
 * The hand holding the current pen, drawn at the pen state's tip: soft cast shadow (offset grows
 * with the lift), palm, fingers with a nail, and a pen that reads as itself (felt-tip, red pen,
 * ballpoint with its ink tube, pencil, coloured pencil, marker, highlighter). Flat palette fills,
 * no gradients; the hand itself does not boil.
 */
import { INK, SOFT } from '../inks.js';
import type { InkCanvas } from './canvas.js';
import type { PenState } from './hand.js';
import type { PenName } from './marks.js';
import { ellipsePts, type Pts } from './paths.js';

interface PenLook {
  /** -1 = the colour of the mark (coloured pencil). */
  readonly tip: number;
  readonly tipLen: number;
  readonly cone: number;
  readonly coneLen: number;
  readonly bodyWidth: number;
  readonly body: number;
  readonly highlight: number;
  readonly band: number;
  readonly tube?: number;
  readonly chisel?: boolean;
}

const PENS: Readonly<Record<PenName, PenLook>> = {
  felt: {
    tip: INK.INK,
    tipLen: 5,
    cone: INK.GRAPH_L,
    coneLen: 17,
    bodyWidth: 4.5,
    body: INK.INK,
    highlight: INK.GRAPHITE,
    band: INK.GRAPH_L,
  },
  red: {
    tip: INK.RED,
    tipLen: 5,
    cone: INK.GRAPH_L,
    coneLen: 17,
    bodyWidth: 4.5,
    body: INK.RED,
    highlight: INK.MARGIN,
    band: INK.INK,
  },
  bic: {
    tip: INK.BIC,
    tipLen: 3,
    cone: INK.GRAPH_L,
    coneLen: 15,
    bodyWidth: 4,
    body: INK.FIBRE,
    highlight: INK.PAPER,
    band: INK.BIC,
    tube: INK.BIC_L,
  },
  pencil: {
    tip: INK.GRAPHITE,
    tipLen: 5,
    cone: INK.KRAFT,
    coneLen: 15,
    bodyWidth: 4.5,
    body: INK.STICKY,
    highlight: INK.STICKY_D,
    band: INK.GRAPH_L,
  },
  cpencil: {
    tip: -1,
    tipLen: 5,
    cone: INK.KRAFT,
    coneLen: 15,
    bodyWidth: 4.5,
    body: -1,
    highlight: INK.PAPER,
    band: -1,
  },
  marker: {
    tip: INK.INK,
    tipLen: 7,
    cone: INK.GRAPH_L,
    coneLen: 20,
    bodyWidth: 8,
    body: INK.PAPER,
    highlight: INK.FIBRE,
    band: INK.INK,
    chisel: true,
  },
  hi: {
    tip: INK.HILITE,
    tipLen: 7,
    cone: INK.STICKY_D,
    coneLen: 18,
    bodyWidth: 8,
    body: INK.HILITE,
    highlight: INK.PAPER,
    band: INK.GRAPHITE,
    chisel: true,
  },
};

type PenFrame = (u: number, v: number) => readonly [number, number];

/** A capsule from (u0, v0) to (u1, v1) with radius r, in pen space. */
function capsule(f: PenFrame, u0: number, v0: number, u1: number, v1: number, r: number): Pts {
  const out: Pts = [];
  const du = u1 - u0;
  const dv = v1 - v0;
  const length = Math.hypot(du, dv);
  const au = du / length;
  const av = dv / length;
  const arc = (cu: number, cv: number, from: number): void => {
    for (let i = 0; i <= 10; i += 1) {
      const a = from + (i / 10) * Math.PI;
      const c = Math.cos(a);
      const s = Math.sin(a);
      out.push(...f(cu + (au * c - av * s) * r, cv + (av * c + au * s) * r));
    }
  };
  arc(u0, v0, Math.PI / 2);
  arc(u1, v1, -Math.PI / 2);
  return out;
}

function handShapes(f: PenFrame, look: PenLook): Readonly<Record<string, Pts>> {
  const { coneLen, tipLen, bodyWidth: bw } = look;
  return {
    palm: capsule(f, 128, 26, 190, 30, 36),
    body: [...f(coneLen, -bw), ...f(250, -bw - 0.5), ...f(250, bw + 0.5), ...f(coneLen, bw)],
    cone: [...f(tipLen, -1.3), ...f(coneLen, -bw), ...f(coneLen, bw), ...f(tipLen, 1.3)],
    tip: look.chisel
      ? [...f(0, -2.5), ...f(tipLen, -2.5), ...f(tipLen, 2.5), ...f(1.5, 2.5)]
      : [...f(0, -0.6), ...f(tipLen, -1.4), ...f(tipLen, 1.4), ...f(0, 0.6)],
    thumb: capsule(f, 36, 11, 96, 27, 8),
    index: capsule(f, 28, -6, 104, -14, 7),
    middle: capsule(f, 46, 3, 118, 10, 6.5),
  };
}

function shape(shapes: Readonly<Record<string, Pts>>, name: string): Pts {
  return shapes[name] ?? [];
}

/** Draws the hand and pen at `state` (screen px; `scale` = screen px per page px). */
export function drawPen(canvas: InkCanvas, state: PenState, scale: number): void {
  const look = PENS[state.pen];
  const tipColor = look.tip < 0 ? state.color : look.tip;
  const bodyColor = look.body < 0 ? state.color : look.body;
  const bandColor = look.band < 0 ? INK.INK : look.band;
  const angle = (state.angle * Math.PI) / 180;
  const ca = Math.cos(angle);
  const sa = Math.sin(angle);
  const frame =
    (ox: number, oy: number): PenFrame =>
    (u, v) => [state.x + ox + (u * ca - v * sa) * scale, state.y + oy + (u * sa + v * ca) * scale];
  const offset = (6 + 12 * state.lift) * scale;
  const shadow = handShapes(frame(offset, offset * 1.1), look);
  canvas.remapped(SOFT, () => {
    for (const name of ['palm', 'body', 'cone', 'thumb', 'index', 'middle']) {
      canvas.fillPoly(shape(shadow, name), INK.PAPER);
    }
  });
  const f = frame(0, 0);
  const s = handShapes(f, look);
  const skin = (name: string): void => {
    canvas.fillPoly(shape(s, name), INK.COFFEE_L);
    canvas.outline(shape(s, name), INK.COFFEE);
  };
  skin('palm');
  skin('middle');
  canvas.fillPoly(shape(s, 'body'), bodyColor);
  // Highlight stripe and band (cap ring / ferrule), so each pen reads as itself.
  canvas.line(
    [...f(look.coneLen + 3, -look.bodyWidth + 1), ...f(240, -look.bodyWidth + 1)],
    look.highlight,
  );
  if (look.tube !== undefined)
    canvas.line([...f(look.coneLen + 2, 0.5), ...f(240, 0.5)], look.tube);
  const bw = look.bodyWidth;
  canvas.fillPoly([...f(150, -bw), ...f(160, -bw), ...f(160, bw), ...f(150, bw)], bandColor);
  canvas.outline(shape(s, 'body'), INK.INK);
  canvas.fillPoly(shape(s, 'cone'), look.cone);
  canvas.outline(shape(s, 'cone'), INK.INK);
  canvas.fillPoly(shape(s, 'tip'), tipColor);
  skin('thumb');
  skin('index');
  // Fingernail on the index tip.
  const nail = ellipsePts(0, 0, 3.6, 2.4, 10);
  const nailPts: Pts = [];
  for (let i = 0; i < nail.length; i += 2)
    nailPts.push(...f(31 + (nail[i] ?? 0), -9 + (nail[i + 1] ?? 0)));
  canvas.fillPoly(nailPts, INK.FIBRE);
}
