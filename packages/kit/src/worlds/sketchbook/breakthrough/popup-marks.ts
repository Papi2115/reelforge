/**
 * The pop-up card's own marks and cut paper, built once: pencil construction on the base (a guide
 * line with ticks under each block, which went down 3 px off it), the maker's note on the floor,
 * the compass arc of every arm's path and a pencil ring round its notch on the backdrop, the
 * printed block fronts, the felt drawings on cut-outs, a crooked hand-written tag, the glue that
 * ran past a tab and the sun rays (each a little different).
 */
import { sunRecipe } from '../draw/doodles.js';
import { DEFAULT_EXPRESSION, DEFAULT_POSE, figureMarks, type Pose } from '../draw/figures.js';
import { textWidth } from '../draw/lettering.js';
import { fillMark, strokeMark, writeMarks, type Mark } from '../draw/marks.js';
import { rnd } from '../draw/math.js';
import { ellipsePts, placement, type Pts } from '../draw/paths.js';
import { INK } from '../inks.js';
import { ARM_PIVOT, type PopupElement, type PopupOptions } from './popup-schema.js';
import { sunRadius, type Card } from './popup-geometry.js';
import type { TagArt } from './popup-paint.js';
import { recipeMarks } from './shapes.js';

/** Marks that were on the card before the shot (complete at t = 0; they still boil). */
const BEFORE = { t0: -5, t1: -4.9, held: false } as const;
const rad = (deg: number): number => (deg * Math.PI) / 180;

const POSES: Readonly<Record<'stand' | 'cheer' | 'point', Partial<Pose>>> = {
  stand: {},
  cheer: { armL: [-150, -168], armR: [150, 168] },
  point: { armR: [100, 96], turn: 0.6 },
};

function pencilLine(pts: Pts, seed: number): Mark {
  return strokeMark(pts, { tool: 'pencil', t0: -5, dur: 0.01, held: false, smooth: false, seed });
}

export function baseMarks(o: PopupOptions, card: Card, seed: number): Mark[] {
  const marks: Mark[] = [];
  o.elements.forEach((element, index) => {
    if (element.kind === 'block') {
      const [x0, x1] = [card.x0 + element.u, card.x0 + element.u + element.w];
      const gy = card.yc + element.depth + 3;
      const s = seed + 511 + index * 7;
      marks.push(pencilLine([x0 - 26, gy, x1 + 20, gy - 1], s));
      marks.push(pencilLine([x0 - 3, gy - 4, x0 - 3, gy + 4], s + 1));
      marks.push(pencilLine([x1 - 3, gy - 4, x1 - 2, gy + 5], s + 2));
    } else if (element.kind === 'note') {
      writeMarks(marks, element.text, {
        ...BEFORE,
        x: card.x0 + element.u,
        y: card.yc + element.depth,
        size: 21,
        hand: 'scrawl',
        tool: 'pencil',
        rot: -3,
        seed: seed + 502 + index,
        fps: 12,
      });
    }
  });
  return marks;
}

/** The angle a pull swings an arm to (deg), or its own angle. */
export function armSwing(o: PopupOptions, element: PopupElement): number | undefined {
  if (element.kind !== 'arm' || element.id === undefined) return undefined;
  const motion = o.pull?.motions.find((m) => m.target === element.id && 'angle' in m.to);
  return motion?.to['angle'];
}

/** The angles an arm's arc covers (deg). */
function arcSpan(
  element: Extract<PopupElement, { kind: 'arm' }>,
  to: number | undefined,
): readonly [number, number] {
  const swing = to ?? element.angle;
  return [Math.min(element.angle, swing) - 15, Math.max(element.angle, swing) + 15];
}

