/**
 * `kit.fx.b2Hud`: the native 640x360 HUD of the Game B2 world over a `kit.fx.b2View` (transparent
 * elsewhere). Every element means something (QUALITY.md §6): compass = year + place + objective,
 * minimap = the walk so far, meter = HP of the thing really in danger, boss bar = the central
 * problem, progress = film progress with chapter flags, toasts / inventory = facts picked up,
 * dialogue / narration typed with an irregular cadence, choices struck out by hand.
 */
import { z } from 'zod';
import { asFx, type FxObject } from '../../../fx/shared.js';
import { anchorParam, createResolver } from '../../../looks/blueprint/timing.js';
import { defineFx, type KitTools } from '../../../registry.js';
import { colorOfSwatch } from '../palette.js';
import { createOutput, SCREEN_H, SCREEN_W } from '../view/output.js';
import { b2WorldOf } from '../view/view-fx.js';
import { hudExtras, type HudCue } from './hud-extra.js';
import { CALL, checkText, fail, parse, type Input } from './hud-schemas.js';
import { HudModel, type Span } from './model.js';

export const b2HudParams = z.object({
  size: z
    .tuple([z.int().min(64).max(3840), z.int().min(36).max(2160)])
    .default([SCREEN_W, SCREEN_H])
    .describe('Pass [ctx.shot.width, ctx.shot.height]'),
  view: z
    .unknown()
    .optional()
    .describe('The kit.fx.b2View this HUD belongs to (compass heading, minimap)'),
  duration: z
    .number()
    .min(0.5)
    .max(600)
    .optional()
    .describe('Shot length (ctx.shot.duration): the default `until` of every element'),
  seed: z.int().min(0).optional(),
  layer: z.int().min(0).max(9).default(1),
  anchor: anchorParam,
});

export type B2HudObject = FxObject & {
  compass(options: Input<'compass'>): Span;
  minimap(options?: Input<'minimap'>): Span;
  meter(options: Input<'meter'>): Span;
  status(options: Input<'status'>): Span;
  boss(options: Input<'boss'>): Span;
  progress(options: Input<'progress'>): Span;
  checkpoint(options: Input<'checkpoint'>): Span;
  toast(options: Input<'toast'>): Span;
  say(text: string, options: Input<'say'>): Span;
  narrate(text: string, options: Omit<Input<'say'>, 'speaker'>): Span;
  choose(options: Input<'choose'>): Span;
  inventory(options: Input<'inventory'>): Span;
  tally(spec: unknown): Span & { intent: string; cues: readonly HudCue[] };
  menu(spec: unknown): Span;
  stinger(text: string, options: unknown): Span & { cues: readonly HudCue[] };
  damage(options: unknown): Span;
  shake(options: unknown): Span;
};

