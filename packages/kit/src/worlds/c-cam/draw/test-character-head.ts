/**
 * Heads of the rig's test character (test-character.ts): four hand-drawn views in head-local units
 * (origin = top of the neck, +x = the way the head faces, y down; the chin sits near y = +6, the
 * crown near y = -204). Original drawing, built only from the ported brushes; not a film person.
 */
import { brushStroke, type BrushEnv } from './brushes.js';
import type { HeadDraw } from './character.js';
import type { FaceState } from './face.js';
import { brow, eye, mouth } from './face-parts.js';
import type { Paint2D } from './paint.js';
import { blob, ellipseRing } from './shapes.js';

/** The warden's own palette (not from `C`). */
export const WARDEN_TONES = {
  skin: '#d4a07c',
  skinD: '#a3725a',
  hair: '#6e6a63',
  hairD: '#4a4740',
  coat: '#46604f',
  coatD: '#2f4236',
  brass: '#b8913e',
  trousers: '#5b4f45',
  trousersD: '#3d342d',
  shoe: '#2b2420',
  shoeD: '#171310',
} as const;

const T = WARDEN_TONES;
export const WARDEN_SEED = 1700;
const S = WARDEN_SEED;
const FACE = { lw: 6, shade: [T.skinD, -9, 6] } as const;

function ear(g: Paint2D, env: BrushEnv, x: number, y: number, seed: number): void {
  blob(g, env, ellipseRing(x, y, 11, 19, 8), T.skin, { lw: 5, seed, shade: [T.skinD, -4, 2] });
}

/** The walrus moustache: two drooping brush strokes under the nose, from (x0, y) outward. */
function moustache(g: Paint2D, env: BrushEnv, x0: number, y: number, spread: number): void {
  const side = (dir: number, seed: number): void => {
    // prettier-ignore
    brushStroke(g, env, [x0, y, x0 + dir * spread * 0.5, y + 4, x0 + dir * spread, y + 18], { w: 9, color: T.hairD, seed });
  };
  side(-1, S + 40);
  side(1, S + 41);
}

function headFront(g: Paint2D, env: BrushEnv, f: FaceState): void {
  ear(g, env, -62, -95, S + 10);
  ear(g, env, 62, -95, S + 11);
  // prettier-ignore
  blob(g, env, [-60, -20, -64, -90, -56, -150, -30, -184, 0, -192, 30, -184, 56, -150, 64, -90, 60, -20, 34, 4 + f.jaw * 10, 0, 10 + f.jaw * 14, -34, 4 + f.jaw * 10], T.skin, { ...FACE, seed: S + 12 });
  // prettier-ignore
  blob(g, env, [-66, -112, -62, -162, -36, -198, 0, -206, 36, -198, 62, -162, 66, -112, 48, -142, 18, -160, -22, -158, -50, -140], T.hair, { lw: 6, seed: S + 13, shade: [T.hairD, -8, 6] });
  brow(g, env, -24, -124, 30, -1, f, { seed: S + 14 });
  brow(g, env, 24, -124, 30, 1, f, { seed: S + 15 });
  eye(g, env, -24, -102, 13, 10, f, { skin: T.skin, seed: S + 16, side: 0 });
  eye(g, env, 24, -102, 13, 10, f, { skin: T.skin, seed: S + 17, side: 1 });
  // prettier-ignore
  blob(g, env, [-6, -98, 8, -74, 16, -58, 0, -50, -14, -58], T.skin, { lw: 5, seed: S + 18, shade: [T.skinD, -4, 3] });
  mouth(g, env, 0, -26 + f.jaw * 6, 38, f, { seed: S + 19 });
  moustache(g, env, 0, -46, 34);
}

