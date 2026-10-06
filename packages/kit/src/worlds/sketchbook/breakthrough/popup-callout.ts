/**
 * The red pen's mark after a pop-up pull, always on what the pull moved (never on an empty spot
 * unless that spot is the point): `loop` round the moved piece where it ends, `trail` an arrow
 * along its move then a loop round it, `notch` (an arm) a loop on the pencilled notch it left
 * and an arrow along its drift (the showcase: the date stayed, the season moved), `none`.
 */
import { arrowRecipe, loopRecipe } from '../draw/doodles.js';
import type { Mark } from '../draw/marks.js';
import { rnd } from '../draw/math.js';
import type { Point, Pts } from '../draw/paths.js';
import { Lens } from './camera.js';
import { flatOutline, isFlat } from './popup-flats.js';
import { cardGeo, eyeAt, type CardGeo } from './popup-geometry.js';
import type { PieceState } from './popup-motion.js';
import type { PopupArt } from './popup-paint.js';
import { recipeMarks } from './shapes.js';

const rad = (deg: number): number => (deg * Math.PI) / 180;

/** Where a piece is (page px) and how big (radius), on the settled card. */
function spotOf(
  art: PopupArt,
  g: CardGeo,
  index: number,
  st: PieceState,
): [Point, number, number] | null {
  const e = art.o.elements[index];
  if (!e) return null;
  if (e.kind === 'arm') {
    const arm = g.arms.find((candidate) => candidate.index === index);
    return arm
      ? [g.back.xf(arm.centre[0], arm.centre[1]), arm.radius * 1.5, arm.radius * 1.4]
      : null;
  }
  if (e.kind === 'block' || e.kind === 'cutout') {
    const piece = g.pieces.find((candidate) => candidate.index === index);
    return piece ? [piece.front.xf(e.w / 2, e.h / 2), e.w / 2 + 14, e.h / 2 + 12] : null;
  }
  if (!isFlat(e)) return null;
  const outline =
    flatOutline(e, st, art.card.x0) ?? flatOutline(e, { ...st, show: 1 }, art.card.x0);
  const uv: Pts = outline ?? [art.card.x0 + e.u, e.v];
  let [u0, v0, u1, v1] = [Infinity, Infinity, -Infinity, -Infinity];
  for (let i = 0; i < uv.length; i += 2) {
    [u0, u1] = [Math.min(u0, uv[i] ?? 0), Math.max(u1, uv[i] ?? 0)];
    [v0, v1] = [Math.min(v0, uv[i + 1] ?? 0), Math.max(v1, uv[i + 1] ?? 0)];
  }
  const [rx, ry] = e.kind === 'flap' ? [e.w / 2, e.h / 2] : [(u1 - u0) / 2, (v1 - v0) / 2];
  return [g.piecePlane.xf((u0 + u1) / 2, (v0 + v1) / 2), rx + 14, ry + 12];
}

function loopAround(at: Point, rx: number, ry: number, t0: number, seed: number): Mark[] {
  return recipeMarks(loopRecipe(at[0] + 1, at[1], rx, ry, seed, 1.12, -0.9), {
    tool: 'red',
    width: 3,
    t0,
    dur: 0.28,
    seed,
    held: true,
    fps: 10,
  });
}

function arrowAlong(path: Pts, t0: number, seed: number): Mark[] {
  return recipeMarks(arrowRecipe(path, 13, 0.5, 0.06, 'out'), {
    tool: 'red',
    width: 3,
    t0,
    dur: 0.2,
    seed,
    held: true,
    fps: 10,
  });
}

/** The arm's notch callout (the showcase's), on the settled card. */
function notchMarks(art: PopupArt, g: CardGeo, index: number, swing: number) {
  const pull = art.times.pull;
  const element = art.o.elements[index];
  const arm = g.arms.find((candidate) => candidate.index === index);
  if (!pull || element?.kind !== 'arm' || !arm) return null;
  const k = arm.radius / 24;
  const notch = g.back.xf(arm.centre[0], arm.centre[1]);
  const seed = art.seed + 551;
  const loop = recipeMarks(loopRecipe(notch[0] + 1, notch[1], 38 * k, 35 * k, seed, 1.12, -0.9), {
    tool: 'red',
    width: 3,
    t0: pull.loop,
    dur: 0.28,
    seed,
    held: true,
    fps: 10,
  });
  const [a0, a1] = [element.angle, swing];
  const sign = Math.sign(a0 - a1) || 1;
  const [from, to] = [a0 - sign * 14, a1 + sign * 15];
  const drift: Pts = [];
  const radius = element.length + 4;
  for (let i = 0; i <= 8; i += 1) {
    const a = rad(from + (i / 8) * (to - from));
    drift.push(
      ...g.back.xf(
        arm.pivot[0] + radius * Math.sin(a),
        arm.pivot[1] + radius * Math.cos(a) + rnd(-0.8, 0.8, seed, i),
      ),
    );
  }
  return { marks: [...loop, ...arrowAlong(drift, pull.arrow, seed + 1)], notch };
}

/** The red callout of the pull (held by the hand), and the vacated notch for `notch`. */
export function calloutMarks(
  art: PopupArt,
  target: number,
  swing: number | undefined,
): { marks: Mark[]; notch: Point | null } | null {
  const pull = art.times.pull;
  const kind = art.o.pull?.callout ?? 'none';
  if (!pull || kind === 'none' || target < 0) return null;
  const geoAt = (t: number, states: PieceState[]): CardGeo =>
    cardGeo(
      new Lens(eyeAt(art.o, art.times, art.times.land + 1)),
      art.card,
      art.o.elements,
      90,
      states,
      art.phiOf(t, 90),
    );
  if (kind === 'notch' && swing !== undefined) {
    return notchMarks(art, geoAt(art.times.land, art.states(art.times.land)), target, swing);
  }
  const settle = pull.done + 0.6;
  const [before, after] = [art.states(pull.press), art.states(settle)];
  const [st0, st1] = [before[target], after[target]];
  const end = st1 ? spotOf(art, geoAt(settle, after), target, st1) : null;
  if (!end) return null;
  const seed = art.seed + 561;
  const start = st0 ? spotOf(art, geoAt(pull.press, before), target, st0) : null;
  const moved = start ? Math.hypot(end[0][0] - start[0][0], end[0][1] - start[0][1]) : 0;
  if (kind === 'trail' && start && moved > 30) {
    const path: Pts = [];
    for (let i = 0; i <= 8; i += 1) {
      const k = 0.12 + (i / 8) * 0.62;
      const bend = Math.sin(Math.PI * k) * 18;
      const [dx, dy] = [end[0][0] - start[0][0], end[0][1] - start[0][1]];
      path.push(
        start[0][0] + dx * k - (dy / moved) * bend,
        start[0][1] + dy * k + (dx / moved) * bend,
      );
    }
    return {
      marks: [
        ...arrowAlong(path, pull.loop, seed),
        ...loopAround(end[0], end[1], end[2], pull.arrow, seed + 3),
      ],
      notch: null,
    };
  }
  return { marks: loopAround(end[0], end[1], end[2], pull.loop, seed), notch: null };
}
