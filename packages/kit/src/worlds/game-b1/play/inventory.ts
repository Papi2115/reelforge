/**
 * The inventory / crafting screen (`screen.inventory(spec)`, a B1 breakthrough; PLAN.md#13.15 B1
 * rework): the narration's parts lie in the slots of a game inventory, the cursor hops between
 * them, two of them lift into the crafting row ("A + B ->"), the result slot stays empty for a
 * beat of silence and then the result pops in gold with its name typed. A toolkit, never a
 * template: `intent` (required) says what combines into what, every slot is one of the film's
 * own sprites with a word of the narration.
 */
import { z } from 'zod';
import { whenParam } from '../../../looks/blueprint/timing.js';
import { EASES, seg, sid } from '../core/math.js';
import type { TvPainter } from '../tv/painter.js';
import type { B1Sprite } from '../vocab/sprite.js';
import {
  arrow,
  BLINDS_S,
  bracket,
  capsText,
  checkHold,
  dashed,
  drawPanel,
  enterSchema,
  failer,
  intentSchema,
  plus,
  printTimes,
  type Cue,
  type Fail,
} from './menu-kit.js';

const fail: Fail = failer('inventory()');
const SLOT_W = 30;
const SLOT_H = 26;
const LIFT_S = 0.5;
const BEAT_S = 0.4;

const itemSchema = z.strictObject({
  sprite: z.string().min(1).describe("The film's sprite id"),
  label: z.string().min(1).max(10).describe('Its name in the narration'),
});

export const inventorySchema = z.strictObject({
  intent: intentSchema('inventory'),
  at: whenParam.describe('The screen opens'),
  until: whenParam.describe('The screen is gone'),
  title: z.string().min(1).max(14).default('INVENTORY'),
  slots: z
    .array(itemSchema)
    .min(2)
    .max(8)
    .describe('The parts, in the order the narration names them'),
  cursor: z
    .array(z.tuple([whenParam, z.int().min(0).max(7)]))
    .max(8)
    .default([])
    .describe('[[t, slot], ...] the cursor hops on the narration beats'),
  craft: z.strictObject({
    a: z.int().min(0).max(7),
    b: z.int().min(0).max(7),
    at: whenParam.describe('The two parts lift into the crafting row'),
    reveal: whenParam.optional().describe('The result pops in (default: at + 1.0 s)'),
    result: itemSchema,
  }),
  enter: enterSchema,
});

export type InventoryInput = z.input<typeof inventorySchema>;
type Spec = z.output<typeof inventorySchema>;

interface Slot {
  readonly sprite: B1Sprite;
  readonly label: string;
  readonly x: number;
  readonly y: number;
  readonly printAt: number;
}

export interface InventoryPlan {
  readonly intent: string;
  readonly at: number;
  readonly until: number;
  readonly title: string;
  readonly slots: readonly Slot[];
  readonly cursor: readonly (readonly [number, number])[];
  readonly craft: {
    readonly a: number;
    readonly b: number;
    readonly at: number;
    readonly reveal: number;
    readonly result: Slot;
  };
  readonly enter: 'blinds' | 'cut';
  readonly seed: number;
}

const slotX = (i: number) => 10 + (i % 4) * 36;
const slotY = (i: number) => 28 + Math.floor(i / 4) * 44;
const CRAFT_Y = 122;
const CRAFT_X = [14, 58, 112] as const;

export function planInventory(
  spec: Spec,
  at: (when: number | string) => number,
  sprite: (id: string) => B1Sprite,
): InventoryPlan {
  const start = at(spec.at);
  const until = at(spec.until);
  if (until <= start) fail('until must come after at');
  const seed = Math.abs(sid(spec.intent)) % 100_000;
  const first = start + (spec.enter === 'blinds' ? BLINDS_S : 0) + 0.15;
  const times = printTimes(spec.slots.length, first, 0.13, seed);
  const slots = spec.slots.map((item, i) => ({
    sprite: sprite(item.sprite),
    label: capsText(fail, `slots[${String(i)}].label`, item.label, 10),
    x: slotX(i),
    y: slotY(i),
    printAt: times[i] ?? first,
  }));
  const { craft } = spec;
  for (const key of ['a', 'b'] as const)
    if (craft[key] >= slots.length)
      fail(`craft.${key} ${String(craft[key])}: there are ${String(slots.length)} slots`);
  if (craft.a === craft.b) fail('craft.a and craft.b must be two different slots');
  const cursor = spec.cursor.map(([t, i], k) => {
    if (i >= slots.length) fail(`cursor[${String(k)}]: slot ${String(i)} does not exist`);
    return [at(t), i] as const;
  });
  const lift = at(craft.at);
  const lastPrint = Math.max(...slots.map((slot) => slot.printAt));
  if (lift < lastPrint + 0.2)
    fail(
      `craft.at ${lift.toFixed(2)}: let the slots print first (the last prints at ${lastPrint.toFixed(2)})`,
    );
  const reveal = craft.reveal === undefined ? lift + 1 : at(craft.reveal);
  if (reveal < lift + LIFT_S + BEAT_S)
    fail(
      `craft.reveal ${reveal.toFixed(2)}: leave a beat of silence (>= ${String(LIFT_S + BEAT_S)} s after craft.at)`,
    );
  const result = {
    sprite: sprite(craft.result.sprite),
    label: capsText(fail, 'craft.result.label', craft.result.label, 10),
    x: CRAFT_X[2],
    y: CRAFT_Y,
    printAt: reveal,
  };
  checkHold(fail, until, reveal + 0.8, 'craft.reveal');
  return {
    intent: spec.intent,
    at: start,
    until,
    title: capsText(fail, 'title', spec.title, 14),
    slots,
    cursor,
    craft: { a: craft.a, b: craft.b, at: lift, reveal, result },
    enter: spec.enter,
    seed,
  };
}

