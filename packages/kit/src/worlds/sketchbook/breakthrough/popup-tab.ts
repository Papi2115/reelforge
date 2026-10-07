/**
 * The pull of a pop-up card: a tab, ribbon, knob or lever sticking out of its left, right or
 * bottom edge, pulled outward by the red pen (`travel` card px). Geometry (where its end is, the
 * pen's grip) and paint (under the card, before the base face). The left kraft tab is the
 * showcase one (docs/worlds/sketchbook-v2 shot 5).
 */
import type { InkCanvas } from '../draw/canvas.js';
import type { Point } from '../draw/paths.js';
import { ellipsePts } from '../draw/paths.js';
import { INK } from '../inks.js';
import { TAB_OUT, tabY, type Card } from './popup-geometry.js';
import type { PopupPull } from './popup-schema.js';
import { capsule } from './shapes.js';

/** Where the pull sits: its anchor on the card edge, outward direction, perpendicular. */
interface TabFrame {
  readonly anchor: Point;
  readonly dir: Point;
  readonly across: Point;
}

function frameOf(card: Card, pull: PopupPull): TabFrame {
  if (pull.side === 'right') return { anchor: [card.x1, tabY(card)], dir: [1, 0], across: [0, 1] };
  if (pull.side === 'bottom') {
    return {
      anchor: [card.x0 + (card.x1 - card.x0) * 0.72, card.yc + card.depth],
      dir: [0, 1],
      across: [1, 0],
    };
  }
  return { anchor: [card.x0, tabY(card)], dir: [-1, 0], across: [0, 1] };
}

const along = (p: Point, d: Point, k: number): Point => [p[0] + d[0] * k, p[1] + d[1] * k];

/** The outer end of the pull when pulled `travel` card px (page px). */
export function tabEnd(card: Card, pull: PopupPull, travel: number): Point {
  const f = frameOf(card, pull);
  return along(f.anchor, f.dir, TAB_OUT + travel);
}

/** Where the red pen holds the pull (page px). */
export function tabGrip(card: Card, pull: PopupPull, travel: number): Point {
  const f = frameOf(card, pull);
  const inset = pull.tab === 'knob' || pull.tab === 'lever' ? 0 : pull.tab === 'ribbon' ? 5 : 4;
  return along(tabEnd(card, pull, travel), f.dir, -inset);
}

/** Paints the pull (page px through `page`, a page-to-canvas mapping of points). */
export function paintTab(
  canvas: InkCanvas,
  page: (pts: number[]) => number[],
  card: Card,
  pull: PopupPull,
  travel: number,
): void {
  const f = frameOf(card, pull);
  const end = tabEnd(card, pull, travel);
  const inner = along(f.anchor, f.dir, -40);
  const line = (a: Point, b: Point, color: number): void => {
    canvas.line(page([a[0], a[1], b[0], b[1]]), color);
  };
  if (pull.tab === 'tab') {
    const start = along(end, f.dir, -10);
    const shape = page(capsule(start[0], start[1], inner[0], inner[1], 10));
    canvas.fillPoly(shape, INK.KRAFT);
    canvas.outline(shape, INK.KRAFT_D);
    // Printed arrow: pull this way.
    const [head, tail] = [along(end, f.dir, -9), along(end, f.dir, -27)];
    const barb = along(end, f.dir, -14);
    line(head, tail, INK.KRAFT_D);
    line(head, along(barb, f.across, -4), INK.KRAFT_D);
    line(head, along(barb, f.across, 4), INK.KRAFT_D);
    return;
  }
  if (pull.tab === 'ribbon') {
    const [a, b] = [along(inner, f.across, -5), along(inner, f.across, 5)];
    const shape = [
      ...a,
      ...b,
      ...along(end, f.across, 5),
      ...along(end, f.dir, -7),
      ...along(end, f.across, -5),
    ];
    canvas.fillPoly(page(shape), INK.SKY);
    canvas.outline(page(shape), INK.BIC_L);
    return;
  }
  const radius = pull.tab === 'knob' ? 3 : 4;
  const stem = page(capsule(end[0], end[1], inner[0], inner[1], radius));
  canvas.fillPoly(stem, pull.tab === 'knob' ? INK.KRAFT_D : INK.GRAPH_L);
  canvas.outline(stem, INK.GRAPHITE);
  const knob = page(
    ellipsePts(end[0], end[1], pull.tab === 'knob' ? 10 : 7, pull.tab === 'knob' ? 9 : 7, 14),
  );
  canvas.fillPoly(knob, pull.tab === 'knob' ? INK.ORANGE : INK.GRAPHITE);
  canvas.outline(knob, pull.tab === 'knob' ? INK.COFFEE : INK.INK);
  if (pull.tab === 'lever') {
    for (const k of [12, 18, 24]) {
      const p = along(end, f.dir, -k);
      line(along(p, f.across, -3), along(p, f.across, 3), INK.GRAPHITE);
    }
  }
}
