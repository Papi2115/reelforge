/**
 * The methods of `kit.fx.b2Hud` added for looks B and C and the tally breakthrough (PLAN.md#13.4
 * part b): `tally(spec)` (the intermission screen, `intent` required), `menu(spec)` (quest log,
 * stat sheet, inventory grid), `stinger(text, opts)` (big slam-in word), `damage(opts)` (a number
 * popping off the meter or the boss bar) and `shake(opts)` (the HUD shakes with decay). Each
 * validates with readable errors and returns its times (and sound cues where it has some).
 */
import { z } from 'zod';
import { textWidth } from '../core/font.js';
import { colorOfSwatch } from '../palette.js';
import { artOf } from '../view/view-assets.js';
import type { B2World } from '../view/world.js';
import { checkText, parseWith, time } from './hud-schemas.js';
import { ICONS, isIconName } from './inventory.js';
import { createMenu, menuSchema } from './menu.js';
import type { HudModel, Span } from './model.js';
import { stingerLands } from './stinger.js';
import { planTally, tallySchema } from './tally-plan.js';

export interface HudCue {
  readonly t: number;
  /** A built-in sound name for `ctx.sfx.at` (the world's palette re-voices it). */
  readonly name: 'tick' | 'blip' | 'stamp' | 'hit-soft';
}

const stingerSchema = z.strictObject({
  at: time,
  until: time.optional(),
  size: z.int().min(3).max(6).default(5).describe('Pixel scale of the letters'),
  x: z.number().min(0).max(600).default(64),
  y: z.number().min(0).max(320).default(112),
});

const damageSchema = z.strictObject({
  text: z
    .string()
    .min(1)
    .max(10)
    .transform((text) => text.toUpperCase())
    .describe('-2, +1, -40%: a number of the story or the meter'),
  at: time,
  on: z.enum(['meter', 'boss']).default('boss'),
  pos: z.tuple([z.number(), z.number()]).optional().describe('Screen px instead of on'),
  colour: z.string().default('clay').describe('clay = loss, sage = gain'),
});

const shakeSchema = z.strictObject({ at: time, amp: z.number().min(0.5).max(6).default(2.5) });

interface Context {
  readonly model: HudModel;
  readonly world: B2World | undefined;
  readonly seed: number;
  readonly at: (when: number | string) => number;
  readonly fail: (message: string) => never;
}

export function hudExtras({ model, world, seed, at, fail }: Context) {
  const time2 = (when: number | string): number => at(when);
  return {
    tally(spec: unknown): Span & { intent: string; cues: readonly HudCue[] } {
      const o = parseWith(tallySchema, spec, 'tally()');
      if (world === undefined && (o.enter === 'melt' || o.backdrop === 'freeze'))
        fail("tally(): enter 'melt' and backdrop 'freeze' need the view: kit.fx.b2Hud({ view })");
      const plan = planTally(o, time2, seed, fail);
      model.tally(plan);
      // Opaque from its first frame to its exit: the view under it need not render.
      if (world !== undefined && plan.backdrop !== 'live') world.occlude(plan.at, plan.outAt);
      const cues: HudCue[] = [];
      for (const row of plan.rows) {
        row.times.slice(0, -1).forEach((t, k) => {
          if (k % 2 === 0) cues.push({ t, name: 'tick' });
        });
        cues.push({ t: row.landed, name: 'blip' });
      }
      if (plan.stamp !== undefined) cues.push({ t: plan.stamp.at, name: 'stamp' });
      return { at: plan.at, end: plan.until, intent: plan.intent, cues };
    },
    menu(spec: unknown): Span {
      const o = parseWith(menuSchema, spec, 'menu()');
      if (o.quest === undefined && o.stats === undefined && o.inventory === undefined)
        fail('menu(): give a quest, stats or an inventory');
      if (o.quest !== undefined && o.stats !== undefined)
        fail('menu(): quest and stats share the left column; pick one');
      const from = at(o.at);
      const until = at(o.until);
      if (until - from < 2.5) fail('menu(): a menu needs >= 2.5 s on screen');
      if (o.quest !== undefined) {
        checkText('menu.quest.now', o.quest.now, 1, 330, 3);
        checkText('menu.quest.objective', o.quest.objective, 1, 330, 2);
        o.quest.done.forEach((line, i) => {
          checkText(`menu.quest.done[${String(i)}]`, line, 1, 330, 1);
        });
      }
      o.stats?.rows.forEach((row, i) => {
        checkText(`menu.stats.rows[${String(i)}].value`, row.value, 1, 160, 2);
      });
      if (o.stats !== undefined) checkText('menu.stats.title', o.stats.title, 1, 330, 3);
      const arts = (o.inventory?.items ?? []).map((item, i) => {
        const art = world === undefined ? undefined : artOf(world.assets, item.icon);
        if (!isIconName(item.icon) && art === undefined)
          fail(
            `menu.inventory.items[${String(i)}].icon "${item.icon}" is unknown (known: ${ICONS.join(', ')}; or an icon id of the view's assets)`,
          );
        return art;
      });
      o.inventory?.items.forEach((item, i) => {
        checkText(`menu.inventory.items[${String(i)}].label`, item.label, 1, 170, 1);
        if (item.band !== undefined && colorOfSwatch(item.band) === undefined)
          fail(`menu.inventory.items[${String(i)}].band "${item.band}" is not a game-b2 colour`);
      });
      if (o.note !== undefined) checkText('menu.note', o.note, 2, 130, 1);
      const items = o.inventory?.items.length ?? 0;
      const select = (o.inventory?.select ?? []).map((step, i) => {
        if (step.index >= items)
          fail(`menu.inventory.select[${String(i)}]: no item ${String(step.index)}`);
        return { at: at(step.at), index: step.index };
      });
      model.menu(createMenu(o, from, until, select, seed, arts));
      return { at: from, end: until };
    },
    stinger(text: string, options: unknown): Span & { cues: readonly HudCue[] } {
      const o = parseWith(stingerSchema, options, 'stinger()');
      const caps = text.toUpperCase();
      checkText('stinger(text)', caps, 1, 600 - o.x, o.size);
      if (caps.length > 16) fail('stinger(text): at most 16 characters (one or two words)');
      const from = at(o.at);
      const lands = stingerLands(caps, from, seed + caps.length);
      const end = o.until === undefined ? (lands.at(-1) ?? from) + 1.6 : at(o.until);
      if (end - (lands.at(-1) ?? from) < 0.6)
        fail('stinger(): hold the word >= 0.6 s after its last letter lands');
      model.stinger({ text: caps, x: o.x, y: o.y, scale: o.size, lands, until: end, seed });
      return { at: from, end, cues: [{ t: lands[0] ?? from, name: 'hit-soft' }] };
    },
    damage(options: unknown): Span {
      const o = parseWith(damageSchema, options, 'damage()');
      checkText('damage.text', o.text, 1, 200, 3);
      const colour = colorOfSwatch(o.colour);
      if (colour === undefined) return fail(`damage.colour "${o.colour}" is not a game-b2 colour`);
      const from = at(o.at);
      const [x, y] = o.pos ?? model.anchorOf(o.on, from);
      const w = textWidth(o.text, 3);
      model.damage({
        text: o.text,
        at: from,
        x: Math.min(630 - w / 2, Math.max(w / 2 + 10, x)),
        y,
        colour,
      });
      return { at: from, end: from + 0.95 };
    },
    shake(options: unknown): Span {
      const o = parseWith(shakeSchema, options, 'shake()');
      const from = at(o.at);
      model.shake({ at: from, amp: o.amp });
      return { at: from, end: from + 0.6 };
    },
  };
}
