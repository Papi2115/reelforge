/**
 * `kit.fx.b1Screen`: the Game B1 frame (PLAN.md#13.5). Two worlds in one 640x360 index frame:
 * the picture INSIDE the TV, painted by the scene with Atari 2600 rules (wide pixels, one colour
 * per sprite row, flicker when a scanline is crowded, playfield blocks, colour cycling) and given
 * the CRT; and the living room around the TV in clean square pixels, seen through a camera that
 * can push into the TV until its picture fills the frame (and back out). On the glass: sticky
 * notes. On top: the film HUD (year, score, cartridge progress, checkpoint, lives, dialogue).
 * Repainted from scratch for every t.
 */
import { z } from 'zod';
import { asFx, type FxObject } from '../../../fx/shared.js';
import { createResolver, whenParam } from '../../../looks/blueprint/timing.js';
import { defineFx, type KitTools } from '../../../registry.js';
import { dialogueTiming } from '../hud/dialogue.js';
import { VIEWS, type CameraKey } from '../room/view.js';
import type { TvPainter } from '../tv/painter.js';
import { ScreenModel, type Painter } from './model.js';
import { createOutput } from './output.js';
import {
  bossSchema,
  cameraKeySchema,
  checkHand,
  checkJoy,
  checkpointSchema,
  fail,
  livesSchema,
  noteSchema,
  parse,
  progressSchema,
  roomSchema,
  saySchema,
  scoreSchema,
  screenParams,
} from './schemas.js';
import { SCREEN_METHODS } from './methods.js';
import { toolkits, type Breakthrough, type Cue } from './toolkits.js';

export interface Span {
  readonly at: number;
  readonly end: number;
}

export type B1ScreenObject = FxObject & {
  tv(painter: (g: TvPainter, t: number) => void): void;
  room(spec?: unknown): void;
  camera(keys: unknown): void;
  year(year: string | number, options: unknown): Span;
  score(options: unknown): Span;
  progress(options: unknown): Span;
  checkpoint(options: unknown): Span;
  lives(options: unknown): Span;
  boss(options: unknown): Span;
  say(text: string, options: unknown): Span;
  narrate(text: string, options: unknown): Span;
  note(lines: readonly string[], options: unknown): Span;
  scoreTable(spec: unknown): Breakthrough;
  manual(spec: unknown): Breakthrough;
  calendarZoom(spec: unknown): Breakthrough;
  cartridge(spec: unknown): Breakthrough;
  levelSelect(spec: unknown): Breakthrough;
  gameOver(spec: unknown): Span & { cues: readonly Cue[] };
};

