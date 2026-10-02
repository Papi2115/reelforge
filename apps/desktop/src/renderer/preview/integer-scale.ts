/**
 * Display size of the low-res frame (D3): the largest integer factor in *device* pixels that fits,
 * so every engine pixel becomes an exact square block even at 125 %/150 % Windows scaling; a
 * fractional factor only when even 1x does not fit.
 */
export interface DisplaySize {
  /** Device pixels per engine pixel. */
  readonly factor: number;
  /** CSS size of the canvas. */
  readonly cssWidth: number;
  readonly cssHeight: number;
}

export function integerDisplaySize(
  containerCssWidth: number,
  containerCssHeight: number,
  frameWidth: number,
  frameHeight: number,
  devicePixelRatio = 1,
): DisplaySize {
  const ratio = devicePixelRatio > 0 && Number.isFinite(devicePixelRatio) ? devicePixelRatio : 1;
  const size = (factor: number): DisplaySize => ({
    factor,
    cssWidth: (frameWidth * factor) / ratio,
    cssHeight: (frameHeight * factor) / ratio,
  });
  if (frameWidth <= 0 || frameHeight <= 0) return size(1);
  const fit = Math.min(
    (containerCssWidth * ratio) / frameWidth,
    (containerCssHeight * ratio) / frameHeight,
  );
  if (!Number.isFinite(fit) || fit <= 0) return size(1);
  return size(fit >= 1 ? Math.floor(fit) : fit);
}
