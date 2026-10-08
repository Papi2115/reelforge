/**
 * Billboard props of the Game B2 world (ports of the showcase's sprites): drawn once from simple
 * shapes, then outlined; slightly crude on purpose (docs/worlds/DECISIONS.md "deliberate
 * roughness"). Labels are real words of the shot (stencils, signs, sale cards).
 */
import { Bmp, handStroke, rotate } from '../core/bitmap.js';
import { drawText } from '../core/font.js';
import { bayer, hash3, rng, vnoise } from '../core/rand.js';
import { C, T } from '../palette.js';

export interface Sprite {
  readonly bmp: Bmp;
  /** emissive[c] = 1 when colour c glows. */
  readonly emissive: Uint8Array;
}

export function sprite(bmp: Bmp, glowing: readonly number[] = []): Sprite {
  const emissive = new Uint8Array(256);
  for (const c of glowing) emissive[c] = 1;
  return { bmp, emissive };
}

/** What a held / thrown item is: the cartridge shell, a sheet of paper, a key. */
export const ITEM_KINDS = ['cartridge', 'note', 'key'] as const;
export type ItemKind = (typeof ITEM_KINDS)[number];

export interface ItemLook {
  /** The thing itself (default the cartridge). */
  readonly kind?: ItemKind | undefined;
  /** Stencil on the label (<= 5 characters fit at full size). */
  readonly label?: string | undefined;
  /** Colour of the label band (swatch index); the accent marks THE item of the story. */
  readonly band?: number | undefined;
  readonly dirty?: boolean | undefined;
  /** The film's own item icon (assets.icons): drawn instead of the shell. */
  readonly art?: ItemArt | undefined;
}

/** A project icon as a held / thrown / inventory item; `key` = id + content hash (caches). */
export interface ItemArt {
  readonly key: string;
  readonly bmp: Bmp;
}

/** Cache key of an item look (the art by its key, not its pixels). */
export function lookKey(look: ItemLook): string {
  return JSON.stringify({ ...look, art: look.art?.key });
}

/** The art scaled by the largest whole factor that fits w x h (nearest neighbour). */
function artThing(art: ItemArt, w: number, h: number): Bmp {
  const k = Math.max(1, Math.floor(Math.min(w / art.bmp.w, h / art.bmp.h)));
  const out = new Bmp(art.bmp.w * k, art.bmp.h * k);
  for (let y = 0; y < out.h; y += 1)
    for (let x = 0; x < out.w; x += 1)
      out.d[y * out.w + x] = art.bmp.d[Math.floor(y / k) * art.bmp.w + Math.floor(x / k)] ?? T;
  return out;
}

/** A generic cartridge-style shell with our own label (no real logo). */
export function cartridge(w: number, h: number, look: ItemLook, seed = 5): Bmp {
  const b = new Bmp(w, h);
  const s = w / 46;
  b.rect(0, 0, w, h, C.CHAR);
  b.rect(0, 0, w, 1, C.SLATE);
  b.rect(0, 0, 1, h, C.SLATE);
  for (let y = Math.round(2 * s); y < Math.round(11 * s); y += Math.max(2, Math.round(2 * s)))
    b.rect(1, y, w - 2, 1, C.SLATE);
  const lx = Math.round(4 * s);
  const ly = Math.round(13 * s);
  const lw = w - 2 * lx;
  const lh = Math.round(27 * s);
  b.rect(lx, ly, lw, lh, C.PAPER);
  b.rect(lx, ly, lw, Math.max(1, Math.round(6 * s)), look.band ?? C.ACCENT);
  b.rect(lx, ly + lh - Math.max(1, Math.round(4 * s)), lw, Math.max(1, Math.round(2 * s)), C.DUSK);
  if (w >= 40) {
    drawText(b, look.label ?? '', lx + 4, ly + Math.round(9 * s), C.VOID);
    b.ellipse(lx + lw - 8, ly + Math.round(12 * s), 3.5, 3.5, C.SAND_L);
    b.ellipse(lx + lw - 7, ly + Math.round(11 * s), 3, 3, C.PAPER);
  } else b.rect(lx + 2, ly + Math.round(10 * s), Math.max(2, lw - 6), 1, C.VOID);
  b.rect(0, h - 1, w, 1, C.SHADOW);
  if (look.dirty === true) {
    const random = rng(seed);
    for (let i = 0; i < w * h * 0.16; i += 1) {
      const x = random() * w;
      const y = random() * h;
      if (w >= 40 && x > lx + 2 && x < lx + 22 && y > ly + 7 && y < ly + 19) continue;
      b.px(x, y, random() < 0.6 ? C.DIRT : C.SAND);
    }
  }
  return b;
}

