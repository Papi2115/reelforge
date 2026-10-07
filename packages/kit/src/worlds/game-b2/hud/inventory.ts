/**
 * The inventory bar of the Game B2 HUD: the facts picked up so far as items in uneven slots on a
 * woodgrain plate (left column, under the compass rows, clear of the hand on the right). A new
 * item drops into its slot with an overshoot and its name types beside the bar for a moment; one
 * slot sits a pixel low (a hand set it).
 */
import { Bmp } from '../core/bitmap.js';
import { drawText } from '../core/font.js';
import { EASES, seg } from '../core/rand.js';
import { C } from '../palette.js';
import { cartridge, lookKey, type ItemLook } from '../ray/sprites-props.js';
import { plate } from './plate.js';

export const ICONS = ['cartridge', 'calendar', 'carton', 'note', 'key'] as const;
export type IconName = (typeof ICONS)[number];

export function isIconName(name: string): name is IconName {
  return (ICONS as readonly string[]).includes(name);
}

export interface InventoryItem {
  readonly icon: IconName;
  readonly label: string;
  readonly at: number;
  /** The item leaves the bar (thrown, handed over); undefined = it stays. */
  readonly out?: number | undefined;
  readonly look: ItemLook;
}

export interface Inventory {
  readonly at: number;
  readonly until: number;
  readonly items: readonly InventoryItem[];
}

const SLOT = 24;
const MAX_SLOTS = 6;
const cache = new Map<string, Bmp>();

function icon(item: InventoryItem): Bmp {
  const key = `${item.icon}:${lookKey(item.look)}`;
  const hit = cache.get(key);
  if (hit) return hit;
  let b: Bmp;
  if (item.look.art !== undefined) {
    b = item.look.art.bmp;
  } else if (item.icon === 'cartridge') {
    b = cartridge(16, 19, item.look).outline(C.VOID);
  } else if (item.icon === 'calendar') {
    b = new Bmp(17, 17, C.PAPER);
    b.rect(0, 0, 17, 4, C.BROWN);
    for (let r = 0; r < 3; r += 1)
      for (let k = 0; k < 4; k += 1)
        b.rect(1 + k * 4, 6 + r * 4, 2, 2, r * 4 + k < 9 ? C.SLATE : C.SAND_L);
    b.rect(15, 5, 1, 11, C.CLAY);
  } else if (item.icon === 'carton') {
    b = new Bmp(19, 15, C.TAN);
    b.rect(16, 0, 3, 15, C.WOOD);
    b.rect(0, 0, 16, 1, C.SAND_L);
    b.rect(7, 0, 3, 4, C.SAND_L);
  } else if (item.icon === 'note') {
    b = new Bmp(15, 17, C.SAND_L);
    b.rect(0, 0, 15, 3, C.TUNGSTEN);
    for (let r = 0; r < 4; r += 1) b.rect(2, 6 + r * 3, 9 + ((r * 5) % 3), 1, C.SAND);
  } else {
    b = new Bmp(19, 11);
    b.ellipse(4.5, 5.5, 4.5, 4.5, C.TUNGSTEN);
    b.ellipse(4.5, 5.5, 1.6, 1.6, 255);
    b.rect(8, 4, 10, 3, C.TUNGSTEN);
    b.rect(14, 7, 2, 3, C.TUNGSTEN);
    b.rect(17, 7, 1, 2, C.TUNGSTEN);
    b.outline(C.UMBER);
  }
  cache.set(key, b);
  return b;
}

/** The bar in the left column under the compass rows (`top`), sliding in from the left edge. */
export function drawInventory(b: Bmp, inventory: Inventory, t: number, top: number): void {
  if (t < inventory.at || t >= inventory.until) return;
  const slots = Math.min(MAX_SLOTS, Math.max(3, inventory.items.length));
  const w = 8 + slots * (SLOT + 3) + 1;
  const slide =
    EASES.out(seg(t, inventory.at, inventory.at + 0.3)) *
    (1 - seg(t, inventory.until - 0.25, inventory.until));
  const x = 20 - Math.round((1 - slide) * (w + 24));
  const y = top;
  plate(b, x, y, w, 34);
  for (let k = 0; k < slots; k += 1) {
    const sx = x + 5 + k * (SLOT + 3) + (k === 2 ? 1 : 0);
    const sy = y + 5 + (k === 1 ? 1 : 0);
    b.rect(sx, sy, SLOT, SLOT, C.VOID);
    b.frame(sx, sy, SLOT, SLOT, C.CHAR);
    const item = inventory.items[k];
    if (item === undefined || t < item.at) continue;
    const lift = item.out === undefined ? 0 : seg(t, item.out, item.out + 0.25);
    if (lift >= 1) continue;
    const drop = 1 - EASES.outBack(seg(t, item.at, item.at + 0.3));
    const bmp = icon(item);
    const y0 = sy + ((SLOT - bmp.h) >> 1) - Math.round(drop * 14) - Math.round(EASES.in(lift) * 16);
    if (lift > 0) b.rect(sx + 1, sy + 1, SLOT - 2, SLOT - 2, C.VOID);
    if (lift < 0.7) b.blit(bmp, sx + ((SLOT - bmp.w) >> 1), y0);
    const fresh = t - item.at;
    if (fresh < 2.5 && slide >= 1) {
      const n = Math.floor(seg(fresh, 0.25, 0.25 + item.label.length * 0.04) * item.label.length);
      const back = seg(fresh, 2.2, 2.5);
      const text = item.label.slice(0, Math.floor(n * (1 - back)));
      drawText(b, text, x + w + 6, y + 13, C.BULB, 1, { shadow: C.VOID });
    }
  }
}

/** Width of the inventory plate (tests, layout). */
export function inventoryWidth(inventory: Inventory): number {
  return 8 + Math.min(MAX_SLOTS, Math.max(3, inventory.items.length)) * (SLOT + 3) + 1;
}
