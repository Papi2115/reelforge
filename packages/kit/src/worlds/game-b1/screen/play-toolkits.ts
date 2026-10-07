/**
 * The game-play toolkits of `kit.fx.b1Screen` (PLAN.md#13.15 B1 rework: the film is mostly GAME):
 * `level` = a 2D level played in the TV (the hero runs, jumps, collects, gets hit, stomps, reaches
 * the goal; events derived from the geometry), and three more breakthrough screens with a required
 * `intent`: `inventory` (parts combine into a result), `shop` (what something costs) and `splits`
 * (a run of steps and their real values). Each validates with readable errors and returns its
 * span, intent and sound cues (`for (const c of r.cues) ctx.sfx.at(c.t, c.name)`).
 */
import { drawLevel } from '../level/level-draw.js';
import { levelSchema, planLevel, type LevelEvent } from '../level/level-plan.js';
import { cameraX, heroAt } from '../level/level-motion.js';
import { drawInventory, inventoryCues, inventorySchema, planInventory } from '../play/inventory.js';
import { menuOverlay } from '../play/menu-kit.js';
import { drawShop, planShop, shopCues, shopSchema } from '../play/shop.js';
import { drawSplits, planSplits, splitsCues, splitsSchema } from '../play/splits.js';
import type { ScreenModel } from './model.js';
import { parse } from './schemas.js';
import type { Breakthrough, Cue } from './toolkits.js';

export interface LevelResult extends Breakthrough {
  /** What happened in the level and when (jump, collect, hit, stomp, goal): sync the HUD to it. */
  readonly events: readonly LevelEvent[];
  /** Where the hero stands on screen at t (TV units, top-left): labels and notes beside it. */
  heroAt(t: number): { readonly x: number; readonly y: number };
}

const LEVEL_CUES: Readonly<Record<LevelEvent['kind'], string>> = {
  jump: 'blip-up',
  collect: 'coin',
  hit: 'hit',
  stomp: 'pop',
  goal: 'success',
};

export function playToolkits(
  model: ScreenModel,
  at: (when: number | string) => number,
  end: number,
) {
  const sprite = (id: string) => model.vocab.sprite(id);
  const sorted = (cues: readonly Cue[]): Cue[] => [...cues].sort((a, b) => a.t - b.t);
  return {
    level(spec: unknown): LevelResult {
      const plan = planLevel(parse(levelSchema, spec, 'level()'), at, end, sprite);
      model.painters.push((g, t) => {
        drawLevel(g, plan, t);
      });
      return {
        at: plan.at,
        end: plan.until,
        intent: plan.intent,
        cues: sorted(plan.events.map((event) => ({ t: event.t, name: LEVEL_CUES[event.kind] }))),
        events: plan.events,
        heroAt: (t: number) => {
          const hero = heroAt(plan, t);
          const cam = plan.camera === 'follow' ? cameraX(plan.width, true, hero) : 0;
          return { x: hero.x - cam, y: hero.y };
        },
      };
    },
    inventory(spec: unknown): Breakthrough {
      const plan = planInventory(parse(inventorySchema, spec, 'inventory()'), at, sprite);
      model.overlays.push(
        menuOverlay(model.vocab, plan, (g, t) => {
          drawInventory(g, plan, t);
        }),
      );
      return { at: plan.at, end: plan.until, intent: plan.intent, cues: inventoryCues(plan) };
    },
    shop(spec: unknown): Breakthrough {
      const plan = planShop(parse(shopSchema, spec, 'shop()'), at, sprite);
      model.overlays.push(
        menuOverlay(model.vocab, plan, (g, t) => {
          drawShop(g, plan, t);
        }),
      );
      return { at: plan.at, end: plan.until, intent: plan.intent, cues: shopCues(plan) };
    },
    splits(spec: unknown): Breakthrough {
      const plan = planSplits(parse(splitsSchema, spec, 'splits()'), at, sprite);
      model.overlays.push(
        menuOverlay(model.vocab, plan, (g, t) => {
          drawSplits(g, plan, t);
        }),
      );
      return { at: plan.at, end: plan.until, intent: plan.intent, cues: splitsCues(plan) };
    },
  };
}
