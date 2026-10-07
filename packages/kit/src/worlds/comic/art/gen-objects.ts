/**
 * Everyday objects in the comic grammar (PLAN.md#13.15a), each drawn as its defining features so
 * it can be named at thumbnail size (real run Comic 1: the skull read as a potato): a skull is a
 * dome with two dark sockets, a nose hole and a row of teeth; a key is a bow, a shaft and a bit.
 * `size` = height, (x, y) = where it rests (bottom centre).
 */
import { z } from 'zod';
import type { ComicPen } from '../page/pen.js';
import { artKey, colorSchema, placeShape, timeOf } from './common.js';
import { drawGadget, drawThing } from './objects-gadgets.js';
import { sketchFor, type Sketch } from './sketch.js';

export const OBJECTS = [
  'skull',
  'bone',
  'barrel',
  'crate',
  'chest',
  'book',
  'scroll',
  'candle',
  'lamp',
  'bottle',
  'jar',
  'coin',
  'key',
  'gem',
  'clock',
  'hourglass',
  'phone',
  'laptop',
  'tv',
  'chair',
  'table',
  'bucket',
  'sword',
  'shield',
  'rock',
  'log',
  'campfire',
  'bell',
  'anchor',
  'compass',
  'globe',
  'envelope',
  'sack',
  'pot',
  'apple',
  'bread',
  'egg',
  'trophy',
  'bulb',
  'battery',
  'gear',
  'magnet',
  'flask',
] as const;
export type ObjectKind = (typeof OBJECTS)[number];

export const objectSchema = z.strictObject({
  ...placeShape,
  kind: z.enum(OBJECTS),
  size: z.number().min(0).max(800).default(40).describe('Height'),
  fill: colorSchema.optional(),
  open: z.boolean().default(false).describe('Chest/book/laptop open, lamp/bulb/tv on'),
});
export type ObjectOptions = z.output<typeof objectSchema>;

const FILLS: Readonly<Partial<Record<ObjectKind, string>>> = {
  skull: 'paper',
  bone: 'paper',
  barrel: 'sepiaTan',
  crate: 'aged',
  chest: 'sepiaMid',
  book: 'red',
  scroll: 'yellowPale',
  candle: 'paper',
  lamp: 'yellow',
  bottle: 'phosphor',
  jar: 'cyan',
  coin: 'yellow',
  key: 'yellow',
  gem: 'cyan',
  clock: 'paper',
  hourglass: 'sepiaTan',
  phone: 'ink',
  laptop: 'greyMid',
  tv: 'sepiaMid',
  chair: 'sepiaTan',
  table: 'sepiaTan',
  bucket: 'greyLight',
  sword: 'greyLight',
  shield: 'cyanDeep',
  rock: 'greyMid',
  log: 'sepiaTan',
  campfire: 'sepiaMid',
  bell: 'yellow',
  anchor: 'greyDark',
  compass: 'yellow',
  globe: 'cyan',
  envelope: 'paper',
  sack: 'aged',
  pot: 'greyDark',
  apple: 'red',
  bread: 'aged',
  egg: 'paper',
  trophy: 'yellow',
  bulb: 'yellowPale',
  battery: 'greyDark',
  gear: 'greyMid',
  magnet: 'red',
  flask: 'greyMid',
};

const L = { shade: 0.4 };

export function drawObject(g: ComicPen, o: ObjectOptions): void {
  const sk = sketchFor(g, o, 100, artKey(`object-${o.kind}`, o.seed));
  const fill = o.fill ?? FILLS[o.kind] ?? 'greyLight';
  const t = timeOf(g, o.t);
  if (!drawContainer(sk, o, fill) && !drawGadget(sk, o, fill, t)) drawThing(sk, o, fill, t);
}

/** Skull: the four marks that make it read (dome, two sockets, the nose hole, teeth). */
function skull(sk: Sketch, fill: string): void {
  sk.shape(
    [
      -34, -42, -38, -70, -26, -94, 0, -100, 26, -94, 38, -70, 34, -42, 24, -34, 22, -18, -22, -18,
      -24, -34,
    ],
    fill,
    { shade: 0.35 },
  );
  sk.shape([-20, -18, 20, -18, 18, 0, -18, 0], fill, { shade: 0.3 });
  for (const side of [-1, 1])
    sk.shape(
      [side * 6, -62, side * 26, -66, side * 28, -50, side * 14, -42, side * 5, -48],
      'ink',
      { outline: false },
    );
  sk.shape([0, -42, -6, -30, 6, -30], 'ink', { outline: false });
  sk.line(-18, -12, 18, -12, 'ink', sk.widthOf('inner'));
  for (let x = -14; x <= 14; x += 7) sk.line(x, -20, x, -4, 'ink', sk.widthOf('inner'));
}

