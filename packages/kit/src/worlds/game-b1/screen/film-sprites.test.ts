/**
 * The film's own things in the B1 toolkits (PLAN.md#13.15, docs/real-run-game-b1-2.md #1-#2): the
 * console close-up stands on the room's own floor (the interior's, not the showcase's shag) and
 * its cartridge label is blank unless the scene gives one of the film's sprites; FIG. 1 of the
 * manual and the level-select nodes take a sprite id of the film. Unknown ids and ambiguous specs
 * fail with readable errors; defaults draw as before.
 */
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { C } from '../palette.js';
import { planInterior } from '../room/interior.js';
import { interiorSchema } from '../room/interior-schema.js';
import { ScreenModel, SCREEN_W } from './model.js';
import { toolkits } from './toolkits.js';

const at = (when: number | string): number => Number(when);
const hash = (frame: Uint8Array): string => createHash('sha256').update(frame).digest('hex');
const count = (frame: Uint8Array, ink: number) =>
  frame.reduce((n, v) => n + (v === ink ? 1 : 0), 0);

/** A weights machine, crimson so its pixels are easy to find. */
const WEIGHTS = {
  describe: 'a weights machine',
  rows: ['#......#', '########', '#..##..#', '#..##..#', '#.####.#', '#......#', '########'],
  colours: 'crimson',
  size: 2,
  rowH: 4,
};

function setup() {
  const model = new ScreenModel(5, 8, 2);
  model.painters.push((g) => {
    g.bands(0, 160, [[0, 'night']]);
  });
  model.vocab.defineSprite('weightsMachine', WEIGHTS);
  return { model, kit: toolkits(model, at, 8) };
}

/** Inks in a patch of the close-up's floor (left of the console, under the cabinet). */
function floorPatch(frame: Uint8Array): Set<number> {
  const inks = new Set<number>();
  for (let y = 290; y < 350; y += 1)
    for (let x = 0; x < 50; x += 1) inks.add(frame[y * SCREEN_W + x] ?? -1);
  return inks;
}

const INSERT = {
  intent: 'breakfast comes next: the same room, a new game in the slot',
  action: 'insert',
  at: 0,
  enter: 'cut',
  exit: 'cut',
} as const;

describe('console close-up', () => {
  it("stands on the living room's shag without an interior, on the interior's floor with one", () => {
    const plain = setup();
    plain.kit.cartridge(INSERT);
    const shag = floorPatch(plain.model.render(0.5));
    expect(shag.has(C.AVOCADO)).toBe(true);
    const bedroom = setup();
    bedroom.model.interior = planInterior(
      interiorSchema.parse({ shell: 'bedroom' }),
      5,
      [-2, -1],
      'DEC',
    );
    bedroom.kit.cartridge(INSERT);
    const carpet = floorPatch(bedroom.model.render(0.5));
    expect(carpet.has(C.AVOCADO)).toBe(false);
    expect(carpet.has(C.OLIVE_D)).toBe(false);
    expect(carpet.has(C.BLUE)).toBe(true);
  });

  it('prints a blank label by default, the showcase art on request, a film sprite by id', () => {
    const render = (art?: string): Uint8Array => {
      const { model, kit } = setup();
      kit.cartridge(art === undefined ? INSERT : { ...INSERT, art });
      return model.render(0.3).slice();
    };
    const blank = render();
    expect(count(blank, C.GOLD)).toBe(0);
    expect(count(blank, C.CRIMSON)).toBe(0);
    expect(count(render('showcase'), C.GOLD)).toBeGreaterThan(0);
    expect(count(render('weightsMachine'), C.CRIMSON)).toBeGreaterThan(40);
    const { kit } = setup();
    expect(() => kit.cartridge({ ...INSERT, art: 'weightMachine' })).toThrow(
      /no sprite "weightMachine".*Did you mean "weightsMachine"/s,
    );
  });
});

const MANUAL = {
  intent: 'two hours a day on the machines push back against the shrinking',
  at: 0,
  until: 6,
  steps: ['2 HOURS A DAY.', 'A TREADMILL, A BIKE\nAND A WEIGHTS MACHINE.'],
  enter: 'cut',
} as const;

describe('manual FIG. 1', () => {
  it("prints one of the film's sprites, the hit copy in colour", () => {
    const { model, kit } = setup();
    kit.manual({ ...MANUAL, figure: { caption: 'THE MACHINE', sprite: 'weightsMachine' } });
    const plainPage = model.render(1).slice();
    const other = setup();
    other.kit.manual({ ...MANUAL, figure: { caption: 'THE MACHINE', shape: 'box' } });
    expect(hash(plainPage)).not.toBe(hash(other.model.render(1)));
    const hit = setup();
    hit.kit.manual({
      ...MANUAL,
      figure: { caption: 'THE MACHINE', sprite: 'weightsMachine', hit: 1 },
    });
    expect(count(hit.model.render(1), C.TEAL)).toBeGreaterThan(count(plainPage, C.TEAL) + 200);
  });

  it('asks for exactly one of shape and sprite, and a defined sprite', () => {
    const { kit } = setup();
    expect(() => kit.manual({ ...MANUAL, figure: { caption: 'THE MACHINE' } })).toThrow(
      /give sprite/,
    );
    expect(() =>
      kit.manual({
        ...MANUAL,
        figure: { caption: 'THE MACHINE', shape: 'box', sprite: 'weightsMachine' },
      }),
    ).toThrow(/not both/);
    expect(() =>
      kit.manual({ ...MANUAL, figure: { caption: 'THE MACHINE', sprite: 'breakfast' } }),
    ).toThrow(/no sprite "breakfast"/);
  });
});

const SELECT = {
  intent: 'the day is a run of levels: bedtime and breakfast first',
  at: 0,
  until: 3,
  route: { from: 0, to: 1, at: 0.3 },
};

describe('level-select nodes', () => {
  it('show a film sprite for a place; icon nodes stay as they were', () => {
    const { model, kit } = setup();
    kit.levelSelect({
      ...SELECT,
      nodes: [
        { label: 'BEDTIME', icon: 'home', x: 24, y: 118 },
        { label: 'GYM', sprite: 'weightsMachine', x: 80, y: 100 },
        { icon: 'lock', x: 136, y: 70 },
      ],
    });
    expect(count(model.render(2.9), C.CRIMSON)).toBeGreaterThan(40);
  });

  it('asks for exactly one of icon and sprite, and a defined sprite', () => {
    const { kit } = setup();
    const node = (extra: object) => ({
      ...SELECT,
      nodes: [
        { label: 'BEDTIME', icon: 'home', x: 24, y: 118 },
        { label: 'GYM', x: 80, y: 100, ...extra },
      ],
    });
    expect(() => kit.levelSelect(node({}))).toThrow(/nodes\[1\]: give sprite/);
    expect(() => kit.levelSelect(node({ icon: 'store', sprite: 'weightsMachine' }))).toThrow(
      /not both/,
    );
    expect(() => kit.levelSelect(node({ sprite: 'breakfast' }))).toThrow(/no sprite "breakfast"/);
  });
});
