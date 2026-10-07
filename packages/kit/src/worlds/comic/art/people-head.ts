/**
 * Heads of comic figures (art.person, PLAN.md#13.15a): hair styles, hats and six expressions,
 * drawn in a 3/4 view facing right. The face is a few ink marks (eye dots, brows, mouth) so it
 * still reads when the figure is small; below ~4 px of head radius only an eye and a mouth stay.
 */
import type { Pt } from './people-pose.js';
import type { Sketch } from './sketch.js';

export const EXPRESSIONS = ['neutral', 'happy', 'sad', 'angry', 'surprised', 'scared'] as const;
export type Expression = (typeof EXPRESSIONS)[number];

export const HAIRS = ['short', 'long', 'bald', 'bun', 'curly', 'spiky', 'ponytail'] as const;
export type Hair = (typeof HAIRS)[number];

export const HATS = [
  'none',
  'cap',
  'bowler',
  'brim',
  'hood',
  'helmet',
  'hardhat',
  'crown',
  'beanie',
  'pointed',
  'kerchief',
] as const;
export type Hat = (typeof HATS)[number];

function arc(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  a0: number,
  a1: number,
  n = 9,
): number[] {
  const pts: number[] = [];
  for (let i = 0; i <= n; i += 1) {
    const a = a0 + ((a1 - a0) * i) / n;
    pts.push(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry);
  }
  return pts;
}

/** Hair behind the head ('back') or the cap of hair over it ('front'). */
export function drawHair(
  sk: Sketch,
  hair: string,
  head: Pt,
  r: number,
  color: string,
  layer: 'back' | 'front',
): void {
  const [hx, hy] = head;
  const ry = r * 1.08;
  const look = { outline: 'inner' as const };
  if (layer === 'back') {
    if (hair === 'long')
      sk.shape(
        [
          hx - r * 0.7,
          hy - r * 0.8,
          hx - r * 1.3,
          hy + r * 1.5,
          hx + r * 0.1,
          hy + r * 1.35,
          hx + r * 0.2,
          hy - r * 0.2,
        ],
        color,
        look,
      );
    if (hair === 'bun') sk.oval(hx - r * 0.75, hy - r * 0.95, r * 0.5, r * 0.45, color, look);
    if (hair === 'ponytail')
      sk.cap(hx - r * 0.9, hy - r * 0.3, hx - r * 1.5, hy + r * 1.1, r * 0.3, color, look);
    return;
  }
  if (hair === 'bald') {
    sk.solid(
      arc(hx - r * 0.05, hy + r * 0.05, r * 1.02, ry, Math.PI * 0.85, Math.PI * 1.05, 4).concat([
        hx - r * 0.7,
        hy + r * 0.1,
      ]),
      color,
    );
    return;
  }
  const outer = arc(hx, hy, r + 1.4, ry + 1.4, Math.PI * 1.02, Math.PI * 1.88, 10);
  if (hair === 'curly' || hair === 'spiky') {
    const bumps: number[] = [];
    for (let i = 0; i + 1 < outer.length; i += 2) {
      const ox = (outer[i] ?? 0) - hx;
      const oy = (outer[i + 1] ?? 0) - hy;
      const k = (i / 2) % 2 === 0 ? 1 : hair === 'spiky' ? 1.35 : 1.12;
      bumps.push(hx + ox * k, hy + oy * k);
    }
    outer.splice(0, outer.length, ...bumps);
  }
  sk.shape(
    [
      ...outer,
      hx + r * 0.45,
      hy - r * 0.45,
      hx - r * 0.2,
      hy - r * 0.25,
      hx - r * 0.55,
      hy + r * 0.45,
      hx - r * 0.95,
      hy + r * 0.25,
    ],
    color,
    look,
  );
}

export interface FaceArgs {
  readonly expression: Expression;
  readonly head: Pt;
  readonly r: number;
  readonly chin: number;
  readonly beard: boolean;
  readonly glasses: boolean;
  readonly skin: string;
  readonly beardColor: string;
  readonly tiny: boolean;
}

