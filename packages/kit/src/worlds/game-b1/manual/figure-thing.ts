/**
 * What FIG. 1 shows: one of the world's plain shapes (figure.ts) or one of the FILM's own sprites
 * (a weights machine, a breakfast tray: `figure.sprite`, from the project's assets or a
 * defineSprite), printed like the rest of the page. A sprite is set in halftone on the key plate
 * (its dark rows solid), its silhouette edged in solid ink, and only the `hit` copy gets the colour
 * plate. Copies lean like the shapes do (the shared placer); a pure function of its inputs.
 */
import type { IndexCanvas } from '../core/canvas.js';
import { colorOfSwatch, DARK } from '../palette.js';
import type { B1Sprite } from '../vocab/sprite.js';
import { drawItem, HALF_WIDTH, HEIGHT, SOLID, tone, type Item, type Shape } from './figure.js';

export type FigureThing =
  | { readonly kind: 'shape'; readonly shape: Shape }
  | { readonly kind: 'sprite'; readonly sprite: B1Sprite };

/** The box a sprite is fitted into (local units, like the shapes' sizes). */
const FIT_W = 44;
const FIT_H = 50;

interface Cells {
  /** Cell width and height in local units. */
  readonly w: number;
  readonly h: number;
  readonly rows: readonly string[];
}

/** A sprite's frame 0 fitted into FIT_W x FIT_H, keeping the TV's wide pixels (a bit = 2 lines). */
function cells(sprite: B1Sprite): Cells {
  const rows = sprite.frames[0] ?? [];
  const bitW = 2 * sprite.size;
  const k = Math.min(FIT_W / (sprite.width * bitW), FIT_H / (rows.length * sprite.rowH));
  return { w: bitW * k, h: sprite.rowH * k, rows };
}

/** Half width and height of a thing in local units (layout spacing, callouts). */
export function thingSize(thing: FigureThing): { half: number; height: number } {
  if (thing.kind === 'shape') return { half: HALF_WIDTH[thing.shape], height: HEIGHT[thing.shape] };
  const c = cells(thing.sprite);
  return { half: (thing.sprite.width * c.w) / 2, height: c.rows.length * c.h };
}

function isOn(rows: readonly string[], r: number, b: number): boolean {
  return rows[r]?.[b] === '#';
}

function spriteItem(cv: IndexCanvas, sprite: B1Sprite, o: Item, plate: boolean): void {
  const c = cells(sprite);
  const half = (sprite.width * c.w) / 2;
  const top = -c.rows.length * c.h;
  const co = Math.cos(o.lean);
  const si = Math.sin(o.lean);
  const drop = Math.abs(half * o.s * si);
  const P = (lx: number, ly: number): [number, number] => [
    o.x + (lx * co - ly * si) * o.s,
    o.base + (lx * si + ly * co) * o.s - drop,
  ];
  if (plate && !o.hit) return;
  c.rows.forEach((row, r) => {
    const ink = colorOfSwatch(sprite.colours[r] ?? '');
    if (ink === undefined) return;
    const value = plate ? tone(0.55) : DARK[ink] === 1 ? SOLID : tone(o.hit ? 0.15 : o.tone);
    const y0 = top + r * c.h;
    for (let b = 0; b < row.length; b += 1) {
      if (row[b] !== '#') continue;
      const x0 = -half + b * c.w;
      const [x1, y1] = [x0 + c.w, y0 + c.h];
      cv.poly([...P(x0, y0), ...P(x1, y0), ...P(x1, y1), ...P(x0, y1)], value);
      if (plate) continue;
      // the silhouette's edge in solid ink: every side of a cell with no cell beyond it
      const edges: readonly (readonly [boolean, number, number, number, number])[] = [
        [!isOn(c.rows, r - 1, b), x0, y0, x1, y0],
        [!isOn(c.rows, r + 1, b), x0, y1, x1, y1],
        [!isOn(c.rows, r, b - 1), x0, y0, x0, y1],
        [!isOn(c.rows, r, b + 1), x1, y0, x1, y1],
      ];
      for (const [open, ax, ay, bx, by] of edges)
        if (open) cv.line(...P(ax, ay), ...P(bx, by), SOLID);
    }
  });
}

export function drawThing(cv: IndexCanvas, thing: FigureThing, o: Item, plate: boolean): void {
  if (thing.kind === 'shape') drawItem(cv, thing.shape, o, plate);
  else spriteItem(cv, thing.sprite, o, plate);
}
