/**
 * Full-screen game menus of look B `rpg-menu` (showcase shot 5): the paused game's woodgrain
 * panel over the dimmed level with a quest log (NOW + the objective in its accent box, DONE
 * ticked in two strokes, AHEAD still redacted) or a stat sheet (an item's or a place's facts with
 * segment bars), an inventory grid whose cursor brackets hop with an overshoot while the item's
 * name types under it, and a developer's note in the corner. Times relative to `at`, seeded
 * variance; a pure function of t.
 */
import { z } from 'zod';
import { Bmp, handStroke } from '../core/bitmap.js';
import { drawText, textWidth, typedCount, typeTimes } from '../core/font.js';
import { bayer, EASES, hash3, lerp, seg } from '../core/rand.js';
import { C, colorOfSwatch } from '../palette.js';
import { cartridge, lookKey, thing, type ItemArt, type ItemLook } from '../ray/sprites-props.js';
import { caretOn, plate } from './plate.js';
import { ICON_HELP, isIconName, type IconName } from './inventory.js';
import { time } from './hud-schemas.js';

const caps = (max: number) =>
  z
    .string()
    .max(max)
    .transform((text) => text.toUpperCase());

export const menuSchema = z.strictObject({
  at: time,
  until: time,
  left: caps(16).default('QUEST LOG').describe('Header of the left column'),
  right: caps(16).default('INVENTORY').describe('Header of the right column'),
  paused: z.boolean().default(true),
  quest: z
    .strictObject({
      now: caps(18).describe('The chapter, big (CHRISTMAS 1982)'),
      objective: caps(28).describe('The quest in its accent box (REACH THE SPRING.)'),
      done: z.array(caps(28)).max(4).default([]).describe('Chapters done, ticked by hand'),
      ahead: z.int().min(0).max(4).default(0).describe('Chapters still ahead (redacted bars)'),
    })
    .optional(),
  stats: z
    .strictObject({
      title: caps(18).describe('What the sheet is about (THE OLD MILL)'),
      rows: z
        .array(
          z.strictObject({
            label: caps(12),
            value: caps(16),
            bar: z.number().min(0).max(1).optional().describe('Share for a segment bar'),
          }),
        )
        .min(1)
        .max(6),
    })
    .optional(),
  inventory: z
    .strictObject({
      items: z
        .array(
          z.strictObject({
            icon: z.string().describe(ICON_HELP),
            label: caps(18),
            sub: caps(18).default(''),
            itemLabel: caps(5).optional(),
            band: z.string().optional(),
          }),
        )
        .min(1)
        .max(6),
      select: z
        .array(z.strictObject({ at: time, index: z.int().min(0).max(5) }))
        .max(8)
        .default([]),
    })
    .optional(),
  note: caps(40).optional().describe("Developer's note easter egg (\\n = second line)"),
});

export type MenuSpec = z.output<typeof menuSchema>;

export interface Menu {
  readonly spec: MenuSpec;
  readonly at: number;
  readonly until: number;
  readonly select: readonly { at: number; index: number }[];
  readonly objectiveTimes: readonly number[];
  readonly seed: number;
  /** Project icons of the inventory items (by index), drawn doubled. */
  readonly arts: readonly (ItemArt | undefined)[];
}

const SLOTS = [
  [432, 70],
  [484, 70],
  [537, 71],
  [432, 123],
  [484, 123],
  [537, 123],
] as const;
const icons = new Map<string, Bmp>();

function bigIcon(icon: IconName, look: ItemLook): Bmp {
  const key = `${icon}:${lookKey(look)}`;
  const hit = icons.get(key);
  if (hit !== undefined) return hit;
  let b: Bmp;
  if (icon === 'cartridge') b = cartridge(30, 35, look).outline(C.VOID);
  else if (icon === 'note') b = thing(26, 30, { ...look, kind: 'note' }).outline(C.VOID);
  else if (icon === 'key') b = thing(32, 32, { kind: 'key' }).outline(C.UMBER);
  else if (icon === 'calendar') {
    b = new Bmp(30, 30, C.PAPER);
    b.rect(0, 0, 30, 7, C.BROWN);
    for (let r = 0; r < 4; r += 1)
      for (let k = 0; k < 6; k += 1) {
        b.rect(2 + k * 5, 10 + r * 5, 3, 3, C.SAND_L);
        if (r * 6 + k < 19) b.px(2 + k * 5, 10 + r * 5, C.SLATE);
      }
    b.rect(28, 9, 1, 20, look.band ?? C.CLAY);
  } else {
    b = new Bmp(32, 26, C.TAN);
    b.rect(28, 0, 4, 26, C.WOOD);
    b.rect(0, 0, 28, 2, C.SAND_L);
    b.rect(12, 0, 4, 6, C.SAND_L);
    if (look.label !== undefined) drawText(b, look.label, 6, 12, C.BROWN);
  }
  icons.set(key, b);
  return b;
}

