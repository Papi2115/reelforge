/**
 * Looks of the voxel character (PLAN.md#3.3): outfit variants (the hero's orange hoodie, a
 * generic hoodie, suit, hooded hacker, police officer), hair, hats, skin tones and accessories,
 * drawn as one small Sketch per body part (shared by the character and the crowd).
 *
 * Part models (voxels; pivots are the joints of character-rig.ts):
 * torso 6x7x4 (+ backpack/hood lump behind), head 6x6x6 (+ hair/hat room), upper arm 2x4x3,
 * forearm 2x4x3 (hand at the bottom), thigh 3x4x3, shin 3x7x3 (+ shoe toe in front).
 */
import type { KitTools } from '../registry.js';
import type { Vec3 } from '../types.js';
import type { VoxelColor, VoxelModel } from '../voxel/model.js';
import type { PartName } from './character-rig.js';
import { DARK, DARKEST, GOLD, PAPER, pick, RED } from './shared.js';
import { Sketch } from './sketch.js';

export const CHARACTER_VARIANTS = ['hero', 'hoodie', 'suit', 'hacker', 'officer'] as const;
export const HAIR_STYLES = ['short', 'long', 'spiky', 'bun', 'bald'] as const;
export const HATS = ['none', 'cap', 'beanie', 'officer', 'hood'] as const;
export const SKIN_TONES = ['pale', 'warm'] as const;
export const ACCESSORIES = ['backpack', 'headphones', 'glasses'] as const;

export type CharacterVariant = (typeof CHARACTER_VARIANTS)[number];
export type HairStyle = (typeof HAIR_STYLES)[number];
export type Hat = (typeof HATS)[number];
export type SkinTone = (typeof SKIN_TONES)[number];
export type Accessory = (typeof ACCESSORIES)[number];

export interface LookSpec {
  readonly variant: CharacterVariant;
  readonly hair: HairStyle;
  readonly hat: Hat;
  readonly skin: SkinTone;
  readonly accessories: readonly Accessory[];
  /** Palette-name overrides. */
  readonly outfit?: string | undefined;
  readonly hairColor?: string | undefined;
}

/** Defaults a variant brings (the hacker wears his hood up, the officer a peaked cap). */
export const VARIANT_DEFAULTS: Readonly<Record<CharacterVariant, { hair: HairStyle; hat: Hat }>> = {
  hero: { hair: 'short', hat: 'none' },
  hoodie: { hair: 'short', hat: 'none' },
  suit: { hair: 'short', hat: 'none' },
  hacker: { hair: 'short', hat: 'hood' },
  officer: { hair: 'short', hat: 'officer' },
};

type Slot =
  | 'top'
  | 'trim'
  | 'shirt'
  | 'tie'
  | 'pants'
  | 'shoe'
  | 'skin'
  | 'hair'
  | 'eye'
  | 'hat'
  | 'brim'
  | 'badge'
  | 'pack'
  | 'gear';

/** Colour chains: Crisp 640 swatch, Noir swatch, Soft 480 swatch, token. */
export const SKIN_CHAINS: Readonly<Record<SkinTone, readonly string[]>> = {
  warm: ['lightOrange', 'gold', 'peach', 'keyLight'],
  pale: ['cream', 'bone', 'sand', 'heroTrim'],
};
export const HAIR_CHAIN = ['indigo', 'charcoal', 'umber', 'shadow'] as const;
export const OUTFIT_CHAINS = {
  teal: ['brightTeal', 'teal', 'sage', 'accent1'],
  pink: ['pink', 'red', 'rose', 'accent2'],
  green: ['green', 'teal', 'mint', 'accent3'],
  violet: ['violet', 'blood', 'mauve', 'accent4'],
  grey: ['slateGrey', 'ash', 'ice', 'textDim'],
} as const;
const JEANS = ['slateBlue', 'steel', 'dusk', 'groundAlt'] as const;
const UNIFORM = ['slateBlue', 'steel', 'cornflower', 'accent1'] as const;
const EYE = ['black', 'black', 'night', 'outline'] as const;

type Colors = Record<Slot, VoxelColor>;

