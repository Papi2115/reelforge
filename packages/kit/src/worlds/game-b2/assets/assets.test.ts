/**
 * The Game B2 open authoring layer (PLAN.md#13.15): the pixel-art DSL and every generator make
 * palette-pure, deterministic bitmaps; broken definitions fail with errors that name the asset,
 * frame, row and column; packs check ids, built-in names, duplicates and caps.
 */
import { describe, expect, it } from 'vitest';
import { T } from '../palette.js';
import type { Bmp } from '../core/bitmap.js';
import { CREATURE_FORMS, CREATURE_KINDS } from './gen-creatures.js';
import { ICON_KINDS } from './gen-icons.js';
import { OBJECT_KINDS } from './gen-objects.js';
import { PLANT_KINDS } from './gen-plants.js';
import { STRUCTURE_KINDS } from './gen-structures.js';
import { TEXTURE_KINDS } from './gen-textures.js';
import { VEHICLE_KINDS } from './gen-vehicles.js';
import { compileIcon, compileSprite, compileTexture, MAX_PACK_ICONS } from './pack.js';
import { colourRef, RAMPS } from './ramps.js';
import { checkAssets, defineOne } from './registry.js';

function pure(bmp: Bmp): boolean {
  return bmp.d.every((index) => index === T || index < 32);
}

function opaque(bmp: Bmp): number {
  return bmp.d.filter((index) => index !== T).length;
}

function spriteOf(spec: unknown): readonly Bmp[] {
  const made = compileSprite('test', spec);
  if (!made.ok) throw new Error(made.errors.join('\n'));
  return made.value.frames.map((frame) => frame.bmp);
}

const SPRITE_SPECS: readonly Record<string, unknown>[] = [
  ...PLANT_KINDS.map((kind) => ({ gen: 'plant', kind })),
  ...CREATURE_KINDS.flatMap((kind) =>
    CREATURE_FORMS[kind].map((form) => ({ gen: 'creature', kind, form })),
  ),
  { gen: 'person', hat: 'top', outfit: 'suit', beard: true, tool: 'cane' },
  { gen: 'person', hat: 'space', outfit: 'spacesuit', build: 'child' },
  ...STRUCTURE_KINDS.map((kind) => ({ gen: 'structure', kind, lit: 0.5 })),
  ...VEHICLE_KINDS.map((kind) => ({ gen: 'vehicle', kind })),
  ...OBJECT_KINDS.map((kind) => ({ gen: 'object', kind })),
];

describe('colour references', () => {
  it('name swatches and ramp steps, never hex', () => {
    expect(colourRef('sage')).toBe(RAMPS.leaf[3]);
    expect(colourRef('leaf.3')).toBe(RAMPS.leaf[3]);
    expect(colourRef('leaf.9')).toBeUndefined();
    expect(colourRef('#ff0000')).toBeUndefined();
  });
});

describe('generators', () => {
  it.each(
    SPRITE_SPECS.map((spec) => [
      `${String(spec['gen'])} ${String(spec['kind'] ?? spec['hat'])} ${typeof spec['form'] === 'string' ? spec['form'] : ''}`,
      spec,
    ]),
  )('%s draws palette-pure, non-empty, the same every time', (_name, spec) => {
    const a = spriteOf({ ...spec, seed: 4 });
    const b = spriteOf({ ...spec, seed: 4 });
    expect(a.length).toBeGreaterThan(0);
    expect(a.length).toBeLessThanOrEqual(4);
    for (const [i, frame] of a.entries()) {
      expect(pure(frame)).toBe(true);
      expect(opaque(frame)).toBeGreaterThan(8);
      expect([...frame.d]).toEqual([...(b[i]?.d ?? [])]);
    }
  });

  it('seeds vary the same kind (a forest is not one stamp)', () => {
    const [a] = spriteOf({ gen: 'plant', kind: 'deciduous', seed: 1 });
    const [b] = spriteOf({ gen: 'plant', kind: 'deciduous', seed: 2 });
    expect([...(a?.d ?? [])]).not.toEqual([...(b?.d ?? [])]);
  });

  it.each(TEXTURE_KINDS)('texture %s is 64x64, palette-pure and seamless-sized', (kind) => {
    const made = compileTexture('t', { gen: 'texture', kind, seed: 3 });
    if (!made.ok) throw new Error(made.errors.join('\n'));
    for (const frame of made.value.frames) {
      expect([frame.bmp.w, frame.bmp.h]).toEqual([64, 64]);
      expect(pure(frame.bmp)).toBe(true);
    }
    expect(made.value.fps > 0).toBe(made.value.frames.length > 1);
  });

  it('water and lava animate; a window is see-through', () => {
    const water = compileTexture('w', { gen: 'texture', kind: 'water' });
    expect(water.ok && water.value.frames.length).toBe(3);
    const hull = compileTexture('h', { gen: 'texture', kind: 'hull', window: true });
    expect(hull.ok && hull.value.frames[0]?.bmp.d.includes(T)).toBe(true);
  });

  it.each(ICON_KINDS)('icon %s is 12x12 inside a 1 px outline', (kind) => {
    const made = compileIcon('i', { gen: 'icon', kind });
    if (!made.ok) throw new Error(made.errors.join('\n'));
    expect([made.value.w, made.value.h]).toEqual([14, 14]);
    expect(pure(made.value)).toBe(true);
    expect(opaque(made.value)).toBeGreaterThan(20);
  });

  it('a generator call may set its speed and foot height', () => {
    const made = compileSprite('deer', { gen: 'creature', kind: 'quadruped', fps: 0, z: 0.2 });
    expect(made.ok && [made.value.fps, made.value.z]).toEqual([0, 0.2]);
  });
});

