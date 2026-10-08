/**
 * Buildings and vehicles of the open vocabulary (PLAN.md#13.15a): from a hut to a skyscraper,
 * a castle to a pyramid; from a cart to a space station. Wobbly rectangles, roofs that miss their
 * corners, wheels that are lumpy loops; one crayon colour each (`color`).
 */
import type { SwatchName } from '../../inks.js';
import { Draft, fill, pale, thin } from './draft.js';
import { arcFlat, family, type Maker } from './family.js';

const window_ = (d: Draft, x: number, y: number, w: number, h: number): void => {
  d.rect(x, y, w, h, fill('skyPencil', 'light'));
  d.sharp([x + w / 2, y, x + w / 2 + 1, y + h], thin);
};

const crenels = (x: number, y: number, w: number, teeth: number): number[] => {
  const pts: number[] = [];
  const step = w / (teeth * 2 - 1);
  for (let i = 0; i < teeth * 2 - 1; i += 1) {
    const up = i % 2 === 0;
    pts.push(x + i * step, up ? y - 8 : y, x + (i + 1) * step, up ? y - 8 : y);
  }
  return pts;
};

const building: Maker = (d, k) => {
  const c = (fallback: SwatchName): SwatchName => k.color ?? fallback;
  switch (k.type) {
    case 'hut':
      d.rect(22, 72, 76, 48, fill(c('kraft'), 'light'));
      d.poly([8, 76, 60, 12 + d.r(-4, 4), 112, 76], fill('sticky', 'scribble'));
      d.poly(arcFlat(60, 120, 12, 26, 180, 360, 5), fill('kraftDark'));
      return d.done([120, 120]);
    case 'castle':
      d.poly(
        [30, 120, 30, 50, ...crenels(30, 50, 60, 3), 90, 50, 90, 120],
        fill(c('graphiteLight'), 'light'),
      );
      for (const x of [4, 90])
        d.poly(
          [x, 120, x, 30, ...crenels(x, 30, 26, 2), x + 26, 30, x + 26, 120],
          fill(c('graphiteLight'), 'light'),
        );
      d.poly(
        [48, 120, ...arcFlat(60, 96, 12, 14, 180, 360, 5), 72, 120],
        fill('kraftDark', 'dense'),
      );
      d.sharp([102, 22, 102, 2, 116, 7, 102, 12], { color: 'margin' });
      for (const x of [14, 100]) d.sharp([x, 50, x, 62], { width: 3 });
      return d.done([120, 120]);
    case 'tower':
      d.poly(
        [10, 160, 10, 26, ...crenels(10, 26, 40, 3), 50, 26, 50, 160],
        fill(c('graphiteLight'), 'light'),
      );
      for (const y of [56, 96]) d.sharp([30, y, 30, y + 14], { width: 3 });
      return d.done([60, 160]);
    case 'church':
      d.rect(40, 70, 70, 60, fill(c('paper')));
      d.poly([36, 72, 75, 40, 114, 72], fill('margin'));
      d.rect(10, 50, 30, 80, fill(c('paper')));
      d.poly([6, 52, 25, 6, 44, 52], fill('graphiteLight'));
      d.sharp([25, 6, 25, -8], {}).sharp([19, -2, 31, -2], {});
      d.circle(25, 72, 6, fill('skyPencil'));
      d.poly([66, 130, ...arcFlat(75, 112, 9, 12, 180, 360, 4), 84, 130], fill('kraftDark'));
      return d.done([120, 140]);
    case 'barn':
      d.poly([10, 130, 10, 60, 30, 30, 70, 14, 110, 30, 130, 60, 130, 130], fill(c('margin')));
      d.rect(48, 80, 44, 50, {});
      d.sharp([48, 80, 92, 130], {}).sharp([92, 80, 48, 130], {});
      return d.done([140, 130]);
    case 'skyscraper': {
      d.rect(20, 20, 50, 200, fill(c('skyPencil'), 'light'));
      const win: number[] = [];
      for (let y = 32; y < 210; y += 14)
        for (let x = 28; x < 66; x += 12) if (d.r(0, 1) < 0.7) win.push(x, y);
      d.dots(win, 3, { nib: 'pencil' });
      d.sharp([45, 20, 45, 2], {});
      return d.done([90, 220]);
    }
    case 'shop':
      d.rect(10, 50, 110, 80, fill(c('paper')));
      for (let i = 0; i < 5; i += 1)
        d.poly(
          [6 + i * 24, 40, 30 + i * 24, 40, 30 + i * 24, 56, 6 + i * 24, 56],
          i % 2 === 0 ? fill('margin', 'dense') : {},
        );
      d.rect(20, 18, 90, 18, {});
      window_(d, 22, 70, 46, 36);
      d.rect(80, 76, 26, 54, fill('kraftDark'));
      return d.done([130, 130]);
    case 'factory':
      d.poly(
        [10, 130, 10, 60, 40, 40, 40, 60, 70, 40, 70, 60, 100, 40, 100, 60, 130, 60, 130, 130],
        fill(c('graphiteLight'), 'light'),
      );
      d.rect(104, 10, 14, 50, fill('margin', 'light'));
      for (const x of [20, 50, 80]) window_(d, x, 80, 18, 18);
      return d.done([140, 130]);
    case 'lighthouse':
      d.poly([30, 160, 38, 40, 62, 40, 70, 160], fill('paper'));
      for (const y of [60, 100, 140])
        d.hatch([36, y, 64, y, 66, y + 18, 34, y + 18], 'margin', { shade: 'dense' });
      d.rect(36, 22, 28, 18, fill('sticky', 'dense'));
      d.poly([32, 24, 50, 6, 68, 24], fill('margin'));
      d.rays(50, 31, 26, 52, 4, { from: -20, to: 20, nib: 'pencil' });
      return d.done([100, 160]);
    case 'tent':
      d.poly([6, 90, 50, 10, 94, 90], fill(c('orange')));
      d.sharp([50, 10, 46, 90], {}).sharp([50, 30, 64, 90], {});
      d.sharp([6, 90, 0, 96], thin).sharp([94, 90, 100, 96], thin);
      return d.done([100, 96]);
    case 'igloo':
      d.poly(arcFlat(60, 80, 56, 60, 180, 360, 10), fill(c('skyPencil'), 'light'));
      for (const y of [40, 60]) d.arc(60, 80, 80 - y, 200, 340, pale);
      d.poly(arcFlat(92, 80, 14, 18, 180, 360, 5), fill('ink', 'dense'));
      return d.done([120, 80]);
    case 'windmill':
      d.poly([34, 150, 42, 50, 68, 50, 76, 150], fill(c('paper')));
      d.poly([38, 52, 55, 30, 72, 52], fill('margin'));
      for (const deg of [20, 110, 200, 290]) {
        const a = ((deg + d.r(-6, 6)) * Math.PI) / 180;
        const [ex, ey] = [55 + Math.cos(a) * 50, 50 + Math.sin(a) * 50];
        d.poly(
          [
            55,
            50,
            ex,
            ey,
            ex + Math.cos(a + 1.57) * 10,
            ey + Math.sin(a + 1.57) * 10,
            55 + Math.cos(a + 1.57) * 4,
            50 + Math.sin(a + 1.57) * 4,
          ],
          fill('kraft', 'light'),
        );
      }
      d.rect(48, 120, 14, 30, fill('kraftDark'));
      return d.done([110, 150]);
    case 'well':
      d.rect(20, 70, 60, 40, fill(c('graphiteLight'), 'light'));
      d.sharp([26, 70, 26, 20], { width: 3 }).sharp([74, 70, 74, 20], { width: 3 });
      d.poly([14, 24, 50, 2, 86, 24], fill('margin'));
      d.sharp([50, 24, 50, 50], thin);
      d.rect(43, 50, 14, 12, fill('kraftDark'));
      return d.done([100, 110]);
    case 'bridge':
      d.sharp([0, 30, 160, 30], { width: 3 });
      d.arc(80, 90, 62, 195, 345, {});
      for (const x of [14, 146]) d.rect(x - 6, 30, 12, 60, fill(c('graphiteLight'), 'light'));
      for (let x = 10; x < 160; x += 20) d.sharp([x, 30, x, 14], thin);
      d.sharp([4, 14, 156, 14], thin);
      return d.done([160, 90]);
    case 'pyramid':
      d.poly([4, 100, 70, 6, 136, 100], fill(c('kraft')));
      for (let i = 1; i < 5; i += 1)
        d.sharp([70 - i * 13, 6 + i * 19, 70 + i * 13, 6 + i * 19], pale);
      return d.done([140, 100]);
    case 'wall': {
      const [w, h] = [k.w ?? 160, k.h ?? 60];
      const [bw, bh] = [Math.max(32, w / 8), Math.max(14, h / 6)];
      d.rect(0, 0, w, h, fill(c('kraft'), 'light'));
      for (let row = 1; row * bh < h; row += 1)
        d.sharp([0, row * bh, w, row * bh + d.r(-1, 1)], pale);
      for (let row = 0; row * bh < h; row += 1) {
        for (let x = (row % 2) * (bw / 2) + bw / 2; x < w; x += bw)
          d.sharp([x, row * bh, x, Math.min(h, row * bh + bh)], pale);
      }
      return d.done([w, h]);
    }
    default:
      d.rect(10, 60, 100, 80, fill(c('paper')));
      d.poly(
        [0, 62, 60, 10 + d.r(-4, 4), 120, 62],
        fill(
          k.type === 'cottage' ? 'sticky' : 'margin',
          k.type === 'cottage' ? 'scribble' : 'hatch',
        ),
      );
      d.rect(50, 98, 22, 42, fill('kraftDark'));
      window_(d, 20, 76, 22, 20);
      window_(d, 80, 76, 20, 20);
      d.rect(84, 18, 12, 28, {});
      return d.done([120, 140]);
  }
};

