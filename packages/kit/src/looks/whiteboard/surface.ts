/**
 * The whiteboard surface, painted once per board: wall, aluminium frame with a bevel, the
 * off-white board with a faint seeded grain and ghosts of old, badly erased marker, an optional
 * dot or line grid, and the marker tray with three markers and an eraser. Returns the safe area
 * templates lay out in (inside the board, clear of the frame and the tray).
 */
import { hashCell } from '../../env/shared.js';
import type { Raster } from '../blueprint/raster.js';
import type { Box } from './geometry.js';
import { noise1 } from './geometry.js';
import type { Theme } from './theme.js';

export type GridKind = 'none' | 'dots' | 'lines';

export interface SurfaceOptions {
  /** Raster px per reference (640x360) px. */
  readonly s: number;
  readonly frame: boolean;
  readonly tray: boolean;
  readonly grid: GridKind;
  readonly seed: number;
}

/** Reference geometry of the framed board. */
const FRAME = { inset: 5, width: 6 };
const TRAY = { height: 9, overhang: 2 };
const GRID_PITCH = 20;
/** Safe margin inside the board (reference px). */
const MARGIN = 24;

function paintGrain(raster: Raster, theme: Theme, board: Box, options: SurfaceOptions): void {
  const { seed } = options;
  for (let y = board.y; y < board.y + board.height; y += 1) {
    for (let x = board.x; x < board.x + board.width; x += 1) {
      if (hashCell(x, y, 1, seed) < 0.006) raster.set(x, y, theme.grain);
    }
  }
  // Ghosts of old marker: a few wide, faint bands of residue where someone wiped carelessly
  // (speckles along wiped "lines", denser in the middle of the band).
  for (let ghost = 0; ghost < 3; ghost += 1) {
    const cx = board.x + board.width * (0.2 + 0.6 * hashCell(ghost, 2, 3, seed));
    const cy = board.y + board.height * (0.15 + 0.7 * hashCell(ghost, 4, 5, seed));
    const rx = board.width * (0.08 + 0.07 * hashCell(ghost, 6, 7, seed));
    const ry = rx * 0.3;
    const pitch = Math.max(3, Math.round(7 * options.s));
    for (let y = Math.floor(cy - ry); y <= cy + ry; y += 1) {
      const line = Math.abs(((y - cy) % pitch) / pitch);
      if (line > 0.3) continue;
      for (let x = Math.floor(cx - rx); x <= cx + rx; x += 1) {
        const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
        const streak = noise1(seed + ghost, 3, x / (9 * options.s)) * 0.5 + 0.5;
        if (d < 1 && hashCell(x, y, 13, seed) < 0.12 * (1 - d) * streak) {
          raster.set(x, y, theme.grain);
        }
      }
    }
  }
}

function paintGrid(raster: Raster, theme: Theme, board: Box, options: SurfaceOptions): void {
  if (options.grid === 'none') return;
  const pitch = Math.max(6, Math.round(GRID_PITCH * options.s));
  const x0 = board.x + (Math.floor(board.width / 2) % pitch);
  const y0 = board.y + (Math.floor(board.height / 2) % pitch);
  for (let y = y0; y < board.y + board.height; y += pitch) {
    for (let x = x0; x < board.x + board.width; x += pitch) {
      raster.set(x, y, theme.grain);
      if (options.grid !== 'lines') continue;
      for (let step = 3; step < pitch; step += 3) {
        raster.set(x + step, y, theme.grain);
        raster.set(x, y + step, theme.grain);
      }
    }
  }
}

function paintTrayMarker(
  raster: Raster,
  theme: Theme,
  x: number,
  y: number,
  s: number,
  ink: number,
): void {
  const length = Math.round(26 * s);
  const height = Math.max(3, Math.round(5 * s));
  raster.rect(x, y, length, height, theme.outline);
  raster.rect(x + 1, y + 1, length - 2, height - 2, theme.board);
  raster.rect(x + length - Math.round(8 * s), y + 1, Math.round(8 * s) - 1, height - 2, ink);
  raster.rect(x - Math.round(2 * s), y + (height >> 1) - 1 + 1, Math.round(2 * s), 1, ink);
}

