/**
 * Shared types of the role vocabulary (ADR-024): a role item (hair style, headgear, clothing
 * layer, accessory, held prop) draws boxes on the body's joints in the page's idiom, relative to
 * the body dimensions, with up to three colour slots (`color`, `trim`, `detail`) that have
 * defaults and can be overridden by the role spec.
 */
import type { ShapeSet } from './shape.js';

/** Body dimensions in voxels (1/12 unit), as the page's castBody computes them. */
export interface Dims {
  /** Torso height, width, depth. */
  readonly th: number;
  readonly tw: number;
  readonly td: number;
  /** Head width, height, depth. */
  readonly hw: number;
  readonly hh: number;
  readonly hd: number;
  /** Arm width and forearm length. */
  readonly aw: number;
  readonly fore: number;
}

export type ColorSlot = 'color' | 'trim' | 'detail';

/** Colours of an item: the slots it draws with, with their defaults (pack swatch names). */
export type ItemColors = Readonly<Partial<Record<ColorSlot, string>>>;

export interface DrawContext {
  readonly shapes: ShapeSet;
  readonly d: Dims;
  /** Resolved colour slots (spec override or the item's default). */
  readonly color: string;
  readonly trim: string;
  readonly detail: string;
  /** Colour under the item (the shirt): shows through openings. */
  readonly under: string;
  /** Hair colour (beards follow it). */
  readonly hair: string;
  /** +1 on the item's native hand, -1 mirrored to the other one (held props). */
  readonly mirror: 1 | -1;
}

/** How an item changes the body before it is built (deltas unless noted). */
export interface BodyAdjust {
  readonly armW?: number;
  readonly headD?: number;
  readonly eyeX?: number;
  readonly eyeY?: number;
  /** Absolute shoe height and toe length (boots). */
  readonly shoeH?: number;
  readonly toe?: number;
  /** The item replaces the bare head (hood, helmet): no skin head box. */
  readonly coversHead?: boolean;
  /** No eyes (a visor). */
  readonly hidesEyes?: boolean;
  /** Sleeves / hands take this slot's colour (coats, gloves). */
  readonly sleeves?: ColorSlot;
  readonly hands?: ColorSlot;
}

export interface RoleItem {
  readonly id: string;
  /** One line for kit-docs and docs/characters.md. */
  readonly description: string;
  readonly colors: ItemColors;
  readonly adjust?: BodyAdjust;
  draw(context: DrawContext): void;
}

export interface HeldItem extends RoleItem {
  /** Hand the page's cast holds it in (geometry is drawn for that side). */
  readonly hand: 'left' | 'right';
}

/** Lookup table of items by id. */
export function itemTable<T extends RoleItem>(items: readonly T[]): ReadonlyMap<string, T> {
  return new Map(items.map((item) => [item.id, item]));
}
