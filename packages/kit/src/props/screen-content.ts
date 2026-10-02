/**
 * Screen content as pure functions: (screen size, state incl. time t) -> one colour role per
 * pixel. Six roles keep every screen palette-limited (each screen maps them to style colours).
 * Pixels are row-major from the top-left. Randomness comes from hashCell with the screen's seed
 * and the frame number floor(t * 12), so the same t always paints the same picture.
 */
import { hashCell } from '../env/shared.js';
import { drawText, fitScale, textBlock, type TextAlign } from './font.js';

export const SCREEN_MODES = ['blank', 'text', 'doom', 'glitch', 'code', 'chart'] as const;
export type ScreenMode = (typeof SCREEN_MODES)[number];

/** Colour roles of a screen pixel. */
export const ROLE = { off: 0, back: 1, ink: 2, hot: 3, cool: 4, dim: 5 } as const;
export const ROLE_COUNT = 6;

export interface ScreenState {
  readonly mode: ScreenMode;
  readonly text: string;
  readonly align: TextAlign;
  /** Glitch overlay 0..1 (0 = none). */
  readonly glitch: number;
  /** false = powered off (all 'off'). */
  readonly on: boolean;
  /** Local time in seconds (animated modes and the glitch). */
  readonly t: number;
  readonly seed: number;
}

/** Glitch/static frames per second. */
const GLITCH_RATE = 12;

interface Canvas {
  readonly width: number;
  readonly height: number;
  readonly pixels: Uint8Array;
}

function set(canvas: Canvas, x: number, y: number, role: number): void {
  if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) return;
  canvas.pixels[y * canvas.width + x] = role;
}

function fract(value: number): number {
  return value - Math.floor(value);
}

function paintText(canvas: Canvas, text: string, align: TextAlign, role: number): void {
  if (text.length === 0) return;
  const block = textBlock(text);
  const margin = canvas.width >= 12 ? 1 : 0;
  const width = canvas.width - 2 * margin;
  const scale = fitScale(block, width, canvas.height - 2 * margin);
  const top = Math.floor((canvas.height - block.height * scale) / 2);
  drawText(text, { x: margin, y: top, width }, scale, align, (x, y) => {
    set(canvas, x, y, role);
  });
}

/** A first-person corridor shooter: scrolling floor and walls, an approaching imp, a gun, a HUD. */
function paintDoom(canvas: Canvas, t: number): void {
  const { width: w, height: h } = canvas;
  const hud = Math.max(2, Math.round(h * 0.16));
  const view = h - hud;
  const horizon = view / 2;
  const cx = w / 2;
  for (let y = 0; y < view; y += 1) {
    const dy = (y + 0.5 - horizon) / horizon;
    for (let x = 0; x < w; x += 1) {
      const dx = (x + 0.5 - cx) / cx;
      let role: number;
      if (Math.abs(dx) < 0.14 && Math.abs(dy) < 0.16) role = ROLE.dim;
      else if (Math.abs(dx) > Math.abs(dy)) {
        role = Math.floor(1.6 / Math.abs(dx) + t * 3) % 2 === 0 ? ROLE.cool : ROLE.back;
      } else if (dy < 0) role = ROLE.off;
      else role = Math.floor(2 / dy + t * 4) % 2 === 0 ? ROLE.dim : ROLE.off;
      set(canvas, x, y, role);
    }
  }
  // The imp walks towards the player, then respawns at the far end (2.5 s cycle).
  const phase = fract(t / 2.5);
  const size = Math.max(2, Math.round(2 + phase * view * 0.45));
  const impWidth = Math.max(2, Math.round(size * 0.7));
  const impX = Math.round(cx - impWidth / 2 + Math.sin(t * 1.7) * w * 0.08);
  const feet = Math.round(horizon + phase * view * 0.3);
  for (let row = 0; row < size; row += 1) {
    for (let column = 0; column < impWidth; column += 1) {
      const eye = row === Math.floor(size / 4) && (column === 0 || column === impWidth - 1);
      set(canvas, impX + column, feet - size + row, eye && size > 3 ? ROLE.ink : ROLE.hot);
    }
  }
  // The gun bobs; a muzzle flash every 0.8 s.
  const gunWidth = Math.max(3, Math.round(w * 0.12));
  const gunHeight = Math.max(2, Math.round(view * 0.3));
  const gunX = Math.round(cx - gunWidth / 2 + Math.sin(t * 8));
  for (let row = 0; row < gunHeight; row += 1) {
    for (let column = 0; column < gunWidth; column += 1) {
      const highlight = column === Math.floor(gunWidth / 2) && row > 0;
      set(canvas, gunX + column, view - gunHeight + row, highlight ? ROLE.dim : ROLE.ink);
    }
  }
  if (fract(t * 1.25) < 0.15) {
    for (let column = -1; column <= gunWidth; column += 1) {
      set(canvas, gunX + column, view - gunHeight - 1, ROLE.hot);
    }
    set(canvas, gunX + Math.floor(gunWidth / 2), view - gunHeight - 2, ROLE.hot);
  }
  for (let y = view; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const health = y > view && x >= 1 && x < Math.max(2, Math.round(w * 0.3));
      const face = y > view && Math.abs(x + 0.5 - cx) < Math.max(1, hud / 2);
      set(canvas, x, y, health ? ROLE.hot : face ? ROLE.ink : ROLE.dim);
    }
  }
}

