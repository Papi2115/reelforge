/**
 * Wall decor of the indoor dioramas, one voxel proud of the inner face of the back (z) or left
 * (x) wall: whiteboard, status screen (animated bars), poster and door.
 */
import type { Sketch } from '../../props/sketch.js';
import type { Vec3 } from '../../types.js';
import { BASE, OVERHANG, Stamp, WALL, type GlowCell } from './canvas.js';
import type { Placed } from './furniture.js';
import type { Slot } from './tones.js';

export type Wall = 'back' | 'left';

/** Stamp of a `width` x `height` panel on a wall, `along` voxels from the wall's start. */
function wallStamp(
  canvas: Sketch<Slot>,
  wall: Wall,
  along: number,
  bottom: number,
  width: number,
): Stamp {
  const inner = OVERHANG + WALL;
  const at: Vec3 =
    wall === 'back'
      ? [OVERHANG + along, BASE + bottom, inner]
      : [inner, BASE + bottom, OVERHANG + along];
  return new Stamp(canvas, at, [width, 1], wall === 'back' ? 'z' : 'x');
}

function centre(stamp: Stamp, width: number, height: number): Vec3 {
  return stamp.point(width / 2, height / 2, 1);
}

/** Whiteboard with a few accent strokes. */
export function whiteboard(
  canvas: Sketch<Slot>,
  wall: Wall,
  along: number,
  bottom: number,
  width: number,
  height: number,
): Placed {
  const s = wallStamp(canvas, wall, along, bottom, width);
  s.box('metal', [0, 0, 0], [width, height, 1]);
  s.box('paper', [1, 1, 0], [width - 1, height - 1, 1]);
  for (let u = 2; u < width - 3; u += 1) s.set('accent', u, height - 3, 0);
  for (let u = 2; u < width - 6; u += 1) s.set('accentDark', u, height - 5, 0);
  s.set('shirtC', width - 4, 3, 0)
    .set('shirtC', width - 3, 4, 0)
    .set('shirtC', width - 5, 4, 0);
  return { top: centre(s, width, height), glow: [] };
}

/**
 * Status screen: dark frame, glow cells (width - 2) x (height - 2) on its face, row-major from
 * the bottom left (use screenBars to animate them).
 */
export function wallScreen(
  canvas: Sketch<Slot>,
  wall: Wall,
  along: number,
  bottom: number,
  width: number,
  height: number,
): Placed {
  const s = wallStamp(canvas, wall, along, bottom, width);
  s.box('darkest', [0, 0, 0], [width, height, 1]);
  const glow: GlowCell[] = [];
  for (let y = 1; y < height - 1; y += 1) {
    for (let u = 1; u < width - 1; u += 1) glow.push(s.front(u, y, 0));
  }
  return { top: centre(s, width, height), glow };
}

/** Poster: accent field with a cream sun and a dark ridge. */
export function poster(
  canvas: Sketch<Slot>,
  wall: Wall,
  along: number,
  bottom: number,
  width: number,
  height: number,
): Placed {
  const s = wallStamp(canvas, wall, along, bottom, width);
  s.box('woodDark', [0, 0, 0], [width, height, 1]);
  s.box('fabricAlt', [1, 1, 0], [width - 1, height - 1, 1]);
  s.set('paper', width - 3, height - 3, 0);
  for (let u = 1; u < width - 1; u += 1) {
    const ridge = 1 + Math.max(0, 2 - Math.abs(u - Math.floor(width / 3)));
    s.box('accentDark', [u, 1, 0], [u + 1, 1 + ridge, 1]);
  }
  return { top: centre(s, width, height), glow: [] };
}

/** Door: frame and dark leaf with a handle. */
export function door(canvas: Sketch<Slot>, wall: Wall, along: number): Placed {
  const s = wallStamp(canvas, wall, along, 0, 7);
  s.box('trim', [0, 0, 0], [7, 13, 1]);
  s.box('woodDark', [1, 0, 0], [6, 12, 1]);
  s.set('paper', 5, 6, 0);
  return { top: centre(s, 7, 13), glow: [] };
}
