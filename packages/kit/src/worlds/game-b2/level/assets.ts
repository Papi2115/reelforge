/**
 * The level format's names -> the raycaster's textures and sprites (pure functions of kind, seed
 * and options, cached), plus the default sizes, heights and caps of each kind.
 */
import { C, colorOfSwatch } from '../palette.js';
import * as P from '../ray/sprites-props.js';
import { clerk, desk } from '../ray/sprites-people.js';
import { cached, type Texture } from '../ray/texture.js';
import * as F from '../ray/textures-flats.js';
import * as W from '../ray/textures-walls.js';
import { lowWallHeight, type BuiltInSprite, type SpriteSpec, type WallCell } from './schema.js';

/** World width, height and foot height of each sprite kind. */
export const SPRITE_SIZE: Readonly<Record<BuiltInSprite, readonly [number, number, number]>> = {
  'sand-pile': [0.5, 0.21, 0],
  carton: [0.42, 0.25, 0],
  pallet: [0.9, 0.82, 0],
  desk: [1.3, 0.98, 0],
  clerk: [0.56, 0.76, 0],
  sign: [0.56, 0.35, 0.64],
  exit: [0.44, 0.18, 0.8],
  boxes: [0.5, 0.39, 0],
  item: [0.2, 0.23, 0],
  card: [0.4, 0.46, 0.5],
  bin: [0.95, 0.5, 0],
};

const SHELF_SEEDS = [1, 7, 12] as const;

export function wallTexture(cell: WallCell, seed: number, variant: number): Texture {
  const key = `w:${String(seed)}:${String(variant)}:${JSON.stringify(cell)}`;
  return cached(key, () => {
    switch (cell.wall) {
      case 'concrete':
        return W.concrete(seed + 11, cell);
      case 'wood-panel':
        return W.woodPanel(seed % 30, cell);
      case 'cubicle':
        return W.cubicle();
      case 'shelf':
        return W.shelf(seed + (SHELF_SEEDS[variant % 3] ?? 1), cell);
      case 'shelf-end':
        return W.shelfEnd(cell);
      case 'corrugated':
        return W.corrugated(seed);
      case 'cinderblock':
        return W.cinderblock(seed);
      case 'counter':
        return W.counter(seed);
      case 'store-shelf':
        return W.storeShelf(seed + variant * 17);
      default:
        return W.concrete(seed + 11, cell);
    }
  });
}

/** Floor or ceiling texture by its format name ('warehouse' as a ceiling = 'warehouse-ceiling'). */
export function flatTexture(kind: string, seed: number, flicker: boolean): Texture {
  return cached(`f:${kind}:${String(seed)}:${String(flicker)}`, () => {
    switch (kind) {
      case 'concrete-sand':
        return F.concreteFloor(seed, true);
      case 'carpet':
        return F.carpet(seed);
      case 'warehouse':
        return F.warehouseFloor(seed, false);
      case 'warehouse-line':
        return F.warehouseFloor(seed, true);
      case 'tile':
        return F.tile(seed, false);
      case 'tile-big':
        return F.tile(seed, true);
      case 'sand':
        return F.sand(seed);
      case 'dark':
        return F.darkCeiling(seed);
      case 'office':
        return F.officeCeiling(seed, false);
      case 'office-light':
        return F.officeCeiling(seed, true);
      case 'warehouse-ceiling':
        return F.warehouseCeiling(seed, false, false);
      case 'warehouse-tube':
        return F.warehouseCeiling(seed, true, flicker);
      case 'grey':
        return F.greyCeiling(seed, false, false);
      case 'grey-tube':
        return F.greyCeiling(seed, true, flicker);
      default:
        return F.concreteFloor(seed, false);
    }
  });
}

export function doorTexture(): Texture {
  return cached('door', W.door);
}

export function wallHeight(cell: WallCell): number {
  return cell.height ?? lowWallHeight(cell.wall) ?? 1;
}

const DEFAULT_CAP: Readonly<Record<string, number>> = { cubicle: C.PUTTY, counter: C.TAN };

export function wallCap(cell: WallCell): number {
  return cell.cap === undefined ? (DEFAULT_CAP[cell.wall] ?? -1) : (colorOfSwatch(cell.cap) ?? -1);
}

/** The frames of a sprite: 0 = rest; desk 1 = typing; clerk 1 = talking, 2/3 = head-shake. */
export function spriteFrames(spec: SpriteSpec & { readonly sprite: BuiltInSprite }): P.Sprite[] {
  const look = {
    label: spec.label ?? '',
    band: spec.band === undefined ? undefined : colorOfSwatch(spec.band),
  };
  const seed = spec.seed ?? 3;
  switch (spec.sprite) {
    case 'sand-pile':
      return [P.sandPile(look)];
    case 'carton':
      return [P.fallenCarton(spec.label ?? '')];
    case 'pallet':
      return [P.pallet(spec.label ?? '')];
    case 'desk':
      return spec.person === true ? [desk(true, 0), desk(true, 1)] : [desk(false, 0)];
    case 'clerk':
      return [clerk(0), clerk(1), clerk(2), clerk(3)];
    case 'sign':
      return [P.sign(spec.label ?? '')];
    case 'exit':
      return [P.exitSign(spec.label ?? 'EXIT')];
    case 'boxes':
      return [P.boxes(seed)];
    case 'item':
      return [P.item(look)];
    case 'card':
      return [P.card(spec.label ?? '', spec.tilt ?? -4, seed)];
    case 'bin':
      return [P.bin(seed + 74)];
  }
}
