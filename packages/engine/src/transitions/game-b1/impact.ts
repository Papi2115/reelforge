/**
 * Impact and signal transitions of the Game B1 world:
 * - `game-b1-room-shake`: a slam (the console is hit, a boss lands): the outgoing frame jolts in
 *   held 2-frame steps with a decaying amplitude, one frame of the 2600 hit flash, then the
 *   incoming frame shakes and settles;
 * - `game-b1-cartridge-in` (a carry-environment link: the TV stays, its game changes): the picture
 *   rolls as a cartridge rocks in the slot, the garbage frame of a console reading a half-seated
 *   cartridge (bands of world inks and torn rows of both pictures, playfield blocks dropping out),
 *   then the new game clicks in with a jolt;
 * - `game-b1-cartridge-out`: garbage as the cartridge leaves the contacts, the picture collapses to
 *   a bright line and a dot (the CRT going off), a dark beat, the next picture powers on from the
 *   centre line.
 * Frames are counted at 30 fps of the style's duration so jolts and garbage hold like a console's.
 * Pure functions of (A, B, p, seed); pixels of A, B, A or B through the world's flash LUT, world inks.
 */
import { hashOf, unit, type Composition, type Compositor } from '../pixels.js';
import { endFrames, phase } from '../wow.js';
import { apply, b1Tones, lutMap, scaleOf } from './tones.js';

/** Copies `src` into `out` shifted by (dx, dy); uncovered pixels get `fill`. */
function shifted(c: Composition, src: Uint32Array, dx: number, dy: number, fill: number): void {
  const { width: W, height: H, out } = c;
  for (let y = 0; y < H; y += 1) {
    const sy = y - dy;
    for (let x = 0; x < W; x += 1) {
      const sx = x - dx;
      out[y * W + x] = sx >= 0 && sy >= 0 && sx < W && sy < H ? (src[sy * W + sx] ?? fill) : fill;
    }
  }
}

function jolt(seed: number, frame: number, amp: number): readonly [number, number] {
  const f = Math.floor(frame / 2);
  return [
    Math.round((unit(hashOf(seed, f, 1)) - 0.5) * 2 * amp),
    Math.round((unit(hashOf(seed, f, 2)) - 0.5) * 2 * amp * 0.6),
  ];
}

export const roomShake: Compositor = (c) => {
  if (endFrames(c)) return;
  const { width: W, a, b, p, seed, tones } = c;
  const s = scaleOf(W);
  const ink = b1Tones(tones);
  const frame = Math.floor(p * 0.5 * 30);
  if (p < 0.4) {
    const [dx, dy] = jolt(seed, frame, 6 * s * (1 - phase(p, 0, 0.4) * 0.5));
    shifted(c, a, dx, dy, ink.VOID);
    return;
  }
  if (p < 0.47) {
    const flash = lutMap(tones, 'flash');
    for (let i = 0; i < c.out.length; i += 1) c.out[i] = apply(flash, b[i] ?? 0);
    return;
  }
  const [dx, dy] = jolt(seed + 7, frame, 4 * s * Math.exp(-phase(p, 0.47, 1) * 4));
  shifted(c, b, dx, dy, ink.VOID);
};

const GARBAGE = [
  'ORANGE',
  'TEAL',
  'MAUVE',
  'GOLD',
  'BLUE',
  'AVOCADO',
  'TUBE',
  'CREAM',
  'GREY_D',
] as const;