function buildHud(params: z.output<typeof b2HudParams>, tools: KitTools): B2HudObject {
  const resolve = createResolver(params.anchor, CALL);
  const world = params.view === undefined ? undefined : b2WorldOf(params.view);
  if (params.view !== undefined && world === undefined)
    fail('view must be the object kit.fx.b2View() returned');
  const seed = params.seed ?? Math.floor(tools.rng() * 2_147_483_647) % 100_000;
  const end = params.duration ?? Number.POSITIVE_INFINITY;
  const model = new HudModel(seed, params.duration ?? 8);
  const output = createOutput(tools, params.size, params.layer, 'b2Hud');
  const at = (when: number | string): number => resolve(when, 0);
  const until = (when: number | string | undefined): number =>
    when === undefined ? end : resolve(when, end);
  const needsView = (what: string): void => {
    if (world === undefined) fail(`${what}() needs the view: kit.fx.b2Hud({ view, ... })`);
  };
  const api = {
    compass(options: unknown) {
      const o = parse('compass', options);
      const years = o.years?.map((key) => ({
        at: at(key.at),
        year: key.year,
        place: key.place,
      })) ?? [{ at: at(o.at), year: o.year ?? '', place: o.place }];
      const targets =
        o.targets?.map((key) => ({ at: at(key.at), pos: key.pos })) ??
        (o.target === undefined ? [] : [{ at: at(o.at), pos: o.target }]);
      model.compass({ at: at(o.at), until: until(o.until), years, targets });
      return { at: at(o.at), end: until(o.until) };
    },
    minimap(options?: unknown) {
      needsView('minimap');
      const o = parse('minimap', options);
      model.minimap(at(o.at), until(o.until));
      return { at: at(o.at), end: until(o.until) };
    },
    meter(options: unknown) {
      const o = parse('meter', options);
      checkText('meter.label', o.label, 1, 80, 1);
      const keys = o.keys.map(([t, value]) => [at(t), Math.min(value, o.segments)] as const);
      model.meter({
        label: o.label,
        at: at(o.at),
        until: until(o.until),
        segments: o.segments,
        keys,
      });
      return { at: at(o.at), end: until(o.until) };
    },
    status(options: unknown) {
      const o = parse('status', options);
      checkText('status.label', o.label, 1, 120, 1);
      model.status({ label: o.label, icon: o.icon, at: at(o.at), until: until(o.until) });
      return { at: at(o.at), end: until(o.until) };
    },
    boss(options: unknown) {
      const o = parse('boss', options);
      checkText('boss.name', o.name, 1, 190, 1);
      model.boss({
        name: o.name,
        label: o.label,
        at: at(o.at),
        until: until(o.until),
        keys: o.keys.map(([t, v]) => [at(t), v] as const),
      });
      return { at: at(o.at), end: until(o.until) };
    },
    progress(options: unknown) {
      const o = parse('progress', options);
      if (o.to < o.from) fail('progress(): to must be >= from (shares of the film)');
      model.progress({
        from: o.from,
        to: o.to,
        chapters: o.chapters,
        at: at(o.at),
        until: until(o.until),
      });
      return { at: at(o.at), end: until(o.until) };
    },
    checkpoint(options: unknown) {
      const o = parse('checkpoint', options);
      checkText('checkpoint.label', o.label, 1, 150, 1);
      const from = at(o.at);
      model.checkpoint({
        label: o.label,
        at: from,
        until: o.until === undefined ? from + 2.4 : until(o.until),
      });
      return { at: from, end: from + 2.4 };
    },
    toast(options: unknown) {
      const o = parse('toast', options);
      checkText('toast.body', o.body, 1, 200, 1);
      const from = at(o.at);
      return model.toast(o.head, o.body, from, o.until === undefined ? from + 2.8 : until(o.until));
    },
    say(text: string, options: unknown) {
      const o = parse('say', options);
      const caps = text.toUpperCase();
      checkText('say(text)', caps, 3, 560, 2);
      return model.say(
        caps,
        o.speaker,
        at(o.at),
        o.until === undefined ? undefined : until(o.until),
      );
    },
    narrate(text: string, options: unknown) {
      return api.say(text, {
        ...(typeof options === 'object' && options !== null ? options : {}),
        speaker: '',
      });
    },
    choose(options: unknown) {
      const o = parse('choose', options);
      o.options.forEach((option, i) => {
        checkText(`choose.options[${String(i)}]`, option, 1, 300, 2);
      });
      const steps = o.steps.map((step) => ({ ...step, at: at(step.at) }));
      for (const step of steps)
        for (const index of [step.cursor, step.strike, step.pick])
          if (index !== undefined && index >= o.options.length)
            fail(`choose(): step index ${String(index)} has no option`);
      model.choose({
        speaker: o.speaker,
        options: o.options,
        at: at(o.at),
        until: at(o.until),
        steps,
      });
      return { at: at(o.at), end: at(o.until) };
    },
    inventory(options: unknown) {
      const o = parse('inventory', options);
      const items = o.items.map((item, i) => {
        checkText(`inventory.items[${String(i)}].label`, item.label, 1, 200, 1);
        const band = item.band === undefined ? undefined : colorOfSwatch(item.band);
        return {
          icon: item.icon,
          label: item.label,
          at: at(item.at),
          out: item.out === undefined ? undefined : at(item.out),
          look: { label: item.itemLabel, band },
        };
      });
      model.inventory({ at: at(o.at), until: until(o.until), items });
      return { at: at(o.at), end: until(o.until) };
    },
    ...hudExtras({ model, world, seed, at, fail }),
  };
  const fx = asFx(output.object, (t) => {
    const screen = model.draw(t, world?.camera(t), world);
    output.present(screen.d);
  });
  const built: B2HudObject = Object.assign(fx, api);
  return built;
}

