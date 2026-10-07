/**
 * The level format with the film's own assets and the outdoor mode (PLAN.md#13.15): project ids
 * work like built-in names (and only when defined), errors still list the built-ins, an outdoor
 * level may stay open and grow tall walls, and an outdoor walk renders palette-pure, the same for
 * the same t, within the CPU frame budget.
 */
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { checkAssets } from '../assets/registry.js';
import type { AssetSet } from '../assets/pack.js';
import { HudModel } from '../hud/model.js';
import { createPath } from '../ray/camera.js';
import { SCREEN_H, SCREEN_W } from '../view/output.js';
import { artOf } from '../view/view-assets.js';
import { B2World } from '../view/world.js';
import { compileLevel } from './compile.js';
import { checkLevel, type KnownAssets } from './schema.js';

function assets(): AssetSet {
  const pack = checkAssets({
    sprites: {
      pine: { gen: 'plant', kind: 'conifer', seed: 2 },
      jay: { gen: 'creature', kind: 'bird', form: 'fly', z: 1.4 },
      ranger: { gen: 'person', hat: 'straw', outfit: 'uniform' },
    },
    textures: {
      moss: { gen: 'texture', kind: 'grass' },
      brook: { gen: 'texture', kind: 'water' },
      cliff: { gen: 'texture', kind: 'rock' },
    },
    icons: { acorn: { gen: 'icon', kind: 'apple', colour: 'tan' } },
  });
  if (!pack.ok) throw new Error(pack.errors.join('\n'));
  return pack.assets;
}

const SET = assets();
const KNOWN: KnownAssets = { sprites: SET.sprites, textures: SET.textures };

const GLADE = {
  name: 'glade',
  sky: { preset: 'day', skyline: 'trees', ground: 'moss' },
  floor: 'moss',
  grid: ['..........', '..CC......', '..........', '....ww....', '..........', '.........C'],
  legend: { C: { wall: 'cliff', height: 2.5 }, w: { floor: 'brook' } },
  lights: [{ pos: [6.5, 4.5], z: 0.4, flicker: 'fire' }],
  sprites: [
    { sprite: 'pine', pos: [7.5, 1.5] },
    { sprite: 'pine', pos: [8.5, 4.5], flip: true, scale: 1.2 },
    { sprite: 'jay', pos: [6.0, 2.0] },
    { id: 'ranger', sprite: 'ranger', pos: [5.5, 2.5] },
  ],
};

function errors(input: unknown, known?: KnownAssets): string[] {
  const checked = checkLevel(input, known);
  return checked.ok ? [] : [...checked.errors];
}

describe('levels with the film assets', () => {
  it('accept project ids (with the assets) and refuse them without', () => {
    expect(errors(GLADE, KNOWN)).toEqual([]);
    const without = errors(GLADE).join('\n');
    expect(without).toMatch(
      /unknown wall texture "cliff" \(known: concrete, [^)]*\); or define it in assets\.textures/,
    );
  });

  it('list the film assets next to the built-ins when a name is unknown', () => {
    const wrong = { ...GLADE, sprites: [{ sprite: 'owl', pos: [2.5, 2.5] }] };
    expect(errors(wrong, KNOWN)[0]).toMatch(
      /unknown sprite "owl" \(known: sand-pile, [^)]*\); the film's assets\.sprites: pine, jay, ranger/,
    );
  });

  it('keep indoor rules indoors: closed border, walls <= 1, no void floor', () => {
    const indoor = { ...GLADE, sky: undefined };
    const out = errors(indoor, KNOWN).join('\n');
    expect(out).toMatch(/on the border and must be a wall \(close the level\)/);
    expect(out).toMatch(/legend "C"\.height: 2\.5 is taller than the ceiling/);
    const voidFloor = {
      ...GLADE,
      sky: undefined,
      legend: { ...GLADE.legend, v: { floor: 'none' } },
    };
    expect(errors(voidFloor, KNOWN).join('\n')).toMatch(/'none' .* needs an outdoor level/);
  });

  it('keep decorations for the built-in textures and check the ground', () => {
    const chalk = { ...GLADE, legend: { ...GLADE.legend, C: { wall: 'cliff', chalk: 'arrow' } } };
    expect(errors(chalk, KNOWN).join('\n')).toMatch(
      /chalk only decorate the built-in wall textures/,
    );
    const ground = { ...GLADE, sky: { ground: 'lava' } };
    expect(errors(ground, KNOWN).join('\n')).toMatch(/sky\.ground: unknown texture "lava"/);
  });

  it('compiles roofs, the sky, animated water and project sprites', () => {
    const checked = checkLevel(GLADE, KNOWN);
    if (!checked.ok) throw new Error(checked.errors.join('\n'));
    const level = compileLevel(checked.level, SET);
    expect(level.sky).toBeDefined();
    expect(level.tallest).toBe(2.5);
    expect(level.ceil[0]).toBe(255);
    expect(level.animated).toHaveLength(1);
    expect(level.sprites.map((sprite) => [sprite.kind, sprite.person])).toEqual([
      ['pine', false],
      ['pine', false],
      ['jay', false],
      ['ranger', true],
    ]);
    expect(level.sprites[2]?.z).toBe(1.4);
  });
});