export function menuOpen(menu: Menu, t: number): number {
  if (t < menu.at || t >= menu.until) return 0;
  return (
    EASES.outBack(seg(t, menu.at, menu.at + 0.3)) *
    (1 - EASES.in(seg(t, menu.until - 0.3, menu.until)))
  );
}

/**
 * Seconds from the menu's typing base to its quest title: after the DONE ticks, or at once when
 * nothing is done (real run Game B2 2: a log with no DONE lines sat empty for 1.7 s).
 */
function titleDelay(done: readonly string[]): number {
  return done.length === 0 ? 0.15 : 1.1;
}

function quest(b: Bmp, menu: Menu, t: number, y: number): void {
  const q = menu.spec.quest;
  if (q === undefined) return;
  const lx = 50;
  const base = menu.at + 0.35;
  drawText(b, 'NOW', lx, y + 34, C.SAND);
  const titleAt = base + titleDelay(q.done);
  drawText(
    b,
    q.now.slice(0, Math.floor(seg(t, titleAt, titleAt + 0.4) * q.now.length)),
    lx,
    y + 46,
    C.PAPER,
    3,
  );
  const boxAt = titleAt + 0.35;
  if (t > boxAt) {
    const size = Math.round(12 * EASES.outBack(seg(t, boxAt, boxAt + 0.2)));
    const off = (12 - size) / 2;
    b.frame(lx + 1 + off, y + 84 + off, size, size, C.ACCENT);
    b.frame(lx + 2 + off, y + 85 + off, size - 2, size - 2, C.ACCENT);
    const n = typedCount(menu.objectiveTimes, t);
    drawText(b, q.objective.slice(0, n), lx + 22, y + 83, C.PAPER, 2);
    if (n < q.objective.length && caretOn(t))
      b.rect(lx + 24 + textWidth(q.objective.slice(0, n), 2), y + 83, 3, 14, C.BULB);
  }
  handStroke(b, [lx, y + 116, lx + 180, y + 117, lx + 330, y + 115], C.SLATE, 77, 2, 1);
  if (q.done.length > 0) drawText(b, 'DONE', lx, y + 128, C.SAND);
  q.done.forEach((line, i) => {
    const yy = y + 143 + i * 15 + (i === 1 ? 1 : 0);
    drawText(b, line, lx + 16, yy, C.PUTTY);
    const tick = base + 0.35 + i * 0.48 * (0.8 + 0.4 * hash3(menu.seed, i, 2));
    const p = seg(t, tick, tick + 0.16);
    if (p > 0)
      handStroke(
        b,
        [lx + 1, yy + 3, lx + 4, yy + 7, lx + 11, yy - 2],
        C.SAGE,
        90 + i,
        1.5,
        p,
        true,
      );
  });
  if (q.ahead > 0) {
    const ay = y + 143 + Math.max(2, q.done.length) * 15 + 15;
    drawText(b, 'AHEAD', lx, ay, C.SAND);
    for (let i = 0; i < q.ahead; i += 1)
      b.rect(lx + 16, ay + 14 + i * 13, [118, 84, 146, 102][i] ?? 90, 6, C.CHAR);
  }
}

function stats(b: Bmp, menu: Menu, t: number, y: number): void {
  const sheet = menu.spec.stats;
  if (sheet === undefined) return;
  const lx = 50;
  const base = menu.at + 0.35;
  drawText(
    b,
    sheet.title.slice(0, Math.floor(seg(t, base + 0.2, base + 0.6) * sheet.title.length)),
    lx,
    y + 38,
    C.PAPER,
    3,
  );
  handStroke(b, [lx, y + 68, lx + 170, y + 69, lx + 330, y + 67], C.SLATE, 78, 2, 1);
  let at = base + 0.7;
  sheet.rows.forEach((row, i) => {
    at += 0.3 + 0.25 * hash3(menu.seed, i, 4);
    if (t < at) return;
    const yy = y + 84 + i * 26 + (i === 2 ? 1 : 0);
    drawText(b, row.label, lx, yy + 4, C.SAND, 1, { jitter: 30 + i });
    const n = Math.floor(seg(t, at, at + 0.04 * row.value.length + 0.1) * row.value.length);
    drawText(b, row.value.slice(0, n), lx + 96, yy, C.PAPER, 2);
    if (row.bar === undefined) return;
    const fill = row.bar * EASES.outBack(seg(t, at + 0.2, at + 0.6));
    for (let k = 0; k < 10; k += 1) {
      const x = lx + 262 + k * 7 + (k > 4 ? 1 : 0);
      b.rect(x, yy + 3, 5, 7, k < Math.round(fill * 10) ? C.SAGE : C.CHAR);
    }
  });
}

