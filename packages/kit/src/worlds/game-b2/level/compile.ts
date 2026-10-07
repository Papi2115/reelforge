/**
 * Compiles a checked level into the raycaster's flat arrays: wall type / floor / ceiling texture
 * and room (mood region) per cell, door axes, one colormap per mood, lights (each lights only its
 * own room, like the showcase) and sprites with their frames. The film's own assets (sprites,
 * textures, animated water) and an outdoor sky compile here too. A pure function of the level.
 */
import { hash3 } from '../core/rand.js';
import { emptyAssets, type AssetSet, type AssetSprite } from '../assets/pack.js';
import { mirror } from '../assets/draw.js';
import { colormap, nearest, type Rgb } from '../palette.js';
import { planSky, type SkyPlan } from '../ray/sky.js';
import { sprite as makeSprite, type Sprite } from '../ray/sprites-props.js';
import type { Texture } from '../ray/texture.js';
import {
  doorTexture,
  flatTexture,
  SPRITE_SIZE,
  spriteFrames,
  wallCap,
  wallHeight,
  wallTexture,
} from './assets.js';
import {
  isBuiltInSprite,
  isDoor,
  isWall,
  legendOf,
  type Level,
  type LightSpec,
  type SpriteSpec,
} from './schema.js';
import { SKY_LIGHT } from './sky.js';

export interface WallType {
  /** Texture ids of the variants (picked per cell by a hash). */
  readonly tex: readonly number[];
  readonly h: number;
  /** Colour of the top of a low wall (-1 = none). */
  readonly cap: number;
  readonly door: boolean;
}

export interface CompiledLight {
  readonly id: string | undefined;
  readonly region: number;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly power: number;
  /** 1 / radius^2. */
  readonly inv: number;
  readonly flicker: LightSpec['flicker'];
  readonly bulb: boolean;
}

export interface CompiledSprite {
  readonly id: string | undefined;
  readonly kind: string;
  readonly region: number;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly w: number;
  readonly h: number;
  readonly frames: readonly Sprite[];
  /** Animation speed of a project sprite (0 = still / built-in behaviour). */
  readonly fps: number;
  /** Frame offset, so a flock never flaps in step. */
  readonly phase: number;
  /** Rest / talk / shake frames like the clerk (view.act). */
  readonly person: boolean;
}

/** A texture whose frames cycle (water, lava, a project texture with frames). */
export interface AnimatedTexture {
  readonly id: number;
  readonly frames: readonly Texture[];
  readonly fps: number;
}

export interface Mood {
  readonly tint: Rgb;
  readonly fog: Rgb;
  readonly density: number;
  readonly ambient: number;
}

export const MOOD_TABLE: Readonly<Record<Level['mood'], Mood>> = {
  dark: { tint: [1.0, 0.9, 0.78], fog: [8, 7, 10], density: 0.16, ambient: 0.02 },
  tungsten: { tint: [1.1, 0.95, 0.72], fog: [44, 30, 24], density: 0.05, ambient: 0.3 },
  fluorescent: { tint: [0.92, 1.03, 0.94], fog: [16, 32, 26], density: 0.085, ambient: 0.09 },
  shop: { tint: [0.96, 1.05, 0.96], fog: [58, 99, 75], density: 0.04, ambient: 0.42 },
  backroom: { tint: [1.0, 0.97, 0.9], fog: [43, 41, 42], density: 0.07, ambient: 0.17 },
};

/** A room of one mood: its colormap, fog colour index, fog density and ambient light. */
export interface Region {
  readonly mood: Level['mood'];
  readonly cmap: Uint8Array;
  readonly fogIndex: number;
  readonly density: number;
  readonly ambient: number;
}

/** No roof: the cell is open to the sky (outdoor levels). */
export const NO_ROOF = 255;
/** No floor: the sky shows below too (outdoor levels: space, a cliff edge). */
export const NO_FLOOR = 255;

