/**
 * Tools (each with a grip, so a person can hold it: `person({ holds: 'axe' })`) and instruments
 * of the open vocabulary (PLAN.md#13.15a): small crude drawings with one strong silhouette and
 * one crayon colour (`color`).
 */
import { fill, thin } from './draft.js';
import { arcFlat, family, starFlat } from './family.js';
import { makers, type Item } from './objects.js';

const TOOLS: Readonly<Record<string, Item>> = {
  axe: (d, c) =>
    d
      .sharp([30, 140, 32, 16], { width: 3, color: 'coffee' })
      .poly([32, 18, 58, 8, 62, 44, 32, 38], fill(c('graphiteLight')))
      .done([70, 140], [31, 120]),
  hammer: (d, c) =>
    d
      .sharp([34, 120, 34, 22], { width: 3, color: 'coffee' })
      .rect(12, 8, 48, 18, fill(c('graphite'), 'light'))
      .done([70, 120], [34, 104]),
  shovel: (d, c) =>
    d
      .sharp([30, 4, 30, 100], { width: 3, color: 'coffee' })
      .sharp([20, 6, 40, 6], { width: 3 })
      .poly([16, 100, 44, 100, 42, 130, 30, 142, 18, 130], fill(c('graphiteLight')))
      .done([60, 142], [30, 30]),
  saw: (d, c) =>
    d
      .poly([30, 20, 130, 30, 130, 44, 30, 52], fill(c('graphiteLight'), 'light'))
      .zigzag(32, 54, 130, 46, 14, 5, thin)
      .blob(18, 38, 14, 18, { ...fill('coffee'), lumps: 0.05 })
      .done([136, 60], [18, 38]),
  pickaxe: (d, c) =>
    d
      .sharp([40, 130, 42, 20], { width: 3, color: 'coffee' })
      .line([6, 40, 30, 22, 54, 18, 80, 30], { width: 4, color: c('graphite') })
      .done([86, 130], [41, 110]),
  rope: (d, c) => {
    for (let i = 0; i < 3; i += 1)
      d.blob(40 + d.r(-3, 3), 40 + i * 4, 30 - i * 3, 14, {
        color: c('kraftDark'),
        width: 2,
        lumps: 0.08,
      });
    return d
      .line([62, 52, 80, 72, 74, 92], { color: c('kraftDark'), width: 2 })
      .done([90, 96], [40, 40]);
  },
  ladder: (d, c) => {
    d.sharp([14, 4, 10, 160], { width: 3, color: c('kraftDark') }).sharp([56, 4, 60, 160], {
      width: 3,
      color: c('kraftDark'),
    });
    for (let y = 20; y < 160; y += 24) d.sharp([12, y, 58, y + d.r(-2, 2)], { width: 2 });
    return d.done([70, 160]);
  },
  wrench: (d, c) =>
    d
      .sharp([30, 120, 34, 30], { width: 5, color: c('graphite') })
      .arc(34, 20, 14, 130, 410, { width: 3 })
      .done([60, 124], [31, 100]),
  torch: (d, c) =>
    d
      .sharp([30, 110, 32, 40], { width: 4, color: 'coffee' })
      .blob(32, 30, 14, 20, { ...fill(c('orange'), 'dense'), lumps: 0.35 })
      .blob(32, 32, 6, 10, { ...fill('sticky', 'dense'), lumps: 0.3, outline: false })
      .done([60, 110], [31, 90]),
  rod: (d, c) =>
    d
      .sharp([10, 140, 90, 10], { width: 2, color: c('coffee') })
      .circle(24, 118, 6, {})
      .line([90, 10, 104, 60, 100, 110], { nib: 'fine' })
      .arc(96, 112, 5, 0, 200, thin)
      .done([110, 140], [18, 126]),
  sword: (d, c) =>
    d
      .poly([28, 100, 28, 10, 34, 0, 40, 10, 40, 100], fill(c('graphiteLight'), 'light'))
      .sharp([12, 100, 56, 100], { width: 4 })
      .sharp([34, 102, 34, 130], { width: 4, color: 'coffee' })
      .done([68, 132], [34, 118]),
  spear: (d, c) =>
    d
      .sharp([30, 170, 30, 30], { width: 2, color: 'coffee' })
      .poly([30, 0, 40, 30, 30, 36, 20, 30], fill(c('graphite'), 'light'))
      .done([60, 170], [30, 120]),
  shield: (d, c) =>
    d
      .poly([10, 10, 80, 10, 80, 50, 45, 100, 10, 50], fill(c('margin')))
      .sharp([45, 14, 45, 90], { width: 3 })
      .sharp([14, 40, 76, 40], { width: 3 })
      .done([90, 104], [45, 50]),
  bow: (d) =>
    d
      .arc(10, 70, 66, -70, 70, { width: 3, color: 'coffee' })
      .sharp([33, 8, 33, 132], thin)
      .done([80, 140], [72, 70]),
  broom: (d, c) =>
    d
      .sharp([30, 4, 32, 110], { width: 3, color: 'coffee' })
      .poly([20, 110, 44, 110, 56, 150, 8, 150], fill(c('sticky'), 'scribble'))
      .done([64, 150], [31, 40]),
  pitchfork: (d) =>
    d
      .sharp([40, 150, 40, 40], { width: 3, color: 'coffee' })
      .sharp([20, 4, 20, 40, 60, 40, 60, 4], { width: 2 })
      .sharp([40, 40, 40, 6], { width: 2 })
      .done([80, 150], [40, 120]),
};

