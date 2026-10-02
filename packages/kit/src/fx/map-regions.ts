/**
 * Land masks of `kit.fx.mapAnimated`. No geodata is bundled: 'europe' is a coarse outline
 * hand-authored for this repo (rough [lon, lat] polygons, CC0, docs/licenses.md) - a stylised,
 * recognisable shape, not a survey map; 'generic' and 'islands' are seeded value noise.
 */
import { hashCell } from '../env/shared.js';

export const MAP_REGIONS = ['generic', 'islands', 'europe'] as const;
export type MapRegion = (typeof MAP_REGIONS)[number];

export interface LandMask {
  readonly columns: number;
  readonly rows: number;
  /** columns x rows, row 0 = north (back, -z), 1 = land. */
  readonly land: Uint8Array;
  /** [lon, lat] -> [u, v] (0..1, v = 0 north) when the region is geographic. */
  readonly project?: ((lon: number, lat: number) => [number, number]) | undefined;
}

type Ring = readonly (readonly [number, number])[];

/** Coarse Europe: [lon, lat] rings, traced by hand at roughly one-degree detail. */
// prettier-ignore
const EUROPE: readonly Ring[] = [
  // Mainland incl. Iberia, Scandinavia, Finland, Italy, Balkans (Baltic/Adriatic are bays).
  [
    [-5.6, 36.0], [-9.0, 37.0], [-8.8, 42.0], [-9.3, 43.2], [-7.5, 43.7], [-1.8, 43.4],
    [-1.2, 46.0], [-4.6, 48.4], [-1.6, 48.7], [1.6, 50.9], [4.0, 51.8], [4.8, 53.0],
    [7.0, 53.5], [8.6, 54.0], [8.2, 55.5], [8.6, 57.1], [10.6, 57.7], [10.5, 56.2],
    [10.0, 55.0], [11.0, 54.2], [14.2, 53.9], [18.5, 54.8], [21.0, 55.3], [21.2, 56.9],
    [24.1, 57.2], [23.5, 58.5], [24.0, 59.4], [28.0, 59.5], [30.2, 59.9], [27.5, 60.5],
    [22.5, 60.0], [21.4, 61.0], [21.5, 63.0], [25.4, 65.0], [24.1, 65.8], [22.0, 65.6],
    [21.0, 64.5], [19.0, 63.5], [17.5, 62.5], [17.2, 61.0], [18.9, 60.0], [18.1, 59.3],
    [16.6, 57.7], [16.4, 56.6], [14.7, 56.1], [12.9, 55.4], [12.6, 56.2], [11.9, 57.7],
    [11.0, 58.9], [10.5, 59.2], [8.0, 58.1], [5.6, 58.9], [5.0, 60.5], [5.2, 62.0],
    [7.5, 63.0], [10.0, 64.0], [12.5, 66.0], [14.5, 67.6], [16.5, 68.6], [19.0, 69.8],
    [23.0, 70.6], [25.8, 71.1], [28.5, 70.9], [31.0, 70.3], [33.0, 69.4], [36.0, 69.1],
    [42.0, 67.5], [42.0, 43.3], [38.0, 44.6], [36.6, 45.3], [35.0, 45.0], [34.0, 44.4],
    [33.4, 44.6], [32.5, 45.4], [33.6, 46.0], [30.7, 46.5], [29.7, 45.4], [28.6, 44.2],
    [27.9, 43.2], [28.0, 42.0], [28.9, 41.1], [27.0, 40.4], [26.2, 40.1], [26.0, 40.8],
    [22.9, 40.6], [23.5, 39.9], [22.8, 39.3], [23.7, 38.0], [23.0, 36.5], [21.7, 36.8],
    [21.3, 37.8], [21.1, 38.4], [20.2, 39.6], [19.4, 40.4], [19.5, 41.8], [18.6, 42.4],
    [16.4, 43.5], [15.2, 44.3], [14.0, 45.0], [13.6, 45.6], [12.3, 45.4], [12.5, 44.2],
    [13.8, 43.0], [15.0, 42.0], [16.0, 41.6], [17.0, 41.0], [18.5, 40.1], [17.2, 40.4],
    [16.6, 39.6], [17.1, 39.0], [16.0, 38.0], [15.6, 38.3], [15.6, 40.1], [14.3, 40.8],
    [12.0, 41.9], [10.5, 43.0], [9.0, 44.4], [7.5, 43.8], [6.0, 43.1], [4.5, 43.4],
    [3.0, 43.3], [3.2, 42.0], [0.8, 41.0], [-0.3, 39.5], [0.2, 38.7], [-0.7, 37.6],
    [-2.1, 36.7], [-4.4, 36.7],
  ],
  // Great Britain, Ireland.
  [
    [-5.7, 50.1], [-3.0, 50.6], [1.4, 51.2], [1.7, 52.6], [0.3, 53.5], [-0.2, 54.5],
    [-1.6, 55.6], [-2.1, 57.1], [-1.8, 57.6], [-3.2, 58.6], [-5.0, 58.6], [-5.6, 57.5],
    [-6.2, 56.5], [-5.6, 55.4], [-4.9, 54.8], [-3.4, 54.9], [-3.4, 54.2], [-3.0, 53.4],
    [-4.6, 53.3], [-4.2, 52.4], [-5.2, 51.8], [-3.2, 51.4], [-4.2, 51.2], [-5.0, 50.6],
  ],
  [
    [-6.0, 52.2], [-6.0, 53.4], [-5.6, 54.5], [-6.2, 55.2], [-7.4, 55.3], [-8.4, 54.6],
    [-10.0, 54.2], [-9.6, 53.4], [-10.2, 52.1], [-9.8, 51.5], [-8.2, 51.8],
  ],
  // Mediterranean islands.
  [[12.4, 38.0], [13.4, 38.2], [15.6, 38.3], [15.1, 36.7], [12.5, 37.6]],
  [[8.4, 41.2], [9.6, 41.0], [9.6, 39.2], [8.5, 38.9], [8.4, 40.0]],
  [[8.6, 42.0], [9.4, 43.0], [9.5, 42.0], [9.2, 41.4], [8.6, 41.7]],
  [[2.4, 39.6], [3.4, 39.8], [3.2, 39.3], [2.5, 39.3]],
  [[23.5, 35.6], [26.3, 35.4], [26.2, 35.0], [23.6, 35.2]],
  [[32.3, 35.1], [34.6, 35.7], [34.0, 34.6], [32.5, 34.7]],
  // Zealand.
  [[10.9, 55.7], [12.6, 56.0], [12.5, 55.2], [11.2, 55.2]],
  // Anatolia.
  [
    [29.0, 41.1], [31.0, 41.1], [33.0, 42.0], [35.5, 41.7], [37.0, 41.2], [39.0, 41.0],
    [42.0, 41.0], [42.0, 36.5], [36.0, 36.5], [34.0, 36.3], [32.5, 36.1], [30.5, 36.6],
    [28.0, 36.7], [27.3, 37.5], [26.3, 38.3], [26.6, 39.4], [26.2, 40.0], [27.5, 40.4],
  ],
  // North Africa.
  [
    [-11.0, 33.0], [-6.0, 35.8], [-5.3, 35.9], [-2.0, 35.1], [1.0, 36.5], [3.0, 36.8],
    [8.6, 36.9], [10.2, 37.2], [11.0, 36.9], [10.5, 36.0], [11.0, 35.0], [11.0, 33.0],
  ],
];

