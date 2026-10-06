/**
 * The two breakthrough page methods of the Sketchbook world (PLAN.md#13.6, showcase sketchbook-v2
 * shots 5 and 8): `page.popup(spec)` (a pop-up card standing up from the page) and
 * `page.strip(spec)` (an accordion timeline strip dragged through the view). Both are rare: at
 * most one per ~60-90 s of film, each the one showpiece of its shot.
 */
import type { Resolver } from '../../../looks/blueprint/timing.js';
import { addPopup, type PopupHandle } from '../breakthrough/popup.js';
import { popupOptions } from '../breakthrough/popup-schema.js';
import { addStrip, type StripHandle } from '../breakthrough/strip.js';
import { stripOptions } from '../breakthrough/strip-schema.js';
import type { SketchPage } from './model.js';
import { parse } from './schemas.js';

export interface BreakthroughDeps {
  readonly page: SketchPage;
  readonly resolve: Resolver;
  /** Starts a method call (fails once the page is sealed); returns its call name. */
  readonly begin: (method: string) => string;
  readonly seedOf: (own: number | undefined) => number;
}

export function breakthroughs(deps: BreakthroughDeps) {
  const { page, resolve, begin, seedOf } = deps;
  return {
    popup(spec: unknown): PopupHandle {
      const call = begin('popup');
      const o = parse(popupOptions, spec, call);
      return addPopup(o, { page, resolve, seed: seedOf(o.seed), call });
    },
    strip(spec: unknown): StripHandle {
      const call = begin('strip');
      const o = parse(stripOptions, spec, call);
      return addStrip(o, { page, resolve, seed: seedOf(o.seed), call });
    },
  };
}
