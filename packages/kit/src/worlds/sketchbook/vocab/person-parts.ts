/**
 * What a person of the open vocabulary wears (PLAN.md#13.15a): clothes in torso units (neck at
 * (0, 0), hip at (0, 100), 100 = the torso), hats, hair and skin in head units (head centre at
 * (0, 0), 100 = the head radius), drawn facing right (the page mirrors them for a figure facing
 * left). Crude like the stick figure under them: a coat is a wobbly trapezoid, a hat a few
 * strokes and one crayon fill.
 */
import type { SwatchName } from '../inks.js';
import { Draft, fill, thin } from './gen/draft.js';
import { arcFlat } from './gen/family.js';
import type { DoodleInput } from './spec.js';

export const CLOTHES = [
  'none',
  'shirt',
  'coat',
  'dress',
  'robe',
  'overalls',
  'vest',
  'suit',
  'armor',
] as const;
export const HATS = [
  'none',
  'cap',
  'brim',
  'beanie',
  'helmet',
  'hardhat',
  'crown',
  'hood',
  'wizard',
  'tophat',
  'scarf',
  'bubble',
] as const;
export const HAIRS = [
  'none',
  'short',
  'spiky',
  'long',
  'bun',
  'curly',
  'ponytail',
  'beard',
  'bald',
] as const;
export const SKINS = ['none', 'light', 'tan', 'brown', 'deep'] as const;

export type Clothes = (typeof CLOTHES)[number];
export type Hat = (typeof HATS)[number];
export type Hair = (typeof HAIRS)[number];
export type Skin = (typeof SKINS)[number];

export const SKIN_INKS: Readonly<Record<Exclude<Skin, 'none'>, SwatchName>> = {
  light: 'coffeeLight',
  tan: 'kraft',
  brown: 'coffee',
  deep: 'kraftDark',
};

/** Clothes (torso units, 100 = neck to hip); `blob` = a bean body under them. */
export function clothesDoodle(
  kind: Clothes,
  blob: boolean,
  color: SwatchName,
  seed: number,
): DoodleInput | null {
  const d = new Draft(seed);
  if (blob) d.blob(0, 50, 34, 60, { ...fill(color), lumps: 0.1 });
  const c = fill(color);
  switch (kind) {
    case 'shirt':
      d.poly([-30, 6, 30, 4, 35, 100, -34, 102], c);
      break;
    case 'coat':
      d.poly([-34, 3, 34, 3, 46, 150, -44, 152], c)
        .line([2, 10, 0, 150], thin)
        .dots([6, 50, 6, 90], 3);
      break;
    case 'dress':
      d.poly([-24, 6, 24, 6, 30, 76, 78, 190, -76, 192, -30, 76], c);
      break;
    case 'robe':
      d.poly([-32, 3, 32, 3, 56, 246, -56, 246], c).sharp([-36, 96, 36, 98], { width: 3 });
      break;
    case 'overalls':
      d.rect(-22, 36, 44, 70, c)
        .sharp([-20, 38, -26, 4], {})
        .sharp([20, 38, 26, 4], {})
        .dots([-12, 46, 12, 46], 3);
      break;
    case 'vest':
      d.poly([-30, 6, -6, 6, 0, 60, -2, 98, -34, 98], c)
        .poly([30, 6, 6, 6, 2, 98, 34, 98], c)
        .rect(10, 40, 14, 12, thin);
      break;
    case 'suit':
      d.poly([-32, 4, 32, 4, 36, 104, -36, 104], c).poly(
        [-4, 6, 4, 6, 6, 60, 0, 72, -6, 60],
        fill('margin', 'dense'),
      );
      break;
    case 'armor':
      d.poly([-34, 2, 34, 2, 36, 104, -36, 104], { ...c, nib: 'felt' }).scribble(
        [-30, 8, 30, 8, 32, 98, -32, 98],
        { nib: 'pencil', spacing: 9 },
      );
      break;
    case 'none':
      break;
  }
  return d.parts.length > 0 ? d.done([1, 1]) : null;
}