/** Scrolling source code: indented lines of coloured tokens and a blinking cursor. */
function paintCode(canvas: Canvas, t: number, seed: number): void {
  const { width: w, height: h } = canvas;
  const scroll = Math.floor(t * 3);
  const tokenRoles = [ROLE.cool, ROLE.ink, ROLE.hot, ROLE.ink, ROLE.dim];
  const lines = Math.floor(h / 2);
  for (let line = 0; line < lines; line += 1) {
    const index = line + scroll;
    const y = line * 2 + 1;
    let x = 1 + Math.floor(hashCell(index, 0, 1, seed) * 4) * 2;
    const tokens = 1 + Math.floor(hashCell(index, 0, 2, seed) * 4);
    for (let token = 0; token < tokens && x < w - 1; token += 1) {
      const length = 2 + Math.floor(hashCell(index, token, 3, seed) * 6);
      const role = tokenRoles[Math.floor(hashCell(index, token, 4, seed) * tokenRoles.length)];
      for (let step = 0; step < length && x < w - 1; step += 1, x += 1) {
        set(canvas, x, y, role ?? ROLE.ink);
      }
      x += 1;
    }
    if (line === lines - 1 && fract(t * 2) < 0.5) set(canvas, Math.min(x, w - 2), y, ROLE.hot);
  }
}

/** Live bar chart: a rising trend whose bars breathe with t (last bar highlighted). */
function paintChart(canvas: Canvas, t: number, seed: number): void {
  const { width: w, height: h } = canvas;
  const bottom = h - 2;
  for (let y = 1; y <= bottom; y += 1) set(canvas, 1, y, ROLE.dim);
  for (let x = 1; x < w - 1; x += 1) set(canvas, x, bottom, ROLE.dim);
  const bars = Math.max(1, Math.min(6, Math.floor((w - 4) / 3)));
  const slot = Math.floor((w - 4) / bars);
  const barWidth = Math.max(1, slot - 1);
  for (let bar = 0; bar < bars; bar += 1) {
    const trend = 0.35 + (0.55 * bar) / Math.max(1, bars - 1);
    const share = Math.min(1, trend + (hashCell(bar, 0, 5, seed) - 0.5) * 0.25);
    const live = 0.88 + 0.12 * Math.sin(t * 2.5 + bar * 1.7);
    const height = Math.max(1, Math.round(share * (bottom - 2) * live));
    const role = bar === bars - 1 ? ROLE.hot : ROLE.cool;
    for (let row = 1; row <= height; row += 1) {
      for (let column = 0; column < barWidth; column += 1) {
        set(canvas, 3 + bar * slot + column, bottom - row, role);
      }
    }
  }
}