function lookColors(tools: KitTools, look: LookSpec): Colors {
  const dark = pick(tools, undefined, DARK);
  const darkest = pick(tools, undefined, DARKEST);
  const base: Colors = {
    top: pick(tools, look.outfit, ['hero']),
    trim: pick(tools, undefined, ['heroTrim']),
    shirt: pick(tools, undefined, PAPER),
    tie: pick(tools, undefined, RED),
    pants: pick(tools, undefined, JEANS),
    shoe: darkest,
    skin: pick(tools, undefined, SKIN_CHAINS[look.skin]),
    hair: pick(tools, look.hairColor, HAIR_CHAIN),
    eye: pick(tools, undefined, EYE),
    hat: pick(tools, look.outfit, OUTFIT_CHAINS.teal),
    brim: darkest,
    badge: pick(tools, undefined, GOLD),
    pack: pick(tools, undefined, OUTFIT_CHAINS.teal),
    gear: darkest,
  };
  switch (look.variant) {
    case 'hero':
      return { ...base, shoe: pick(tools, undefined, PAPER), pack: pick(tools, undefined, JEANS) };
    case 'hoodie':
      return { ...base, top: pick(tools, look.outfit, OUTFIT_CHAINS.teal), trim: dark };
    case 'suit':
      return { ...base, top: pick(tools, look.outfit, DARK), pants: dark };
    case 'hacker':
      return {
        ...base,
        top: pick(tools, look.outfit, DARKEST),
        trim: pick(tools, undefined, OUTFIT_CHAINS.green),
        pants: dark,
        pack: dark,
      };
    case 'officer':
      return {
        ...base,
        top: pick(tools, look.outfit, UNIFORM),
        trim: darkest,
        pants: darkest,
        hat: pick(tools, look.outfit, UNIFORM),
      };
  }
}

export interface PartModel {
  readonly model: VoxelModel;
  /** Grid point at the part's joint. */
  readonly pivot: Vec3;
}

export type PartModels = Readonly<Record<PartName, PartModel>>;

function torso(colors: Colors, look: LookSpec): Sketch<Slot> {
  // Body x 1..7, y 0..7, z 2..6; z 0..2 behind it holds the backpack or the hood lump.
  const sketch = new Sketch<Slot>([8, 7, 8], colors);
  sketch.box('top', [1, 0, 2], [7, 7, 6]);
  const front = 5;
  if (look.variant === 'suit') {
    sketch.paint('shirt', [2, 3, front], [6, 7, front + 1]);
    sketch.paint('tie', [3, 1, front], [5, 7, front + 1]);
  } else if (look.variant === 'officer') {
    sketch.paint('trim', [1, 0, 2], [7, 1, 6]).paint('badge', [3, 0, front], [5, 1, front + 1]);
    sketch.paint('badge', [5, 4, front], [6, 5, front + 1]);
    sketch.paint('trim', [3, 5, front], [5, 7, front + 1]);
  } else {
    sketch.paint('trim', [1, 0, 2], [7, 1, 6]);
    for (const x of [2, 5]) sketch.paint('trim', [x, 3, front], [x + 1, 6, front + 1]);
    if (look.hat !== 'hood') sketch.box('top', [2, 4, 1], [6, 7, 2]);
  }
  if (look.accessories.includes('backpack')) {
    sketch.box('pack', [2, 1, 0], [6, 6, 2]);
    for (const x of [2, 5]) sketch.paint('pack', [x, 3, 2], [x + 1, 7, 6]);
  }
  return sketch;
}

function hair(sketch: Sketch<Slot>, style: HairStyle): void {
  if (style === 'bald') {
    sketch.paint('hair', [1, 2, 1], [7, 4, 2]);
    return;
  }
  sketch.box('hair', [1, 5, 1], [7, 6, 7]).paint('hair', [1, 2, 1], [7, 6, 2]);
  sketch.paint('hair', [1, 3, 1], [2, 6, 5]).paint('hair', [6, 3, 1], [7, 6, 5]);
  sketch.box('hair', [2, 6, 2], [6, 7, 5]);
  if (style === 'long') {
    sketch.box('hair', [1, 0, 0], [7, 6, 1]);
    sketch.box('hair', [0, 1, 1], [1, 6, 5]).box('hair', [7, 1, 1], [8, 6, 5]);
  } else if (style === 'spiky') {
    for (const [x, z] of [
      [1, 2],
      [3, 1],
      [5, 2],
      [2, 4],
      [4, 3],
      [6, 4],
    ] as const) {
      sketch.box('hair', [x, 6, z], [x + 1, 8, z + 1]);
    }
  } else if (style === 'bun') {
    sketch.box('hair', [3, 6, 1], [5, 8, 3]);
  }
}

