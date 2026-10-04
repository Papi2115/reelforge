/**
 * The stage's backdrop sheet (layer 0): bands of torn paper for a day, dusk or night sky, or a
 * plain kraft / white sheet, plus the sun, moon and stars cut for it. Internal pieces of the
 * paper stage (stage.ts adds them); the bands' torn tops carry light rims, so even the sky
 * reads as stacked paper.
 */
import { hashCell } from '../../env/shared.js';
import type { PaperColors, PaperRole } from './colors.js';
import { finishPaper, PAPER_GRAIN, tornOffset } from './paper.js';
import type { PieceModel, PosedPart } from './piece.js';
import {
  createSprite,
  fillEllipse,
  fillPolygon,
  fillRect,
  type Point,
  type Sprite,
} from './sprite.js';

export const BACKDROPS = ['day', 'dusk', 'night', 'kraft', 'paper'] as const;
export type Backdrop = (typeof BACKDROPS)[number];

/** Sky bands from the top down: role and the band's top edge as a share of the horizon height. */
const BANDS: Readonly<Record<Backdrop, readonly (readonly [PaperRole, number])[]>> = {
  day: [
    ['skyMid', 0],
    ['skyLight', 0.78],
  ],
  dusk: [
    ['duskTop', 0],
    ['duskMid', 0.34],
    ['duskLow', 0.6],
    ['duskGlow', 0.84],
  ],
  night: [
    ['night', 0],
    ['nightMid', 0.7],
  ],
  kraft: [['kraft', 0]],
  paper: [['paper', 0]],
};

/** The colour under everything (the first band). */
export function backdropBase(colors: PaperColors, backdrop: Backdrop): number {
  return colors.role(BANDS[backdrop][0]?.[0] ?? 'paper');
}

/** Sheet of `width x height` px whose horizon is `horizon` px from its top. */
function cutSheet(
  colors: PaperColors,
  backdrop: Backdrop,
  width: number,
  height: number,
  horizon: number,
  seed: number,
  s: number,
): Sprite {
  const sprite = createSprite(width, height);
  for (const [band, [role, share]] of BANDS[backdrop].entries()) {
    const color = colors.role(role);
    const top = horizon * share;
    for (let x = 0; x < width; x += 1) {
      const wave = band === 0 ? 0 : 3 * s * Math.sin(x / (61 * s) + band * 1.7);
      const y = band === 0 ? 0 : Math.round(top + wave + tornOffset(x, 1.4 * s, seed + band));
      for (let row = Math.max(0, y); row < height; row += 1) sprite.data[row * width + x] = color;
      if (band === 0 || y < 0 || y >= height) continue;
      // The band's torn top edge: a light paper rim, 2 px thick in places.
      const rim = colors.rim[color] ?? color;
      sprite.data[y * width + x] = rim;
      if (y + 1 < height && hashCell(x, band, 3, seed) < 0.3)
        sprite.data[(y + 1) * width + x] = rim;
    }
  }
  finishPaper(sprite, colors, {
    rim: 'none',
    grain: PAPER_GRAIN,
    seed,
  });
  return sprite;
}

/** The backdrop sheet: frame + margin on every side, pivot at the frame centre. */
export function backdropModel(backdrop: Backdrop, horizon: number, seed: number): PieceModel {
  return {
    kitType: 'paperBackdrop',
    placement: { layer: 0, x: 320, y: 180 },
    bind: (context) => {
      const { margin, s } = context;
      const width = context.width + margin * 2;
      const height = context.height + margin * 2;
      const sprite = cutSheet(
        context.colors,
        backdrop,
        width,
        height,
        margin + horizon * s,
        seed,
        s,
      );
      const part: PosedPart = { sprite, x: 0, y: 0, pivot: [width / 2, height / 2], shadow: false };
      return () => ({ parts: [part], anchors: {} });
    },
  };
}

