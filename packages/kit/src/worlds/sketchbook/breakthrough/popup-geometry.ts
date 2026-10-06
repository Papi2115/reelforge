/**
 * The pop-up card as geometry: its timeline (the pencil lifts the cover with an anticipation dip,
 * lets go, it swings past upright and settles; the red pen pulls the tab), and for a fold angle
 * the planes of the cover, the backdrop, every standing piece and every arm. Page px; Z = height
 * off the page. Ported from docs/worlds/sketchbook-v2/js/popup.js (shot 5).
 */
import { ease, seg } from '../draw/math.js';
import type { Point } from '../draw/paths.js';
import type { Lens, Plane, Vec3 } from './camera.js';
import { ARM_PIVOT, type PopupElement, type PopupOptions } from './popup-schema.js';

const rad = (deg: number): number => (deg * Math.PI) / 180;
const X3: Vec3 = [1, 0, 0];
/** Lens of the 2.5D camera (page px): left of centre, far below the frame, high up. */
export const LENS: Vec3 = [470, 1470, 1400];
/** Pull tab: how far it sticks out left of the card, and its travel when pulled. */
export const TAB_OUT = 30;
export const TAB_TRAVEL = 52;

export const sunRadius = (piece: 'sun' | 'disc'): number => (piece === 'sun' ? 24 : 21);

/** Times of the choreography (page s). */
export interface PopupTimes {
  /** The pencil hand comes in. */
  readonly open: number;
  readonly dip: number;
  readonly lift: number;
  readonly letGo: number;
  /** Settled upright. */
  readonly land: number;
  /** The red pen comes in, presses, pulls, is done pulling (undefined without a pull). */
  readonly pull?: {
    readonly enter: number;
    readonly press: number;
    readonly drag: number;
    readonly done: number;
    readonly hover: number;
    readonly loop: number;
    readonly arrow: number;
  };
}

export function popupTimes(open: number, press: number | undefined): PopupTimes {
  const base = { open, dip: open + 0.36, lift: open + 0.5, letGo: open + 0.88, land: open + 1.48 };
  if (press === undefined) return base;
  return {
    ...base,
    pull: {
      enter: press - 0.42,
      press,
      drag: press + 0.12,
      done: press + 1.1,
      hover: press + 1.2,
      loop: press + 1.34,
      arrow: press + 1.72,
    },
  };
}

/** Fold angle of the cover (deg): 0 = shut, 90 = upright; peeled slow-fast, swings past, settles. */
export function foldAt(times: PopupTimes, t: number): number {
  if (t <= times.lift) return 0;
  if (t <= times.letGo) return 55 * ease('in', seg(t, times.lift, times.letGo));
  return 55 + 35 * ease('back', seg(t, times.letGo, times.land), 3);
}

/** How far the tab has been pulled (card px; a small press-in first). */
export function tabAt(times: PopupTimes, t: number): number {
  const pull = times.pull;
  if (!pull) return 0;
  return (
    -3 * ease('out', seg(t, pull.press, pull.drag)) +
    (TAB_TRAVEL + 3) * ease('inOut', seg(t, pull.drag, pull.done))
  );
}

/** The card in page px. */
export interface Card {
  readonly x0: number;
  readonly x1: number;
  /** The fold line. */
  readonly yc: number;
  readonly depth: number;
}

/** y of the pull tab's centre line (page px). */
export function tabY(card: Card): number {
  return card.yc + card.depth * 0.673 + 10;
}

export function cardOf(o: PopupOptions): Card {
  return { x0: o.x, x1: o.x + o.w, yc: o.y, depth: o.depth };
}

/** The eye at t: the nudge eases in while the card opens (dx, dy = shift of the backdrop top). */
export function eyeAt(o: PopupOptions, times: PopupTimes, t: number): Vec3 {
  const k = LENS[2] / (LENS[2] - o.depth) - 1;
  const e = ease('inOut', seg(t, times.open, times.land));
  return [LENS[0] - (o.camera.dx / k) * e, LENS[1] - (o.camera.dy / k) * e, LENS[2]];
}

type Standing = Extract<PopupElement, { kind: 'block' | 'cutout' }>;
type Arm = Extract<PopupElement, { kind: 'arm' }>;

