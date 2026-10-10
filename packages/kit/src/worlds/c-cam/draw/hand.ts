/**
 * C-CAM faces (PLAN.md#14.4), part 3: the mitten hand (palm blob, thumb tube, finger tubes or
 * knuckle strokes), drawn at the wrist and rotated along the forearm. Thumb toward +x.
 *
 * Port of `face.js` `ST.hand` of film 3 (identical in films 1-2). Divergences:
 *  - explicit `BrushEnv` instead of the `ST.LW` global, no module state;
 *  - `kind` is typed (`HandKind`). In the original any other string (or none) drew a palm and a
 *    thumb without knuckles; `'thumb'` (thumbs-up) and `'none'` never reach `ST.hand`: the cast
 *    files and `ST.drawArm` handle them (`hand: 'none'` + their own `thumbsUp`), so neither is a
 *    kind here. The rig's default kind is `'fist'` (`rig.js:86`).
 */
import { brushStroke, type BrushEnv } from './brushes.js';
import type { Paint2D } from './paint.js';
import { blob, tube, type BlobOptions } from './shapes.js';

export const HAND_KINDS = ['fist', 'open', 'point', 'grip', 'flat'] as const;

export type HandKind = (typeof HAND_KINDS)[number];

export interface HandOptions {
  readonly seed?: number;
  /** Shadow crescent colour (default translucent brown). */
  readonly shade?: string;
  readonly lw?: number;
}

/**
 * Mitten hand with its wrist at (x, y). `ang` = forearm direction in degrees (0 = down), `sz` =
 * hand size. Kinds: fist (knuckles), grip (knuckles), point (index finger + knuckles), open (four
 * spread fingers), flat (no thumb).
 */
export function hand(
  g: Paint2D,
  env: BrushEnv,
  x: number,
  y: number,
  ang: number,
  sz: number,
  skin: string,
  kind: HandKind,
  o: HandOptions = {},
): void {
  const seed = o.seed || 23;
  const shade = o.shade || 'rgba(50,25,15,0.3)';
  const lw = o.lw || 5.5;
  g.save();
  g.translate(x, y);
  g.rotate((-ang * Math.PI) / 180);
  const blobOpts: BlobOptions = { lw, seed, shade: [shade, -sz * 0.14, sz * 0.05] };
  if (kind === 'open') {
    [-0.38, -0.12, 0.13, 0.36].forEach((u, i) => {
      const a = u * 0.9;
      const l = sz * (0.6 + (i === 1 ? 0.12 : 0) - (i === 3 ? 0.12 : 0));
      // prettier-ignore
      tube(g, env, [u * sz * 0.6, sz * 0.75, u * sz * 0.6 + Math.sin(a) * l, sz * 0.75 + Math.cos(a) * l], [sz * 0.26, sz * 0.21], skin, { lw, seed: seed + i });
    });
  }
  if (kind === 'point') {
    // prettier-ignore
    tube(g, env, [sz * 0.15, sz * 0.7, sz * 0.25, sz * 1.55], [sz * 0.26, sz * 0.21], skin, { lw, seed: seed + 5 });
  }
  // prettier-ignore
  blob(g, env, [-sz * 0.44, 0, sz * 0.42, 0, sz * 0.54, sz * 0.55, sz * 0.34, sz * 0.98, -sz * 0.32, sz * 1.0, -sz * 0.55, sz * 0.5], skin, blobOpts);
  if (kind === 'fist' || kind === 'grip' || kind === 'point') {
    for (let i = 0; i < 3; i += 1) {
      // prettier-ignore
      brushStroke(g, env, [-sz * 0.38 + i * sz * 0.22, sz * 0.62, -sz * 0.3 + i * sz * 0.22, sz * 0.88], { w: lw * 0.6, seed: seed + 10 + i });
    }
  }
  if (kind !== 'flat') {
    // prettier-ignore
    tube(g, env, [sz * 0.36, sz * 0.25, sz * 0.64, sz * 0.64], [sz * 0.3, sz * 0.23], skin, { lw, seed: seed + 7 });
  }
  g.restore();
}