/** The garbage frame: bands of seeded heights, inks or torn rows of A / B, dropped-out blocks. */
function garbage(c: Composition, frame: number): void {
  const { width: W, height: H, a, b, out, seed, tones } = c;
  const ink = b1Tones(tones);
  const s = scaleOf(W);
  const block = Math.max(1, Math.round(16 * s));
  let y = 0;
  let i = 0;
  while (y < H) {
    const bh = Math.max(
      1,
      Math.round(2 * s * (1 + Math.floor(unit(hashOf(seed, frame * 97 + i, 3)) * 9))),
    );
    const pick = unit(hashOf(seed, frame * 97 + i, 4));
    const name =
      GARBAGE[Math.floor(unit(hashOf(seed, frame * 97 + i, 5)) * GARBAGE.length)] ?? 'TUBE';
    const glitch = unit(hashOf(seed, frame * 97 + i, 6)) > 0.55;
    const tear = Math.round((unit(hashOf(seed, frame * 97 + i, 8)) - 0.5) * 40 * s);
    for (let yy = y; yy < Math.min(H, y + bh); yy += 1)
      for (let x = 0; x < W; x += 1) {
        const k = yy * W + x;
        const blockOff = glitch && unit(hashOf(seed, frame * 13 + Math.floor(x / block), i)) > 0.6;
        const sx = Math.min(W - 1, Math.max(0, x + tear));
        out[k] = blockOff
          ? ink.VOID
          : pick < 0.25
            ? (a[yy * W + sx] ?? 0)
            : pick < 0.4
              ? (b[yy * W + sx] ?? 0)
              : ink[name];
      }
    y += bh;
    i += 1;
  }
}

const IN_S = 0.8;
const OUT_S = 0.9;

export const cartridgeIn: Compositor = (c) => {
  if (endFrames(c)) return;
  const { width: W, height: H, a, b, p, seed, tones } = c;
  const s = scaleOf(W);
  const frame = Math.floor(p * IN_S * 30);
  if (p < 0.25) {
    // the vertical hold slips while the cartridge rocks in the slot
    const roll =
      Math.round(phase(p, 0, 0.25) ** 2 * H * 0.3) +
      Math.round((unit(hashOf(seed, frame >> 1, 9)) - 0.5) * 4 * s);
    shifted(c, a, 0, roll, b1Tones(tones).VOID);
    return;
  }
  if (p < 0.7) {
    garbage(c, frame);
    return;
  }
  const [, dy] = jolt(seed + 3, frame, (3 * s * Math.exp(-phase(p, 0.7, 1) * 3)) / 0.6);
  shifted(c, b, 0, dy, b1Tones(tones).VOID);
};

export const cartridgeOut: Compositor = (c) => {
  if (endFrames(c)) return;
  const { width: W, height: H, a, b, out, p, tones } = c;
  const ink = b1Tones(tones);
  const frame = Math.floor(p * OUT_S * 30);
  if (p < 0.3) {
    garbage(c, frame);
    return;
  }
  const mid = H / 2;
  if (p < 0.5) {
    // the CRT going off: the picture squeezes to a bright line, the line to a dot
    const q = phase(p, 0.3, 0.5);
    const half = Math.max(0.5, mid * (1 - q / 0.6));
    const reach = q < 0.6 ? W : W * (1 - (q - 0.6) / 0.4);
    for (let y = 0; y < H; y += 1)
      for (let x = 0; x < W; x += 1) {
        const i = y * W + x;
        const inBand = Math.abs(y + 0.5 - mid) <= half && Math.abs(x + 0.5 - W / 2) <= reach / 2;
        if (!inBand) out[i] = ink.VOID;
        else if (half < 2) out[i] = ink.CREAM;
        else out[i] = a[Math.min(H - 1, Math.floor(mid + ((y - mid) * mid) / half)) * W + x] ?? 0;
      }
    return;
  }
  if (p < 0.65) {
    out.fill(ink.VOID);
    return;
  }
  // powering on: the next picture opens from the centre line
  const half = mid * Math.min(1, phase(p, 0.65, 0.85));
  for (let y = 0; y < H; y += 1)
    for (let x = 0; x < W; x += 1) {
      const i = y * W + x;
      out[i] = Math.abs(y + 0.5 - mid) <= Math.max(1, half) ? (b[i] ?? 0) : ink.VOID;
    }
};