export const b2Hud = defineFx({
  name: 'b2Hud',
  description:
    'Game B2 HUD at native 640x360 over kit.fx.b2View: woodgrain plates with the year compass, minimap, threat meter, status effects, boss bar, film progress with chapter flags, quest/item toasts, inventory bar, dialogue / narration boxes with an irregular typewriter and choice boxes; the intermission tally, game menus, stingers and damage numbers. Every element must carry story data.',
  params: b2HudParams,
  methods: {
    'update(t)': 'Repaints the HUD for local time t: call it every frame',
    'compass({ at, year, place, years: [{ at, year, place }], target: [x, y], targets: [{ at, pos }] })':
      'Year (rolls when the story jumps in time), heading tape, objective marker, place typed under it',
    'minimap({ at })': 'The level around the player with the footprints of the walk (needs view)',
    'meter({ label, segments, keys: [[t, value]], at })':
      'HP-style meter: ONLY for the thing really in danger in the story (e.g. MARKET); losing segments blink clay',
    "status({ label, icon: 'hourglass' | 'waves' | 'alarm', at, until })":
      'A status effect under the compass (RUSHED, FLOODED)',
    'boss({ name, label, keys: [[t, share]], at, until })':
      'Boss bar: ONLY for the central problem; each step lands with an overshoot',
    'progress({ from, to, chapters })':
      'Film progress strip (shares of the film this shot spans) with chapter flags',
    'checkpoint({ label, at })':
      'A chapter flag pops on the progress strip and its name types under it',
    'toast({ head, body, at, until })':
      "'NEW QUEST' / '+ ITEM' / 'QUEST UPDATED' toast: types in, backspaces out",
    'say(text, { speaker, at, until })':
      'Dialogue line (CAPS, \\n breaks, <= 3 lines) typed at an irregular cadence; returns { at, end }',
    'narrate(text, { at, until })': 'The narration box (no speaker)',
    'choose({ speaker, options, at, until, steps: [{ at, cursor | strike | pick }] })':
      'A choice box: the cursor moves with an overshoot, struck options are crossed by hand, the pick lights up',
    "inventory({ items: [{ icon: 'cartridge' | 'calendar' | 'carton' | 'note' | 'key', label, at, itemLabel, band, out }], at, until })":
      'Inventory bar: facts picked up so far; a new one drops in and its name types above; `out` = it leaves (thrown)',
    'tally({ intent, at, until, title, sub, rows: [{ label, value, format, unit, approx, est, role, underline }], stamp: { text }, backdrop, enter, exit })':
      'Breakthrough: the intermission screen (chapter recap). Counters tick up row by row, then a still beat and a stamp; melts in, dissolves out; holds <= 4 s. Returns { at, end, cues }',
    'menu({ at, until, left, right, quest: { now, objective, done, ahead } | stats: { title, rows: [{ label, value, bar }] }, inventory: { items, select: [{ at, index }] }, note })':
      'Look B: the paused game menu over the dimmed level (quest log or stat sheet + inventory grid with a hopping cursor)',
    'stinger(text, { at, until, size, x, y })':
      'Look C: one big word slams in letter by letter on uneven beats and falls out at until',
    "damage({ text, at, on: 'meter' | 'boss', pos, colour })":
      'Look C: a number pops off the meter or the boss bar, rises and dissolves (call after meter / boss)',
    'shake({ at, amp })': 'The whole HUD shakes with decay (pair it with view.shake)',
  },
  build: buildHud,
});