function paintTray(raster: Raster, theme: Theme, frame: Box, options: SurfaceOptions): void {
  const { s } = options;
  const height = Math.max(4, Math.round(TRAY.height * s));
  const overhang = Math.round(TRAY.overhang * s);
  const x = frame.x + Math.round(14 * s);
  const width = frame.width - Math.round(28 * s);
  const y = frame.y + frame.height - Math.round(FRAME.width * s) - overhang;
  const lip = Math.max(2, Math.round(3 * s));
  const top = y + height - lip;
  const markers = [theme.black, theme.blue, theme.red];
  markers.forEach((ink, index) => {
    const markerHeight = Math.max(3, Math.round(5 * s));
    paintTrayMarker(
      raster,
      theme,
      x + Math.round((40 + index * 34) * s),
      top - markerHeight,
      s,
      ink,
    );
  });
  const eraserX = x + width - Math.round(70 * s);
  const eraserHeight = Math.round(8 * s);
  raster.rect(eraserX, top - eraserHeight, Math.round(30 * s), eraserHeight, theme.outline);
  raster.rect(
    eraserX + 1,
    top - eraserHeight + 1,
    Math.round(30 * s) - 2,
    eraserHeight - 2,
    theme.sleeve,
  );
  raster.rect(
    eraserX + 1,
    top - Math.round(3 * s),
    Math.round(30 * s) - 2,
    Math.round(3 * s) - 1,
    theme.wall,
  );
  raster.rect(x, top, width, lip + Math.round(3 * s), theme.outline);
  raster.rect(x + 1, top + 1, width - 2, lip + Math.round(3 * s) - 2, theme.frame);
  raster.rect(x + 1, top + lip, width - 2, 1, theme.frameDark);
}

/** Paints the surface; returns the board box and the safe area (raster px). */
export function paintSurface(
  raster: Raster,
  theme: Theme,
  options: SurfaceOptions,
): { readonly board: Box; readonly area: Box } {
  const { s } = options;
  let board: Box = { x: 0, y: 0, width: raster.width, height: raster.height };
  if (options.frame) {
    raster.rect(0, 0, raster.width, raster.height, theme.wall);
    const inset = Math.round(FRAME.inset * s);
    const frame: Box = {
      x: inset,
      y: inset,
      width: raster.width - inset * 2,
      height: raster.height - inset * 2 - Math.round((options.tray ? 6 : 0) * s),
    };
    raster.rect(frame.x, frame.y, frame.width, frame.height, theme.outline);
    raster.rect(frame.x + 1, frame.y + 1, frame.width - 2, frame.height - 2, theme.frame);
    const width = Math.max(2, Math.round(FRAME.width * s));
    board = {
      x: frame.x + width,
      y: frame.y + width,
      width: frame.width - width * 2,
      height: frame.height - width * 2,
    };
    raster.rect(board.x - 1, board.y - 1, board.width + 2, board.height + 2, theme.frameDark);
    raster.rect(board.x, board.y, board.width, board.height, theme.board);
    paintGrain(raster, theme, board, options);
    paintGrid(raster, theme, board, options);
    if (options.tray) paintTray(raster, theme, frame, options);
  } else {
    raster.rect(0, 0, raster.width, raster.height, theme.board);
    paintGrain(raster, theme, board, options);
    paintGrid(raster, theme, board, options);
  }
  const margin = Math.round(MARGIN * s);
  const bottom = options.frame && options.tray ? Math.round(8 * s) : 0;
  return {
    board,
    area: {
      x: board.x + margin,
      y: board.y + margin,
      width: board.width - margin * 2,
      height: board.height - margin * 2 - bottom,
    },
  };
}