/** Visible window of the Europe preset (degrees) and the cos(latitude) of its projection. */
const EUROPE_VIEW = { west: -11, east: 41, south: 34.5, north: 71.5, cos: 0.64 } as const;

function insideRing(ring: Ring, x: number, y: number): boolean {
  let inside = false;
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index++) {
    const [xi, yi] = ring[index] ?? [0, 0];
    const [xj, yj] = ring[previous] ?? [0, 0];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function europeMask(columns: number): LandMask {
  const { west, east, south, north, cos } = EUROPE_VIEW;
  const rows = Math.round((columns * (north - south)) / ((east - west) * cos));
  const land = new Uint8Array(columns * rows);
  for (let row = 0; row < rows; row += 1) {
    const lat = north - ((row + 0.5) / rows) * (north - south);
    for (let column = 0; column < columns; column += 1) {
      const lon = west + ((column + 0.5) / columns) * (east - west);
      if (EUROPE.some((ring) => insideRing(ring, lon, lat))) land[row * columns + column] = 1;
    }
  }
  const project = (lon: number, lat: number): [number, number] => [
    (lon - west) / (east - west),
    (north - lat) / (north - south),
  ];
  return { columns, rows, land, project };
}

/** Bilinear value noise in [0, 1) on a lattice of `scale` cells, smoothstep-blended. */
export function valueNoise2(x: number, z: number, scale: number, seed: number): number {
  const fx = x / scale;
  const fz = z / scale;
  const x0 = Math.floor(fx);
  const z0 = Math.floor(fz);
  const sx = (fx - x0) * (fx - x0) * (3 - 2 * (fx - x0));
  const sz = (fz - z0) * (fz - z0) * (3 - 2 * (fz - z0));
  const salt = Math.round(scale * 1000);
  const at = (dx: number, dz: number): number => hashCell(x0 + dx, z0 + dz, salt, seed);
  const top = at(0, 0) + (at(1, 0) - at(0, 0)) * sx;
  const bottom = at(0, 1) + (at(1, 1) - at(0, 1)) * sx;
  return top + (bottom - top) * sz;
}

/** Noise preset: lattice scales (in columns / n), centre falloff and the share of land. */
const NOISE_PRESETS = {
  generic: { scales: [3, 8, 24], falloff: 0.7, share: 0.38 },
  islands: { scales: [6, 12, 24], falloff: 0.25, share: 0.2 },
} as const;
const OCTAVE_WEIGHTS = [0.5, 0.3, 0.2] as const;

/**
 * Seeded land: three octaves of value noise minus an elliptic falloff (land gathers in the
 * middle), thresholded at the quantile that gives the preset's land share.
 */
function noiseMask(region: 'generic' | 'islands', columns: number, seed: number): LandMask {
  const preset = NOISE_PRESETS[region];
  const rows = Math.round(columns * 0.625);
  const values = new Float64Array(columns * rows);
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const noise = preset.scales.reduce(
        (sum, scale, octave) =>
          sum +
          (OCTAVE_WEIGHTS[octave] ?? 0) * valueNoise2(column, row, columns / scale, seed + octave),
        0,
      );
      const dx = (column + 0.5) / columns - 0.5;
      const dz = (row + 0.5) / rows - 0.5;
      values[row * columns + column] = noise - preset.falloff * (dx * dx * 1.4 + dz * dz * 2.6);
    }
  }
  const sorted = Float64Array.from(values).sort();
  const threshold = sorted[Math.floor(sorted.length * (1 - preset.share))] ?? 0;
  const land = Uint8Array.from(values, (value) => (value >= threshold ? 1 : 0));
  return { columns, rows, land };
}

/** Land mask of a region preset at `columns` cells across. */
export function landMask(region: MapRegion, columns: number, seed: number): LandMask {
  return region === 'europe' ? europeMask(columns) : noiseMask(region, columns, seed);
}

/** Cells of land in a mask (tests: presets are neither empty nor all land). */
export function landShare(mask: LandMask): number {
  return mask.land.reduce((sum, value) => sum + value, 0) / mask.land.length;
}