const INSTRUMENTS: Readonly<Record<string, Item>> = {
  telescope: (d, c) =>
    d
      .poly([20, 40, 120, 10, 124, 26, 24, 56], fill(c('sticky')))
      .rect(4, 42, 18, 12, {})
      .sharp([70, 36, 46, 120], {})
      .sharp([70, 36, 70, 120], {})
      .sharp([70, 36, 96, 120], {})
      .done([130, 120]),
  microscope: (d, c) =>
    d
      .rect(14, 110, 70, 10, fill(c('graphiteLight')))
      .line([70, 110, 80, 60, 60, 20], { width: 4 })
      .poly([34, 4, 52, 0, 64, 64, 46, 68], fill(c('paper')))
      .sharp([30, 80, 84, 80], { width: 3 })
      .done([96, 120]),
  compass: (d, c) =>
    d
      .circle(40, 40, 34, fill(c('paper')))
      .poly([40, 12, 47, 40, 40, 68, 33, 40], {})
      .hatch([40, 12, 47, 40, 33, 40], 'margin', { shade: 'dense' })
      .dots([40, 40], 4)
      .done([80, 80]),
  thermometer: (d, c) =>
    d
      .poly([22, 100, 22, 10, ...arcFlat(30, 10, 8, 8, 180, 360, 4), 38, 100], {})
      .circle(30, 110, 12, fill(c('margin'), 'dense'))
      .hatch([25, 104, 35, 104, 35, 50, 25, 50], c('margin'), { shade: 'dense' })
      .sharp([40, 30, 46, 30], thin)
      .sharp([40, 50, 46, 50], thin)
      .sharp([40, 70, 46, 70], thin)
      .done([60, 124]),
  magnifier: (d, c) =>
    d
      .circle(40, 40, 30, fill(c('skyPencil'), 'light'))
      .sharp([62, 62, 100, 100], { width: 5, color: 'coffee' })
      .done([104, 104], [86, 86]),
  hourglass: (d, c) =>
    d
      .sharp([10, 6, 90, 6], { width: 3 })
      .sharp([10, 120, 90, 120], { width: 3 })
      .poly([20, 8, 80, 8, 52, 62, 80, 118, 20, 118, 48, 62], {})
      .hatch([30, 116, 70, 116, 50, 92], c('kraft'), { shade: 'dense' })
      .hatch([34, 24, 66, 24, 50, 54], c('kraft'), { shade: 'dense' })
      .done([100, 126]),
  balance: (d, c) =>
    d
      .sharp([70, 20, 70, 120], { width: 3 })
      .rect(50, 120, 40, 8, {})
      .sharp([14, 30, 126, 22], { width: 2 })
      .arc(14, 60, 18, 0, 180, fill(c('sticky')))
      .arc(126, 52, 18, 0, 180, fill(c('sticky')))
      .sharp([14, 30, 0, 60], thin)
      .sharp([14, 30, 30, 60], thin)
      .sharp([126, 22, 110, 52], thin)
      .sharp([126, 22, 142, 52], thin)
      .done([144, 130]),
  battery: (d, c, k) => {
    const level = (k.count ?? 3) / 4;
    d.rect(6, 14, 90, 44, {}).rect(96, 26, 8, 20, fill('ink', 'dense'));
    return d
      .hatch([10, 18, 10 + 82 * level, 18, 10 + 82 * level, 54, 10, 54], c('green'), {
        shade: 'dense',
      })
      .done([110, 70]);
  },
  antenna: (d) =>
    d
      .sharp([40, 120, 40, 30], { width: 3 })
      .sharp([20, 120, 40, 60, 60, 120], {})
      .arc(40, 28, 14, 200, 340, {})
      .arc(40, 28, 26, 210, 330, {})
      .arc(40, 28, 38, 220, 320, thin)
      .done([80, 120]),
  panel: (d, c) => {
    d.poly([10, 50, 40, 10, 130, 10, 100, 50], fill(c('bic'), 'light'));
    for (const k of [0.33, 0.66])
      d.sharp(
        [10 + 30 * (1 - k) + 0, 50 - 40 * (1 - k), 100 + 30 * (1 - k), 50 - 40 * (1 - k)],
        thin,
      );
    return d
      .sharp([70, 10, 40, 50], thin)
      .sharp([100, 10, 70, 50], thin)
      .sharp([70, 30, 70, 90], { width: 3 })
      .done([140, 90]);
  },
  flask: (d, c) =>
    d
      .poly([34, 6, 50, 6, 50, 40, 80, 100, 4, 100, 34, 40], {})
      .hatch([16, 76, 68, 76, 78, 98, 6, 98], c('green'), { shade: 'dense' })
      .dots([36, 66, 48, 58, 42, 50], 3, thin)
      .done([84, 104]),
  gauge: (d, c) =>
    d
      .arc(60, 70, 54, 180, 360, { width: 2 })
      .sharp([6, 70, 114, 70], {})
      .rays(60, 70, 44, 54, 7, { from: 180, to: 360 })
      .sharp([60, 70, 92, 32], { nib: 'red', width: 2 })
      .dots([60, 70], 5, { color: c('ink') })
      .done([120, 76]),
  binoculars: (d, c) =>
    d
      .circle(26, 50, 18, fill(c('graphite'), 'light'))
      .circle(70, 50, 18, fill(c('graphite'), 'light'))
      .rect(18, 10, 16, 30, {})
      .rect(62, 10, 16, 30, {})
      .sharp([34, 22, 62, 22], { width: 3 })
      .done([96, 70]),
  camera: (d, c) =>
    d
      .rect(6, 20, 100, 60, fill(c('graphiteLight'), 'light'))
      .circle(56, 50, 20, fill('ink', 'light'))
      .rect(14, 10, 24, 10, {})
      .done([112, 82]),
  radio: (d, c) => {
    d.rect(6, 30, 110, 60, fill(c('margin'), 'light'))
      .circle(40, 60, 18, {})
      .sharp([90, 30, 112, 4], {});
    for (let i = 0; i < 3; i += 1) d.sharp([70, 46 + i * 10, 104, 46 + i * 10], thin);
    return d.done([120, 90]);
  },
  gear: (d, c) =>
    d
      .poly(starFlat(40, 40, 30, 38, 8, 0), fill(c('graphiteLight')))
      .circle(40, 40, 10, {})
      .done([80, 80]),
  dish: (d, c) =>
    d
      .arc(50, 20, 40, 20, 160, { width: 2, ...fill(c('paper')) })
      .sharp([50, 60, 50, 110], { width: 3 })
      .sharp([50, 20, 50, 58], thin)
      .dots([50, 18], 4)
      .done([100, 110]),
};

export const TOOL_FAMILIES = [
  family({
    kind: 'tool',
    group: 'tool',
    summary: Object.keys(TOOLS).join(', '),
    types: makers(TOOLS),
    height: 110,
    heights: { ladder: 170, rope: 60, shield: 80, saw: 50 },
  }),
  family({
    kind: 'instrument',
    group: 'instrument',
    summary: `${Object.keys(INSTRUMENTS).join(', ')} (battery: count 0-4 = charge)`,
    types: makers(INSTRUMENTS),
    height: 80,
    heights: {
      telescope: 110,
      microscope: 110,
      thermometer: 100,
      balance: 110,
      antenna: 120,
      dish: 100,
      battery: 40,
      binoculars: 50,
      gauge: 60,
      gear: 60,
    },
  }),
];