function head34(g: Paint2D, env: BrushEnv, f: FaceState): void {
  ear(g, env, -40, -92, S + 20);
  // prettier-ignore
  blob(g, env, [-52, -20, -60, -90, -52, -152, -24, -186, 6, -194, 36, -184, 60, -150, 68, -96, 66, -40, 50, -4 + f.jaw * 10, 20, 8 + f.jaw * 14, -20, 4 + f.jaw * 8], T.skin, { ...FACE, seed: S + 21 });
  // prettier-ignore
  blob(g, env, [-60, -104, -58, -160, -30, -198, 6, -206, 40, -196, 64, -160, 66, -120, 46, -146, 14, -162, -24, -156, -46, -128], T.hair, { lw: 6, seed: S + 22, shade: [T.hairD, -8, 6] });
  brow(g, env, 12, -124, 28, -1, f, { seed: S + 23 });
  brow(g, env, 50, -122, 20, 1, f, { seed: S + 24 });
  eye(g, env, 12, -102, 12, 10, f, { skin: T.skin, seed: S + 25, side: 0 });
  eye(g, env, 50, -102, 8, 9, f, { skin: T.skin, seed: S + 26, side: 1 });
  // prettier-ignore
  blob(g, env, [32, -98, 58, -76, 74, -60, 56, -50, 40, -56], T.skin, { lw: 5, seed: S + 27, shade: [T.skinD, -4, 3] });
  mouth(g, env, 34, -26 + f.jaw * 6, 30, f, { seed: S + 28 });
  moustache(g, env, 40, -46, 26);
}

function headProfile(g: Paint2D, env: BrushEnv, f: FaceState): void {
  // prettier-ignore
  blob(g, env, [-50, -20, -58, -90, -48, -152, -16, -188, 18, -192, 48, -170, 62, -130, 66, -100, 64, -50, 60, -16 + f.jaw * 10, 36, 6 + f.jaw * 14, 0, 6 + f.jaw * 8, -30, 0], T.skin, { ...FACE, seed: S + 31 });
  // prettier-ignore
  blob(g, env, [-58, -96, -56, -160, -22, -200, 18, -206, 52, -180, 54, -150, 30, -158, 0, -150, -20, -120, -36, -90], T.hair, { lw: 6, seed: S + 32, shade: [T.hairD, -8, 6] });
  ear(g, env, -8, -94, S + 30);
  brow(g, env, 44, -124, 22, 1, f, { seed: S + 33 });
  eye(g, env, 44, -102, 9, 10, f, { skin: T.skin, seed: S + 34, side: 1 });
  // prettier-ignore
  blob(g, env, [58, -100, 76, -80, 88, -64, 70, -54, 60, -60], T.skin, { lw: 5, seed: S + 35, shade: [T.skinD, -4, 3] });
  mouth(g, env, 52, -26 + f.jaw * 6, 18, f, { seed: S + 36 });
  // prettier-ignore
  brushStroke(g, env, [70, -48, 60, -40, 50, -26], { w: 9, color: T.hairD, seed: S + 37 });
}

function headBack(g: Paint2D, env: BrushEnv): void {
  ear(g, env, -62, -95, S + 50);
  ear(g, env, 62, -95, S + 51);
  // prettier-ignore
  blob(g, env, [-58, -20, -64, -90, -56, -150, -30, -184, 0, -192, 30, -184, 56, -150, 64, -90, 58, -20, 0, 6], T.skin, { ...FACE, seed: S + 52 });
  // prettier-ignore
  blob(g, env, [-66, -60, -66, -150, -38, -198, 0, -206, 38, -198, 66, -150, 66, -60, 30, -48, 0, -44, -30, -48], T.hair, { lw: 6, seed: S + 53, shade: [T.hairD, -8, 6] });
  [-1, 1].forEach((s, i) => {
    brushStroke(g, env, [s * 26, -14, s * 22, 4], { w: 4, seed: S + 54 + i });
  });
}

/** The four head views (`HeadDraw`): front, three-quarter, profile, back. */
export const wardenHead: HeadDraw = (g, env, view, f) => {
  if (view === 0) headFront(g, env, f);
  else if (view === 1) head34(g, env, f);
  else if (view === 2) headProfile(g, env, f);
  else headBack(g, env);
};