export function backMarks(o: PopupOptions, card: Card, seed: number): Mark[] {
  const marks: Mark[] = [];
  o.elements.forEach((element, index) => {
    if (element.kind !== 'arm') return;
    const px = card.x0 + element.u;
    const r = element.length;
    const [lo, hi] = arcSpan(element, armSwing(o, element));
    const arc: Pts = [];
    for (let i = 0; i <= 24; i += 1) {
      const a = rad(lo + (i / 24) * (hi - lo));
      arc.push(px + r * Math.sin(a), ARM_PIVOT + r * Math.cos(a));
    }
    const s = seed + 521 + index * 5;
    marks.push(
      strokeMark(arc, { tool: 'pencil', t0: -5, dur: 0.01, held: false, seed: s, fps: 12 }),
    );
    const n0 = [
      px + r * Math.sin(rad(element.angle)),
      ARM_PIVOT + r * Math.cos(rad(element.angle)),
    ] as const;
    const size = sunRadius(element.piece);
    const ring = ellipsePts(n0[0], n0[1], size + 2.5, size + 2, 18, 0, 2.2);
    ring.push((ring[0] ?? 0) + 3, (ring[1] ?? 0) + 4);
    marks.push(
      strokeMark(ring, { tool: 'pencil', t0: -5, dur: 0.01, held: false, seed: s + 1, fps: 12 }),
    );
  });
  return marks;
}

/** Printed (type) text centred on width w. */
function printCentred(
  marks: Mark[],
  text: string,
  w: number,
  y: number,
  size: number,
  extra: { seed: number; width: number; color?: number; track?: number },
): void {
  const track = extra.track ?? 0;
  const width = textWidth(text, size, 'type') + track * (size / 10) * Math.max(0, text.length - 1);
  writeMarks(marks, text, {
    ...BEFORE,
    x: (w - width) / 2,
    y,
    size,
    hand: 'type',
    tool: 'fine',
    boil: 0,
    fps: 1,
    seed: extra.seed,
    width: extra.width,
    color: extra.color,
    track,
  });
}

function cutoutMarks(element: Extract<PopupElement, { kind: 'cutout' }>, seed: number): Mark[] {
  const marks: Mark[] = [];
  const ground = element.text === undefined ? element.h - 8 : element.h - 30;
  if (element.draw === 'figure') {
    const pose = { ...DEFAULT_POSE, ...POSES[element.pose] };
    const figure = figureMarks({
      x: element.w / 2,
      y: ground,
      h: Math.min(ground - 8, element.w * 1.5),
      t0: -5,
      seed,
      tool: 'felt',
      fps: 12,
      belly: 0,
      brows: true,
      pose: () => pose,
      expression: () => DEFAULT_EXPRESSION,
    });
    marks.push(...figure.marks.map((mark) => ({ ...mark, held: false })));
  } else if (element.draw === 'sun') {
    const r = Math.min(element.w, ground) * 0.2;
    const [cx, cy] = [element.w / 2, ground / 2 + 4];
    marks.push(...recipeMarks(sunRecipe(cx, cy, r, seed, 8, 0.7), { tool: 'felt', t0: -5, seed }));
    marks.push(
      fillMark(ellipsePts(cx + 1, cy + 1, r - 1, r - 2, 14), {
        color: INK.ORANGE,
        t0: -5,
        dur: 0.01,
        seed: seed + 77,
        spacing: 2,
        held: false,
      }),
    );
  }
  if (element.text !== undefined) {
    const size = 15;
    writeMarks(marks, element.text, {
      ...BEFORE,
      x: (element.w - textWidth(element.text, size, 'print')) / 2,
      y: element.h - 10,
      size,
      hand: 'print',
      tool: 'fine',
      seed: seed + 9,
      fps: 12,
    });
  }
  return marks;
}

