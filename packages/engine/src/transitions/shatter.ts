/**
 * Shatter (ADR-028, family `texture`): an impact at the focus point, a spider-web of glass cracks
 * (seeded jagged rays and polygonal rings) runs out from it, then the shards drop away — inner
 * ones first, turning and shrinking into the depth — onto the incoming shot. Pure; every pixel
 * is a copy of A or B or a palette colour.
 */
import { hashOf, unit, type Composition, type Compositor } from './pixels.js';
import { drawPiece, lastValueCache, measurePieces, seamAt, type PieceMap } from './pieces.js';
import { diamondAngle, endFrames, focusPixels, phase } from './wow.js';

const RING_SHARES = [0.09, 0.2, 0.36, 0.6] as const;
const WOBBLE_STEP = 2;
const FALL_FROM = 0.3;
const FALL_SPREAD = 0.3;
const FALL_JITTER = 0.08;
const FALL_LENGTH = 0.3;
const CRACK_FROM = 0.02;
const CRACK_TO = 0.3;

interface Web {
  readonly map: PieceMap;
  readonly rays: number;
  readonly rings: number;
}

/** Value noise in [-1, 1] along one ray (linear between hashed knots). */
function rayNoise(seed: number, ray: number, at: number): number {
  const knot = Math.floor(at);
  const t = at - knot;
  const first = unit(hashOf(seed, ray, knot)) * 2 - 1;
  const second = unit(hashOf(seed, ray, knot + 1)) * 2 - 1;
  return first + (second - first) * t;
}

/** Shard id per pixel: sector between two jagged rays x ring between polygonal rings. */
function buildWeb(c: Composition, fx: number, fy: number): Web {
  const { width, height, seed } = c;
  const rays = 11 + (seed % 5);
  const rings = RING_SHARES.length;
  const diagonal = Math.sqrt(width * width + height * height);
  const maxRadius = Math.ceil(diagonal / WOBBLE_STEP) + 2;
  const base = Array.from(
    { length: rays },
    (_, ray) => ((ray + 0.35 * (unit(hashOf(seed, ray, 77)) - 0.5)) / rays) * 4,
  );
  // Angle of every ray per 2-px radius bucket (diamond-angle units, jagged near the impact).
  const angles = new Float64Array(rays * maxRadius);
  for (let ray = 0; ray < rays; ray += 1) {
    for (let bucket = 0; bucket < maxRadius; bucket += 1) {
      const radius = bucket * WOBBLE_STEP;
      const lateral = 7 * rayNoise(seed, ray, radius / 26);
      angles[ray * maxRadius + bucket] = (base[ray] ?? 0) + (0.64 * lateral) / (radius + 10);
    }
  }
  // Rings are straight chords between neighbouring rays: line n.X + c > 0 = beyond the chord.
  const chords = new Float64Array(rays * rings * 3);
  const rayPoint = (ray: number, ring: number): readonly [number, number] => {
    const share = RING_SHARES[ring] ?? 1;
    const radius = share * diagonal * (0.82 + 0.36 * unit(hashOf(seed ^ 0x3c6ef372, ray, ring)));
    const bucket = Math.min(maxRadius - 1, Math.floor(radius / WOBBLE_STEP));
    const [ux, uy] = diamondDirection(angles[ray * maxRadius + bucket] ?? 0);
    return [fx + ux * radius, fy + uy * radius];
  };
  for (let ray = 0; ray < rays; ray += 1) {
    for (let ring = 0; ring < rings; ring += 1) {
      const [px, py] = rayPoint(ray, ring);
      const [qx, qy] = rayPoint((ray + 1) % rays, ring);
      let nx = qy - py;
      let ny = px - qx;
      let offset = -(nx * px + ny * py);
      if (nx * fx + ny * fy + offset > 0) {
        nx = -nx;
        ny = -ny;
        offset = -offset;
      }
      chords.set([nx, ny, offset], (ray * rings + ring) * 3);
    }
  }
  const ids = new Int32Array(width * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const dx = x + 0.5 - fx;
      const dy = y + 0.5 - fy;
      const radius = Math.sqrt(dx * dx + dy * dy);
      const bucket = Math.min(maxRadius - 1, Math.floor(radius / WOBBLE_STEP));
      const angle = diamondAngle(dx, dy);
      const first = angles[bucket] ?? 0;
      const relative = (((angle - first) % 4) + 4) % 4;
      let sector = 0;
      for (let ray = 1; ray < rays; ray += 1) {
        const offset = ((((angles[ray * maxRadius + bucket] ?? 0) - first) % 4) + 4) % 4;
        if (offset > relative) break;
        sector = ray;
      }
      let ring = 0;
      for (let index = 0; index < rings; index += 1) {
        const at = (sector * rings + index) * 3;
        const side =
          (chords[at] ?? 0) * (x + 0.5) + (chords[at + 1] ?? 0) * (y + 0.5) + (chords[at + 2] ?? 0);
        if (side > 0) ring = index + 1;
      }
      ids[y * width + x] = sector * (rings + 1) + ring;
    }
  }
  return { map: measurePieces(ids, width, height, rays * (rings + 1)), rays, rings };
}