export function bulb(on: boolean): Sprite {
  const b = new Bmp(12, 48);
  for (let y = 0; y < 34; y += 1) b.px(y > 18 ? 5 : 6, y, y % 3 ? C.CHAR : C.SLATE);
  b.poly([3, 34, 9, 34, 11.5, 40, 0.5, 40], C.SLATE);
  b.rect(2, 35, 2, 4, C.GREY);
  b.rect(0, 39, 12, 1, C.CHAR);
  b.ellipse(6, 43, 3.2, 4, on ? C.BULB : C.GREY);
  b.rect(4, 40, 4, 1, on ? C.TUNGSTEN : C.GREY);
  b.px(6, 47, on ? C.TUNGSTEN : C.GREY);
  return sprite(b, on ? [C.BULB, C.TUNGSTEN] : []);
}

/** A drift of desert sand with an item corner poking out (the hook clue). */
export function sandPile(look: ItemLook): Sprite {
  const b = new Bmp(64, 26);
  const small = cartridge(14, 16, look);
  small.outline(C.VOID);
  b.blit(rotate(small, -28), 8, 0);
  for (let x = 0; x < 64; x += 1) {
    const hx = 17 * Math.exp(-(((x - 31) / 17) ** 2)) + 3 * vnoise(x, 0, 5, 3) + (x < 26 ? 2 : 0);
    for (let y = Math.round(26 - hx); y < 26; y += 1) {
      const depth = y - (26 - hx);
      let c = depth < 2 ? C.SAND_L : depth < hx * 0.6 ? C.SAND : C.DIRT;
      if (x > 40 && depth > 1 && bayer(x, y) < 0.5) c = C.DIRT;
      b.px(x, y, c);
    }
  }
  for (let i = 0; i < 14; i += 1)
    b.px(46 + i * 1.3 + hash3(i, 1, 1) * 2, 24 + hash3(i, 2, 1) * 2, C.SAND);
  return sprite(b);
}

/** A carton that fell off the rack (stencil `label`). */
export function fallenCarton(label: string): Sprite {
  const b = new Bmp(34, 20);
  b.poly([2, 7, 26, 5, 31, 2, 7, 3], C.SAND_L);
  b.poly([2, 7, 26, 5, 27, 18, 3, 19], C.TAN);
  b.poly([26, 5, 31, 2, 32, 15, 27, 18], C.WOOD);
  drawText(b, label, 7, 9, C.BROWN);
  return sprite(b.outline(C.UMBER));
}

export function pallet(label: string): Sprite {
  const b = new Bmp(48, 44);
  b.rect(2, 38, 44, 6, C.WOOD);
  for (let x = 4; x < 46; x += 9) b.rect(x, 39, 2, 4, C.UMBER);
  [
    [3, 24, 21, 14],
    [25, 25, 20, 13],
    [12, 10, 22, 14],
  ].forEach(([x = 0, y = 0, w = 0, h = 0], i) => {
    b.rect(x, y, w, h, C.TAN);
    b.rect(x + w - 3, y, 3, h, C.WOOD);
    b.rect(x, y, w, 1, C.SAND_L);
    drawText(b, label, x + 2 + i, y + 4, C.BROWN);
  });
  handStroke(b, [4, 12, 44, 30], C.PUTTY, 5, 3);
  return sprite(b.outline(C.UMBER));
}

/** A hand-lettered card on a stick (SALE), tilted. */
export function card(label: string, tilt: number, seed: number): Sprite {
  const b = new Bmp(30, 34);
  b.rect(6, 0, 1, 21, C.CHAR);
  b.rect(23, 0, 1, 21, C.CHAR);
  b.rect(1, 20, 28, 11, C.PAPER);
  b.rect(1, 30, 28, 1, C.SAND);
  drawText(b, label, 4, 22, C.CLAY, 1, { jitter: seed, bold: true });
  return sprite(rotate(b, tilt));
}

const BOX_COLOURS = [C.GREEN, C.DUSK, C.CLAY, C.TUNGSTEN, C.SAGE, C.HAZE, C.PLUM];

/** A bargain bin of look-alike game boxes. */
export function bin(seed: number): Sprite {
  const b = new Bmp(64, 36);
  const random = rng(seed);
  for (let i = 0; i < 26; i += 1) {
    const w = 7 + random() * 7;
    const h = 9 + random() * 6;
    const box = new Bmp(Math.ceil(w), Math.ceil(h), BOX_COLOURS[i % BOX_COLOURS.length]);
    box.rect(0, 0, box.w, 2, C.PAPER);
    b.blit(rotate(box, (random() - 0.5) * 70), 2 + random() * 50, random() * 12);
  }
  b.rect(0, 14, 64, 22, T);
  for (let y = 14; y < 36; y += 1)
    for (let x = 0; x < 64; x += 1) if (x % 6 === 0 || y % 6 === 2) b.px(x, y, C.GREY);
  b.rect(0, 14, 64, 2, C.PUTTY);
  return sprite(b);
}