/** Row tearing, corrupted blocks and noise pixels; amount 0 leaves the picture unchanged. */
export function applyGlitch(canvas: Canvas, amount: number, t: number, seed: number): void {
  if (amount <= 0) return;
  const { width: w, height: h, pixels } = canvas;
  const frame = Math.floor(t * GLITCH_RATE);
  const row = new Uint8Array(w);
  for (let y = 0; y < h; y += 1) {
    if (hashCell(y, frame, 11, seed) >= amount * 0.5) continue;
    const shift = Math.round((hashCell(y, frame, 12, seed) - 0.5) * w * 0.6 * amount);
    row.set(pixels.subarray(y * w, (y + 1) * w));
    for (let x = 0; x < w; x += 1) pixels[y * w + x] = row[(((x - shift) % w) + w) % w] ?? 0;
  }
  const noisy = [ROLE.hot, ROLE.cool, ROLE.ink, ROLE.dim];
  const blocks = Math.round(amount * 4);
  for (let block = 0; block < blocks; block += 1) {
    const bx = Math.floor(hashCell(block, frame, 13, seed) * w);
    const by = Math.floor(hashCell(block, frame, 14, seed) * h);
    const bw = 2 + Math.floor(hashCell(block, frame, 15, seed) * Math.max(1, w / 4));
    const role = noisy[Math.floor(hashCell(block, frame, 16, seed) * noisy.length)] ?? ROLE.hot;
    for (let x = bx; x < bx + bw; x += 1) set(canvas, x, by, role);
  }
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      if (hashCell(x, y, frame, seed + 17) >= amount * 0.12) continue;
      const pick = Math.floor(hashCell(x, y, frame, seed + 18) * noisy.length);
      pixels[y * w + x] = noisy[pick] ?? ROLE.ink;
    }
  }
}

/** Colour role per pixel (row-major from the top-left) for the given state. */
export function paintScreen(width: number, height: number, state: ScreenState): Uint8Array {
  const canvas: Canvas = { width, height, pixels: new Uint8Array(width * height) };
  if (!state.on) return canvas.pixels.fill(ROLE.off);
  canvas.pixels.fill(ROLE.back);
  const frame = Math.floor(state.t * GLITCH_RATE);
  switch (state.mode) {
    case 'blank':
      break;
    case 'text':
      paintText(canvas, state.text, state.align, ROLE.ink);
      break;
    case 'doom':
      paintDoom(canvas, state.t);
      break;
    case 'code':
      paintCode(canvas, state.t, state.seed);
      break;
    case 'chart':
      paintChart(canvas, state.t, state.seed);
      break;
    case 'glitch':
      for (let index = 0; index < canvas.pixels.length; index += 1) {
        const lit = hashCell(index, frame, 19, state.seed) < 0.35;
        canvas.pixels[index] = lit ? ROLE.dim : ROLE.back;
      }
      paintText(canvas, state.text.length > 0 ? state.text : 'ERROR', state.align, ROLE.ink);
      applyGlitch(canvas, Math.max(0.6, state.glitch), state.t, state.seed);
      return canvas.pixels;
  }
  applyGlitch(canvas, state.glitch, state.t, state.seed);
  return canvas.pixels;
}

/** Whether the picture changes with t (static screens skip repainting on update(t)). */
export function isAnimated(state: Pick<ScreenState, 'mode' | 'glitch' | 'on'>): boolean {
  if (!state.on) return false;
  return (
    state.mode === 'doom' ||
    state.mode === 'code' ||
    state.mode === 'chart' ||
    state.mode === 'glitch' ||
    state.glitch > 0
  );
}