function buildScreen(params: z.output<typeof screenParams>, tools: KitTools): B1ScreenObject {
  const resolve = createResolver(params.anchor, 'kit.fx.b1Screen()');
  const seed = params.seed ?? Math.floor(tools.rng() * 2_147_483_647) % 100_000;
  const end = params.duration ?? Number.POSITIVE_INFINITY;
  const model = new ScreenModel(seed, params.duration ?? 8, params.flickerLimit);
  const output = createOutput(tools, params.size, params.layer);
  const at = (when: number | string): number => resolve(when, 0);
  const until = (when: number | string | undefined, fallback = end): number =>
    when === undefined ? fallback : resolve(when, fallback);
  const pair = (value: readonly [number | string, number | string]) =>
    [at(value[0]), at(value[1])] as const;

  const api = {
    tv(painter: unknown) {
      if (typeof painter !== 'function') fail('tv(painter): pass a function (g, t) => { ... }');
      model.painters.push(painter as Painter);
    },
    room(spec?: unknown) {
      const o = parse(roomSchema, spec, 'room()');
      const gift = o.gift;
      model.room = {
        calendar:
          o.calendar === false
            ? undefined
            : {
                month: checkJoy('room.calendar.month', o.calendar.month),
                mark: o.calendar.mark,
                ring: o.calendar.markAt === undefined ? [-2, -1] : pair(o.calendar.markAt),
              },
        tree: o.tree,
        presents: o.presents ?? o.tree,
        gift:
          gift === undefined
            ? undefined
            : {
                slot: pair(gift.slot),
                tag: gift.tag.map((line, i) => checkHand(`room.gift.tag[${String(i)}]`, line)),
                tagAt: pair(gift.tagAt),
                blink: gift.blink === undefined ? undefined : at(gift.blink),
              },
        lamp: o.lamp,
        carts: o.carts,
      };
    },
    camera(keys: unknown) {
      const list = parse(z.array(cameraKeySchema).min(1).max(32), keys, 'camera(keys)');
      const resolved: CameraKey[] = list.map((key, i) => {
        const custom = key.x !== undefined || key.y !== undefined || key.zoom !== undefined;
        if (custom === (key.on !== undefined))
          fail(`camera(keys)[${String(i)}]: give either on: 'room' | 'tv' | ... or x, y, zoom`);
        const view =
          key.on === undefined
            ? { fx: key.x ?? 160, fy: key.y ?? 90, s: key.zoom ?? 2, inTv: 0 }
            : VIEWS[key.on];
        return { at: at(key.at), view, ease: key.ease };
      });
      for (let i = 1; i < resolved.length; i += 1)
        if ((resolved[i]?.at ?? 0) < (resolved[i - 1]?.at ?? 0))
          fail(`camera(keys)[${String(i)}]: keys must be in time order`);
      model.camera.splice(0, model.camera.length, ...resolved);
    },
    year(year: string | number, options: unknown) {
      const text = String(year);
      if (!/^\d{1,4}$/.test(text)) fail(`year("${text}"): 1-4 digits (the story's year)`);
      const o = parse(z.strictObject({ at: whenParam }), options, 'year()');
      model.years.push({ at: at(o.at), year: text });
      model.years.sort((a, b) => a.at - b.at);
      return { at: at(o.at), end };
    },
    score(options: unknown) {
      const o = parse(scoreSchema, options, 'score()');
      const keys = o.keys.map(([t, v]) => [at(t), v] as const);
      model.score = {
        at: at(o.at),
        until: until(o.until),
        label: checkJoy('score.label', o.label),
        keys,
      };
      return { at: at(o.at), end: until(o.until) };
    },
    progress(options: unknown) {
      const o = parse(progressSchema, options, 'progress()');
      if (o.to < o.from) fail('progress(): to must be >= from (shares of the film)');
      model.progress = { at: at(o.at), from: o.from, to: o.to, slots: o.slots };
      return { at: at(o.at), end };
    },
    checkpoint(options: unknown) {
      const o = parse(checkpointSchema, options, 'checkpoint()');
      const from = at(o.at);
      const label = checkJoy('checkpoint.label', o.label);
      model.checkpoints.push({ at: from, until: until(o.until, from + 2.4), label });
      return { at: from, end: until(o.until, from + 2.4) };
    },
    lives(options: unknown) {
      const o = parse(livesSchema, options, 'lives()');
      const keys = o.keys.map(([t, v]) => [at(t), Math.min(v, o.max)] as const);
      const label = checkJoy('lives.label', o.label);
      model.lives = { at: at(o.at), until: until(o.until), label, max: o.max, keys };
      return { at: at(o.at), end: until(o.until) };
    },
    boss(options: unknown) {
      const o = parse(bossSchema, options, 'boss()');
      const hp = o.hp;
      model.bosses.push({
        at: at(o.at),
        num: o.num,
        name: checkJoy('boss.name', o.name),
        from: o.from,
        x: o.x,
        y: o.y,
        seed: o.seed ?? seed + 31 * model.bosses.length + o.num,
        hp:
          hp === undefined
            ? undefined
            : {
                n: hp.n,
                label: checkJoy('boss.hp.label', hp.label),
                keys: hp.keys.map(([t, v]) => [at(t), Math.min(v, hp.n)] as const),
                segW: hp.segW,
              },
        defeat: o.defeat === undefined ? undefined : at(o.defeat),
      });
      return { at: at(o.at), end: o.defeat === undefined ? end : at(o.defeat) + 0.62 };
    },
    say(text: string, options: unknown) {
      const o = parse(saySchema, options, 'say()');
      const caps = checkJoy('say(text)', text, 3);
      const speaker = checkJoy('say.speaker', o.speaker);
      const from = at(o.at);
      const typedEnd = dialogueTiming({ text: caps, speaker, at: from });
      const to = until(o.until, typedEnd + 1.6);
      model.dialogues.push({ text: caps, speaker, at: from, until: to, place: o.place });
      return { at: from, end: to };
    },
    narrate(text: string, options: unknown) {
      const rest = typeof options === 'object' && options !== null ? options : {};
      return api.say(text, { ...rest, speaker: '' });
    },
    note(lines: readonly string[], options: unknown) {
      const list = parse(z.array(z.string().min(1).max(16)).min(1).max(4), lines, 'note(lines)');
      const o = parse(noteSchema, options, 'note()');
      model.notes.push({
        at: at(o.at),
        x: o.x,
        y: o.y,
        w: o.w,
        h: o.h,
        angle: o.angle,
        lines: list.map((line, i) => checkHand(`note(lines)[${String(i)}]`, line)),
        size: o.size,
        seed: o.seed ?? 51 + model.notes.length * 13,
        under: o.under,
        strike: o.strike === undefined ? undefined : { line: o.strike.line, at: at(o.strike.at) },
        tick: o.tick === undefined ? undefined : at(o.tick),
      });
      return { at: at(o.at), end };
    },
  };
  const fx = asFx(output.object, (t) => {
    output.present(model.render(t));
  });
  return Object.assign(fx, api, toolkits(model, at, end));
}

export const b1Screen = defineFx({
  name: 'b1Screen',
  description:
    'Game B1 world (Atari-era boss montage): one frame of two worlds. Inside the TV the scene paints with Atari 2600 rules (wide pixels, one colour per sprite row, flicker on crowded lines, playfield, CRT); around it a wood-panelled 1982 living room in square pixels with a camera that pushes into the TV and back. Sticky notes on the glass, boss cards, a film HUD (year, score, cartridge progress, checkpoint, lives, dialogue), the high-score table and manual page toolkits, the calendar zoom, the cartridge insert / pull, the level-select map and the game-over screen. Build once, call update(t) every frame.',
  params: screenParams,
  methods: SCREEN_METHODS,
  build: buildScreen,
});