const wheel = (d: Draft, x: number, y: number, r: number, spokes = false): void => {
  d.circle(x, y, r, fill('ink', spokes ? 'light' : 'dense'));
  if (spokes) d.rays(x, y, 0, r, 6, thin);
};

const vehicle: Maker = (d, k) => {
  const c = (fallback: SwatchName): SwatchName => k.color ?? fallback;
  switch (k.type) {
    case 'bus':
      d.rect(6, 14, 150, 50, fill(c('sticky')));
      for (let x = 16; x < 140; x += 26) d.rect(x, 22, 18, 16, fill('skyPencil', 'light'));
      wheel(d, 34, 64, 10);
      wheel(d, 128, 64, 10);
      return d.done([160, 76]);
    case 'truck':
      d.rect(6, 10, 96, 50, fill(c('paper')));
      d.poly([104, 60, 104, 24, 128, 24, 142, 40, 142, 60], fill(c('margin')));
      d.rect(110, 28, 16, 12, fill('skyPencil', 'light'));
      for (const x of [26, 80, 124]) wheel(d, x, 62, 10);
      return d.done([150, 74]);
    case 'bike':
      wheel(d, 22, 50, 18, true);
      wheel(d, 92, 50, 18, true);
      d.sharp([22, 50, 46, 50, 78, 22, 40, 22, 46, 50], { color: c('margin') });
      d.sharp([78, 22, 92, 50], { color: c('margin') }).sharp([78, 22, 74, 12, 82, 10], {});
      d.sharp([36, 16, 46, 16], { width: 3 });
      return d.done([114, 70]);
    case 'rowboat':
      d.poly([4, 30, 116, 30, 100, 54, 22, 54], fill(c('kraftDark')));
      d.sharp([40, 20, 20, 70], { width: 2 }).sharp([80, 20, 100, 70], { width: 2 });
      return d.done([120, 70]);
    case 'sailboat':
      d.poly([4, 100, 126, 100, 108, 124, 20, 124], fill(c('kraftDark')));
      d.sharp([64, 100, 64, 6], { width: 2 });
      d.poly([68, 10, 68, 92, 120, 92], fill('paper'));
      d.poly([60, 20, 60, 92, 18, 92], fill(c('margin'), 'light'));
      d.sharp([64, 6, 80, 10, 64, 14], { color: 'margin' });
      return d.done([130, 124]);
    case 'rocket':
      d.poly([30, 120, 30, 40, ...arcFlat(45, 40, 15, 36, 180, 360, 6), 60, 120], fill(c('paper')));
      d.poly([30, 96, 12, 128, 30, 120], fill('margin')).poly(
        [60, 96, 78, 128, 60, 120],
        fill('margin'),
      );
      d.circle(45, 58, 8, fill('skyPencil'));
      d.poly([34, 122, 45, 150 + d.r(-4, 6), 56, 122], fill('orange', 'dense'));
      return d.done([90, 150]);
    case 'plane':
      d.blob(80, 40, 72, 12, { ...fill(c('paper')), lumps: 0.03 });
      d.poly([70, 44, 100, 80, 112, 80, 92, 44], fill(c('skyPencil'), 'light'));
      d.poly([16, 36, 6, 8, 20, 8, 34, 32], fill(c('margin')));
      d.dots([100, 36, 112, 36, 124, 36, 136, 37], 3);
      return d.done([160, 84]);
    case 'train':
      d.rect(10, 30, 80, 40, fill(c('margin')));
      d.rect(90, 10, 40, 60, fill(c('margin')));
      d.rect(98, 18, 24, 18, fill('skyPencil', 'light'));
      d.rect(22, 8, 14, 22, fill('ink', 'light'));
      d.poly([10, 70, -2, 84, 10, 84], {});
      for (const x of [26, 60, 110]) wheel(d, x, 78, 10, true);
      return d.done([132, 90]);
    case 'cart':
      d.rect(20, 30, 90, 36, fill(c('kraft')));
      for (let x = 32; x < 110; x += 18) d.sharp([x, 30, x, 66], pale);
      wheel(d, 64, 72, 18, true);
      d.sharp([110, 50, 160, 64], { width: 2 });
      return d.done([160, 92]);
    case 'submarine':
      d.blob(80, 50, 70, 22, { ...fill(c('sticky')), lumps: 0.04 });
      d.rect(66, 14, 26, 16, fill(c('sticky')));
      d.sharp([80, 14, 80, 0, 92, 0], {});
      for (const x of [50, 80, 110]) d.circle(x, 50, 6, fill('skyPencil'));
      d.poly([10, 50, 0, 34, 0, 66], fill(c('sticky')));
      return d.done([160, 76]);
    case 'helicopter':
      d.blob(60, 50, 34, 22, { ...fill(c('margin')), lumps: 0.05 });
      d.blob(72, 46, 14, 12, { ...fill('skyPencil', 'light'), lumps: 0.05 });
      d.sharp([28, 46, 0, 40], { width: 2 }).sharp([-2, 30, 2, 50], {});
      d.sharp([60, 28, 60, 16], {}).sharp([10, 14, 112, 18], { width: 2 });
      d.sharp([40, 72, 90, 72], { width: 2 })
        .sharp([50, 70, 46, 72], {})
        .sharp([80, 70, 82, 72], {});
      return d.done([120, 80]);
    case 'balloon':
      d.blob(50, 44, 40, 44, { ...fill(c('orange')), lumps: 0.06 });
      d.arc(50, 44, 22, 270, 450, thin);
      d.sharp([24, 78, 38, 110], thin).sharp([76, 78, 62, 110], thin);
      d.rect(36, 110, 28, 20, fill('kraftDark'));
      return d.done([100, 130]);
    case 'station':
      d.rect(60, 30, 40, 40, fill(c('paper')));
      d.rect(100, 40, 40, 20, fill(c('paper')));
      for (const x of [4, 146]) {
        d.rect(x, 10, 50, 80, fill('bic', 'light'));
        d.sharp([x + 25, 10, x + 25, 90], thin).sharp([x, 50, x + 50, 50], thin);
      }
      d.sharp([54, 50, 60, 50], { width: 3 }).sharp([140, 50, 146, 50], { width: 3 });
      d.arc(80, 24, 10, 180, 360, {});
      return d.done([200, 100]);
    case 'satellite':
      d.rect(42, 30, 26, 26, fill(c('sticky')));
      for (const x of [2, 74]) d.rect(x, 34, 36, 18, fill('bic', 'light'));
      d.arc(55, 18, 12, 0, 180, {});
      d.sharp([55, 30, 55, 18], {});
      return d.done([112, 60]);
    default:
      d.poly([6, 56, 6, 36, 34, 32, 50, 12, 100, 12, 118, 32, 140, 36, 142, 56], fill(c('margin')));
      d.poly([56, 18, 76, 18, 76, 32, 44, 32], fill('skyPencil', 'light'));
      d.poly([82, 18, 98, 18, 110, 32, 82, 32], fill('skyPencil', 'light'));
      wheel(d, 36, 58, 12);
      wheel(d, 112, 58, 12);
      return d.done([148, 72]);
  }
};