/** Eyes, brows, mouth (and beard, glasses) of an expression. */
export function drawFace(sk: Sketch, a: FaceArgs): void {
  const [hx, hy] = a.head;
  const { r, expression: e } = a;
  const dark = a.skin === 'sepiaMid' || a.skin === 'sepiaInk';
  const ink = dark ? 'paper' : 'ink';
  const up = a.chin > 0 ? -r * 0.12 : a.chin < 0 ? r * 0.1 : 0;
  const near: [number, number] = [hx + r * 0.5, hy - r * 0.08];
  const far: [number, number] = [hx + r * 0.05, hy - r * 0.1];
  const eyes = [near, far];
  sk.oval(hx - r * 0.2, hy + r * 0.12, r * 0.18, r * 0.26, a.skin, { outline: 'inner' });
  if (a.beard)
    sk.shape(
      [
        hx - r * 0.3,
        hy + r * 0.3,
        hx + r * 0.9,
        hy + r * 0.35,
        hx + r * 0.75,
        hy + r * 1.15,
        hx + r * 0.1,
        hy + r * 1.25,
      ],
      a.beardColor,
      { outline: 'inner' },
    );
  const wide = e === 'surprised' || e === 'scared';
  eyes.forEach(([ex, ey], i) => {
    if (a.tiny && i === 1) return;
    const s = i === 0 ? 1 : 0.8;
    if (wide && !a.tiny) {
      sk.oval(ex, ey, r * 0.17 * s, r * 0.22 * s, 'paper', { outline: 'inner' });
      sk.dot(ex + r * 0.04, ey + up, r * 0.07 * s, 'ink');
    } else if (e === 'happy' && !a.tiny) {
      sk.stroke([ex - r * 0.13, ey + r * 0.05, ex, ey - r * 0.08, ex + r * 0.13, ey + r * 0.05], {
        color: ink,
      });
    } else {
      sk.dot(ex, ey + up * 0.6, r * 0.11 * s, ink);
    }
  });
  if (!a.tiny) drawBrows(sk, e, eyes, r, ink);
  const [mx, my] = [hx + r * 0.45, hy + r * 0.52];
  const w = r * 0.28;
  const mouth: Readonly<Record<Expression, number[]>> = {
    neutral: [mx - w, my, mx + w * 0.8, my - r * 0.02],
    happy: [mx - w, my - r * 0.08, mx, my + r * 0.12, mx + w, my - r * 0.1],
    sad: [mx - w, my + r * 0.1, mx, my - r * 0.06, mx + w, my + r * 0.08],
    angry: [mx - w, my + r * 0.03, mx + w, my - r * 0.03],
    surprised: [],
    scared: [
      mx - w,
      my,
      mx - w * 0.3,
      my - r * 0.06,
      mx + w * 0.3,
      my + r * 0.05,
      mx + w,
      my - r * 0.03,
    ],
  };
  if (e === 'surprised') sk.oval(mx, my + r * 0.05, r * 0.13, r * 0.18, 'ink', { outline: false });
  else sk.stroke(mouth[e], { color: ink, w: e === 'angry' ? 'outer' : 'inner' });
  if (e === 'scared' && !a.tiny)
    sk.shape(
      [hx - r * 0.95, hy - r * 0.9, hx - r * 0.8, hy - r * 0.55, hx - r * 1.1, hy - r * 0.55],
      'cyan',
      { outline: 'inner' },
    );
  if (a.glasses && !a.tiny) {
    for (const [ex, ey] of eyes) sk.oval(ex, ey, r * 0.21, r * 0.18, 'none', { outline: 'inner' });
    sk.line(near[0] - r * 0.21, near[1], far[0] + r * 0.21, far[1]);
  }
}

function drawBrows(
  sk: Sketch,
  e: Expression,
  eyes: readonly [number, number][],
  r: number,
  ink: string,
): void {
  // Inner end = toward the nose (+x). Angry: inner low; sad and scared: inner high.
  const tilt = e === 'angry' ? 0.16 : e === 'sad' || e === 'scared' ? -0.14 : 0;
  const lift = e === 'surprised' || e === 'scared' ? 0.14 : 0;
  for (const [ex, ey] of eyes) {
    const y = ey - r * (0.3 + lift);
    sk.stroke([ex - r * 0.14, y - tilt * r, ex + r * 0.14, y + tilt * r], {
      color: ink,
      w: e === 'angry' ? 'outer' : 'inner',
    });
  }
}