export interface CompiledLevel {
  readonly name: string;
  readonly w: number;
  readonly h: number;
  readonly seed: number;
  /** Wall type index per cell (0 = open). */
  readonly wall: Uint8Array;
  /** Door axis per cell: 1 = the door plane is x = cx + 0.5, 2 = y = cy + 0.5. */
  readonly doorAxis: Uint8Array;
  readonly floor: Uint8Array;
  /** Ceiling texture per cell (NO_ROOF = open sky). */
  readonly ceil: Uint8Array;
  /** Region (mood room) per cell; 0 = the level's own mood. */
  readonly region: Uint8Array;
  readonly regions: readonly Region[];
  readonly wallTypes: readonly WallType[];
  readonly textures: readonly Texture[];
  readonly animated: readonly AnimatedTexture[];
  readonly lights: readonly CompiledLight[];
  readonly sprites: readonly CompiledSprite[];
  /** Height of the tallest wall (>= 1): a ray stops at a wall this tall. */
  readonly tallest: number;
  /** Outdoor level: the sky and the ground texture beyond the grid (-1 = none). */
  readonly sky: SkyPlan | undefined;
  readonly ground: number;
}

function seedOf(level: Level): number {
  if (level.seed !== undefined) return level.seed;
  let h = 7;
  for (const ch of level.name) h = (Math.imul(h, 31) + ch.charCodeAt(0)) | 0;
  return (h >>> 0) % 100_000;
}

function regionOf(level: Level, mood: Level['mood'], own: boolean): Region {
  const base = own && level.sky !== undefined ? SKY_LIGHT[level.sky.preset] : MOOD_TABLE[mood];
  return {
    mood,
    cmap: colormap(base.tint, base.fog),
    fogIndex: nearest(base.fog[0], base.fog[1], base.fog[2]),
    density: own ? (level.density ?? base.density) : base.density,
    ambient: own ? (level.ambient ?? base.ambient) : base.ambient,
  };
}

const flipped = new WeakMap<Sprite, Sprite>();

function mirrored(frame: Sprite): Sprite {
  let found = flipped.get(frame);
  if (found === undefined) {
    found = { ...makeSprite(mirror(frame.bmp)), emissive: frame.emissive };
    flipped.set(frame, found);
  }
  return found;
}

function compileSprite(spec: SpriteSpec, region: number, assets: AssetSet): CompiledSprite {
  const own: AssetSprite | undefined = isBuiltInSprite(spec.sprite)
    ? undefined
    : assets.sprites.get(spec.sprite);
  const [w0, h0, z0] = isBuiltInSprite(spec.sprite)
    ? SPRITE_SIZE[spec.sprite]
    : [own?.size[0] ?? 0.5, own?.size[1] ?? 0.5, own?.z ?? 0];
  const scale = spec.scale ?? 1;
  const [x, y] = spec.pos;
  const frames = isBuiltInSprite(spec.sprite)
    ? spriteFrames({ ...spec, sprite: spec.sprite })
    : [...(own?.frames ?? [])];
  return {
    id: spec.id,
    kind: spec.sprite,
    region,
    x,
    y,
    z: spec.z ?? z0,
    w: spec.w ?? w0 * scale,
    h: spec.h ?? h0 * scale,
    frames: spec.flip === true ? frames.map(mirrored) : frames,
    fps: own?.fps ?? 0,
    phase: Math.floor(hash3(Math.floor(x * 16), Math.floor(y * 16), spec.seed ?? 5) * 8),
    person: spec.sprite === 'clerk' || own?.person === true,
  };
}

