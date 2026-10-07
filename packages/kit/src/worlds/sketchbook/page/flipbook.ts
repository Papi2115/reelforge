/**
 * A flipbook in the page corner (look C, docs/worlds/sketchbook-v2 shot 6): `count` pages, each
 * drawn once like any page (its own page API, no hand), riffled by a thumb between `at` and
 * `until` (ease in-out, so it starts and ends slowly): page k folds away from the bottom-right
 * corner over page k + 1. The pages are complete and still (printed once each: the same doodle
 * redrawn on every page boils from page to page, not in time).
 */
import { InkCanvas } from '../draw/canvas.js';
import { cornerFold, drawThumb } from '../draw/fold.js';
import { ease, seg } from '../draw/math.js';
import type { Layer, SketchPage } from './model.js';

/** Page time the flipbook pages are shown at: every mark complete, the boil frame fixed. */
const STILL_T = 1e6;
/** Thumb tip on the page corner (page px). */
const THUMB: readonly [number, number] = [930, 508];

export interface FlipbookSpec {
  readonly pages: readonly SketchPage[];
  readonly at: number;
  readonly until: number;
}

export class Flipbook {
  private readonly spec: FlipbookSpec;
  private readonly cache = new Map<number, Uint8Array>();

  constructor(spec: FlipbookSpec) {
    this.spec = spec;
  }

  /** Which page is on top at t, and how far it has folded (0..1). */
  stateAt(t: number): { readonly index: number; readonly fold: number } {
    const last = this.spec.pages.length - 1;
    const f = last * ease('inOut', seg(t, this.spec.at, this.spec.until));
    const index = Math.min(last, Math.floor(f));
    return { index, fold: index >= last ? 0 : f - index };
  }

  /** Page `index` rendered still (kept for the next frames: they are the same pixels). */
  private still(index: number, width: number, height: number): Uint8Array {
    const cached = this.cache.get(index);
    if (cached) return cached;
    const page = this.spec.pages[index];
    const canvas = new InkCanvas(width, height);
    page?.render(canvas, STILL_T);
    if (this.cache.size >= 3) {
      const oldest = this.cache.keys().next().value;
      if (oldest !== undefined) this.cache.delete(oldest);
    }
    this.cache.set(index, canvas.data);
    return canvas.data;
  }

  /** The flipbook as the base layer of the page (it covers the whole stock). */
  layer(): Layer {
    return {
      key: Number.NEGATIVE_INFINITY,
      from: Number.NEGATIVE_INFINITY,
      draw: (canvas, t) => {
        const { index, fold } = this.stateAt(t);
        const top = this.still(index, canvas.width, canvas.height);
        if (fold < 0.02) {
          canvas.data.set(top);
          drawThumb(canvas, THUMB[0], THUMB[1], 0);
          return null;
        }
        const under = this.still(index + 1, canvas.width, canvas.height);
        cornerFold(canvas, top, under, ease('inOut', fold));
        drawThumb(canvas, THUMB[0], THUMB[1], -5 * Math.sin(Math.PI * fold));
        return null;
      },
    };
  }
}
