/**
 * The continuity link between a first-person shot and an automap shot (PLAN.md#13.4, the map as
 * the film's continuity): `game-b2-map-unfold` grows the incoming map shot out of the outgoing
 * shot's HUD minimap (the incoming frame squeezed into a rect that opens from the minimap to the
 * full frame, so the map's centre - the player - stays where the minimap's arrow was);
 * `game-b2-map-fold` shrinks the outgoing map shot back into the incoming shot's minimap in held
 * steps and dithers it away there. The map shot should start / end centred on the player (the
 * default of `view.automap`). Palette-pure: A or B pixels and the rim tone.
 */
import { bayerThreshold, type Compositor } from '../pixels.js';
import { endFrames, phase } from '../wow.js';
import { b2Tones, minimapRect } from './tones.js';

function inOut(q: number): number {
  return q < 0.5 ? 4 * q * q * q : 1 - (-2 * q + 2) ** 3 / 2;
}

type Rect = readonly [number, number, number, number];

function lerpRect(from: Rect, to: Rect, e: number): Rect {
  const at = (k: 0 | 1 | 2 | 3): number => from[k] + (to[k] - from[k]) * e;
  return [at(0), at(1), at(2), at(3)];
}

/**
 * Paints `inner` squeezed into `rect` over `outer`: the rect's 1 px rim is the darkest tone;
 * `mix` > 0 lets `outer` dither through inside the rect.
 */
function squeeze(
  c: Parameters<Compositor>[0],
  inner: Uint32Array,
  outer: Uint32Array,
  rect: Rect,
  mix: number,
): void {
  const { width: W, height: H, out } = c;
  const rim = b2Tones(c.tones).VOID;
  const [rx, ry, rw, rh] = rect;
  const x0 = Math.round(rx);
  const y0 = Math.round(ry);
  const x1 = Math.round(rx + rw);
  const y1 = Math.round(ry + rh);
  for (let y = 0; y < H; y += 1)
    for (let x = 0; x < W; x += 1) {
      const i = y * W + x;
      const inside = x >= x0 && x < x1 && y >= y0 && y < y1;
      if (!inside || (mix > 0 && bayerThreshold(x, y) < mix)) {
        const onRim = mix === 0 && x >= x0 - 1 && x <= x1 && y >= y0 - 1 && y <= y1 && !inside;
        out[i] = onRim ? rim : (outer[i] ?? 0);
        continue;
      }
      const sx = Math.min(W - 1, Math.floor(((x - x0 + 0.5) * W) / Math.max(1, x1 - x0)));
      const sy = Math.min(H - 1, Math.floor(((y - y0 + 0.5) * H) / Math.max(1, y1 - y0)));
      out[i] = inner[sy * W + sx] ?? 0;
    }
}

export const mapUnfold: Compositor = (c) => {
  if (endFrames(c)) return;
  const { width: W, height: H, a, b, p } = c;
  const mini = minimapRect(W, H);
  const e = inOut(phase(p, 0.12, 1));
  squeeze(c, b, a, lerpRect(mini, [0, 0, W, H], e), 1 - phase(p, 0, 0.12));
};

export const mapFold: Compositor = (c) => {
  if (endFrames(c)) return;
  const { width: W, height: H, a, b, p } = c;
  const mini = minimapRect(W, H);
  // A tiny swell (anticipation), then the shrink in held steps (~10 fps), then the dither.
  const swell = p < 0.1 ? -0.018 * Math.sin(Math.PI * phase(p, 0, 0.1)) : 0;
  const steps = Math.floor(phase(p, 0.1, 0.75) * 8) / 8;
  const e = p < 0.1 ? swell : inOut(steps);
  squeeze(c, a, b, lerpRect([0, 0, W, H], mini, e), phase(p, 0.78, 1));
};
