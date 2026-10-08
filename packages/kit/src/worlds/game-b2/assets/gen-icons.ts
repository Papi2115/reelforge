/**
 * Item icon generator of the Game B2 open layer: `{ gen: 'icon', kind, colour, accent }` -> a
 * 12x12 inventory icon (outlined to 14x14) for the HUD inventory, the menu and the hand. The film's
 * own things: a ledger is a book, a brick is a brick, a coin bag is a coin bag (never the
 * showcase's cartridge).
 */
import { z } from 'zod';
import { Bmp } from '../core/bitmap.js';
import { C, T } from '../palette.js';
import { colourRef } from './ramps.js';

export const ICON_KINDS = [
  'document',
  'letter',
  'book',
  'map',
  'scroll',
  'key',
  'coin',
  'coins',
  'bag',
  'gem',
  'bottle',
  'potion',
  'flask',
  'bread',
  'apple',
  'fish',
  'bone',
  'wrench',
  'hammer',
  'brick',
  'ticket',
  'chip',
  'phone',
  'clock',
  'compass',
  'feather',
  'leaf',
  'star',
  'heart',
  'drop',
  'medal',
  'battery',
  'shell',
  'rope',
  'ring',
  'pill',
] as const;
export type IconKind = (typeof ICON_KINDS)[number];

export const iconGenSchema = z.strictObject({
  gen: z.literal('icon'),
  kind: z.enum(ICON_KINDS),
  colour: z.string().optional().describe('Main colour (swatch or ramp step; default per kind)'),
  accent: z.string().optional().describe('Second colour (label, liquid, gem)'),
});
export type IconGenSpec = z.output<typeof iconGenSchema>;

/** Default [main, accent] per kind. */
const COLOURS: Readonly<Record<IconKind, readonly [number, number]>> = {
  document: [C.PAPER, C.SLATE],
  letter: [C.SAND_L, C.CLAY],
  book: [C.CLAY, C.PAPER],
  map: [C.SAND_L, C.GREEN],
  scroll: [C.SAND_L, C.BROWN],
  key: [C.TUNGSTEN, C.WOOD],
  coin: [C.TUNGSTEN, C.BULB],
  coins: [C.TUNGSTEN, C.BULB],
  bag: [C.SAND, C.TUNGSTEN],
  gem: [C.HAZE, C.MOON],
  bottle: [C.GREEN, C.SAND_L],
  potion: [C.PLUM, C.FLUO],
  flask: [C.MOON, C.FLUO],
  bread: [C.TAN, C.SAND_L],
  apple: [C.CLAY, C.GREEN],
  fish: [C.HAZE, C.MOON],
  bone: [C.PUTTY, C.PAPER],
  wrench: [C.GREY, C.PUTTY],
  hammer: [C.GREY, C.WOOD],
  brick: [C.CLAY, C.TAN],
  ticket: [C.SAND_L, C.CLAY],
  chip: [C.CHAR, C.TUNGSTEN],
  phone: [C.CHAR, C.FLUO],
  clock: [C.PAPER, C.CHAR],
  compass: [C.TUNGSTEN, C.CLAY],
  feather: [C.PAPER, C.GREY],
  leaf: [C.GREEN, C.SAGE],
  star: [C.TUNGSTEN, C.BULB],
  heart: [C.CLAY, C.TUNGSTEN],
  drop: [C.HAZE, C.MOON],
  medal: [C.TUNGSTEN, C.DUSK],
  battery: [C.GREY, C.FLUO],
  shell: [C.SAND_L, C.TAN],
  rope: [C.TAN, C.WOOD],
  ring: [C.TUNGSTEN, C.MOON],
  pill: [C.PAPER, C.CLAY],
};

