/**
 * Geodata and projection of the blueprint map (pure, unit-tested): decoding of the embedded
 * Natural Earth countries, region lookup (country code or name, continent), view boxes and the
 * equirectangular projection (longitudes scaled by the cosine of the view's middle latitude).
 */
import { KitError } from '../../errors.js';
import { WORLD_COUNTRIES, WORLD_QUANTUM } from './world-data.js';

export type LonLat = readonly [number, number];

export interface Country {
  readonly code: string;
  readonly continent: string;
  readonly name: string;
  /** Outer rings in [lon, lat]. */
  readonly rings: readonly (readonly LonLat[])[];
  /** [west, south, east, north]. */
  readonly bounds: readonly [number, number, number, number];
}

/** Decodes one encoded polyline (zigzag deltas, 5-bit chunks offset by 63) into [lon, lat] points. */
export function decodeRing(encoded: string, quantum = WORLD_QUANTUM): LonLat[] {
  const numbers: number[] = [];
  let shift = 0;
  let chunk = 0;
  for (let index = 0; index < encoded.length; index += 1) {
    const bits = encoded.charCodeAt(index) - 63;
    chunk |= (bits & 0x1f) << shift;
    shift += 5;
    if (bits < 0x20) {
      numbers.push(chunk & 1 ? ~(chunk >> 1) : chunk >> 1);
      chunk = 0;
      shift = 0;
    }
  }
  const points: LonLat[] = [];
  let lon = 0;
  let lat = 0;
  for (let index = 0; index + 1 < numbers.length; index += 2) {
    lon += numbers[index] ?? 0;
    lat += numbers[index + 1] ?? 0;
    points.push([lon * quantum, lat * quantum]);
  }
  return points;
}

let decoded: readonly Country[] | undefined;

/** Every embedded country (decoded once). */
export function worldCountries(): readonly Country[] {
  decoded ??= WORLD_COUNTRIES.map(([code, continent, name, encoded]) => {
    const rings = encoded.map((ring) => decodeRing(ring));
    const lons = rings.flat().map(([lon]) => lon);
    const lats = rings.flat().map(([, lat]) => lat);
    return {
      code,
      continent,
      name,
      rings,
      bounds: [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)] as const,
    };
  });
  return decoded;
}

const CONTINENTS: Readonly<Record<string, string>> = {
  africa: 'AF',
  antarctica: 'AN',
  asia: 'AS',
  europe: 'EU',
  'north-america': 'NA',
  oceania: 'OC',
  'south-america': 'SA',
};

/** Europe's countries span to the Pacific (Russia): a continent highlight stops at the Urals. */
const CONTINENT_EAST_LIMIT: Readonly<Record<string, number>> = { EU: 60 };

export interface Region {
  /** Indices into worldCountries(). */
  readonly countries: readonly number[];
  /** Longitude beyond which the region is not drawn (continent clips). */
  readonly eastLimit: number;
}

function slug(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-');
}

/** A region by country code ('FRA'), country name ('France') or continent ('europe'). */
export function findRegion(query: string): Region {
  const countries = worldCountries();
  const continent = CONTINENTS[slug(query)];
  if (continent !== undefined) {
    return {
      countries: countries.flatMap((country, index) =>
        country.continent === continent ? [index] : [],
      ),
      eastLimit: CONTINENT_EAST_LIMIT[continent] ?? Infinity,
    };
  }
  const upper = query.trim().toUpperCase();
  const index = countries.findIndex(
    (country) => country.code === upper || slug(country.name) === slug(query),
  );
  if (index < 0) {
    throw new KitError(
      'invalid-params',
      `blueprintMap: unknown region "${query}"; use a continent (${Object.keys(CONTINENTS).join(', ')}), an ISO-style code (FRA, USA, POL) or a country name; tiny islands and city states are not in the 1:110m data (use a marker)`,
    );
  }
  return { countries: [index], eastLimit: Infinity };
}

/** [west, south, east, north] view boxes. */
export const MAP_VIEWS = {
  world: [-170, -56, 190, 80],
  europe: [-24, 34, 46, 71],
  africa: [-20, -36, 54, 38],
  asia: [24, -10, 150, 62],
  'middle-east': [24, 11, 64, 43],
  'north-america': [-168, 6, -50, 74],
  'south-america': [-84, -56, -32, 14],
  oceania: [108, -48, 180, 2],
} as const satisfies Record<string, readonly [number, number, number, number]>;

export type ViewBox = readonly [number, number, number, number];

export interface Projection {
  /** [lon, lat] -> raster pixel. */
  readonly project: (lon: number, lat: number) => [number, number];
  /** Raster x -> longitude. */
  readonly longitude: (x: number) => number;
  /** Pixels per degree of latitude. */
  readonly scale: number;
}

/**
 * Equirectangular projection that fits `view` into the rectangle (centred, aspect kept: the
 * longer side of the rectangle shows more than the view).
 */
export function projection(
  view: ViewBox,
  rect: { x: number; y: number; width: number; height: number },
): Projection {
  const [west, south, east, north] = view;
  const middle = ((south + north) / 2) * (Math.PI / 180);
  const stretch = Math.cos(middle);
  const scale = Math.min(rect.width / ((east - west) * stretch), rect.height / (north - south));
  const cx = rect.x + rect.width / 2;
  const cy = rect.y + rect.height / 2;
  const lonC = (west + east) / 2;
  const latC = (south + north) / 2;
  return {
    project: (lon, lat) => [cx + (lon - lonC) * stretch * scale, cy - (lat - latC) * scale],
    longitude: (x) => lonC + (x - cx) / (stretch * scale),
    scale,
  };
}

/** Linear blend of two view boxes. */
export function blendView(a: ViewBox, b: ViewBox, k: number): ViewBox {
  return [
    a[0] + (b[0] - a[0]) * k,
    a[1] + (b[1] - a[1]) * k,
    a[2] + (b[2] - a[2]) * k,
    a[3] + (b[3] - a[3]) * k,
  ];
}