/** A hat over the head (flat = one-ink silhouette). */
export function drawHat(
  sk: Sketch,
  hat: Hat,
  head: Pt,
  r: number,
  color: string,
  flat: boolean,
): void {
  const [hx, hy] = head;
  const look = { outline: flat ? (false as const) : ('inner' as const), shade: flat ? 0 : 0.35 };
  const top = hy - r * 1.08;
  switch (hat) {
    case 'cap':
      sk.shape(
        [
          ...arc(hx, hy - r * 0.15, r * 1.05, r * 1.0, Math.PI, Math.PI * 2, 8),
          hx + r * 1.9,
          hy - r * 0.15,
          hx + r * 1.7,
          hy - r * 0.32,
        ],
        color,
        look,
      );
      return;
    case 'bowler':
      sk.shape(arc(hx, hy - r * 0.45, r * 0.95, r * 0.95, Math.PI, Math.PI * 2, 8), color, look);
      sk.shape(
        [
          hx - r * 1.35,
          hy - r * 0.48,
          hx + r * 1.4,
          hy - r * 0.5,
          hx + r * 1.3,
          hy - r * 0.32,
          hx - r * 1.25,
          hy - r * 0.3,
        ],
        color,
        look,
      );
      return;
    case 'brim':
      sk.shape(
        [
          hx - r * 0.75,
          hy - r * 0.55,
          hx - r * 0.6,
          top - r * 0.55,
          hx + r * 0.7,
          top - r * 0.6,
          hx + r * 0.8,
          hy - r * 0.55,
        ],
        color,
        look,
      );
      sk.shape(
        [
          hx - r * 1.9,
          hy - r * 0.42,
          hx + r * 2,
          hy - r * 0.5,
          hx + r * 1.7,
          hy - r * 0.25,
          hx - r * 1.6,
          hy - r * 0.2,
        ],
        color,
        look,
      );
      if (!flat)
        sk.line(
          hx - r * 0.7,
          hy - r * 0.62,
          hx + r * 0.78,
          hy - r * 0.64,
          'ink',
          sk.widthOf('outer'),
        );
      return;
    case 'hood':
      sk.shape(
        [
          ...arc(hx - r * 0.1, hy, r * 1.3, r * 1.35, Math.PI * 0.55, Math.PI * 1.85, 10),
          hx + r * 0.55,
          hy - r * 0.6,
          hx + r * 0.2,
          hy + r * 0.9,
        ],
        color,
        look,
      );
      return;
    case 'helmet':
      sk.oval(hx + r * 0.1, hy + r * 0.05, r * 1.55, r * 1.5, 'none', {
        outline: flat ? false : 'outer',
      });
      if (!flat)
        sk.stroke(
          arc(hx + r * 0.1, hy + r * 0.05, r * 1.25, r * 1.2, Math.PI * 1.15, Math.PI * 1.45, 4),
          { color: 'paper', w: 'outer' },
        );
      return;
    case 'hardhat':
      sk.shape(
        [
          ...arc(hx, hy - r * 0.3, r * 1.05, r * 0.9, Math.PI, Math.PI * 2, 8),
          hx + r * 1.45,
          hy - r * 0.3,
          hx + r * 1.4,
          hy - r * 0.15,
          hx - r * 1.15,
          hy - r * 0.15,
        ],
        color,
        look,
      );
      return;
    case 'crown': {
      const y0 = hy - r * 0.6;
      sk.shape(
        [
          hx - r * 0.9,
          y0,
          hx - r * 0.95,
          top - r * 0.5,
          hx - r * 0.45,
          top - r * 0.1,
          hx,
          top - r * 0.65,
          hx + r * 0.45,
          top - r * 0.1,
          hx + r * 0.95,
          top - r * 0.5,
          hx + r * 0.9,
          y0,
        ],
        flat ? color : 'yellow',
        look,
      );
      return;
    }
    case 'beanie':
      sk.shape(
        arc(hx, hy - r * 0.2, r * 1.08, r * 1.1, Math.PI * 1.02, Math.PI * 1.98, 9),
        color,
        look,
      );
      sk.oval(hx - r * 0.1, top - r * 0.3, r * 0.3, r * 0.28, color, look);
      return;
    case 'pointed':
      sk.shape(
        [hx - r * 1.4, hy - r * 0.4, hx - r * 0.2, top - r * 2.6, hx + r * 1.4, hy - r * 0.45],
        color,
        look,
      );
      return;
    case 'kerchief':
      sk.shape(
        [
          ...arc(hx, hy - r * 0.05, r * 1.12, r * 1.15, Math.PI * 0.9, Math.PI * 1.9, 9),
          hx - r * 1.3,
          hy + r * 0.5,
        ],
        color,
        look,
      );
      return;
    case 'none':
      return;
  }
}