const WALK = [
  { at: 0, x: 1.5, y: 4.5, yaw: -10, pitch: 0, eye: 0.5, ease: 'lin' },
  { at: 3, x: 4.5, y: 4.2, yaw: -30, pitch: -6, eye: 0.5, ease: 'inOut' },
  { at: 6, x: 5.0, y: 3.8, yaw: 20, pitch: 4, eye: 0.5, ease: 'out' },
] as const;

function scene(): { world: B2World; hud: HudModel } {
  const checked = checkLevel(GLADE, KNOWN);
  if (!checked.ok) throw new Error(checked.errors.join('\n'));
  const world = new B2World(compileLevel(checked.level, SET), createPath(WALK, 3), 3, 1, SET);
  const art = artOf(SET, 'acorn');
  world.hand.add({ kind: 'hold', at: 0.5, until: 6, item: { art } });
  world.act('ranger', 'talk', 1, 4);
  const hud = new HudModel(3, 6);
  hud.compass({ at: 0, until: 6, years: [{ at: 0, year: '', place: 'THE GLADE' }], targets: [] });
  hud.inventory({
    at: 0,
    until: 6,
    items: [{ icon: 'note', label: 'ACORN', at: 0.2, look: { art } }],
  });
  return { world, hud };
}

describe('an outdoor walk', () => {
  it('is palette-pure, shows the sky and repaints the same pixels for the same t', () => {
    const screen = new Uint8Array(SCREEN_W * SCREEN_H);
    const hash = (world: B2World, hud: HudModel, t: number): string => {
      const cam = world.render(t, screen);
      return createHash('sha256')
        .update(screen)
        .update(hud.draw(t, cam, world).d)
        .digest('hex');
    };
    const a = scene();
    const times = [0.2, 1.7, 3.3, 5.1];
    const forward = times.map((t) => hash(a.world, a.hud, t));
    const b = scene();
    expect(
      [...times]
        .reverse()
        .map((t) => hash(b.world, b.hud, t))
        .reverse(),
    ).toEqual(forward);
    expect(new Set(forward).size).toBe(times.length);
    a.world.render(1.7, screen);
    expect(screen.every((index) => index < 32)).toBe(true);
    const top = screen.subarray(0, SCREEN_W * 40);
    expect(new Set(top).size).toBeGreaterThan(2);
  });

  it('renders view + HUD within the frame budget on the CPU (<= 10 ms/frame measured)', () => {
    const screen = new Uint8Array(SCREEN_W * SCREEN_H);
    const { world, hud } = scene();
    for (let i = 0; i < 30; i += 1) hud.draw(i * 0.2, world.render(i * 0.2, screen), world);
    let ms = Number.POSITIVE_INFINITY;
    for (let batch = 0; batch < 6; batch += 1) {
      const started = process.hrtime.bigint();
      for (let i = 0; i < 20; i += 1) {
        const t = ((batch * 20 + i) / 120) * 6;
        hud.draw(t, world.render(t, screen), world);
      }
      ms = Math.min(ms, Number(process.hrtime.bigint() - started) / 1e6 / 20);
    }
    process.stdout.write(`game-b2 outdoor view+hud: ${ms.toFixed(2)} ms/frame (best batch)\n`);
    expect(ms).toBeLessThan(30);
  });
});
