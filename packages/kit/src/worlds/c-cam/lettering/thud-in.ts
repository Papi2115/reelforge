/**
 * The title "thud-in": a letter lands from 1.6x to 1.0x with a two-step overshoot (under- and
 * over-shoot), all on twos, as a pure function of time. Steps sit on the global 12 fps grid (the
 * films' `twos(t)`), so at 24 fps every pose is held for exactly two frames whatever the start
 * time; a letter appears on the first grid step at or after its start. Letters of a word start
 * `THUD_LETTER_STEP` apart (the films' 0.04 s).
 */

export const THUD_FPS = 12;
export const THUD_LETTER_STEP = 0.04;

/** Scale per step on twos: slam, settle, overshoot (2 steps), rest. */
const THUD_SCALES: readonly number[] = [1.6, 1.25, 0.9, 1.05, 1];

export interface Thud {
  /** False before the start time: draw nothing. */
  readonly visible: boolean;
  /** Scale about the letter's centre. */
  readonly scale: number;
  /** Steps since the start (0 = the slam frame). */
  readonly step: number;
}

/** Tolerance for times that sit on a grid step but carry float noise (e.g. 0.04 * 3). */
const GRID_EPSILON = 1e-6;

/** State of a thud-in that starts at `t0` (seconds) at time `t` (seconds). */
export function thudIn(t: number, t0: number): Thud {
  const step = Math.floor(t * THUD_FPS + GRID_EPSILON) - Math.ceil(t0 * THUD_FPS - GRID_EPSILON);
  if (step < 0) return { visible: false, scale: THUD_SCALES[0] ?? 1.6, step };
  const last = THUD_SCALES.length - 1;
  return { visible: true, scale: THUD_SCALES[Math.min(step, last)] ?? 1, step };
}

/** Start time of letter `index` of a word that starts at `t0`. */
export function thudStart(t0: number, index: number): number {
  return t0 + index * THUD_LETTER_STEP;
}

/**
 * `DrawOptions.charScale` for a word thudding in from `t0`: letter `index` starts at
 * `thudStart(t0, index)`; 0 (hidden) before that.
 */
export function thudScale(t: number, t0: number): (index: number) => number {
  return (index) => {
    const thud = thudIn(t, thudStart(t0, index));
    return thud.visible ? thud.scale : 0;
  };
}
