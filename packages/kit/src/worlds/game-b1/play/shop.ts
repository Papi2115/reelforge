/**
 * The shop / trade screen (`screen.shop(spec)`, a B1 breakthrough; PLAN.md#13.15 B1 rework): what
 * something costs, as a game shop. The narration's goods stand on a shelf with price tags, the
 * wallet counts what the player has (in the narration's unit: money, minutes, energy), each buy
 * hops the cursor to the item, the item flies into the wallet and the wallet rolls down; a buy the
 * wallet cannot pay blinks NOT ENOUGH and the item stays. A toolkit, never a template: `intent`
 * (required) says what the trade-off is; prices and the wallet are real numbers of the narration.
 */
import { z } from 'zod';
import { whenParam } from '../../../looks/blueprint/timing.js';
import { EASES, seg, sid } from '../core/math.js';
import type { TvPainter } from '../tv/painter.js';
import type { B1Sprite } from '../vocab/sprite.js';
import {
  BLINDS_S,
  bracket,
  capsText,
  checkHold,
  drawPanel,
  enterSchema,
  failer,
  intentSchema,
  printTimes,
  type Cue,
  type Fail,
} from './menu-kit.js';

const fail: Fail = failer('shop()');
const FLY_S = 0.45;
const SHELF_Y = 86;
const COL_W = 36;

export const shopSchema = z.strictObject({
  intent: intentSchema('shop'),
  at: whenParam,
  until: whenParam,
  title: z.string().min(1).max(14).default('SHOP'),
  wallet: z.strictObject({
    label: z.string().min(1).max(8).describe('What the player pays with (the narration word)'),
    amount: z.int().min(0).max(99999).describe('What the player has (a real number)'),
  }),
  items: z
    .array(
      z.strictObject({
        sprite: z.string().min(1),
        label: z.string().min(1).max(10),
        price: z.int().min(0).max(99999).describe('A real number of the narration'),
      }),
    )
    .min(2)
    .max(4),
  buys: z
    .array(z.strictObject({ item: z.int().min(0).max(3), at: whenParam }))
    .min(1)
    .max(3)
    .describe('The player buys (or tries to) on these beats'),
  keeper: z.string().min(1).optional().describe("The film's sprite id of whoever sells"),
  enter: enterSchema,
});

export type ShopInput = z.input<typeof shopSchema>;
type Spec = z.output<typeof shopSchema>;

interface Item {
  readonly sprite: B1Sprite;
  readonly label: string;
  readonly price: number;
  readonly x: number;
  readonly printAt: number;
}

interface Buy {
  readonly item: number;
  readonly at: number;
  /** false = the wallet cannot pay: NOT ENOUGH. */
  readonly paid: boolean;
  /** The wallet after this buy. */
  readonly after: number;
}

export interface ShopPlan {
  readonly intent: string;
  readonly at: number;
  readonly until: number;
  readonly title: string;
  readonly wallet: { readonly label: string; readonly amount: number };
  readonly items: readonly Item[];
  readonly buys: readonly Buy[];
  readonly keeper: B1Sprite | undefined;
  readonly enter: 'blinds' | 'cut';
  readonly seed: number;
}

export function planShop(
  spec: Spec,
  at: (when: number | string) => number,
  sprite: (id: string) => B1Sprite,
): ShopPlan {
  const start = at(spec.at);
  const until = at(spec.until);
  if (until <= start) fail('until must come after at');
  const seed = Math.abs(sid(spec.intent)) % 100_000;
  const first = start + (spec.enter === 'blinds' ? BLINDS_S : 0) + 0.15;
  const times = printTimes(spec.items.length, first, 0.16, seed);
  const items = spec.items.map((item, i) => ({
    sprite: sprite(item.sprite),
    label: capsText(fail, `items[${String(i)}].label`, item.label, 10),
    price: item.price,
    x: 10 + i * COL_W,
    printAt: times[i] ?? first,
  }));
  const lastPrint = Math.max(...items.map((item) => item.printAt));
  let wallet = spec.wallet.amount;
  let previous = lastPrint;
  const buys = spec.buys.map((buy, i): Buy => {
    const item = items[buy.item];
    if (item === undefined)
      fail(`buys[${String(i)}].item ${String(buy.item)}: there are ${String(items.length)} items`);
    const t = at(buy.at);
    if (t < previous + 0.3)
      fail(
        `buys[${String(i)}].at ${t.toFixed(2)}: leave >= 0.3 s after ${i === 0 ? 'the shelf prints' : 'the previous buy'} (${previous.toFixed(2)})`,
      );
    previous = t + FLY_S;
    const paid = item.price <= wallet;
    if (paid) wallet -= item.price;
    return { item: buy.item, at: t, paid, after: wallet };
  });
  checkHold(fail, until, previous + 0.4, 'the last buy');
  return {
    intent: spec.intent,
    at: start,
    until,
    title: capsText(fail, 'title', spec.title, 14),
    wallet: {
      label: capsText(fail, 'wallet.label', spec.wallet.label, 8),
      amount: spec.wallet.amount,
    },
    items,
    buys,
    keeper: spec.keeper === undefined ? undefined : sprite(spec.keeper),
    enter: spec.enter,
    seed,
  };
}

