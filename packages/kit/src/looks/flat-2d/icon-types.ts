/** Shape of a flat-2d icon bitmap (icon-bitmaps-*.ts). */

/** 16 rows of 16 cells: `.` empty, `#` main, `+` accent, `*` gold, `o` light, `x` dark. */
export interface IconBitmap {
  /** Default role (or palette name) of `#`. */
  readonly main: string;
  /** Default role (or palette name) of `+`. */
  readonly accent: string;
  readonly rows: readonly string[];
}

/** Cells per icon edge. */
export const ICON_CELLS = 16;