function drawItem(g: TvPainter, slot: Slot, x: number, y: number, squash?: number): void {
  const s = slot.sprite;
  const size = s.width * s.size > SLOT_W - 4 ? 1 : s.size;
  const w = s.width * size;
  const h = s.height * s.rowH;
  g.draw(s.id, x + Math.floor((SLOT_W - w) / 2), y + Math.max(1, SLOT_H - 2 - h), {
    playfield: true,
    size,
    ...(squash === undefined ? {} : { squash }),
  });
}

function label(g: TvPainter, text: string, x: number, y: number, ink: string, typeAt?: number) {
  const w = text.length * 3;
  g.text(text, x + Math.max(0, Math.floor((SLOT_W - w) / 2)), y, {
    colour: ink,
    size: 2,
    ...(typeAt === undefined ? {} : { type: { at: typeAt, cps: 16 } }),
  });
}

/** Where a lifted part is at t: from its slot to its crafting box in held steps. */
function lifted(plan: InventoryPlan, slot: Slot, to: number, t: number): readonly [number, number] {
  const u = EASES.inOut(seg(Math.floor(t * 15) / 15, plan.craft.at, plan.craft.at + LIFT_S));
  return [
    Math.round(slot.x + (to - slot.x) * u),
    Math.round(slot.y + (CRAFT_Y - slot.y) * u - 10 * Math.sin(Math.PI * u)),
  ];
}

export function drawInventory(g: TvPainter, plan: InventoryPlan, t: number): void {
  drawPanel(g, plan.title, plan.at + 0.1, plan.seed);
  const { craft } = plan;
  plan.slots.forEach((slot, i) => {
    if (t < slot.printAt) return;
    const away = (i === craft.a || i === craft.b) && t >= craft.at;
    if (t - slot.printAt < 0.1 && g.frame % 2 === 0) return; // 2600 flicker while it prints
    if (away) dashed(g, slot.x, slot.y, SLOT_W, SLOT_H, 'greyDark');
    else {
      g.rect(slot.x, slot.y, SLOT_W, SLOT_H, 'night');
      drawItem(g, slot, slot.x, slot.y);
    }
    label(g, slot.label, slot.x, slot.y + SLOT_H + 3, away ? 'greyDark' : 'tan');
  });
  let cursor: number | undefined;
  for (const [ct, i] of plan.cursor) if (t >= ct && t < craft.at) cursor = i;
  const slot = cursor === undefined ? undefined : plan.slots[cursor];
  if (slot !== undefined) bracket(g, slot.x, slot.y, SLOT_W, SLOT_H);
  if (t < craft.at) return;
  dashed(g, CRAFT_X[0], CRAFT_Y, SLOT_W, SLOT_H, 'teal');
  dashed(g, CRAFT_X[1], CRAFT_Y, SLOT_W, SLOT_H, 'teal');
  plus(g, CRAFT_X[0] + SLOT_W + 4, CRAFT_Y + 9, 'cream');
  const blink =
    t >= craft.at + LIFT_S && t < craft.reveal && Math.floor((t - craft.at) * 5) % 2 === 0;
  arrow(g, CRAFT_X[1] + SLOT_W + 6, CRAFT_Y + 9, blink ? 'gold' : 'tan');
  for (const [index, box] of [
    [craft.a, CRAFT_X[0]],
    [craft.b, CRAFT_X[1]],
  ] as const) {
    const part = plan.slots[index];
    if (part === undefined) continue;
    const [x, y] = lifted(plan, part, box, t);
    drawItem(g, part, x, y);
  }
  const res = craft.result;
  if (t < craft.reveal) {
    dashed(g, res.x, res.y, SLOT_W, SLOT_H, 'greyDark');
    return;
  }
  const d = t - craft.reveal;
  const sh = g.util.shake(t, craft.reveal + 0.05, 3, 10, plan.seed + 5);
  g.rect(res.x - 1 + sh.x, res.y - 1, SLOT_W + 2, SLOT_H + 2, d < 0.07 ? 'white' : 'gold');
  g.rect(res.x + 1 + sh.x, res.y + 1, SLOT_W - 2, SLOT_H - 2, 'night');
  drawItem(g, res, res.x + sh.x, res.y, d < 0.1 ? 0.6 : undefined);
  label(g, res.label, res.x - 2, res.y + SLOT_H + 4, 'gold', craft.reveal + 0.15);
}

export function inventoryCues(plan: InventoryPlan): Cue[] {
  const out: Cue[] = plan.cursor
    .filter(([t]) => t < plan.craft.at)
    .map(([t]) => ({ t, name: 'blip' }));
  out.push({ t: plan.slots[0]?.printAt ?? plan.at, name: 'blip-up' });
  out.push({ t: plan.craft.at, name: 'pop' });
  out.push({ t: plan.craft.reveal, name: 'success' });
  return out.sort((a, b) => a.t - b.t);
}