describe('pixel-art DSL', () => {
  const FERN = { rows: ['.g.', 'gGg', '.d.'], legend: { g: 'leaf.3', G: 'sage', d: 'brown' } };

  it('compiles rows into an outlined sprite, mirrors and animates frames', () => {
    const [bmp] = spriteOf(FERN);
    expect([bmp?.w, bmp?.h]).toEqual([5, 5]);
    expect(spriteOf({ ...FERN, mirror: true })[0]?.w).toBe(8);
    const frames = spriteOf({ frames: [FERN.rows, FERN.rows], legend: FERN.legend, fps: 3 });
    expect(frames.length).toBe(2);
  });

  it('names the row and column of a character missing from the legend', () => {
    const made = compileSprite('sprites.fern', { ...FERN, rows: ['.g.', 'gXg', '.d.'] });
    expect(made.ok ? [] : made.errors).toContain(
      'sprites.fern.rows[1]: "X" at x=1 is not in the legend',
    );
  });

  it('rejects ragged rows, hex colours, too many frames and a wrong texture size', () => {
    const errors = (made: { ok: boolean; errors?: readonly string[] }): string =>
      made.ok ? '' : (made.errors ?? []).join('\n');
    expect(errors(compileSprite('s', { ...FERN, rows: ['.g.', 'gGgg', '.d.'] }))).toMatch(
      /rows\[1\]: 4 pixels wide, expected 3/,
    );
    expect(
      errors(compileSprite('s', { ...FERN, legend: { ...FERN.legend, g: '#00ff00' } })),
    ).toMatch(/"#00ff00" is not a game-b2 colour/);
    const five = Array.from({ length: 5 }, () => FERN.rows);
    expect(errors(compileSprite('s', { frames: five, legend: FERN.legend }))).toMatch(
      /5 frames, at most 4/,
    );
    expect(errors(compileTexture('t', { size: 16, ...FERN }))).toMatch(
      /16x16 texture needs 16 rows/,
    );
    expect(errors(compileSprite('s', { gen: 'plant', kind: 'cactus', form: 'x' }))).toMatch(/form/);
    expect(errors(compileSprite('s', { gen: 'robot' }))).toMatch(/unknown generator "robot"/);
  });

  it('tiles a 16 px texture to the raycaster size', () => {
    const rows = Array.from({ length: 16 }, (_, y) => (y % 2 ? 'ab' : 'ba').repeat(8));
    const made = compileTexture('t', { size: 16, rows, legend: { a: 'char', b: 'slate' } });
    expect(made.ok && [made.value.frames[0]?.bmp.w, made.value.frames[0]?.bmp.d[0]]).toEqual([
      64,
      colourRef('slate'),
    ]);
  });
});

describe('asset packs', () => {
  it('load sprites, textures and icons by id', () => {
    const pack = checkAssets({
      version: 1,
      world: 'game-b2',
      sprites: { oak: { gen: 'plant', kind: 'deciduous' } },
      textures: { moss: { gen: 'texture', kind: 'grass' } },
      icons: { ledger: { gen: 'icon', kind: 'book' } },
    });
    expect(
      pack.ok && [
        ...pack.assets.sprites.keys(),
        ...pack.assets.textures.keys(),
        ...pack.assets.icons.keys(),
      ],
    ).toEqual(['oak', 'moss', 'ledger']);
  });

  it('refuse bad ids, built-in names, duplicates and too many icons', () => {
    const errors = (input: unknown): string => {
      const pack = checkAssets(input);
      return pack.ok ? '' : pack.errors.join('\n');
    };
    expect(errors({ sprites: { Oak: { gen: 'plant', kind: 'bush' } } })).toMatch(/kebab-case/);
    expect(errors({ sprites: { clerk: { gen: 'person' } } })).toMatch(/built-in sprite name/);
    expect(errors({ textures: { concrete: { gen: 'texture', kind: 'rock' } } })).toMatch(
      /built-in texture/,
    );
    const twice = { icons: { coin: { gen: 'icon', kind: 'coin' } } };
    expect(errors([twice, twice])).toMatch(/assets\[1\]\.icons\.coin: "coin" is already defined/);
    const many = Object.fromEntries(
      Array.from({ length: MAX_PACK_ICONS + 1 }, (_, i) => [
        `i${String(i)}`,
        { gen: 'icon', kind: 'gem' },
      ]),
    );
    expect(errors({ icons: many })).toMatch(/at most 24 per view/);
    expect(errors({ sprites: {}, extra: 1 })).toMatch(/assets/);
  });

  it('define one more entry after the fact', () => {
    const pack = checkAssets({});
    if (!pack.ok) throw new Error('empty pack');
    expect(defineOne(pack.assets, 'icons', 'brick', { gen: 'icon', kind: 'brick' })).toEqual([]);
    expect(defineOne(pack.assets, 'icons', 'brick', { gen: 'icon', kind: 'brick' })[0]).toMatch(
      /already defined/,
    );
  });
});