function draw(b: Bmp, kind: IconKind, m: number, a: number): void {
  switch (kind) {
    case 'document':
      b.poly([2, 0, 8, 0, 10, 2, 10, 12, 2, 12], m);
      for (let y = 3; y < 11; y += 2) b.rect(3, y, y === 9 ? 4 : 6, 1, a);
      b.rect(8, 0, 2, 2, C.SAND);
      return;
    case 'letter':
      b.rect(0, 2, 12, 8, m);
      b.line(0, 2, 6, 6, a);
      b.line(11, 2, 6, 6, a);
      return;
    case 'book':
      b.rect(1, 1, 10, 10, m);
      b.rect(1, 1, 2, 10, C.UMBER);
      b.rect(4, 3, 5, 2, a);
      b.rect(3, 10, 8, 1, C.PAPER);
      return;
    case 'map':
      b.poly([0, 1, 4, 0, 8, 1, 12, 0, 12, 11, 8, 12, 4, 11, 0, 12], m);
      b.rect(4, 0, 1, 12, C.SAND);
      b.rect(8, 1, 1, 11, C.SAND);
      b.line(2, 9, 9, 3, a);
      b.px(9, 3, C.CLAY);
      return;
    case 'scroll':
      b.rect(2, 1, 8, 10, m);
      b.rect(1, 0, 10, 2, a);
      b.rect(1, 10, 10, 2, a);
      for (let y = 4; y < 9; y += 2) b.rect(3, y, 6, 1, C.SAND);
      return;
    case 'key':
      b.ellipse(3, 6, 3, 3, m);
      b.px(3, 6, T);
      b.rect(5, 5, 7, 2, m);
      b.rect(9, 7, 1, 2, m);
      b.rect(11, 7, 1, 3, m);
      return;
    case 'coin':
      b.ellipse(6, 6, 5.5, 5.5, m);
      b.ellipse(6, 6, 3.5, 3.5, a);
      b.rect(5, 4, 2, 4, m);
      return;
    case 'coins':
      for (let k = 0; k < 4; k += 1) {
        b.rect(1 + (k % 2), 9 - k * 2, 8, 2, k % 2 ? a : m);
        b.px(9 + (k % 2), 9 - k * 2, C.WOOD);
      }
      b.ellipse(9, 4, 2.5, 2.5, m);
      return;
    case 'bag':
      b.ellipse(6, 8, 5.5, 4, m);
      b.poly([4, 4, 8, 4, 7, 1, 5, 1], m);
      b.rect(4, 4, 4, 1, C.BROWN);
      b.rect(5, 7, 2, 3, a);
      b.rect(4, 8, 4, 1, a);
      return;
    case 'gem':
      b.poly([3, 1, 9, 1, 12, 4, 6, 11, 0, 4], m);
      b.poly([3, 1, 6, 1, 4, 4], a);
      b.line(0, 4, 12, 4, a);
      return;
    case 'bottle':
    case 'potion':
    case 'flask':
      if (kind === 'flask') b.poly([4, 0, 8, 0, 8, 4, 12, 11, 0, 11, 4, 4], m);
      else {
        b.rect(5, 0, 2, 3, C.WOOD);
        b.rect(4, 3, 4, 2, m);
        if (kind === 'potion') b.ellipse(6, 8, 5, 4, m);
        else b.rect(3, 5, 6, 7, m);
      }
      b.rect(2, 8, 8, 3, a);
      b.px(4, 6, C.PAPER);
      return;
    case 'bread':
      b.ellipse(6, 7, 6, 4, m);
      for (let x = 3; x < 10; x += 3) b.line(x, 5, x + 1, 8, a);
      return;
    case 'apple':
      b.ellipse(6, 7, 5, 5, m);
      b.rect(6, 0, 1, 3, C.BROWN);
      b.ellipse(8, 2, 2, 1, a);
      b.px(4, 5, C.PAPER);
      return;
    case 'fish':
      b.ellipse(5, 6, 5, 3, m);
      b.poly([9, 6, 12, 3, 12, 9], m);
      b.px(2, 5, C.VOID);
      b.rect(2, 7, 6, 1, a);
      return;
    case 'bone':
      b.rect(2, 5, 8, 2, m);
      for (const [x, y] of [
        [1, 4],
        [1, 7],
        [10, 4],
        [10, 7],
      ] as const)
        b.ellipse(x, y, 1.6, 1.6, a);
      return;
    case 'wrench':
      b.line(2, 10, 8, 4, m);
      b.line(3, 10, 9, 4, m);
      b.ellipse(9, 3, 3, 3, m);
      b.rect(9, 1, 2, 2, T);
      return;
    case 'hammer':
      b.rect(5, 4, 2, 8, a);
      b.rect(1, 1, 10, 4, m);
      b.rect(1, 1, 10, 1, C.PUTTY);
      return;
    case 'brick':
      b.rect(0, 3, 12, 7, m);
      b.rect(0, 3, 12, 1, a);
      b.rect(10, 4, 2, 6, C.BROWN);
      b.px(3, 6, C.BROWN);
      b.px(7, 7, C.BROWN);
      return;
    case 'ticket':
      b.rect(0, 3, 12, 6, m);
      b.rect(3, 3, 1, 6, a);
      b.px(0, 6, T);
      b.px(11, 6, T);
      b.rect(5, 5, 5, 1, a);
      return;
    case 'chip':
      b.rect(2, 2, 8, 8, m);
      for (let k = 3; k < 10; k += 2) {
        b.px(k, 1, a);
        b.px(k, 10, a);
        b.px(1, k, a);
        b.px(10, k, a);
      }
      b.rect(4, 4, 4, 4, C.SLATE);
      return;
    case 'phone':
      b.rect(3, 0, 6, 12, m);
      b.rect(4, 1, 4, 8, a);
      b.px(6, 10, C.GREY);
      return;
    case 'clock':
    case 'compass':
      b.ellipse(6, 6, 5.5, 5.5, kind === 'clock' ? C.CHAR : C.WOOD);
      b.ellipse(6, 6, 4.5, 4.5, kind === 'clock' ? m : C.PAPER);
      b.line(6, 6, 6, 2, kind === 'clock' ? a : C.CLAY);
      b.line(6, 6, 9, 7, kind === 'clock' ? a : C.CHAR);
      return;
    case 'feather':
    case 'leaf':
      b.poly([1, 11, 4, 4, 10, 0, 8, 6], m);
      b.line(1, 11, 9, 1, a);
      return;
    case 'star':
      b.poly([6, 0, 7.5, 4, 12, 4.5, 8.5, 7, 10, 12, 6, 9, 2, 12, 3.5, 7, 0, 4.5, 4.5, 4], m);
      b.px(6, 4, a);
      return;
    case 'heart':
      b.ellipse(3.5, 4, 3, 3, m);
      b.ellipse(8.5, 4, 3, 3, m);
      b.poly([0.5, 5, 11.5, 5, 6, 11], m);
      b.px(3, 3, a);
      return;
    case 'drop':
      b.ellipse(6, 8, 4, 3.5, m);
      b.poly([2.2, 7, 6, 0, 9.8, 7], m);
      b.px(4, 7, a);
      return;
    case 'medal':
      b.poly([3, 0, 6, 5, 9, 0], a);
      b.ellipse(6, 8, 4, 4, m);
      b.px(6, 8, C.BULB);
      return;
    case 'battery':
      b.rect(1, 3, 10, 6, m);
      b.rect(11, 5, 1, 2, m);
      b.rect(2, 4, 5, 4, a);
      return;
    case 'shell':
      b.poly([6, 1, 12, 9, 6, 11, 0, 9], m);
      for (let k = 2; k < 11; k += 3) b.line(6, 2, k, 10, a);
      return;
    case 'rope':
      for (let k = 0; k < 3; k += 1) {
        b.ellipse(6, 6, 5.5 - k * 1.6, 5.5 - k * 1.6, k % 2 ? a : m);
      }
      b.ellipse(6, 6, 1, 1, T);
      return;
    case 'ring':
      b.ellipse(6, 7, 4.5, 4.5, m);
      b.ellipse(6, 7, 2.8, 2.8, T);
      b.poly([4, 3, 6, 0, 8, 3], a);
      return;
    case 'pill':
      b.ellipse(3.5, 6, 3, 3, m);
      b.ellipse(8.5, 6, 3, 3, a);
      b.rect(3, 3, 3, 6, m);
      b.rect(6, 3, 3, 6, a);
      b.px(3, 4, C.PAPER);
      return;
  }
}

/** Draws a 12x12 icon, outlined (14x14). */
export function makeIcon(spec: IconGenSpec): Bmp {
  const [m0, a0] = COLOURS[spec.kind];
  const main = spec.colour === undefined ? m0 : (colourRef(spec.colour) ?? m0);
  const accent = spec.accent === undefined ? a0 : (colourRef(spec.accent) ?? a0);
  const inner = new Bmp(12, 12);
  draw(inner, spec.kind, main, accent);
  const out = new Bmp(14, 14);
  out.blit(inner, 1, 1);
  return out.outline(C.VOID);
}