function drawContainer(sk: Sketch, o: ObjectOptions, fill: string): boolean {
  switch (o.kind) {
    case 'skull':
      skull(sk, fill);
      return true;
    case 'barrel':
      sk.shape([-30, 0, -36, -50, -30, -100, 30, -100, 36, -50, 30, 0], fill, L);
      for (const y of [-18, -82])
        sk.stroke([-33, y, 0, y + 3, 33, y], { w: 'outer', color: 'greyDark' });
      for (const x of [-14, 0, 14]) sk.line(x * 1.1, -4, x * 1.2, -96, 'sepiaMid');
      return true;
    case 'crate':
      sk.shape([-45, 0, -45, -90, 45, -90, 45, 0], fill, L);
      sk.shape([-45, -90, -45, -78, 45, -78, 45, -90], fill, { outline: 'inner' });
      sk.stroke([-40, -6, 40, -74], { w: 'outer', color: 'sepiaMid' });
      return true;
    case 'chest':
      sk.shape([-46, 0, -46, -50, 46, -50, 46, 0], fill, L);
      sk.shape(
        o.open ? [-46, -50, -40, -96, 52, -96, 46, -50] : [-48, -50, -44, -76, 44, -76, 48, -50],
        fill,
        L,
      );
      if (o.open) sk.flat([-40, -52, 40, -52, 30, -60, -30, -60], 'yellow');
      sk.shape([-7, -56, 7, -56, 7, -40, -7, -40], 'yellow', { outline: 'inner' });
      return true;
    case 'book':
      if (o.open) {
        sk.shape([0, -4, -48, 0, -48, -56, 0, -62], 'paper', L);
        sk.shape([0, -4, 48, 0, 48, -56, 0, -62], 'paper', L);
        for (let i = 0; i < 5; i += 1)
          for (const s of [-1, 1]) sk.line(s * 8, -50 + i * 9, s * 40, -48 + i * 9, 'greyMid', 1);
      } else {
        sk.shape([-36, 0, -36, -100, 36, -100, 36, 0], fill, L);
        sk.shape([-36, -100, -28, -100, -28, 0, -36, 0], 'ink', { outline: false });
        sk.shape([-16, -80, 26, -80, 26, -64, -16, -64], 'paper', { outline: 'inner' });
      }
      return true;
    case 'scroll':
      sk.shape([-36, -14, 36, -14, 36, -86, -36, -86], fill, L);
      for (const y of [-14, -86]) sk.cap(-42, y, 42, y, 8, fill, L);
      for (let i = 0; i < 5; i += 1)
        sk.line(-24, -70 + i * 10, 20 - (i % 2) * 10, -70 + i * 10, 'greyMid', 1);
      return true;
    case 'bottle':
    case 'jar': {
      const jar = o.kind === 'jar';
      sk.shape(
        jar
          ? [-30, 0, -34, -70, -22, -80, 22, -80, 34, -70, 30, 0]
          : [-20, 0, -22, -56, -8, -70, -8, -96, 8, -96, 8, -70, 22, -56, 20, 0],
        fill,
        L,
      );
      sk.shape(
        jar ? [-26, -80, 26, -80, 26, -96, -26, -96] : [-9, -96, 9, -96, 9, -100, -9, -100],
        'sepiaMid',
        { outline: 'inner' },
      );
      sk.shape([-16, -20, 16, -20, 16, -44, -16, -44], 'paper', { outline: 'inner' });
      sk.stroke([-12, -60, -12, -26], { color: 'paper', w: 'outer' });
      return true;
    }
    case 'bucket':
    case 'pot':
      sk.shape([-34, 0, -44, -70, 44, -70, 34, 0], fill, L);
      sk.oval(0, -70, 44, 9, o.kind === 'pot' ? 'ink' : 'greyMid');
      sk.stroke(
        o.kind === 'pot' ? [-44, -60, -56, -66] : [-44, -70, -30, -100, 30, -100, 44, -70],
        { w: 'outer' },
      );
      if (o.kind === 'pot') sk.stroke([44, -60, 56, -66], { w: 'outer' });
      return true;
    case 'flask':
      sk.stroke([-30, -60, -38, -96, 0, -104, 38, -96, 30, -60], { w: 'outer', color: 'sepiaMid' });
      sk.oval(0, -42, 38, 40, fill, L);
      sk.oval(0, -42, 24, 26, 'none', { outline: 'inner' });
      sk.shape([-8, -80, 8, -80, 8, -94, -8, -94], 'sepiaMid', { outline: 'inner' });
      return true;
    case 'sack':
      sk.shape([-36, 0, -44, -50, -18, -84, -12, -96, 12, -96, 18, -84, 44, -50, 36, 0], fill, L);
      sk.stroke([-18, -84, 18, -84], { w: 'outer', color: 'sepiaMid' });
      return true;
    default:
      return false;
  }
}
