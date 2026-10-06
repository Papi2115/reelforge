/**
 * Paints the pop-up card for t (docs/worlds/sketchbook-v2/js/popup.js, shot 5): the base card with
 * its pull tab, glue tabs, smear, pencil guides, note, tape and tag; the shadows; then either the
 * open card (backdrop, its pencil marks, arms, standing pieces back to front, the tag thread) or the
 * shut one (pieces under the kraft cover). Everything is a pure function of t.
 */
import type { InkCanvas } from '../draw/canvas.js';
import { drawMarks } from '../draw/ink.js';
import type { Mark } from '../draw/marks.js';
import { at, hash } from '../draw/math.js';
import {
  ellipsePts,
  pixelPath,
  quad,
  smoothPath,
  type Placement,
  type Pts,
  type Xform,
} from '../draw/paths.js';
import { INK, inkOfSwatch, SOFT } from '../inks.js';
import { paintTape } from '../traces.js';
import { PopCamera, type Plane, type Vec3 } from './camera.js';
import {
  cardGeo,
  eyeAt,
  foldAt,
  tabY,
  type ArmGeo,
  type Card,
  type CardGeo,
  type PieceGeo,
  type PopupTimes,
} from './popup-geometry.js';
import type { PopupOptions } from './popup-schema.js';
import { capsule } from './shapes.js';

/** Paper inks of the pieces (white card, kraft cover / arm). */
const CARD = { color: INK.PAPER, fibre: INK.FIBRE } as const;
const KRAFT = { color: INK.KRAFT, fibre: INK.COFFEE_L, speck: INK.KRAFT_D } as const;

export interface TagArt {
  readonly place: Placement;
  readonly w: number;
  readonly h: number;
  readonly marks: Mark[];
}

/** What the card is made of: built once in build(), painted every frame. */
export interface PopupArt {
  readonly o: PopupOptions;
  readonly card: Card;
  readonly times: PopupTimes;
  readonly seed: number;
  /** Page px marks on the base (pencil guides, the note). */
  readonly baseMarks: Mark[];
  /** Backdrop marks (uv: page x, height up the card). */
  readonly backMarks: Mark[];
  /** Marks on a piece's front (uv: across, down from its top), by element index. */
  readonly frontMarks: ReadonlyMap<number, Mark[]>;
  /** Printed label on a disc (disc-local px), by element index. */
  readonly discMarks: ReadonlyMap<number, Mark[]>;
  readonly tag: TagArt | null;
  /** Glue that ran past the first block's left tab (page px). */
  readonly smear: Pts | null;
  /** Cut-paper rays of each sun (polar [angle, radius] triples), by element index. */
  readonly rays: ReadonlyMap<number, Pts[]>;
  /** Arm angles at t (deg, in arm order). */
  angles(t: number): number[];
  /** The tab's left end at t (page px), or null without a pull. */
  tabEnd(t: number): number | null;
}

type ScreenXf = (plane: Plane) => Xform;

/** The page itself (Z = 0): identity through any lens. */
const pagePlane = (cam: PopCamera): Plane => cam.plane([0, 0, 0], [1, 0, 0], [0, 1, 0]);

function polar(rays: Pts): Pts {
  const out: Pts = [];
  for (let i = 0; i < rays.length; i += 2) {
    out.push(Math.cos(at(rays, i)) * at(rays, i + 1), Math.sin(at(rays, i)) * at(rays, i + 1));
  }
  return out;
}

/** Disc-local points onto the backdrop at the arm's end (spun with the arm). */
function onArm(arm: ArmGeo, pts: Pts): Pts {
  const c = Math.cos(arm.spin);
  const s = Math.sin(arm.spin);
  const out: Pts = [];
  for (let i = 0; i < pts.length; i += 2) {
    const [x, y] = [at(pts, i), at(pts, i + 1)];
    out.push(arm.centre[0] + x * c - y * s, arm.centre[1] + x * s + y * c);
  }
  return out;
}