/** Compiles a level that passed `checkLevel` (with the same assets). */
export function compileLevel(level: Level, assets: AssetSet = emptyAssets()): CompiledLevel {
  const h = level.grid.length;
  const w = level.grid[0]?.length ?? 0;
  const seed = seedOf(level);
  const textures: Texture[] = [];
  const animated: AnimatedTexture[] = [];
  const texId = (texture: Texture): number => {
    const found = textures.indexOf(texture);
    if (found >= 0) return found;
    textures.push(texture);
    return textures.length - 1;
  };
  /** A project texture id -> its first frame's slot (the frames cycle there). */
  const ownTex = (name: string): number | undefined => {
    const own = assets.textures.get(name);
    const first = own?.frames[0];
    if (own === undefined || first === undefined) return undefined;
    const known = textures.indexOf(first);
    const id = texId(first);
    if (known < 0 && own.frames.length > 1) animated.push({ id, frames: own.frames, fps: own.fps });
    return id;
  };
  const flatId = (name: string, salt: number, flicker: boolean): number =>
    ownTex(name) ?? texId(flatTexture(name, seed + salt, flicker));
  const outdoor = level.sky !== undefined;
  const regions: Region[] = [regionOf(level, level.mood, true)];
  const regionId = (mood: Level['mood'] | undefined): number => {
    if (mood === undefined || (!outdoor && mood === level.mood)) return 0;
    const found = regions.findIndex((region, i) => i > 0 && region.mood === mood);
    if (found >= 0) return found;
    regions.push(regionOf(level, mood, false));
    return regions.length - 1;
  };
  const wallTypes: WallType[] = [{ tex: [], h: 0, cap: -1, door: false }];
  const typeOfChar = new Map<string, number>();
  const wall = new Uint8Array(w * h);
  const doorAxis = new Uint8Array(w * h);
  const floor = new Uint8Array(w * h);
  const ceil = new Uint8Array(w * h);
  const region = new Uint8Array(w * h);
  let tallest = 1;
  for (let y = 0; y < h; y += 1)
    for (let x = 0; x < w; x += 1) {
      const ch = level.grid[y]?.[x] ?? '#';
      const entry = legendOf(level, ch) ?? {};
      const i = y * w + x;
      const open = isWall(entry) || isDoor(entry) ? {} : entry;
      const flicker = 'flicker' in open && open.flicker === true;
      region[i] = regionId('mood' in open ? open.mood : undefined);
      const floorName = ('floor' in open && open.floor) || level.floor;
      floor[i] = floorName === 'none' ? NO_FLOOR : flatId(floorName, 41, false);
      const own = 'ceiling' in open ? open.ceiling : undefined;
      const ceiling = own ?? level.ceiling;
      ceil[i] =
        outdoor && (own === undefined || own === 'none')
          ? NO_ROOF
          : flatId(ceiling === 'warehouse' ? 'warehouse-ceiling' : ceiling, 71, flicker);
      if (!isWall(entry) && !isDoor(entry)) continue;
      let type = typeOfChar.get(ch);
      if (type === undefined) {
        if (isWall(entry)) {
          const custom = ownTex(entry.wall);
          const variants = entry.wall === 'shelf' || entry.wall === 'store-shelf' ? [0, 1, 2] : [0];
          const tex =
            custom === undefined
              ? variants.map((variant) => texId(wallTexture(entry, seed, variant)))
              : [custom];
          const height = wallHeight(entry);
          tallest = Math.max(tallest, height);
          wallTypes.push({ tex, h: height, cap: wallCap(entry), door: false });
        } else wallTypes.push({ tex: [texId(doorTexture())], h: 1, cap: -1, door: true });
        type = wallTypes.length - 1;
        typeOfChar.set(ch, type);
      }
      wall[i] = type;
      if (isDoor(entry)) {
        const above = level.grid[y - 1]?.[x];
        doorAxis[i] = above !== undefined && isWall(legendOf(level, above)) ? 1 : 2;
      }
    }
  const groundName = level.sky?.ground ?? level.floor;
  const ground = !outdoor || groundName === 'none' ? -1 : flatId(groundName, 41, false);
  const cellRegion = (x: number, y: number): number =>
    region[Math.floor(y) * w + Math.floor(x)] ?? 0;
  return {
    name: level.name,
    w,
    h,
    seed,
    wall,
    doorAxis,
    floor,
    ceil,
    region,
    regions,
    wallTypes,
    textures,
    animated,
    lights: level.lights.map((light) => ({
      id: light.id,
      region: cellRegion(light.pos[0], light.pos[1]),
      x: light.pos[0],
      y: light.pos[1],
      z: light.z,
      power: light.power,
      inv: 1 / (light.radius * light.radius),
      flicker: light.flicker,
      bulb: light.bulb,
    })),
    sprites: level.sprites.map((spec) =>
      compileSprite(spec, cellRegion(spec.pos[0], spec.pos[1]), assets),
    ),
    tallest,
    sky: level.sky === undefined ? undefined : planSky(level.sky, seed),
    ground,
  };
}

/** Compiles one extra sprite of a level (`view.place`). */
export function compileExtraSprite(
  level: CompiledLevel,
  spec: SpriteSpec,
  assets: AssetSet = emptyAssets(),
): CompiledSprite {
  const [x, y] = spec.pos;
  return compileSprite(spec, level.region[Math.floor(y) * level.w + Math.floor(x)] ?? 0, assets);
}

/** Variant texture of a wall cell (stable per cell). */
export function wallTextureAt(type: WallType, x: number, y: number): number {
  return type.tex.length === 1
    ? (type.tex[0] ?? 0)
    : (type.tex[Math.floor(hash3(x, y, 3) * type.tex.length)] ?? 0);
}
