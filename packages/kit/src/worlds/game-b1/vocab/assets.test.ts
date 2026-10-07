/**
 * Project asset files of the Game B1 world and the room DSL (PLAN.md#13.15): a project's
 * `assets/game-b1/*.json` validate together (readable sentences naming the file and the id), the
 * validator knows the project's ids and flags unknown ones a scene uses; interiors keep the
 * world's identity (the TV picture lands in the same glass in every shell) and the calendar zoom
 * still works on an interior's calendar.
 */
import { createHash } from 'node:crypto';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createKit } from '../../../kit.js';
import { testRng } from '../../../testing/rng.js';
import { interiorSchema, SHELLS } from '../room/interior-schema.js';
import { planInterior } from '../room/interior.js';
import { TV_GLASS, VIEWS } from '../room/view.js';
import { B1_TABLE, INKS } from '../palette.js';
import { ScreenModel } from '../screen/model.js';
import { b1SceneRefs, checkB1Assets } from './assets.js';

const FOREST = {
  version: 1,
  world: 'game-b1',
  sprites: { stump: { rows: ['..####..', '########'], colours: ['tan', 'walnut'] } },
  generated: {
    oak: { kind: 'tree', shape: 'round' },
    ranger: { kind: 'person', role: 'ranger' },
    canopy: { kind: 'scenery', type: 'canopy' },
  },
  rooms: { cabin: { shell: 'workshop', props: [{ kind: 'poster', x: 270, sprite: 'oak' }] } },
};

describe('asset files', () => {
  it('validates a project and lists its ids by kind', () => {
    const report = checkB1Assets([{ name: 'assets/game-b1/forest.json', content: FOREST }]);
    expect(report.errors).toEqual([]);
    expect(report.ids).toEqual({
      sprites: ['stump', 'oak', 'ranger'],
      playfields: ['canopy'],
      rooms: ['cabin'],
    });
  });

  it('names the file and the id in every problem, across files', () => {
    const bad = {
      version: 1,
      world: 'game-b1',
      sprites: { oak: { rows: ['#########'], colours: 'green' } },
      generated: { deer: { kind: 'animal', like: 'unicorn' } },
      rooms: { hut: { shell: 'castle' }, den: { props: [{ kind: 'poster', x: 1, sprite: 'nope' }] } },
    };
    const report = checkB1Assets([
      { name: 'assets/game-b1/forest.json', content: FOREST },
      { name: 'assets/game-b1/more.json', content: bad },
      { name: 'assets/game-b1/old.json', content: { version: 2, world: 'game-b1' } },
    ]);
    const text = report.errors.join('\n');
    expect(text).toMatch(/more\.json: sprite "oak" row 0 is 9 bits wide/);
    expect(text).toMatch(/more\.json: sprite "oak" colours: "green" is not a game-b1 ink.*try avocado/);
    expect(text).toMatch(/more\.json: "oak" is already defined in assets\/game-b1\/forest\.json/);
    expect(text).toMatch(/more\.json: generated "deer": like/);
    expect(text).toMatch(/more\.json: room "hut": shell/);
    expect(text).toMatch(/more\.json: room "den": poster sprite "nope" is not defined/);
    expect(text).toMatch(/old\.json: version/);
  }); // prettier-ignore

  it('knows the project ids: a scene using an unknown one gets a did-you-mean', () => {
    const source = `screen.generate('crow', { kind: 'bird' });
      screen.tv((g) => { g.draw('rangr', 1, 2); g.draw('crow', 0, 0); g.field("canopy", 60); });
      screen.interior('cabin');`;
    const refs = b1SceneRefs(source);
    expect(refs.defines).toEqual(['crow']);
    expect(refs.uses).toEqual({
      sprites: ['rangr', 'crow'],
      playfields: ['canopy'],
      rooms: ['cabin'],
    });
    const report = checkB1Assets([{ name: 'forest.json', content: FOREST }], {
      used: refs.uses,
      known: { sprites: refs.defines },
    });
    expect(report.errors).toEqual([
      'unknown sprite "rangr" (did you mean "ranger"?): define it in assets/game-b1/*.json or in the scene',
    ]);
  });
});

const hash = (frame: Uint8Array): string => createHash('sha256').update(frame).digest('hex');

function roomFrame(shell: (typeof SHELLS)[number], t: number): Uint8Array {
  const m = new ScreenModel(7, 6, 2);
  m.painters.push((g) => {
    g.bands(0, 160, [
      [0, 'night'],
      [90, 'teal'],
    ]);
  });
  const spec = interiorSchema.parse({ shell, calendar: { month: 'MAY', year: 1999, mark: 4 } });
  m.interior = planInterior(spec, 7, [-2, -1], 'MAY');
  m.room = { calendar: { month: 'MAY', mark: 4, ring: [-2, -1] }, tree: false, presents: false, gift: undefined, lamp: false, carts: 0 }; // prettier-ignore
  return m.render(t).slice();
}

describe('room DSL', () => {
  it('paints every shell deterministically in the 23 inks with the TV glass in the same place', () => {
    const glass = (frame: Uint8Array) => {
      const rows: number[] = [];
      const [x0, y0] = [TV_GLASS.x * 2 + 4, TV_GLASS.y * 2 + 4];
      for (let y = y0; y < y0 + TV_GLASS.h * 2 - 8; y += 1)
        for (let x = x0; x < x0 + TV_GLASS.w * 2 - 8; x += 1) rows.push(frame[y * 640 + x] ?? 0);
      return hash(Uint8Array.from(rows));
    };
    const glasses = new Set<string>();
    const rooms = new Set<string>();
    for (const shell of SHELLS) {
      const a = roomFrame(shell, 1.3);
      expect(hash(roomFrame(shell, 1.3)), shell).toBe(hash(a));
      for (const index of new Set(a)) expect(index, shell).toBeLessThan(INKS);
      glasses.add(glass(a));
      rooms.add(hash(a));
    }
    expect(glasses.size).toBe(1);
    expect(rooms.size).toBe(SHELLS.length);
    expect(INKS).toBe(B1_TABLE.length);
  });

  it('builds through the screen: interior by id from an asset file, the calendar zoom on it', () => {
    const kit = createKit({ three: THREE, palette: {}, rng: testRng(5), style: 'game-b1' });
    type Api = Record<string, ((...args: unknown[]) => unknown) | undefined>;
    const fx = kit.api.fx as unknown as Api;
    const make = () => fx['b1Screen']?.({ duration: 4 }) as Api;
    const screen = make();
    screen['assets']?.({ ...FOREST, rooms: { cabin: { shell: 'garage', calendar: { month: 'JUN', year: 2003 } } } });
    screen['interior']?.('cabin');
    expect(() => screen['interior']?.({ shell: 'office' })).toThrow(/already set/);
    expect(screen['calendarZoom']?.({ intent: 'the next summer, the forest is gone', at: 1 })).toMatchObject({ at: 1 });
    expect(() => make()['interior']?.({ props: [{ kind: 'poster', x: 1, sprite: 'ghost' }] })).toThrow(/poster sprite "ghost"/);
    expect(() => make()['interior']?.({ wallColours: ['green'] })).toThrow(/try avocado/);
    expect(VIEWS.room.inTv).toBe(0);
  }); // prettier-ignore
});