const armUV = (arm: ArmGeo): Pts =>
  capsule(arm.pivot[0], arm.pivot[1], arm.centre[0], arm.centre[1], 5.5);

function to3(plane: Plane, uv: Pts): Vec3[] {
  const out: Vec3[] = [];
  for (let i = 0; i < uv.length; i += 2) out.push(plane.at(at(uv, i), at(uv, i + 1)));
  return out;
}

function paintTag(canvas: InkCanvas, cam: PopCamera, tag: TagArt, t: number): void {
  const xf = (u: number, v: number): readonly [number, number] => {
    const [x, y] = tag.place.toPage(u, v);
    return [x * cam.s, y * cam.s];
  };
  const corners = quad(xf, tag.w, tag.h);
  const shape = [...xf(0, 9), ...xf(9, 0), ...corners.slice(2, 6), ...xf(0, tag.h)];
  cam.shade([shape.map((value, i) => value + (i % 2 === 1 ? 3 : 2) * cam.s)], SOFT);
  canvas.fillPoly(shape, INK.COFFEE_L);
  canvas.outline(shape, INK.KRAFT_D);
  const [hx, hy] = tag.place.toPage(8, 9);
  canvas.fillPoly(cam.page(ellipsePts(hx, hy, 4, 4, 10)), INK.KRAFT);
  canvas.fillPoly(cam.page(ellipsePts(hx, hy, 1.8, 1.8, 8)), INK.PAPER);
  drawMarks(canvas, tag.marks, t, xf);
}

function paintBase(
  canvas: InkCanvas,
  cam: PopCamera,
  art: PopupArt,
  t: number,
  toScreen: Xform,
): void {
  const { x0, x1, yc, depth } = art.card;
  const base = pagePlane(cam);
  cam.shade(
    [cam.page([x0 + 3, yc + 4, x1 + 3, yc + 4, x1 + 3, yc + depth + 4, x0 + 3, yc + depth + 4])],
    SOFT,
  );
  const tabEnd = art.tabEnd(t);
  if (tabEnd !== null) {
    const ty = tabY(art.card);
    const tab = cam.page(capsule(tabEnd + 10, ty, x0 + 40, ty, 10));
    canvas.fillPoly(tab, INK.KRAFT);
    canvas.outline(tab, INK.KRAFT_D);
    // Printed arrow: pull this way.
    cam.line(base, tabEnd + 9, ty, tabEnd + 27, ty, INK.KRAFT_D);
    cam.line(base, tabEnd + 9, ty, tabEnd + 14, ty - 4, INK.KRAFT_D);
    cam.line(base, tabEnd + 9, ty, tabEnd + 14, ty + 4, INK.KRAFT_D);
  }
  cam.face(base, [x0, yc, x1, yc, x1, yc + depth, x0, yc + depth], {
    ...CARD,
    offset: 41,
    edge: INK.SHADE,
  });
  // Glue tabs of every block, folded flat either side of its foot.
  for (const element of art.o.elements) {
    if (element.kind !== 'block') continue;
    const left = x0 + element.u;
    for (const [x, dir] of [
      [left, -1],
      [left + element.w, 1],
    ] as const) {
      const tab = cam.page([
        x,
        yc + 3,
        x + dir * 11,
        yc + 7,
        x + dir * 11,
        yc + element.depth - 5,
        x,
        yc + element.depth - 1,
      ]);
      canvas.fillPoly(tab, INK.PAPER);
      canvas.outline(tab, INK.SHADE);
    }
  }
  if (art.smear) {
    const smear = cam.page(art.smear);
    cam.shade([smear], SOFT);
    const rim = pixelPath([...smear, at(smear, 0), at(smear, 1)], true);
    for (let i = 0; i < rim.length; i += 2) {
      if (hash(at(rim, i), at(rim, i + 1), 4572) < 0.55)
        canvas.put(at(rim, i), at(rim, i + 1), INK.SHADE);
    }
  }
  drawMarks(canvas, art.baseMarks, t, toScreen);
  paintTape(canvas, toScreen, x0 + 8, yc + depth - 3, 58, 20, -38, art.seed + 81);
  paintTape(canvas, toScreen, x1 - 6, yc + depth - 6, 54, 20, 33, art.seed + 82);
  if (art.tag) paintTag(canvas, cam, art.tag, t);
}