/** Marks on the fronts of blocks and cut-outs (uv: across, down from the top), by element. */
export function frontMarks(o: PopupOptions, seed: number): Map<number, Mark[]> {
  const out = new Map<number, Mark[]>();
  o.elements.forEach((element, index) => {
    const s = seed + 531 + index * 11;
    if (element.kind === 'block') {
      const marks: Mark[] = [];
      const size = Math.min(36, element.h * 0.5);
      const top = element.band === undefined ? 0 : 21;
      if (element.band !== undefined) {
        printCentred(marks, element.band, element.w - 4.4, 16, 11, {
          seed: s,
          width: 1,
          color: INK.PAPER,
          track: 0.4,
        });
      }
      printCentred(marks, element.text, element.w, top + (element.h - top + size) / 2, size, {
        seed: s + 1,
        width: 3,
      });
      out.set(index, marks);
    } else if (element.kind === 'cutout') out.set(index, cutoutMarks(element, s));
  });
  return out;
}

/** A disc's printed label (disc-local px, centred on 0, 0), by element. */
export function discMarks(o: PopupOptions, seed: number): Map<number, Mark[]> {
  const out = new Map<number, Mark[]>();
  o.elements.forEach((element, index) => {
    if (element.kind !== 'arm' || element.piece !== 'disc' || element.label === undefined) return;
    const marks: Mark[] = [];
    const size = 12;
    printCentred(marks, element.label, 0, size / 2, size, { seed: seed + 541 + index, width: 2 });
    out.set(index, marks);
  });
  return out;
}

export function tagArt(o: PopupOptions, card: Card, seed: number): TagArt | null {
  const tag = o.elements.find((element) => element.kind === 'tag');
  if (tag?.kind !== 'tag') return null;
  const block = o.elements.find((element) => element.kind === 'block');
  const x =
    tag.u === undefined ? (block?.kind === 'block' ? block.u + block.w - 2 : o.w - 90) : tag.u;
  const depth = tag.depth ?? (block?.kind === 'block' ? block.depth + 52 : o.depth * 0.42);
  const widest = Math.max(...tag.lines.map((line) => textWidth(line, 13, 'scrawl')));
  const marks: Mark[] = [];
  tag.lines.forEach((line, k) => {
    writeMarks(marks, line, {
      ...BEFORE,
      x: k === 0 ? 15 : 12,
      y: 18 + k * 17,
      size: 13,
      hand: 'scrawl',
      tool: 'fine',
      seed: seed + 541 + k,
      fps: 12,
    });
  });
  return {
    place: placement(card.x0 + x, card.yc + depth, -9, 1),
    w: Math.max(69, widest + 26),
    h: tag.lines.length === 1 ? 30 : 44,
    marks,
  };
}

export function smearOf(o: PopupOptions, card: Card, seed: number): Pts | null {
  const block = o.elements.find((element) => element.kind === 'block');
  if (block?.kind !== 'block') return null;
  const smear: Pts = [];
  for (let i = 0; i < 14; i += 1) {
    const a = (i / 14) * Math.PI * 2;
    const r = rnd(0.65, 1.15, seed + 571, i);
    smear.push(card.x0 + block.u - 17 + Math.cos(a) * 11 * r, card.yc + 21 + Math.sin(a) * 7 * r);
  }
  return smear;
}

/** Cut-paper rays of every sun: [angle, radius] x 3 per ray (no two suns alike). */
export function sunRays(o: PopupOptions, seed: number): Map<number, Pts[]> {
  const out = new Map<number, Pts[]>();
  o.elements.forEach((element, index) => {
    if (element.kind !== 'arm' || element.piece !== 'sun') return;
    const r = sunRadius('sun');
    const s = seed + 561 + index * 13;
    const rays: Pts[] = [];
    for (let i = 0; i < 9; i += 1) {
      const a = (i / 9) * Math.PI * 2 + rnd(-0.12, 0.12, s, i) - 0.2;
      const hw = rnd(0.17, 0.23, s + 1, i);
      const length = rnd(8, 13, s + 2, i);
      rays.push([a - hw, r - 2, a + rnd(-0.05, 0.05, s + 3, i), r + length, a + hw, r - 2]);
    }
    out.set(index, rays);
  });
  return out;
}
