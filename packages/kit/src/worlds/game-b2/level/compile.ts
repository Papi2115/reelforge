/**
 * Compiles a checked level into the raycaster's flat arrays: wall type / floor / ceiling texture
 * and room (mood region) per cell, door axes, one colormap per mood, lights (each lights only its
 * own room, like the showcase) and sprites with their frames. A pure function of the level.
 */
import { hash3 } from '../core/rand.js';
import { colormap, nearest, type Rgb } from '../palette.js';
import type { Sprite } from '../ray/sprites-props.js';
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
import { isDoor, isWall, legendOf, type Level, type LightSpec, type SpriteSpec } from './schema.js';

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
  readonly kind: SpriteSpec['sprite'];
  readonly region: number;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly w: number;
  readonly h: number;
  readonly frames: readonly Sprite[];
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
  readonly ceil: Uint8Array;
  /** Region (mood room) per cell; 0 = the level's own mood. */
  readonly region: Uint8Array;
  readonly regions: readonly Region[];
  readonly wallTypes: readonly WallType[];
  readonly textures: readonly Texture[];
  readonly lights: readonly CompiledLight[];
  readonly sprites: readonly CompiledSprite[];
}

function seedOf(level: Level): number {
  if (level.seed !== undefined) return level.seed;
  let h = 7;
  for (const ch of level.name) h = (Math.imul(h, 31) + ch.charCodeAt(0)) | 0;
  return (h >>> 0) % 100_000;
}

function regionOf(level: Level, mood: Level['mood'], own: boolean): Region {
  const base = MOOD_TABLE[mood];
  return {
    mood,
    cmap: colormap(base.tint, base.fog),
    fogIndex: nearest(base.fog[0], base.fog[1], base.fog[2]),
    density: own ? (level.density ?? base.density) : base.density,
    ambient: own ? (level.ambient ?? base.ambient) : base.ambient,
  };
}

function compileSprite(spec: SpriteSpec, region: number): CompiledSprite {
  const [w, h, z] = SPRITE_SIZE[spec.sprite];
  const [x, y] = spec.pos;
  return {
    id: spec.id,
    kind: spec.sprite,
    region,
    x,
    y,
    z: spec.z ?? z,
    w: spec.w ?? w,
    h: spec.h ?? h,
    frames: spriteFrames(spec),
  };
}

/** Compiles a level that passed `checkLevel`. */
export function compileLevel(level: Level): CompiledLevel {
  const h = level.grid.length;
  const w = level.grid[0]?.length ?? 0;
  const seed = seedOf(level);
  const textures: Texture[] = [];
  const texId = (texture: Texture): number => {
    const found = textures.indexOf(texture);
    if (found >= 0) return found;
    textures.push(texture);
    return textures.length - 1;
  };
  const regions: Region[] = [regionOf(level, level.mood, true)];
  const regionId = (mood: Level['mood'] | undefined): number => {
    if (mood === undefined || mood === level.mood) return 0;
    const found = regions.findIndex((region) => region.mood === mood);
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
  for (let y = 0; y < h; y += 1)
    for (let x = 0; x < w; x += 1) {
      const ch = level.grid[y]?.[x] ?? '#';
      const entry = legendOf(level, ch) ?? {};
      const i = y * w + x;
      const open = isWall(entry) || isDoor(entry) ? {} : entry;
      const flicker = 'flicker' in open && open.flicker === true;
      region[i] = regionId('mood' in open ? open.mood : undefined);
      floor[i] = texId(
        flatTexture(('floor' in open && open.floor) || level.floor, seed + 41, false),
      );
      const ceiling = ('ceiling' in open && open.ceiling) || level.ceiling;
      ceil[i] = texId(
        flatTexture(ceiling === 'warehouse' ? 'warehouse-ceiling' : ceiling, seed + 71, flicker),
      );
      if (!isWall(entry) && !isDoor(entry)) continue;
      let type = typeOfChar.get(ch);
      if (type === undefined) {
        if (isWall(entry)) {
          const variants = entry.wall === 'shelf' || entry.wall === 'store-shelf' ? [0, 1, 2] : [0];
          const tex = variants.map((variant) => texId(wallTexture(entry, seed, variant)));
          wallTypes.push({ tex, h: wallHeight(entry), cap: wallCap(entry), door: false });
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
    sprites: level.sprites.map((spec) => compileSprite(spec, cellRegion(spec.pos[0], spec.pos[1]))),
  };
}

/** Compiles one extra sprite of a level (`view.place`). */
export function compileExtraSprite(level: CompiledLevel, spec: SpriteSpec): CompiledSprite {
  const [x, y] = spec.pos;
  return compileSprite(spec, level.region[Math.floor(y) * level.w + Math.floor(x)] ?? 0);
}

/** Variant texture of a wall cell (stable per cell). */
export function wallTextureAt(type: WallType, x: number, y: number): number {
  return type.tex.length === 1
    ? (type.tex[0] ?? 0)
    : (type.tex[Math.floor(hash3(x, y, 3) * type.tex.length)] ?? 0);
}