const types = (makers: Maker, names: readonly string[]): Record<string, Maker> =>
  Object.fromEntries(names.map((name) => [name, makers]));

const BUILDINGS = [
  'house',
  'cottage',
  'hut',
  'castle',
  'tower',
  'church',
  'barn',
  'skyscraper',
  'shop',
  'factory',
  'lighthouse',
  'tent',
  'igloo',
  'windmill',
  'well',
  'bridge',
  'pyramid',
  'wall',
];
const VEHICLES = [
  'car',
  'bus',
  'truck',
  'bike',
  'rowboat',
  'sailboat',
  'rocket',
  'plane',
  'train',
  'cart',
  'submarine',
  'helicopter',
  'balloon',
  'station',
  'satellite',
];

export const STRUCTURE_FAMILIES = [
  family({
    kind: 'building',
    group: 'structure',
    summary: `${BUILDINGS.join(', ')} (wall: w x h)`,
    types: types(building, BUILDINGS),
    height: 160,
    heights: {
      skyscraper: 280,
      tower: 220,
      church: 200,
      lighthouse: 220,
      windmill: 200,
      tent: 100,
      igloo: 90,
      well: 120,
      bridge: 100,
      wall: 60,
      hut: 120,
    },
  }),
  family({
    kind: 'vehicle',
    group: 'vehicle',
    summary: VEHICLES.join(', '),
    types: types(vehicle, VEHICLES),
    height: 70,
    heights: {
      bike: 60,
      rowboat: 45,
      sailboat: 140,
      rocket: 180,
      plane: 70,
      train: 90,
      submarine: 70,
      helicopter: 80,
      balloon: 150,
      station: 110,
      satellite: 60,
    },
  }),
];