/** The wallet at t: rolls from the old amount to the new one while the item flies in. */
function walletAt(plan: ShopPlan, t: number): number {
  let value = plan.wallet.amount;
  for (const buy of plan.buys) {
    if (t < buy.at || !buy.paid) continue;
    const u = seg(t, buy.at + FLY_S * 0.6, buy.at + FLY_S + 0.25);
    value = Math.round(value + (buy.after - value) * u);
  }
  return value;
}

function drawWallet(g: TvPainter, plan: ShopPlan, t: number): void {
  const value = String(walletAt(plan, t));
  const x = 152 - value.length * 7.5;
  g.text(plan.wallet.label, 150 - plan.wallet.label.length * 3, 12, { colour: 'tan', size: 2 });
  const rolling = plan.buys.some(
    (buy) => buy.paid && t >= buy.at + FLY_S * 0.6 && t < buy.at + FLY_S + 0.25,
  );
  g.score(value, x, 22, { colour: rolling ? 'cream' : 'gold', cell: [6, 5] });
}

function drawShelf(g: TvPainter, plan: ShopPlan, t: number): void {
  const sold = new Set(plan.buys.filter((buy) => buy.paid && t >= buy.at).map((buy) => buy.item));
  g.rect(6, SHELF_Y, 148, 3, 'teak');
  g.rect(6, SHELF_Y + 3, 148, 1, 'walnut');
  plan.items.forEach((item, i) => {
    if (t < item.printAt || (t - item.printAt < 0.1 && g.frame % 2 === 0)) return;
    const s = item.sprite;
    const w = s.width * s.size;
    const h = s.height * s.rowH;
    if (!sold.has(i))
      g.draw(s.id, item.x + Math.floor((30 - w) / 2), SHELF_Y - h, { playfield: true });
    const tag = sold.has(i) ? 'SOLD' : String(item.price);
    g.rect(item.x + 2, SHELF_Y + 7, 26, 9, sold.has(i) ? 'rust' : 'cream');
    g.text(tag, item.x + 15 - tag.length * 1.5, SHELF_Y + 9, {
      colour: sold.has(i) ? 'cream' : 'walnutDark',
      size: 2,
    });
    g.text(item.label, item.x + 15 - item.label.length * 1.5, SHELF_Y + 20, {
      colour: 'tan',
      size: 2,
    });
  });
}

function drawBuys(g: TvPainter, plan: ShopPlan, t: number): void {
  let current: Buy | undefined;
  for (const buy of plan.buys) if (t >= buy.at - 0.25) current = buy;
  if (current === undefined) return;
  const item = plan.items[current.item];
  if (item === undefined) return;
  if (t < current.at + FLY_S) bracket(g, item.x, SHELF_Y - 30, 30, 48);
  if (!current.paid) {
    if (t >= current.at && Math.floor((t - current.at) * 4) % 2 === 0)
      g.text('NOT ENOUGH', 54, 150, { colour: 'crimson', size: 2 });
    return;
  }
  if (t < current.at || t >= current.at + FLY_S) return;
  const u = EASES.in(seg(Math.floor(t * 15) / 15, current.at, current.at + FLY_S));
  const s = item.sprite;
  const x = Math.round(item.x + (130 - item.x) * u);
  const y = Math.round(
    SHELF_Y - s.height * s.rowH + (24 - SHELF_Y) * u - 14 * Math.sin(Math.PI * u),
  );
  g.draw(s.id, x, y, { flicker: false });
}

export function drawShop(g: TvPainter, plan: ShopPlan, t: number): void {
  drawPanel(g, plan.title, plan.at + 0.1, plan.seed);
  g.rect(6, 128, 148, 44, 'walnut');
  g.rect(6, 128, 148, 2, 'teak');
  const keeper = plan.keeper;
  if (keeper !== undefined) {
    const bob = Math.floor(t * 2) % 2;
    g.draw(keeper.id, 112, 128 - keeper.height * keeper.rowH + bob, { flicker: false, frame: 0 });
  }
  drawShelf(g, plan, t);
  drawWallet(g, plan, t);
  drawBuys(g, plan, t);
}

export function shopCues(plan: ShopPlan): Cue[] {
  const out: Cue[] = [{ t: plan.items[0]?.printAt ?? plan.at, name: 'blip-up' }];
  for (const buy of plan.buys) {
    out.push({ t: buy.at - 0.25, name: 'blip' });
    out.push({ t: buy.at, name: buy.paid ? 'coin' : 'error-buzz' });
  }
  return out.sort((a, b) => a.t - b.t);
}
