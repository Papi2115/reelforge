/**
 * Contact-sheet pages of the Grim Ink project modules (PLAN.md#14.8), painted on the ink stage by
 * the scene `reelforge people-preview` / `places-preview` generate (so the CLI and the app render
 * the same bytes through the same engine). Each page fills one 1920x1080 frame; nothing here
 * depends on the frame time (the sheet is drawn at the fixed `SHEET_T`).
 *
 * Person: page 0 = the six ring views (front, 3/4, profile, back, profile left, 3/4 left) x three
 * poses (stand, akimbo, walk); page 1 = the 14 expressions, front heads. Place: pages 0-2 = the
 * place at three framings (wide: all of it, medium: x2 on its light / centre, close: x3.2 on its
 * first anchor / light).
 */
import { C, H, W } from '../core.js';
import { DEFAULT_ENV, inkLine, makeEnv } from '../draw/brushes.js';
import type { Character } from '../draw/character.js';
import { EXPR_NAMES, face } from '../draw/face.js';
import { drawFigure } from '../draw/figure.js';
import type { Paint2D } from '../draw/paint.js';
import { pose, type Pose, type PoseName } from '../draw/poses.js';
import { RING } from '../draw/rig-views.js';
import { rect } from '../draw/scenery.js';
import type { BrushEnv } from '../draw/brushes.js';

/** Shot time every sheet page is drawn at (eyes open, no talk). */
export const SHEET_T = 0.4;
export const PERSON_SHEET_PAGES = 2;
export const PLACE_SHEET_PAGES = 3;

const SHEET_POSES: readonly PoseName[] = ['stand', 'akimbo', 'walk'];
const FACE_COLUMNS = 7;

/** Crown height of a character in body px (positive). */
function crown(character: Character): number {
  const D = character.D;
  return Math.abs(D.top ?? D.head?.top ?? D.sy * 1.45);
}

function backdrop(g: Paint2D, rows: number): void {
  g.setTransform(1, 0, 0, 1, 0, 0);
  rect(g, DEFAULT_ENV, 0, 0, W, H, C.PLASTER, { lw: 0, seed: 3 });
  const cell = H / rows;
  for (let r = 0; r < rows; r += 1) {
    const floor = (r + 1) * cell - 16;
    rect(g, DEFAULT_ENV, 0, floor, W, 16, C.STONE_D, { lw: 0, seed: 5 + r });
    inkLine(g, DEFAULT_ENV, [0, floor, W / 2, floor + 2, W, floor], { seed: 9 + r, w: 5 });
  }
}

/**
 * Draws one figure of the turnaround. The default is the bare rig; a project person passes its
 * own drawer (person.ts) so its module hooks (`arms`, `held`, `beforeHand`) and its default
 * props show on the sheet like in a scene (PLAN.md#14.18: the props never showed before).
 */
export type SheetFigure = (
  g: Paint2D,
  env: BrushEnv,
  at: { readonly x: number; readonly y: number; readonly s: number },
  pose: Pose,
  yaw: number,
  t: number,
) => void;

function rigFigure(character: Character): SheetFigure {
  return (g, env, at, P, yaw, t) => {
    drawFigure(g, env, character, at, P, yaw, undefined, t);
  };
}

function turnaround(g: Paint2D, character: Character, drawOne: SheetFigure): void {
  backdrop(g, SHEET_POSES.length);
  const cellW = W / RING.length;
  const cellH = H / SHEET_POSES.length;
  const s = (cellH * 0.86) / crown(character);
  SHEET_POSES.forEach((name, row) => {
    const floor = (row + 1) * cellH - 16;
    RING.forEach((yaw, col) => {
      const P = pose(name, character.D, 0.25);
      const at = { x: (col + 0.5) * cellW, y: floor, s };
      drawOne(g, DEFAULT_ENV, at, P, yaw, SHEET_T);
    });
  });
}

function faces(g: Paint2D, character: Character): void {
  g.setTransform(1, 0, 0, 1, 0, 0);
  rect(g, DEFAULT_ENV, 0, 0, W, H, C.LINEN, { lw: 0, seed: 4 });
  const rows = Math.ceil(EXPR_NAMES.length / FACE_COLUMNS);
  const cellW = W / FACE_COLUMNS;
  const cellH = H / rows;
  const D = character.D;
  const headHeight = D.head ? Math.abs(D.head.bottom - D.head.top) : crown(character) * 0.3;
  // Body px -> screen; head-local units are body px / headScale.
  const k = (cellH * 0.62) / headHeight;
  const env: BrushEnv = makeEnv(k);
  EXPR_NAMES.forEach((expr, index) => {
    const col = index % FACE_COLUMNS;
    const row = Math.floor(index / FACE_COLUMNS);
    g.save();
    g.translate((col + 0.5) * cellW, (row + 0.86) * cellH);
    g.scale(k * character.headScale, k * character.headScale);
    character.head(g, env, 0, face(SHEET_T, character.seed, expr, { noBlink: true }));
    g.restore();
  });
}

/** Paints page `page` (0 turnaround, 1 faces; wraps) of a person's sheet. */
export function paintPersonSheet(
  g: Paint2D,
  character: Character,
  page: number,
  drawOne: SheetFigure = rigFigure(character),
): void {
  const index = ((Math.floor(page) % PERSON_SHEET_PAGES) + PERSON_SHEET_PAGES) % PERSON_SHEET_PAGES;
  g.save();
  if (index === 0) turnaround(g, character, drawOne);
  else faces(g, character);
  g.restore();
}

/** What the place sheet needs of a place. */
export interface SheetPlace {
  readonly bounds: readonly [number, number];
  readonly light: { readonly x: number; readonly y: number } | undefined;
  readonly anchors: Readonly<Record<string, readonly [number, number]>>;
  draw(g: Paint2D, env: BrushEnv, t: number): void;
}

/** Centre and zoom of framing `index` (0 wide, 1 medium, 2 close). */
export function placeFraming(
  place: SheetPlace,
  index: number,
): { readonly cx: number; readonly cy: number; readonly z: number } {
  const [w, h] = place.bounds;
  const wide = Math.min(W / w, H / h);
  const centre: readonly [number, number] = place.light
    ? [place.light.x, place.light.y]
    : [w / 2, h / 2];
  const [firstAnchor] = Object.values(place.anchors);
  if (index === 0) return { cx: w / 2, cy: h / 2, z: wide };
  if (index === 1) return { cx: centre[0], cy: centre[1], z: wide * 2 };
  const [cx, cy] = firstAnchor ?? centre;
  return { cx, cy, z: wide * 3.2 };
}

/** Paints page `page` (0 wide, 1 medium, 2 close; wraps) of a place's sheet. */
export function paintPlaceSheet(g: Paint2D, place: SheetPlace, page: number): void {
  const index = ((Math.floor(page) % PLACE_SHEET_PAGES) + PLACE_SHEET_PAGES) % PLACE_SHEET_PAGES;
  const { cx, cy, z } = placeFraming(place, index);
  g.save();
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.fillStyle = C.INK;
  g.fillRect(0, 0, W, H);
  g.translate(W / 2, H / 2);
  g.scale(z, z);
  g.translate(-cx, -cy);
  place.draw(g, makeEnv(z), SHEET_T);
  g.restore();
}
