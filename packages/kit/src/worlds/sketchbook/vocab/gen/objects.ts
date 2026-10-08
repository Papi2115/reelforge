/**
 * Things of the open vocabulary (PLAN.md#13.15a): everyday objects, tools (each with a grip, so
 * a person can hold it: `person({ holds: 'axe' })`) and instruments. Small crude drawings with
 * one strong silhouette and one crayon colour (`color`).
 */
import type { SwatchName } from '../../inks.js';
import { Draft, fill, pale, thin } from './draft.js';
import { arcFlat, family, leafPts, type Knobs, type Maker } from './family.js';

export type Item = (
  d: Draft,
  c: (fallback: SwatchName) => SwatchName,
  k: Knobs,
) => ReturnType<Maker>;

const OBJECTS: Readonly<Record<string, Item>> = {
  crate: (d, c) =>
    d
      .rect(10, 30, 70, 56, fill(c('kraft')))
      .poly([10, 30, 30, 14, 96, 14, 80, 30], fill(c('kraft'), 'light'))
      .poly([80, 30, 96, 14, 96, 70, 80, 86], {})
      .sharp([10, 58, 80, 58], pale)
      .done([100, 86]),
  barrel: (d, c) =>
    d
      .poly([16, 6, 64, 6, 74, 50, 64, 94, 16, 94, 6, 50], fill(c('kraftDark'), 'light'))
      .arc(40, 6, 24, 0, 180, thin)
      .sharp([10, 30, 70, 30], {})
      .sharp([10, 72, 70, 72], {})
      .done([80, 96]),
  book: (d, c) =>
    d
      .poly([10, 20, 70, 14, 74, 80, 14, 86], fill(c('margin')))
      .sharp([14, 86, 18, 92, 78, 86, 74, 80], {})
      .sharp([22, 20, 24, 84], thin)
      .done([84, 96]),
  lamp: (d, c) =>
    d
      .rect(20, 92, 50, 8, {})
      .sharp([44, 92, 30, 50, 60, 30], { width: 2 })
      .poly([52, 18, 82, 30, 74, 52, 46, 36], fill(c('sticky')))
      .rays(76, 50, 8, 26, 4, { from: 60, to: 140, nib: 'pencil' })
      .done([100, 100]),
  lantern: (d, c) =>
    d
      .arc(30, 14, 10, 180, 360, {})
      .rect(14, 18, 32, 8, {})
      .rect(16, 26, 28, 40, fill(c('sticky'), 'light'))
      .blob(30, 50, 5, 9, { ...fill('orange', 'dense'), lumps: 0.2 })
      .rect(12, 66, 36, 8, {})
      .done([60, 76], [30, 6]),
  clock: (d, c) =>
    d
      .circle(40, 40, 34, fill(c('paper')))
      .sharp([40, 40, 40, 16], { width: 2 })
      .sharp([40, 40, 58, 46], {})
      .dots([40, 10, 70, 40, 40, 70, 10, 40], 3)
      .done([80, 80]),
  phone: (d, c) =>
    d
      .rect(14, 4, 40, 76, fill(c('graphiteLight'), 'light'))
      .rect(18, 12, 32, 54, fill('skyPencil', 'light'))
      .dots([34, 72], 3)
      .done([68, 84], [34, 60]),
  laptop: (d, c) =>
    d
      .rect(20, 6, 80, 54, fill(c('graphiteLight'), 'light'))
      .rect(26, 12, 68, 42, fill('skyPencil', 'light'))
      .poly([10, 70, 20, 60, 100, 60, 112, 70], {})
      .done([120, 72]),
  key: (d) =>
    d
      .circle(16, 30, 12, {})
      .sharp([28, 30, 88, 30], { width: 2 })
      .sharp([76, 30, 76, 42], {})
      .sharp([86, 30, 86, 40], {})
      .done([96, 50], [16, 30]),
  sack: (d, c) =>
    d
      .blob(40, 56, 32, 34, { ...fill(c('kraft')), lumps: 0.18 })
      .zigzag(28, 22, 52, 22, 4, 6)
      .sharp([30, 16, 40, 22, 52, 14], {})
      .done([80, 92], [40, 16]),
  bottle: (d, c) =>
    d
      .poly(
        [30, 6, 42, 6, 42, 26, 56, 40, 56, 100, 16, 100, 16, 40, 30, 26],
        fill(c('green'), 'light'),
      )
      .rect(18, 56, 36, 22, fill('paper'))
      .done([72, 100], [36, 60]),
  cup: (d, c) =>
    d
      .poly([14, 20, 60, 20, 56, 76, 18, 76], fill(c('margin')))
      .arc(60, 46, 14, -80, 80, { width: 2 })
      .done([84, 80]),
  apple: (d, c) =>
    d
      .blob(36, 46, 30, 28, { ...fill(c('margin')), lumps: 0.1 })
      .line([36, 22, 38, 8], {})
      .poly(leafPts(48, 12, 18, 8, -20), fill('green'))
      .done([72, 76]),
  coins: (d, c, k) => {
    const count = k.count ?? 4;
    for (let i = 0; i < count; i += 1)
      d.blob(40 + d.r(-3, 3), 80 - i * 9, 30, 8, { ...fill(c('sticky'), 'dense'), lumps: 0.03 });
    return d.done([80, 90]);
  },
  cash: (d, c) =>
    d
      .rect(6, 10, 100, 50, fill(c('green'), 'light'))
      .circle(56, 35, 12, {})
      .sharp([12, 16, 100, 16], pale)
      .done([112, 70]),
  flag: (d, c) =>
    d
      .sharp([10, 4, 12, 120], { width: 2 })
      .poly([12, 8, 40, 2, 66, 12, 92, 6, 90, 50, 64, 56, 38, 46, 12, 52], fill(c('margin')))
      .done([100, 120], [11, 100]),
  sign: (d, c) =>
    d
      .sharp([46, 40, 46, 120], { width: 3 })
      .rect(6, 8, 84, 40, fill(c('kraft'), 'light'))
      .done([96, 120]),
  chest: (d, c) =>
    d
      .rect(10, 40, 90, 50, fill(c('kraftDark')))
      .poly(
        [10, 40, ...arcFlat(55, 40, 45, 26, 180, 360, 6), 100, 40],
        fill(c('kraftDark'), 'light'),
      )
      .rect(48, 34, 14, 16, fill('sticky', 'dense'))
      .done([110, 90]),
  candle: (d, c) =>
    d
      .rect(20, 30, 20, 60, fill(c('paper')))
      .blob(30, 18, 5, 10, { ...fill('orange', 'dense'), lumps: 0.2 })
      .line([22, 30, 20, 44], thin)
      .done([60, 92]),
  chair: (d, c) =>
    d
      .sharp([20, 4, 20, 90], { width: 2 })
      .sharp([20, 50, 70, 50, 70, 90], { width: 2 })
      .hatch([20, 44, 72, 44, 72, 52, 20, 52], c('kraftDark'))
      .done([80, 90]),
  table: (d, c) =>
    d
      .rect(4, 20, 132, 10, fill(c('kraftDark')))
      .sharp([16, 30, 14, 90], { width: 3 })
      .sharp([124, 30, 126, 90], { width: 3 })
      .done([140, 90]),
  bed: (d, c) =>
    d
      .sharp([6, 20, 6, 80], { width: 3 })
      .sharp([154, 40, 154, 80], { width: 3 })
      .rect(6, 46, 148, 18, fill(c('skyPencil'), 'light'))
      .blob(28, 38, 18, 8, { lumps: 0.1 })
      .done([160, 80]),
  door: (d, c) =>
    d
      .rect(10, 6, 60, 120, fill(c('kraftDark'), 'light'))
      .dots([58, 70], 4)
      .rect(20, 18, 40, 40, thin)
      .done([80, 126]),
  window: (d, c) =>
    d
      .rect(10, 10, 80, 70, fill(c('skyPencil'), 'light'))
      .sharp([50, 10, 50, 80], {})
      .sharp([10, 45, 90, 45], {})
      .line([6, 6, 18, 40, 4, 84], { color: 'margin' })
      .done([100, 90]),
  bucket: (d, c) =>
    d
      .poly([14, 30, 76, 30, 68, 90, 22, 90], fill(c('graphiteLight'), 'light'))
      .arc(45, 30, 30, 180, 360, {})
      .done([90, 90], [45, 2]),
  scroll: (d, c) =>
    d
      .rect(14, 10, 70, 90, fill(c('paper')))
      .blob(14, 55, 8, 46, { lumps: 0.05 })
      .blob(84, 55, 8, 46, { lumps: 0.05 })
      .sharp([26, 30, 72, 30], pale)
      .sharp([26, 46, 66, 46], pale)
      .sharp([26, 62, 70, 62], pale)
      .done([96, 110]),
  letter: (d, c) =>
    d
      .rect(6, 10, 100, 64, fill(c('paper')))
      .sharp([6, 10, 56, 48, 106, 10], {})
      .done([112, 80]),
  basket: (d, c) =>
    d
      .poly([10, 40, 90, 40, 80, 90, 20, 90], fill(c('kraft'), 'scribble'))
      .arc(50, 40, 34, 180, 360, { width: 2 })
      .done([100, 90], [50, 6]),
  pot: (d, c) =>
    d
      .blob(50, 50, 40, 30, { ...fill(c('ink'), 'light'), lumps: 0.05 })
      .sharp([8, 22, 92, 22], { width: 3 })
      .sharp([24, 76, 18, 90], {})
      .sharp([76, 76, 82, 90], {})
      .done([100, 90]),
  map: (d, c) =>
    d
      .poly(
        [6, 10, 40, 4, 74, 12, 108, 6, 108, 80, 74, 86, 40, 78, 6, 84],
        fill(c('kraft'), 'light'),
      )
      .sharp([40, 4, 40, 78], pale)
      .sharp([74, 12, 74, 86], pale)
      .line([16, 66, 40, 50, 62, 58, 84, 34], { nib: 'pencil' })
      .sharp([80, 28, 92, 40], { nib: 'red' })
      .sharp([92, 28, 80, 40], { nib: 'red' })
      .done([114, 90], [20, 80]),
  crown: (d, c) =>
    d
      .poly([6, 60, 4, 14, 26, 38, 44, 6, 62, 38, 84, 14, 82, 60], fill(c('sticky'), 'dense'))
      .dots([44, 50], 5, { color: 'margin' })
      .done([88, 64]),
};

export const makers = (items: Readonly<Record<string, Item>>): Record<string, Maker> =>
  Object.fromEntries(
    Object.entries(items).map(([name, item]) => [
      name,
      (d: Draft, k: Knobs) => item(d, (fallback) => k.color ?? fallback, k),
    ]),
  );

export const OBJECT_FAMILIES = [
  family({
    kind: 'object',
    group: 'object',
    summary: `${Object.keys(OBJECTS).join(', ')} (coins: count)`,
    types: makers(OBJECTS),
    height: 70,
    heights: {
      key: 30,
      cup: 40,
      apple: 40,
      cash: 40,
      crown: 40,
      phone: 50,
      candle: 50,
      letter: 50,
      bucket: 55,
      flag: 110,
      sign: 100,
      door: 130,
      chair: 90,
      lamp: 90,
      window: 90,
    },
  }),
];