function paintPiece(
  canvas: InkCanvas,
  cam: PopCamera,
  art: PopupArt,
  piece: PieceGeo,
  sx: ScreenXf,
  t: number,
): void {
  const e = piece.element;
  const shaded = (plane: Plane, uv: Pts, offset: number): void => {
    if (!plane.facing) return;
    cam.face(plane, uv, { ...CARD, offset, shade: PopCamera.shadeOf(plane), edge: INK.GRAPH_L });
  };
  if (e.kind === 'block') {
    shaded(piece.left, piece.leftUV, 901);
    shaded(piece.right, piece.rightUV, 902);
    shaded(piece.top, [0, 0, e.w, 0, e.w, e.depth, 0, e.depth], 903);
    shaded(piece.front, [0, 0, e.w, 0, e.w, e.h, 0, e.h], 904);
    if (piece.front.facing && e.band !== undefined) {
      cam.flat(piece.front, [1, 1, e.w - 1, 1, e.w - 1, 21, 1, 21], INK.GRAPHITE);
    }
  } else {
    // A narrow strip ties the top of the cut-out to the backdrop.
    const mid = e.w / 2;
    shaded(piece.top, [mid - 12, 0, mid + 12, 0, mid + 12, e.depth, mid - 12, e.depth], 905);
    shaded(piece.front, cutShape(art.seed, piece.index, e.w, e.h), 906);
  }
  const marks = art.frontMarks.get(piece.index);
  if (marks && piece.front.facing) drawMarks(canvas, marks, t, sx(piece.front));
}

/** The cut-out's scissor outline (uv), seeded per element. */
function cutShape(seed: number, index: number, w: number, h: number): Pts {
  const out: Pts = [];
  const n = 7;
  const j = (k: number, edge: number): number =>
    k === 0 ? 0 : (hash(seed, index, edge, k) - 0.5) * 2.6;
  for (let k = 0; k < n; k += 1) out.push((k / n) * w, j(k, 0));
  for (let k = 0; k < n; k += 1) out.push(w + j(k, 1), (k / n) * h);
  for (let k = 0; k < n; k += 1) out.push(w - (k / n) * w, h + j(k, 2) * 0.3);
  for (let k = 0; k < n; k += 1) out.push(j(k, 3), h - (k / n) * h);
  return out;
}

function paintArm(
  canvas: InkCanvas,
  cam: PopCamera,
  art: PopupArt,
  g: CardGeo,
  arm: ArmGeo,
  t: number,
): void {
  cam.face(g.armPlane, armUV(arm), {
    ...KRAFT,
    offset: 313,
    edge: INK.KRAFT_D,
    shade: PopCamera.shadeOf(g.armPlane),
  });
  const brad = cam.screen(g.armPlane, ellipsePts(arm.pivot[0], arm.pivot[1], 4.5, 4.5, 10));
  canvas.fillPoly(brad, INK.GRAPH_L);
  canvas.outline(brad, INK.GRAPHITE);
  const disc = ellipsePts(0, 0, arm.radius, arm.radius, 30);
  if (arm.element.piece === 'sun') {
    for (const ray of art.rays.get(arm.index) ?? [])
      cam.flat(g.piecePlane, onArm(arm, polar(ray)), INK.ORANGE, INK.COFFEE);
    cam.flat(g.piecePlane, onArm(arm, disc), INK.ORANGE, INK.COFFEE);
    return;
  }
  const color = inkOfSwatch(arm.element.color) ?? INK.SKY;
  cam.flat(g.piecePlane, onArm(arm, disc), color, INK.GRAPHITE);
  const marks = art.discMarks.get(arm.index);
  if (marks) {
    drawMarks(canvas, marks, t, (u, v) => {
      const [pu, pv] = onArm(arm, [u, v]);
      const [x, y] = g.piecePlane.xf(pu ?? 0, pv ?? 0);
      return [x * cam.s, y * cam.s];
    });
  }
}

