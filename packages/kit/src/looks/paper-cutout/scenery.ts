/**
 * Built-in scenery of the paper stage: depth strips from far to near (hills with a row of trees,
 * or a two-row city skyline over a street strip), toned for the backdrop so the far layers are
 * the faint ones and the near ones carry the contrast.
 */
import type { PaperRole } from './colors.js';
import { buildingsModel } from './city.js';
import { cloudsModel } from './clouds.js';
import { hillsModel, treesModel, type HillKind } from './landscape.js';
import type { PieceModel } from './piece.js';
import type { Backdrop } from './sky.js';

export const SCENERIES = ['hills', 'city', 'none'] as const;
export type Scenery = (typeof SCENERIES)[number];

/** Strip tones far to near per backdrop. */
const HILL_TONES: Readonly<Record<Backdrop, readonly PaperRole[]>> = {
  day: ['skyDeep', 'greenMid', 'green', 'greenDark'],
  dusk: ['wine', 'duskMid', 'duskTop', 'night'],
  night: ['skyDeep', 'nightMid', 'night', 'night'],
  kraft: ['woodLight', 'heroDark', 'wood', 'ink'],
  paper: ['skyLight', 'green', 'greenMid', 'greenDark'],
};

const CITY_TONES: Readonly<Record<Backdrop, readonly [PaperRole, PaperRole, PaperRole]>> = {
  day: ['skyMid', 'stone', 'stoneDark'],
  dusk: ['duskMid', 'stoneDark', 'night'],
  night: ['nightMid', 'stoneDark', 'night'],
  kraft: ['woodLight', 'stone', 'wood'],
  paper: ['stoneLight', 'stone', 'stoneDark'],
};

export interface SceneryParams {
  readonly backdrop: Backdrop;
  readonly scenery: Scenery;
  readonly layers: number;
  readonly hills: HillKind;
  readonly sky: boolean;
}

/** Built-in pieces (models with their own layer and placement), far first. */
export function scenery(params: SceneryParams, horizon: number, seed: number): PieceModel[] {
  const models: PieceModel[] = [];
  if (params.sky && params.backdrop === 'day') {
    models.push(
      cloudsModel({ count: 3, band: [24, horizon - 90], size: 64, drift: 5, tone: 'paper', seed }),
    );
  }
  const count = params.layers;
  const ground = 360 - horizon;
  // Far strips crowd at the horizon, the nearest one is a low band at the bottom.
  const baseline = (index: number): number =>
    count === 1
      ? horizon + ground * 0.1
      : horizon + ground * (-0.08 + 0.68 * (index / (count - 1)) ** 1.3);
  if (params.scenery === 'hills') {
    const tones = HILL_TONES[params.backdrop];
    for (let index = 0; index < count; index += 1) {
      const near = index / Math.max(1, count - 1);
      models.push(
        hillsModel(
          {
            kind: index === count - 1 && count > 1 ? 'flat' : params.hills,
            tone: tones[index] ?? 'greenMid',
            height: 34 - 16 * near,
            width: 260 - 40 * index,
            seed: seed + index * 17,
          },
          index + 1,
          baseline(index),
        ),
      );
      if (index === 1 || (count === 1 && index === 0)) {
        models.push(
          treesModel(
            {
              kind: params.backdrop === 'night' || params.backdrop === 'dusk' ? 'pine' : 'mixed',
              count: 5,
              spread: [30, 610],
              height: 46,
              tone: tones[index + 1] ?? tones[index] ?? 'greenMid',
              trunk: 'wood',
              sway: 2,
              seed: seed + 5,
            },
            index + 1,
            baseline(index) + 8,
          ),
        );
      }
    }
  }
  if (params.scenery === 'city') {
    const [far, mid, street] = CITY_TONES[params.backdrop];
    const windows = params.backdrop === 'night' || params.backdrop === 'dusk' ? 0.45 : 0.15;
    const rows: readonly (readonly [PaperRole, readonly [number, number], number])[] = [
      [far, [70, 150], 1],
      [mid, [40, 105], 2],
    ];
    rows.slice(0, Math.max(1, count - 1)).forEach(([tone, height, layer], index) => {
      models.push(
        buildingsModel(
          {
            count: 9 - index * 2,
            height,
            tone,
            roof: index === 0 ? tone : 'heroDark',
            window: 'sun',
            lit: windows,
            seed: seed + index * 23,
          },
          layer,
          baseline(index),
        ),
      );
    });
    if (count >= 2) {
      models.push(
        hillsModel(
          { kind: 'flat', tone: street, height: 6, width: 400, seed: seed + 3 },
          Math.min(3, count),
          baseline(count - 1) + ground * 0.12,
        ),
      );
    }
  }
  return models;
}
