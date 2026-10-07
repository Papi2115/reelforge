/**
 * Built-in example levels of the Game B2 world, ported from the approved showcase's map
 * (docs/worlds/game-hud-b2-rpg-v2/js/world.js): `office` = the damp corridor with one bulb, a
 * door, and the 1980s office behind it; `warehouse` = racking in fluorescent fog either side of a
 * painted line, one faulty tube. `stencil` fills their labels (carton stencils, the aisle sign)
 * with a real word of the film; without it the cartons are blank. Scenes pick one with
 * `kit.fx.b2View({ level: 'warehouse', stencil: 'E.T.' })` or write their own level object.
 */
import type { LevelInput } from './schema.js';

export const BUILT_IN_LEVELS = ['office', 'warehouse'] as const;
export type BuiltInLevel = (typeof BUILT_IN_LEVELS)[number];

/** Corridor (x 1-12, y 6, alcove at x 5-6) -> door (13, 6) -> office (x 14-21, y 2-10). */
function office(stencil: string | undefined): LevelInput {
  return {
    name: 'office',
    mood: 'dark',
    floor: 'concrete',
    ceiling: 'dark',
    grid: [
      '#############WWWWWWWWWWW',
      '#############WWWWWKWWWWW',
      '#############WooooooooWW',
      '#############WooooooooWW',
      '#############WouLoooooWW',
      '#########T###WooooooLoPW',
      '#..........,.DooooooooDW',
      '#####..######WoooooLooWW',
      '#############WouuuooooWW',
      '#############WooooooooWW',
      '#############WooooooooWW',
      '#############WWWWWWWWWWW',
    ],
    legend: {
      '#': { wall: 'concrete' },
      T: { wall: 'concrete', chalk: 'tally', count: 5 },
      W: { wall: 'wood-panel' },
      K: { wall: 'wood-panel', pinned: 'calendar', crossed: 23 },
      P: { wall: 'wood-panel', pinned: 'poster' },
      u: { wall: 'cubicle' },
      D: { door: true },
      ',': { floor: 'concrete-sand' },
      o: { floor: 'carpet', ceiling: 'office', mood: 'tungsten' },
      L: { floor: 'carpet', ceiling: 'office-light', mood: 'tungsten' },
    },
    lights: [
      {
        id: 'bulb',
        pos: [11.0, 6.45],
        z: 0.68,
        power: 1.7,
        radius: 1.45,
        flicker: 'bulb',
        bulb: true,
      },
      { pos: [16.5, 4.5], power: 0.8, radius: 4.2 },
      { pos: [19.5, 7.5], power: 0.7, radius: 4.2 },
      { pos: [20.5, 5.5], power: 0.6, radius: 3.6 },
      { id: 'desk-lamp', pos: [20.6, 2.1], z: 0.5, power: 0.4, radius: 1.4 },
    ],
    sprites: [
      { id: 'clue', sprite: 'sand-pile', pos: [11.05, 6.8], band: 'pink', label: stencil },
      { id: 'worker', sprite: 'desk', pos: [20.6, 2.3], person: true },
    ],
  };
}

/** Warehouse (x 2-18, y 1-15): racks at y 5-6 and 10-11 from x 4 to 14, doors at (1, 8) and (19, 8). */
function warehouse(stencil: string | undefined): LevelInput {
  const label = stencil === undefined ? {} : { label: stencil };
  return {
    name: 'warehouse',
    mood: 'fluorescent',
    floor: 'warehouse',
    ceiling: 'warehouse',
    grid: [
      '#####################',
      '##.................##',
      '##.................##',
      '##.................##',
      '##.................##',
      '##..EsssssssssE....##',
      '##..EsssssssssE....##',
      '##.................##',
      '#D----t---f---t--t-D#',
      '##.................##',
      '##..SsssssssssE....##',
      '##..EsssssssssE....##',
      '##.................##',
      '##.................##',
      '##.................##',
      '##.................##',
      '#####################',
    ],
    legend: {
      '#': { wall: 'corrugated' },
      D: { door: true },
      s: { wall: 'shelf', ...label },
      E: { wall: 'shelf-end' },
      S: { wall: 'shelf-end', ...label },
      '-': { floor: 'warehouse-line' },
      t: { floor: 'warehouse-line', ceiling: 'warehouse-tube' },
      f: { floor: 'warehouse-line', ceiling: 'warehouse-tube', flicker: true },
    },
    lights: [
      { pos: [6.5, 8.5], power: 0.95, radius: 3.6 },
      { id: 'faulty-tube', pos: [10.5, 8.5], power: 0.95, radius: 3.6, flicker: 'tube' },
      { pos: [14.5, 8.5], power: 0.95, radius: 3.6 },
      { pos: [17.5, 8.5], power: 0.9, radius: 3.4 },
    ],
    sprites: [
      { id: 'fallen', sprite: 'carton', pos: [9.4, 7.45], label: stencil },
      { id: 'pallet', sprite: 'pallet', pos: [17.4, 10.4], label: stencil },
    ],
  };
}

/** True for the name of a built-in (showcase) level. */
export function isBuiltInLevel(name: string): name is BuiltInLevel {
  return (BUILT_IN_LEVELS as readonly string[]).includes(name);
}

export function builtInLevel(name: BuiltInLevel, stencil?: string): LevelInput {
  return name === 'office' ? office(stencil) : warehouse(stencil);
}