function paintThread(canvas: InkCanvas, cam: PopCamera, art: PopupArt, g: CardGeo): void {
  const block = g.pieces.find((piece) => piece.element.kind === 'block');
  if (!art.tag || !block || g.phi < 4) return;
  const a = block.corner;
  const z = art.tag.place.toPage(8, 9);
  const m = [(a[0] + z[0]) / 2 + 3, (a[1] + z[1]) / 2 + 9];
  const pix = pixelPath(
    smoothPath(cam.page([a[0], a[1], m[0] ?? 0, m[1] ?? 0, z[0], z[1]]), null, 2),
    true,
  );
  for (let i = 0; i < pix.length; i += 2) canvas.put(at(pix, i), at(pix, i + 1), INK.GRAPHITE);
  canvas.fillPoly(cam.page(ellipsePts(a[0], a[1], 1.6, 1.6, 6)), INK.GRAPHITE);
}

/** The whole card at t into `canvas` (`mask` = scratch canvas of the same size). */
export function paintPopup(
  canvas: InkCanvas,
  mask: InkCanvas,
  art: PopupArt,
  t: number,
  toScreen: Xform,
): void {
  const cam = new PopCamera(canvas, mask, eyeAt(art.o, art.times, t));
  const sx: ScreenXf = (plane) => (u, v) => {
    const [x, y] = plane.xf(u, v);
    return [x * cam.s, y * cam.s];
  };
  const g = cardGeo(cam, art.card, art.o.elements, foldAt(art.times, t), art.angles(t));
  const { x0, x1, yc, depth } = art.card;
  paintBase(canvas, cam, art, t, toScreen);
  const base = pagePlane(cam);
  const cover = to3(g.cover, [x0, 0, x1, 0, x1, depth, x0, depth]);
  if (g.phi > 0.5) {
    cam.shade(
      [
        cam.shadowOn(base, cover),
        ...g.pieces.map((piece) => cam.shadowOn(base, piece.box)),
        cam.page([x0, yc, x1, yc, x1, yc + 3, x0, yc + 3]),
      ],
      SOFT,
    );
  }
  const backUV = [x0, 0, x1, 0, x1, depth, x0, depth];
  if (g.back.facing) {
    cam.face(g.back, backUV, {
      ...CARD,
      offset: 517,
      shade: PopCamera.shadeOf(g.back),
      edge: INK.SHADE,
    });
    drawMarks(canvas, art.backMarks, t, sx(g.back));
    const clip = [x0, 0, x1, depth];
    cam.shade(
      [
        ...g.pieces.map((piece) => cam.shadowOn(g.back, piece.box, clip)),
        ...g.arms.flatMap((arm) => [
          cam.shadowOn(g.back, to3(g.armPlane, armUV(arm)), clip),
          cam.shadowOn(
            g.back,
            to3(g.piecePlane, onArm(arm, ellipsePts(0, 0, arm.radius, arm.radius, 30))),
            clip,
          ),
        ]),
      ],
      SOFT,
    );
    for (const arm of g.arms) paintArm(canvas, cam, art, g, arm, t);
    for (const piece of g.pieces) paintPiece(canvas, cam, art, piece, sx, t);
    paintThread(canvas, cam, art, g);
    return;
  }
  for (const piece of g.pieces) if (g.phi >= 0.5) paintPiece(canvas, cam, art, piece, sx, t);
  paintThread(canvas, cam, art, g);
  cam.face(g.cover, backUV, {
    ...KRAFT,
    offset: 233,
    shade: PopCamera.shadeOf(g.cover),
    edge: INK.KRAFT_D,
  });
}
