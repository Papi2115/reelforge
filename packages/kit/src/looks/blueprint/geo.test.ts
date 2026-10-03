import { describe, expect, it } from 'vitest';
import { blendView, decodeRing, findRegion, MAP_VIEWS, projection, worldCountries } from './geo.js';
import { graticuleStep, routePoints } from './map-parts.js';
import { WORLD_COUNTRIES } from './world-data.js';

/** Point-in-polygon (even-odd) over a country's rings. */
function inside(
  rings: readonly (readonly (readonly [number, number])[])[],
  lon: number,
  lat: number,
) {
  let hit = false;
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i] ?? [0, 0];
      const [xj, yj] = ring[j] ?? [0, 0];
      if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) hit = !hit;
    }
  }
  return hit;
}

function country(code: string) {
  const found = worldCountries().find((entry) => entry.code === code);
  if (!found) throw new Error(`no ${code}`);
  return found;
}

describe('embedded world data', () => {
  it('decodes encoded polylines (Google algorithm, 0.25-degree units)', () => {
    // Zigzag deltas in 5-bit chunks offset by 63: "?" = 0, "_@" = 32 -> +16, "@" = 1 -> -1.
    expect(decodeRing('??_@@', 1)).toEqual([
      [0, 0],
      [16, -1],
    ]);
  });

  it('holds 177 countries with unique codes in a small module', () => {
    const countries = worldCountries();
    expect(countries).toHaveLength(177);
    expect(new Set(countries.map((entry) => entry.code)).size).toBe(177);
    const bytes = WORLD_COUNTRIES.reduce((sum, row) => sum + row[3].join('').length, 0);
    expect(bytes).toBeLessThan(16_000);
    for (const entry of countries) {
      expect(entry.rings.length, entry.code).toBeGreaterThan(0);
      expect(entry.bounds[0], entry.code).toBeGreaterThanOrEqual(-180);
      expect(entry.bounds[2], entry.code).toBeLessThanOrEqual(180);
    }
  });

  it('puts capitals inside their countries', () => {
    const capitals: readonly (readonly [string, number, number])[] = [
      ['FRA', 2.35, 48.85],
      ['POL', 21.0, 52.2],
      ['USA', -77.0, 38.9],
      ['BRA', -47.9, -15.8],
      ['CHN', 116.4, 39.9],
      ['AUS', 149.1, -35.3],
      ['EGY', 31.2, 30.0],
      ['IND', 77.2, 28.6],
    ];
    for (const [code, lon, lat] of capitals)
      expect(inside(country(code).rings, lon, lat), code).toBe(true);
    expect(inside(country('FRA').rings, 21.0, 52.2)).toBe(false);
  });

  it('finds regions by code, name and continent', () => {
    expect(findRegion('fra').countries).toEqual(findRegion('France').countries);
    const europe = findRegion('europe');
    expect(europe.countries.length).toBeGreaterThan(30);
    expect(europe.eastLimit).toBe(60);
    expect(findRegion('south america').countries.length).toBeGreaterThan(10);
    expect(() => findRegion('Atlantis')).toThrow(/unknown region "Atlantis"/);
  });
});

describe('projection', () => {
  it('fits a view box into a rectangle with the cosine stretch', () => {
    const rect = { x: 10, y: 20, width: 600, height: 300 };
    const proj = projection(MAP_VIEWS.world, rect);
    const [cx, cy] = proj.project(10, 12);
    expect(cx).toBeCloseTo(310);
    expect(cy).toBeCloseTo(170);
    expect(proj.longitude(cx)).toBeCloseTo(10);
    const [east] = proj.project(190, 12);
    const [west] = proj.project(-170, 12);
    expect(east - west).toBeLessThanOrEqual(600 + 1e-9);
    const europe = projection(MAP_VIEWS.europe, rect);
    const [paris, parisY] = europe.project(2.35, 48.85);
    const [warsaw, warsawY] = europe.project(21, 52.2);
    expect(warsaw).toBeGreaterThan(paris);
    expect(warsawY).toBeLessThan(parisY);
  });

  it('blends views and picks graticule steps', () => {
    expect(blendView([0, 0, 10, 10], [10, 10, 20, 20], 0.5)).toEqual([5, 5, 15, 15]);
    expect(graticuleStep(360)).toBe(60);
    expect(graticuleStep(70)).toBe(15);
  });

  it('routes arc northwards between places or marker ids', () => {
    const markers = new Map([['rt', [4.5, 51.9] as const]]);
    const path = routePoints({ from: [-74, 40.7], to: 'rt', via: [], arc: 0.2 }, markers);
    expect(path[0]).toEqual([-74, 40.7]);
    expect(path.at(-1)).toEqual([4.5, 51.9]);
    const middle = path[12] ?? [0, 0];
    expect(middle[1]).toBeGreaterThan((40.7 + 51.9) / 2);
    expect(
      routePoints({ from: [0, 0], to: [1, 1], via: [[0.5, 2]], arc: 0.2 }, markers),
    ).toHaveLength(3);
    expect(() => routePoints({ from: 'nope', to: [1, 1], via: [], arc: 0 }, markers)).toThrow(
      /"nope" is not a marker id/,
    );
  });
});
