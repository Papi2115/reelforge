/** Axis maths shared by the blueprint charts and timelines: nice ticks and number formatting. */

export interface NiceScale {
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly ticks: readonly number[];
}

/** 1, 2, 2.5, 5 x 10^n step closest to (max - min) / count. */
export function niceStep(span: number, count: number): number {
  if (!(span > 0)) return 1;
  const raw = span / Math.max(1, count);
  const power = 10 ** Math.floor(Math.log10(raw));
  const fraction = raw / power;
  const nice =
    fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 2.5 ? 2.5 : fraction <= 5 ? 5 : 10;
  return nice * power;
}

/** Range widened to whole steps with about `count` intervals (min/max kept when given). */
export function niceScale(
  low: number,
  high: number,
  count = 4,
  fixed: { readonly min?: number | undefined; readonly max?: number | undefined } = {},
): NiceScale {
  let lo = fixed.min ?? low;
  let hi = fixed.max ?? high;
  if (hi <= lo) hi = lo + 1;
  const step = niceStep(hi - lo, count);
  if (fixed.min === undefined) lo = Math.floor(lo / step + 1e-9) * step;
  if (fixed.max === undefined) hi = Math.ceil(hi / step - 1e-9) * step;
  const ticks: number[] = [];
  const first = Math.ceil(lo / step - 1e-9) * step;
  for (let value = first; value <= hi + step * 1e-6; value += step) {
    // "+ 0" turns -0 into 0.
    ticks.push(Math.round(value / step) * step + 0);
  }
  return { min: lo, max: hi, step, ticks };
}

/** Decimals needed to show every value exactly (at most 3). */
export function decimalsOf(values: readonly number[]): number {
  let decimals = 0;
  for (const value of values) {
    while (
      decimals < 3 &&
      Math.abs(value * 10 ** decimals - Math.round(value * 10 ** decimals)) > 1e-6
    ) {
      decimals += 1;
    }
  }
  return decimals;
}

/** 12500 -> "12,500"; decimals fixed; prefix/suffix around. */
export function formatNumber(value: number, decimals = 0, prefix = '', suffix = ''): string {
  const fixed = Math.abs(value).toFixed(decimals);
  const [whole = '0', fraction] = fixed.split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const sign = value < 0 && Number(fixed) !== 0 ? '-' : '';
  return `${sign}${prefix}${grouped}${fraction === undefined ? '' : `.${fraction}`}${suffix}`;
}

/** Short tick label: 1500 -> "1.5K", 2000000 -> "2M". */
export function formatCompact(value: number): string {
  const abs = Math.abs(value);
  const units = [
    [1e9, 'B'],
    [1e6, 'M'],
    [1e3, 'K'],
  ] as const;
  for (const [size, unit] of units) {
    if (abs >= size) {
      const scaled = value / size;
      return `${String(Math.round(scaled * 10) / 10)}${unit}`;
    }
  }
  return String(Math.round(value * 100) / 100);
}

/** Linear map of `value` in [d0, d1] to [r0, r1]. */
export function linear(value: number, d0: number, d1: number, r0: number, r1: number): number {
  if (d1 === d0) return r0;
  return r0 + ((value - d0) / (d1 - d0)) * (r1 - r0);
}