/** A paper sun: a disc with a zig-zag ring cut around it. */
function cutSun(colors: PaperColors, radius: number, seed: number): Sprite {
  const size = Math.ceil(radius * 2.8);
  const sprite = createSprite(size, size);
  const c = size / 2;
  const rays = 14;
  const ring: Point[] = [];
  for (let index = 0; index < rays * 2; index += 1) {
    const angle = (index / (rays * 2)) * Math.PI * 2;
    const r = index % 2 === 0 ? radius * 1.32 : radius * 1.1;
    ring.push([c + Math.cos(angle) * r, c + Math.sin(angle) * r]);
  }
  fillPolygon(sprite, ring, colors.role('hero'));
  fillEllipse(sprite, c, c, radius, radius, colors.role('sun'));
  finishPaper(sprite, colors, { rim: 'cut', grain: PAPER_GRAIN, seed });
  return sprite;
}

/** A crescent moon: a disc minus an offset disc. */
function cutMoon(colors: PaperColors, radius: number, seed: number): Sprite {
  const size = Math.ceil(radius * 2 + 2);
  const sprite = createSprite(size, size);
  const c = size / 2;
  fillEllipse(sprite, c, c, radius, radius, colors.role('paper'));
  fillEllipse(sprite, c + radius * 0.55, c - radius * 0.25, radius * 0.85, radius * 0.85, 0);
  finishPaper(sprite, colors, { rim: 'cut', grain: PAPER_GRAIN, seed });
  return sprite;
}

/** A 4-point paper star of `arm` px. */
function cutStar(color: number, arm: number): Sprite {
  const size = arm * 2 + 1;
  const sprite = createSprite(size, size);
  fillRect(sprite, arm, 0, 1, size, color);
  fillRect(sprite, 0, arm, size, 1, color);
  if (arm >= 2) fillRect(sprite, arm - 1, arm - 1, 3, 3, color);
  return sprite;
}

/** Sun (day, dusk), moon and twinkling stars (night): layer 1, behind the far hills. */
export function celestialModel(backdrop: Backdrop, horizon: number, seed: number): PieceModel {
  return {
    kitType: 'paperSky',
    placement: { layer: 1, x: 0, y: 0 },
    bind: (context) => {
      const { colors, s, clock } = context;
      const parts: PosedPart[] = [];
      const anchors: Record<string, { x: number; y: number }> = {};
      const at = (x: number, y: number): readonly [number, number] => [
        x * s - context.originX,
        y * s,
      ];
      if (backdrop === 'day' || backdrop === 'dusk') {
        const radius = (backdrop === 'dusk' ? 30 : 20) * s;
        const sprite = cutSun(colors, radius, seed);
        const [x, y] = backdrop === 'dusk' ? at(452, horizon - 16) : at(480, horizon - 150);
        parts.push({ sprite, x, y, pivot: [sprite.width / 2, sprite.height / 2] });
        anchors['sun'] = { x, y };
      }
      if (backdrop !== 'night') return () => ({ parts, anchors });
      const moon = cutMoon(colors, 18 * s, seed);
      const [mx, my] = at(500, 66);
      parts.push({ sprite: moon, x: mx, y: my, pivot: [moon.width / 2, moon.height / 2] });
      anchors['moon'] = { x: mx, y: my };
      const stars = Array.from({ length: 26 }, (_, index) => ({
        x:
          hashCell(index, 1, 0, seed) * (context.width + context.margin) -
          context.margin / 2 -
          context.originX,
        y: hashCell(index, 2, 0, seed) * (horizon - 40) * s,
        arm: hashCell(index, 3, 0, seed) < 0.3 ? Math.max(1, Math.round(2 * s)) : 1,
        phase: Math.floor(hashCell(index, 4, 0, seed) * 6),
      }));
      const bright = [colors.role('paper'), colors.role('sun')];
      const sprites = bright.map((color) => [1, 2, 3].map((arm) => cutStar(color, arm)));
      return (t) => {
        const frame = clock.frame(t);
        const twinkling = stars.map((star): PosedPart => {
          const lit = (frame + star.phase) % 6 === 0 ? 1 : 0;
          const sprite = sprites[lit]?.[Math.min(2, star.arm - 1)] ?? moon;
          const half = (sprite.width - 1) / 2;
          return { sprite, x: star.x, y: star.y, pivot: [half, half], layer: -1, shadow: false };
        });
        return { parts: [...twinkling, ...parts], anchors };
      };
    },
  };
}