/** Hats (head units, 100 = head radius, facing right). */
export function hatDoodle(kind: Hat, color: SwatchName, seed: number): DoodleInput | null {
  const d = new Draft(seed);
  const c = fill(color);
  switch (kind) {
    case 'cap':
      d.poly([-104, -18, ...arcFlat(0, -22, 104, 92, 190, 350, 6), 104, -18], c).sharp(
        [96, -22, 190, -14],
        { width: 3 },
      );
      break;
    case 'brim':
      d.poly([-86, -55, -70, -152, 76, -158, 90, -55], c)
        .line([-205, -48, 0, -64, 212, -50], { width: 3 })
        .sharp([-86, -70, 90, -72], thin);
      break;
    case 'beanie':
      d.poly([-110, -30, ...arcFlat(0, -34, 110, 104, 185, 355, 6), 110, -30], c)
        .rect(-112, -46, 224, 26, {})
        .circle(0, -150, 22, c);
      break;
    case 'helmet':
      d.poly([-122, -10, ...arcFlat(0, -14, 122, 118, 185, 355, 6), 122, -10], c).sharp(
        [-130, -8, 132, -10],
        { width: 3 },
      );
      break;
    case 'hardhat':
      d.poly(
        [-108, -24, ...arcFlat(0, -28, 108, 100, 185, 355, 6), 108, -24],
        fill(color === 'paper' ? 'sticky' : color, 'dense'),
      )
        .sharp([-130, -24, 160, -22], { width: 3 })
        .sharp([0, -126, 4, -40], thin);
      break;
    case 'crown':
      d.poly(
        [-90, -60, -96, -165, -48, -110, 0, -178, 48, -110, 96, -165, 90, -60],
        fill(color === 'paper' ? 'sticky' : color, 'dense'),
      );
      break;
    case 'hood':
      d.line([-120, 110, ...arcFlat(0, 0, 136, 140, 160, 380, 10), 124, 108], { width: 2 });
      break;
    case 'wizard':
      d.poly([-122, -56, 30, -330, 122, -56], c)
        .sharp([-150, -52, 150, -58], { width: 3 })
        .dots([-10, -150, 40, -220], 4, { color: 'sticky' });
      break;
    case 'tophat':
      d.rect(-74, -230, 148, 170, fill(color === 'paper' ? 'ink' : color, 'dense')).sharp(
        [-140, -60, 142, -64],
        { width: 3 },
      );
      break;
    case 'bubble':
      d.circle(4, 6, 158, {
        ...fill(color === 'paper' ? 'skyPencil' : color, 'light'),
        width: 2,
      }).arc(4, 6, 120, 200, 250, thin);
      break;
    case 'scarf':
      d.poly([-110, 30, ...arcFlat(0, -6, 112, 112, 170, 370, 8), 110, 30], c).line(
        [-104, 34, -150, 120, -126, 140],
        { width: 2 },
      );
      break;
    case 'none':
      break;
  }
  return d.parts.length > 0 ? d.done([1, 1]) : null;
}

/** A row of spikes over the top of the head (spiky hair). */
function spikes(): number[] {
  const pts: number[] = [];
  for (let i = 0; i <= 8; i += 1) {
    const a = ((200 + i * 17.5) * Math.PI) / 180;
    const r = i % 2 === 0 ? 96 : 140;
    pts.push(Math.cos(a) * r, Math.sin(a) * r);
  }
  return pts;
}

/** Hair (head units, facing right: the back of the head is on the left). */
export function hairDoodle(kind: Hair, color: SwatchName, seed: number): DoodleInput | null {
  const d = new Draft(seed);
  const s = { color, width: 2 };
  switch (kind) {
    case 'short':
      for (let i = 0; i < 6; i += 1) {
        const a = 200 + i * 26;
        const [x, y] = [Math.cos((a * Math.PI) / 180) * 100, Math.sin((a * Math.PI) / 180) * 100];
        d.sharp([x, y, x * 1.12 - 10, y * 1.16], s);
      }
      break;
    case 'spiky':
      d.poly(spikes(), fill(color, 'dense'));
      break;
    case 'long':
      d.line([-30, -98, -96, -40, -112, 70, -96, 170], s).line([30, -98, 92, -50, 100, 40], s);
      break;
    case 'bun':
      d.arc(0, 0, 102, 200, 330, s).circle(-104, -80, 34, fill(color, 'dense'));
      break;
    case 'curly':
      for (let i = 0; i < 5; i += 1)
        d.circle(-80 + i * 38, -92 + Math.abs(i - 2) * 14, 22, { color, nib: 'fine' });
      break;
    case 'ponytail':
      d.arc(0, 0, 104, 195, 335, s).line([-96, -40, -150, 20, -138, 110], { color, width: 3 });
      break;
    case 'beard':
      d.poly([-80, 20, -64, 120, 0, 156, 64, 120, 84, 20, 40, 60, -30, 60], fill(color, 'dense'));
      break;
    case 'bald':
      d.arc(-20, -20, 60, 210, 260, thin);
      break;
    case 'none':
      break;
  }
  return d.parts.length > 0 ? d.done([1, 1]) : null;
}