/** A hanging sign: dark plate on two wires, the room's name. */
export function sign(label: string): Sprite {
  const b = new Bmp(48, 30);
  b.rect(8, 0, 1, 18, C.CHAR);
  b.rect(39, 0, 1, 18, C.CHAR);
  b.rect(1, 17, 46, 12, C.CHAR);
  b.frame(1, 17, 46, 12, C.SLATE);
  drawText(b, label, 4, 19, C.PAPER);
  return sprite(b);
}

/** A glowing exit sign. */
export function exitSign(label: string): Sprite {
  const b = new Bmp(24, 10, C.CHAR);
  drawText(b, label, 2, 2, C.FLUO);
  return sprite(b, [C.FLUO]);
}

function gameBox(b: Bmp, x: number, y: number, w: number, h: number): void {
  b.rect(x, y, w, h, C.DUSK);
  b.rect(x + w - 3, y, 3, h, C.NIGHT);
  b.rect(x, y, w - 3, 2, C.HAZE);
  b.rect(x + 2, y + 3, Math.round(w * 0.35), 2, C.PAPER);
  const r = Math.min(3, w * 0.12);
  b.ellipse(x + w * 0.66, y + h * 0.55, r, r, C.MOON);
  b.frame(x, y, w, h, C.VOID);
}

/** A small stack of boxed games (returned stock). */
export function boxes(seed: number): Sprite {
  const b = new Bmp(36, 28);
  const random = rng(seed);
  let y = 28;
  for (let i = 0; i < 2 + Math.floor(random() * 2); i += 1) {
    const w = 22 + Math.floor(random() * 8);
    const h = 8 + Math.floor(random() * 3);
    y -= h;
    gameBox(b, 2 + Math.floor(random() * 6), y, w, h);
  }
  return sprite(b.outline(C.VOID, true));
}

/** A sheet of paper (a note, a memo): ruled lines, a coloured top band, the word on it. */
function note(w: number, h: number, look: ItemLook): Bmp {
  const b = new Bmp(w, h);
  b.poly([0, 1, w - 2, 0, w - 1, h - 1, 1, h - 2], C.SAND_L);
  b.rect(1, 1, w - 3, Math.max(1, Math.round(h * 0.12)), look.band ?? C.TUNGSTEN);
  const gap = Math.max(2, Math.round(h / 9));
  for (let y = Math.round(h * 0.3); y < h - 2; y += gap)
    b.rect(2, y, Math.max(1, w - 6 - ((y * 7) % 5)), 1, C.SAND);
  if (w >= 40) drawText(b, look.label ?? '', 4, Math.round(h * 0.2), C.BROWN, 1, { jitter: 4 });
  b.px(w - 2, h - 2, C.SAND);
  return b;
}

/** A brass key lying across its box: ring, shank, two teeth. */
function key(w: number, h: number): Bmp {
  const b = new Bmp(w, h);
  const r = Math.max(2, Math.round(h * 0.28));
  const cy = Math.round(h / 2);
  b.ellipse(r + 1, cy, r, r, C.TUNGSTEN);
  b.ellipse(r + 1, cy, Math.max(1, r * 0.45), Math.max(1, r * 0.45), T);
  const t = Math.max(1, Math.round(h * 0.12));
  b.rect(r * 2, cy - t, w - r * 2 - 1, t * 2, C.TUNGSTEN);
  b.rect(w - Math.round(w * 0.2), cy + t, Math.max(1, Math.round(w * 0.06)), t * 2, C.TUNGSTEN);
  b.rect(w - Math.round(w * 0.36), cy + t, Math.max(1, Math.round(w * 0.05)), t + 1, C.TUNGSTEN);
  b.rect(r * 2, cy - t, w - r * 2 - 1, 1, C.BULB);
  return b;
}

/** The item as a bitmap of about w x h (cartridge, note or key), not outlined. */
export function thing(w: number, h: number, look: ItemLook, seed = 5): Bmp {
  if (look.art !== undefined) return artThing(look.art, w, h);
  if (look.kind === 'note') return note(w, h, look);
  if (look.kind === 'key') return key(w, Math.round(h * 0.5));
  return cartridge(w, h, look, seed);
}

/** An item standing on the floor or a shelf (the cartridge shell, a note, a key). */
export function item(look: ItemLook): Sprite {
  const b = thing(20, 23, look);
  return sprite(b.outline(C.VOID));
}