function inventory(b: Bmp, menu: Menu, t: number, y: number): void {
  const inv = menu.spec.inventory;
  if (inv === undefined) return;
  SLOTS.forEach(([sx, sy], i) => {
    const top = y + sy - 30;
    b.rect(sx, top, 46, 46, C.VOID);
    b.frame(sx, top, 46, 46, C.CHAR);
    const item = inv.items[i];
    if (item === undefined) {
      b.rect(sx + 22, top + 22, 2, 2, C.CHAR);
      return;
    }
    const band = item.band === undefined ? undefined : colorOfSwatch(item.band);
    const art = menu.arts[i];
    const icon =
      art !== undefined || !isIconName(item.icon)
        ? thing(30, 30, { art })
        : bigIcon(item.icon, { label: item.itemLabel, band });
    b.blit(icon, sx + 23 - (icon.w >> 1), top + 23 - (icon.h >> 1));
  });
  let current = -1;
  let previous = 0;
  let movedAt = 0;
  for (const step of menu.select)
    if (t >= step.at) {
      previous = current < 0 ? step.index : current;
      current = step.index;
      movedAt = step.at;
    }
  if (current < 0) return;
  const u = EASES.outBack(seg(t, movedAt, movedAt + 0.2));
  const [fx, fy] = SLOTS[previous] ?? SLOTS[0];
  const [tx, ty] = SLOTS[current] ?? SLOTS[0];
  const ax = lerp(fx, tx, u);
  const ay = lerp(fy, ty, u) + y - 30;
  for (const [ox, oy, sx, sy] of [
    [0, 0, 1, 1],
    [46, 0, -1, 1],
    [0, 46, 1, -1],
    [46, 46, -1, -1],
  ] as const) {
    b.rect(ax + ox - (sx < 0 ? 4 : 0) - 1, ay + oy - (sy < 0 ? 1 : 0) - 1, 5, 2, C.BULB);
    b.rect(ax + ox - (sx < 0 ? 1 : 0) - 1, ay + oy - (sy < 0 ? 4 : 0) - 1, 2, 5, C.BULB);
  }
  const item = inv.items[current];
  if (item === undefined) return;
  const n = Math.floor(
    seg(t, movedAt + 0.12, movedAt + 0.7) * (item.label.length + item.sub.length),
  );
  drawText(b, item.label.slice(0, n), 432, y + 162, C.BULB);
  drawText(b, item.sub.slice(0, Math.max(0, n - item.label.length)), 432, y + 176, C.PAPER);
}

/** Paints the menu (and the dimmed level around it) over the HUD screen at t. */
export function drawMenu(b: Bmp, menu: Menu, t: number): void {
  const open = menuOpen(menu, t);
  if (open <= 0) return;
  const dim = seg(t, menu.at, menu.at + 0.2) * (1 - seg(t, menu.until - 0.25, menu.until));
  for (let y = 0; y < b.h; y += 1)
    for (let x = 0; x < b.w; x += 1) if (bayer(x, y) < dim * 0.5) b.d[y * b.w + x] = C.VOID;
  const x = 26;
  const w = 588;
  const hFull = 270;
  const h = Math.max(4, Math.round(hFull * open));
  const y = 44 + Math.round((hFull - h) / 2);
  plate(b, x, y, w, h);
  if (h < hFull - 6) return;
  b.rect(x + 6, y + 20, w - 12, h - 26, C.SHADOW);
  b.rect(x + 6, y + 20, w - 12, 1, C.VOID);
  const { spec } = menu;
  drawText(b, spec.left, x + 16, y + 7, C.BULB, 1, { shadow: C.VOID });
  if (spec.inventory !== undefined)
    drawText(b, spec.right, 432, y + 7, C.BULB, 1, { shadow: C.VOID });
  if (spec.paused) drawText(b, 'PAUSED', x + w - 56, y + 7, C.PAPER, 1, { shadow: C.VOID });
  quest(b, menu, t, y);
  stats(b, menu, t, y);
  inventory(b, menu, t, y);
  if (spec.note !== undefined)
    spec.note.split('\n').forEach((line, i) => drawText(b, line, 470, y + 236 + i * 11, C.SLATE));
}

/** Resolves a menu (objective typing times, selection times). */
export function createMenu(
  spec: MenuSpec,
  at: number,
  until: number,
  select: Menu['select'],
  seed: number,
  arts: Menu['arts'] = [],
): Menu {
  const objectiveAt = at + 0.35 + titleDelay(spec.quest?.done ?? []) + 0.5;
  const objectiveTimes = typeTimes(spec.quest?.objective ?? '', 4242 + seed, objectiveAt, 0.045);
  return { spec, at, until, select, objectiveTimes, seed, arts };
}