function hat(sketch: Sketch<Slot>, kind: Hat): void {
  switch (kind) {
    case 'none':
      return;
    case 'cap':
      sketch.box('hat', [1, 5, 1], [7, 7, 7]).box('hat', [2, 5, 7], [6, 6, 9]);
      return;
    case 'beanie':
      sketch.box('hat', [1, 4, 1], [7, 8, 7]).paint('trim', [1, 4, 1], [7, 5, 7]);
      sketch.box('hat', [3, 8, 3], [5, 9, 5]);
      return;
    case 'officer':
      sketch.box('brim', [1, 5, 1], [7, 6, 7]).box('hat', [0, 6, 0], [8, 8, 8]);
      sketch.box('brim', [2, 5, 7], [6, 6, 9]).box('badge', [3, 6, 8], [5, 7, 9]);
      return;
    case 'hood':
      sketch.box('top', [0, 0, 0], [1, 7, 7]).box('top', [7, 0, 0], [8, 7, 7]);
      sketch.box('top', [0, 6, 0], [8, 8, 8]).box('top', [1, 0, 0], [7, 6, 1]);
      sketch.paint('trim', [0, 6, 7], [8, 7, 8]);
      sketch.box('top', [1, 5, 6], [7, 6, 7]);
      return;
  }
}

function head(colors: Colors, look: LookSpec): Sketch<Slot> {
  // Head x 1..7, y 0..6, z 1..7 (face at z = 6); room around it for hair, hats, headphones.
  const sketch = new Sketch<Slot>([8, 10, 10], colors);
  sketch.box('skin', [1, 0, 1], [7, 6, 7]);
  sketch.paint('eye', [2, 3, 6], [3, 4, 7]).paint('eye', [5, 3, 6], [6, 4, 7]);
  // Under a hat only the back and sides show: tufts, spikes and buns would poke through.
  const covered = look.hair === 'long' || look.hair === 'bald' ? look.hair : 'short';
  if (look.hat !== 'hood') hair(sketch, look.hat === 'none' ? look.hair : covered);
  hat(sketch, look.hat);
  if (look.accessories.includes('glasses')) {
    sketch.box('gear', [1, 3, 7], [7, 4, 8]).box('gear', [1, 3, 4], [2, 4, 7]);
    sketch.box('gear', [6, 3, 4], [7, 4, 7]);
  }
  if (look.accessories.includes('headphones')) {
    const band = look.hat === 'none' ? 7 : 8;
    sketch.box('gear', [0, 2, 3], [1, 6, 5]).box('gear', [7, 2, 3], [8, 6, 5]);
    sketch.box('gear', [0, 6, 3], [1, band, 5]).box('gear', [7, 6, 3], [8, band, 5]);
    sketch.box('gear', [1, band - 1, 3], [7, band, 5]);
    sketch.paint('pack', [0, 3, 3], [1, 5, 5]).paint('pack', [7, 3, 3], [8, 5, 5]);
  }
  return sketch;
}

function upperArm(colors: Colors): Sketch<Slot> {
  return new Sketch<Slot>([2, 4, 3], colors).box('top', [0, 0, 0], [2, 4, 3]);
}

function forearm(colors: Colors, look: LookSpec): Sketch<Slot> {
  const sketch = new Sketch<Slot>([2, 4, 3], colors);
  sketch.box('top', [0, 2, 0], [2, 4, 3]).box('skin', [0, 0, 0], [2, 2, 3]);
  if (look.variant === 'suit') sketch.paint('shirt', [0, 2, 0], [2, 3, 3]);
  return sketch;
}

function thigh(colors: Colors): Sketch<Slot> {
  return new Sketch<Slot>([3, 4, 3], colors).box('pants', [0, 0, 0], [3, 4, 3]);
}

function shin(colors: Colors): Sketch<Slot> {
  const sketch = new Sketch<Slot>([3, 7, 4], colors);
  return sketch.box('pants', [0, 2, 0], [3, 7, 3]).box('shoe', [0, 0, 0], [3, 2, 4]);
}

/** The six part models of a look (meshed at CHARACTER_VOXEL by the caller). */
export function characterParts(tools: KitTools, look: LookSpec): PartModels {
  const colors = lookColors(tools, look);
  const model = (sketch: Sketch<Slot>) => sketch.model(tools.voxel);
  return {
    torso: { model: model(torso(colors, look)), pivot: [4, 0, 4] },
    head: { model: model(head(colors, look)), pivot: [4, 0, 4] },
    upperArm: { model: model(upperArm(colors)), pivot: [1, 3, 1.5] },
    forearm: { model: model(forearm(colors, look)), pivot: [1, 4, 1.5] },
    thigh: { model: model(thigh(colors)), pivot: [1.5, 4, 1.5] },
    shin: { model: model(shin(colors)), pivot: [1.5, 7, 1.5] },
  };
}
