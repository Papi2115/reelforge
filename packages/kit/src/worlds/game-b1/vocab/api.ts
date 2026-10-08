/**
 * The open-vocabulary methods of `kit.fx.b1Screen` (PLAN.md#13.15): the film defines its own TV
 * things (`defineSprite`, `definePlayfield`, `generate`), loads its project asset files
 * (`assets`) and builds its own room around the TV (`interior`). Definitions happen in build();
 * the painter draws them by id (`g.draw`, `g.field`).
 */
import { interiorProblems, planInterior } from '../room/interior.js';
import { interiorSchema } from '../room/interior-schema.js';
import type { ScreenModel } from '../screen/model.js';
import { checkJoy, fail, parse } from '../screen/schemas.js';
import { loadB1Assets, type B1AssetIds } from './assets.js';
import type { B1Playfield } from './playfield.js';
import type { B1Sprite } from './sprite.js';

/** What a scene needs to lay a definition out: its size in TV units and its frames. */
export interface VocabInfo {
  readonly id: string;
  readonly w: number;
  readonly h: number;
  readonly frames: number;
}

function info(made: B1Sprite | B1Playfield): VocabInfo {
  if ('lines' in made) return { id: made.id, w: 160, h: made.height, frames: 1 };
  const span = made.copies[made.copies.length - 1] ?? 0;
  return {
    id: made.id,
    w: made.width * made.size + span,
    h: made.height * made.rowH,
    frames: made.frames.length,
  };
}

export function vocabApi(model: ScreenModel, at: (when: number | string) => number) {
  return {
    defineSprite(id: string, spec: unknown): VocabInfo {
      return info(model.vocab.defineSprite(id, spec));
    },
    definePlayfield(id: string, spec: unknown): VocabInfo {
      return info(model.vocab.definePlayfield(id, spec));
    },
    generate(id: string, spec: unknown): VocabInfo {
      return info(model.vocab.generate(id, spec));
    },
    assets(file: unknown): B1AssetIds {
      return loadB1Assets(model.vocab, file, (m) => fail(`assets(file):\n${m}`));
    },
    interior(spec?: unknown): void {
      if (model.room !== undefined)
        fail('interior(): the room is already set (room() or interior() once per shot)');
      const raw = typeof spec === 'string' ? model.vocab.room(spec) : spec;
      const o = parse(interiorSchema, raw, 'interior()');
      const problems = interiorProblems(o, (id) => model.vocab.sprites.has(id));
      if (problems.length > 0) fail(`interior(): ${problems.join('; ')}`);
      const cal = o.calendar;
      const month = cal === false ? '' : checkJoy('interior.calendar.month', cal.month);
      const ring =
        cal === false || cal.markAt === undefined
          ? ([-2, -1] as const)
          : ([at(cal.markAt[0]), at(cal.markAt[1])] as const);
      model.interior = planInterior(o, model.seed, ring, month);
      model.room = {
        calendar: cal === false ? undefined : { month, mark: cal.mark, ring },
        tree: false,
        presents: false,
        gift: undefined,
        lamp: false,
        carts: o.carts,
      };
    },
  };
}
