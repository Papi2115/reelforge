/**
 * Waveform drawing data (PLAN.md#6.5): reduces the peak bytes from main (one per 1/peaksPerSecond
 * s) to one value per lane column for the current zoom. Zoomed out, a column takes the loudest of
 * its buckets; zoomed in past the bucket size, neighbouring columns share a bucket.
 */

export interface PeakSource {
  readonly peaks: Uint8Array;
  readonly peaksPerSecond: number;
}

/** Peak (0..255) per column; column `c` covers [from + c*secondsPerPx, from + (c+1)*secondsPerPx). */
export function peakColumns(
  source: PeakSource,
  from: number,
  secondsPerPx: number,
  columns: number,
): Uint8Array {
  const out = new Uint8Array(Math.max(0, Math.floor(columns)));
  const { peaks, peaksPerSecond } = source;
  if (!(secondsPerPx > 0) || peaks.length === 0) return out;
  for (let column = 0; column < out.length; column += 1) {
    const start = Math.floor((from + column * secondsPerPx) * peaksPerSecond);
    const end = Math.max(
      start + 1,
      Math.floor((from + (column + 1) * secondsPerPx) * peaksPerSecond),
    );
    if (end <= 0 || start >= peaks.length) continue;
    let peak = 0;
    for (let bucket = Math.max(0, start); bucket < Math.min(end, peaks.length); bucket += 1) {
      const value = peaks[bucket] ?? 0;
      if (value > peak) peak = value;
    }
    out[column] = peak;
  }
  return out;
}

/** Seconds covered by the peaks. */
export function peaksDuration(source: PeakSource): number {
  return source.peaksPerSecond > 0 ? source.peaks.length / source.peaksPerSecond : 0;
}