/** Unit vector of a diamond angle (inverse of `diamondAngle`). */
function diamondDirection(angle: number): readonly [number, number] {
  const a = ((angle % 4) + 4) % 4;
  const [x, y] =
    a < 1 ? [1 - a, a] : a < 2 ? [1 - a, 2 - a] : a < 3 ? [a - 3, 2 - a] : [a - 3, a - 4];
  const length = Math.sqrt(x * x + y * y);
  return [x / length, y / length];
}

const webCache = lastValueCache<Web>();

/** The web of this frame size, seed and focus (built once per transition). */
function webFor(c: Composition, fx: number, fy: number): Web {
  const key = `${String(c.width)}x${String(c.height)}|${String(c.seed)}|${String(fx)},${String(fy)}`;
  return webCache(key, () => buildWeb(c, fx, fy));
}

/** Drop start of a shard: inner rings first, seeded jitter. */
function fallStart(seed: number, id: number, ring: number, rings: number): number {
  return FALL_FROM + FALL_SPREAD * (ring / rings) + FALL_JITTER * unit(hashOf(seed, id, 5));
}

export const shatter: Compositor = (c) => {
  if (endFrames(c)) return;
  const { width, height, a, b, out, p, seed, tones } = c;
  const [fx, fy] = focusPixels(c);
  const web = webFor(c, fx, fy);
  const { map, rings } = web;
  const diagonal = Math.sqrt(width * width + height * height);
  const crack = diagonal * phase(p, CRACK_FROM, CRACK_TO);
  const glass = tones.nearest(0x2ec4b6);
  const falling: { readonly id: number; readonly fall: number }[] = [];
  const resting = new Uint8Array(map.count);
  for (let id = 0; id < map.count; id += 1) {
    const start = fallStart(seed, id, id % (rings + 1), rings);
    const fall = phase(p, start, start + FALL_LENGTH);
    if (fall > 0) falling.push({ id, fall });
    else resting[id] = 1;
  }
  out.set(b);
  falling.sort((first, second) => second.fall - first.fall || first.id - second.id);
  for (const { id, fall } of falling) {
    const awayX = (map.centreX[id] ?? fx) - fx;
    const awayY = (map.centreY[id] ?? fy) - fy;
    const away = Math.max(1, Math.sqrt(awayX * awayX + awayY * awayY));
    drawPiece(
      c,
      map,
      id,
      {
        dx: (awayX / away) * 50 * fall,
        dy: (awayY / away) * 20 * fall + 1.4 * height * fall * fall,
        turn: (unit(hashOf(seed, id, 9)) - 0.5) * 0.7 * fall,
        scale: 1 - 0.3 * fall,
        dim: 0.25 * fall,
        thickness: 0,
      },
      { edge: (id & 1) === 0 ? tones.brightest : glass, side: glass },
    );
  }
  const shake = p < 0.12 ? Math.round(3 * (1 - p / 0.12)) * ((Math.floor(p * 60) & 1) * 2 - 1) : 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      if (resting[map.ids[index] ?? 0] !== 1) continue;
      const dx = x + 0.5 - fx;
      const dy = y + 0.5 - fy;
      const seam = dx * dx + dy * dy < crack * crack ? seamAt(map.ids, width, height, x, y) : 0;
      const sx = Math.min(width - 1, Math.max(0, x + shake));
      out[index] =
        seam === 1 ? tones.brightest : seam === 2 ? tones.darkest : (a[y * width + sx] ?? 0);
    }
  }
  drawImpact(c, fx, fy, phase(p, 0, 0.14));
};

/** A short star burst at the impact point (brightest tone), growing then shrinking. */
function drawImpact(c: Composition, fx: number, fy: number, q: number): void {
  if (q <= 0 || q >= 1) return;
  const { width, height, out, tones } = c;
  const size = Math.round(14 * (1 - Math.abs(2 * q - 1)));
  const cx = Math.round(fx);
  const cy = Math.round(fy);
  for (let step = -size; step <= size; step += 1) {
    const thick = Math.abs(step) < size / 3 ? 1 : 0;
    for (let side = -thick; side <= thick; side += 1) {
      for (const [x, y] of [
        [cx + step, cy + side],
        [cx + side, cy + step],
        [cx + Math.round(step * 0.6), cy + Math.round(step * 0.6)],
        [cx + Math.round(step * 0.6), cy - Math.round(step * 0.6)],
      ] as const) {
        if (x >= 0 && y >= 0 && x < width && y < height) out[y * width + x] = tones.brightest;
      }
    }
  }
}
