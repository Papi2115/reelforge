/**
 * The breakthrough toolkits and continuity helpers of `kit.fx.b1Screen` (PLAN.md#13.5 part b):
 * the high-score table and the instruction-manual page (never templates: `intent` required,
 * content from the narration), the calendar zoom, the cartridge insert / pull, the level-select
 * map and the game-over screen. Each validates with readable errors and returns its span, its
 * intent and its sound cues (`for (const c of r.cues) ctx.sfx.at(c.t, c.name)`).
 */
import { z } from 'zod';
import { checkHand, fail, parse } from './schemas.js';
import { gameOverCues, gameOverOverlay, gameOverSchema } from '../hud/game-over.js';
import { ManualLayer } from '../manual/manual-layer.js';
import { manualSchema, planManual } from '../manual/manual-plan.js';
import { colorOfSwatch } from '../palette.js';
import { ScoreTable } from '../scores/table-draw.js';
import { planScoreTable, scoreTableSchema } from '../scores/table-plan.js';
import { calendarLanding } from '../seams/calendar-zoom.js';
import { cartridgeCues, cartridgeSchema, planCartridge } from '../seams/cartridge.js';
import {
  drawLevelSelect,
  levelSelectCues,
  levelSelectSchema,
  planLevelSelect,
} from '../select/level-select.js';
import { whenParam } from '../../../looks/blueprint/timing.js';
import type { ScreenModel } from './model.js';

export interface Cue {
  readonly t: number;
  readonly name: string;
}

export interface Breakthrough {
  readonly at: number;
  readonly end: number;
  readonly intent: string;
  readonly cues: readonly Cue[];
}

const zoomSchema = z.strictObject({
  intent: z.string().min(12).max(160).describe('What the next place is and why the calendar'),
  at: whenParam.describe('The push into the calendar starts'),
  push: z.number().min(0.4).max(2.5).default(0.9),
  wipe: z
    .union([z.number().min(0.3).max(1.5), z.literal(false)])
    .default(0.62)
    .describe('Seconds of the line-by-line redraw into the TV picture; false = end on the page'),
});

export function toolkits(model: ScreenModel, at: (when: number | string) => number, end: number) {
  const span = (from: number, to: number, intent: string, cues: readonly Cue[]): Breakthrough => ({
    at: from,
    end: to,
    intent,
    cues: [...cues].sort((a, b) => a.t - b.t),
  });
  return {
    scoreTable(spec: unknown): Breakthrough {
      const plan = planScoreTable(parse(scoreTableSchema, spec, 'scoreTable()'), at);
      const table = new ScoreTable(plan);
      model.overlays.push(table.overlay);
      model.glassPainters.push(table.glass);
      return span(plan.at, plan.until, plan.intent, table.cues());
    },
    manual(spec: unknown): Breakthrough {
      const plan = planManual(parse(manualSchema, spec, 'manual()'), at);
      const layer = new ManualLayer(plan);
      model.papers.push(layer);
      return span(plan.at, plan.until, plan.intent, layer.cues());
    },
    calendarZoom(spec: unknown): Breakthrough & { landing: ReturnType<typeof calendarLanding> } {
      const o = parse(zoomSchema, spec, 'calendarZoom()');
      if (model.room?.calendar === undefined)
        fail('calendarZoom(): call room({ calendar: { month, mark } }) first (it zooms into it)');
      if (model.zoom !== undefined) fail('calendarZoom(): one calendar zoom per shot');
      const from = at(o.at);
      const rest = from + o.push;
      const wipeEnd = o.wipe === false ? undefined : rest + o.wipe;
      model.zoom = { at: from, end: rest, wipeEnd };
      const cues: Cue[] = [{ t: from, name: 'swoosh-in' }];
      if (wipeEnd !== undefined) cues.push({ t: rest, name: 'glitch' });
      return { ...span(from, wipeEnd ?? rest, o.intent, cues), landing: calendarLanding() };
    },
    cartridge(spec: unknown): Breakthrough {
      const o = parse(cartridgeSchema, spec, 'cartridge()');
      const stripe = colorOfSwatch(o.stripe);
      if (stripe === undefined) fail(`cartridge(): stripe "${o.stripe}" is not a game-b1 colour`);
      const label = o.label === undefined ? undefined : checkHand('cartridge.label', o.label);
      const plan = planCartridge(o, at(o.at), { label, stripe });
      for (const other of model.cartridges)
        if (plan.at < other.end && other.at < plan.end)
          fail('cartridge(): two cartridge swaps overlap in time');
      model.cartridges.push(plan);
      return span(plan.at, plan.end, o.intent, cartridgeCues(plan));
    },
    levelSelect(spec: unknown): Breakthrough {
      const plan = planLevelSelect(parse(levelSelectSchema, spec, 'levelSelect()'), at);
      model.overlays.push((cv, t) => {
        drawLevelSelect(cv, plan, t);
      });
      return span(plan.at, plan.until, plan.intent, levelSelectCues(plan));
    },
    gameOver(spec: unknown): { at: number; end: number; cues: readonly Cue[] } {
      const o = parse(gameOverSchema, spec, 'gameOver()');
      const from = at(o.at);
      const until = o.until === undefined ? end : at(o.until);
      const count = o.count.map(([t, digit]) => [at(t), digit] as const);
      const plan = { text: o.text, at: from, until, count, ghost: o.ghost, seed: model.seed + 808 };
      // A backdrop: the scene's tv() painters draw over it (a cartridge dropping through).
      const backdrop = gameOverOverlay(plan, model.bosses);
      model.painters.unshift((g, t) => {
        g.raw((cv) => {
          backdrop(cv, t);
        });
      });
      return { at: from, end: until, cues: gameOverCues(plan) };
    },
  };
}