export interface PieceGeo {
  readonly element: Standing;
  readonly index: number;
  readonly x0: number;
  readonly x1: number;
  readonly front: Plane;
  readonly top: Plane;
  readonly left: Plane;
  readonly right: Plane;
  readonly leftUV: number[];
  readonly rightUV: number[];
  /** Corners of the box, or of a cut-out's card (shadow casters). */
  readonly box: Vec3[];
  /** Top-right front corner (page px): where a tag thread is tied. */
  readonly corner: Point;
}

export interface ArmGeo {
  readonly element: Arm;
  readonly index: number;
  readonly pivot: Point;
  /** Centre of the piece on the backdrop (u = page x, v = up the card). */
  readonly centre: Point;
  /** Spin of the piece since its rest angle (radians). */
  readonly spin: number;
  readonly radius: number;
}

export interface CardGeo {
  readonly phi: number;
  readonly cover: Plane;
  readonly back: Plane;
  readonly armPlane: Plane;
  readonly piecePlane: Plane;
  readonly pieces: PieceGeo[];
  readonly arms: ArmGeo[];
}

function pieceGeo(cam: Lens, card: Card, e: Standing, index: number, phi: number): PieceGeo {
  const c = Math.cos(rad(phi));
  const s = Math.sin(rad(phi));
  const x0 = card.x0 + e.u;
  const x1 = x0 + e.w;
  const yc = card.yc;
  const yB = yc + e.depth + e.h * c;
  const zB = e.h * s;
  const yC = yc + e.h * c;
  // A block casts its whole box; a cut-out only its thin card.
  const box: Vec3[] = [];
  for (const x of [x0, x1]) {
    box.push([x, yc + e.depth, 0], [x, yB, zB]);
    if (e.kind === 'block') box.push([x, yc, 0], [x, yC, zB]);
  }
  return {
    element: e,
    index,
    x0,
    x1,
    front: cam.plane([x0, yB, zB], X3, [0, -c, -s]),
    top: cam.plane([x0, yC, zB], X3, [0, 1, 0]),
    left: cam.plane([x0, yc, 0], [0, 0, 1], [0, 1, 0]),
    right: cam.plane([x1, yc, 0], [0, 1, 0], [0, 0, 1]),
    leftUV: [0, 0, 0, e.depth, zB, e.depth + e.h * c, zB, e.h * c],
    rightUV: [0, 0, e.depth, 0, e.depth + e.h * c, zB, e.h * c, zB],
    box,
    corner: cam.proj(x1, yB, zB),
  };
}

/** Everything for a fold angle `phi` and the arms at `angles` (deg, one per arm in order). */
export function cardGeo(
  cam: Lens,
  card: Card,
  elements: readonly PopupElement[],
  phi: number,
  angles: readonly number[],
): CardGeo {
  const c = Math.cos(rad(phi));
  const s = Math.sin(rad(phi));
  const d: Vec3 = [0, c, s];
  const inward: Vec3 = [0, s, -c];
  const off = (e: number): Plane => cam.plane([0, card.yc + e * s, -e * c], X3, d, inward);
  const pieces: PieceGeo[] = [];
  const arms: ArmGeo[] = [];
  elements.forEach((element, index) => {
    if (element.kind === 'block' || element.kind === 'cutout') {
      pieces.push(pieceGeo(cam, card, element, index, phi));
    } else if (element.kind === 'arm') {
      const angle = angles[arms.length] ?? element.angle;
      const pivot: Point = [card.x0 + element.u, ARM_PIVOT];
      arms.push({
        element,
        index,
        pivot,
        centre: [
          pivot[0] + element.length * Math.sin(rad(angle)),
          pivot[1] + element.length * Math.cos(rad(angle)),
        ],
        spin: rad(element.angle - angle),
        radius: sunRadius(element.piece),
      });
    }
  });
  // Nearest the fold first: painted back to front.
  pieces.sort((a, b) => a.element.depth - b.element.depth || a.index - b.index);
  return {
    phi,
    cover: cam.plane([0, card.yc, 0], X3, d),
    back: off(0),
    armPlane: off(1.5),
    piecePlane: off(5),
    pieces,
    arms,
  };
}
