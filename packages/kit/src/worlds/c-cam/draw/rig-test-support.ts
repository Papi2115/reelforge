/**
 * Test support for the rig tests (rig-*.test.ts): the original `rig.js` loaded with its
 * dependencies (original.ts), real cast dimensions and styles from film 3 / film 1, and the view
 * grid. Never imported by production code.
 */
import { expect } from 'vitest';
import { makeEnv, type BrushEnv } from './brushes.js';
import type { RigDims } from './character.js';
import { LegacyRecordingPaint, loadOriginal, type OriginalST } from './original.js';
import type { Paint2D } from './paint.js';
import { RecordingPaint } from './recording-paint.js';
import type { ArmStyle, LegStyle } from './rig-limbs.js';

/** The original engine with face.js (hand), poses.js and rig.js loaded. */
export function loadRigOriginal(): OriginalST {
  return loadOriginal(['face.js', 'poses.js', 'rig.js']);
}

export type Loose = (...args: unknown[]) => unknown;

/** A loosely typed original function (test oracle). */
export function origFn(original: OriginalST, name: string): Loose {
  const fn = original[name] as unknown as Loose | undefined;
  if (typeof fn !== 'function') throw new Error(`original ST.${name} is missing`);
  return fn;
}

/** Every ring yaw plus the mirrored back view (-3): all 4 views, plain and mirrored. */
export const YAWS = [0, 1, 2, 3, -1, -2, -3] as const;

/** films/03-apollo-11/js/cast/commander.js:10 */
export const COMMANDER: RigDims = {
  sw: 70,
  sy: -552,
  sz: 8,
  l1a: 114,
  l2a: 108,
  hw: 36,
  hy: -340,
  l1l: 164,
  l2l: 150,
  elbowOut: 0.75,
  top: -800,
  waist: [84, -404],
  hsz: 42,
  head: { x: [0, 18, 36, 0], top: -800, bottom: -598, hw: 78 },
};

/** films/03-apollo-11/js/cast/you.js:10 */
export const YOU: RigDims = {
  sw: 56,
  sy: -548,
  sz: 6,
  l1a: 118,
  l2a: 112,
  hw: 30,
  hy: -340,
  l1l: 170,
  l2l: 152,
  elbowOut: 0.7,
  top: -800,
  waist: [70, -404],
  hsz: 40,
  head: { x: [0, 18, 40, 0], top: -800, bottom: -596, hw: 70 },
};

/** films/03-apollo-11/js/cast/crowd.js:8 (no head box, no hsz in the original: 30 here). */
export const CROWD: RigDims = {
  sw: 30,
  sy: -250,
  sz: 0,
  l1a: 64,
  l2a: 60,
  hw: 16,
  hy: -120,
  l1l: 64,
  l2l: 58,
  elbowOut: 0.8,
  waist: [34, -160],
  hsz: 30,
};

/** commander.js:109 (glove colours inlined). */
export const SUIT_ARM: ArmStyle = {
  cloth: '#aba58f',
  clothD: '#817b66',
  w: [56, 48, 42],
  skin: '#c9c3ad',
  skinD: '#8f8a76',
  hsz: 42,
  lw: 7,
  cuff: '#8a8478',
  hatch: { c: 'rgba(40,36,24,0.45)', n: 3, len: 24, gap: 6, k: 3, ang: 30 },
};

/** A bare, hairy forearm with a cuff (film 1 style, cast/you.js of samurai-edo). */
export const BARE_ARM: ArmStyle = {
  cloth: '#5a6470',
  clothD: '#3c444c',
  w: [32, 28, 24],
  bare: 0.42,
  skin: '#d9a07e',
  skinD: '#a8735a',
  hsz: 32,
  lw: 6,
  hair: true,
  cuff: '#3c444c',
  hatch: { c: 'rgba(20,14,8,0.45)', n: 3, len: 22, gap: 6, k: 3, ang: 30 },
};

/** A shirt rolled to the elbow (`bare: 0`), no hatch, no lw / seed (original defaults). */
export const SHIRT_ARM: ArmStyle = {
  cloth: '#d8d0b8',
  clothD: '#a49c86',
  w: [30, 26, 20],
  bare: 0,
  skin: '#e0b090',
  skinD: '#b07e62',
  hsz: 30,
};

/** commander.js:110 */
export const SUIT_LEG: LegStyle = {
  cloth: '#aba58f',
  clothD: '#817b66',
  w: [62, 52, 46],
  shoe: '#8d8874',
  shoeD: '#66624f',
  len: 80,
  sw: 40,
  lw: 7,
  splay: 0.3,
  hatch: { c: 'rgba(60,50,30,0.4)', n: 3, len: 30, gap: 6, k: 3, ang: 70 },
};

/** Bare shins, a shoe highlight, default splay / lw / seed. */
export const BARE_LEG: LegStyle = {
  cloth: '#7a2a1a',
  clothD: '#45200f',
  w: [40, 30, 24],
  shoe: '#262220',
  shoeD: '#141210',
  shoeL: '#45403c',
  len: 54,
  sw: 30,
  skin: '#d9a07e',
  skinD: '#a8735a',
};

/**
 * Draws the same thing with the original (globals `ST.LW` / `ST.camZ`) and the port (explicit
 * env) and expects identical recordings.
 */
export function expectSameDrawing(
  original: OriginalST,
  legacy: (g: LegacyRecordingPaint) => unknown,
  port: (g: Paint2D, env: BrushEnv) => void,
  zoom = 1,
): void {
  const a = new LegacyRecordingPaint();
  const b = new RecordingPaint();
  original.LW = Math.pow(zoom, -0.55);
  original.camZ = zoom;
  legacy(a);
  port(b, makeEnv(zoom));
  expect(a.calls.length).toBeGreaterThan(0);
  expect(b.toLines()).toEqual(a.toLines());
}
