/**
 * Render suite of a Sketchbook look (PLAN.md#13.6): the world-look suite (`world-looks.ts`) at
 * 960x540 in the sketchbook style - lint, goldens `look-<look>-<scene>-t<t>`, vibe guard,
 * seek-order determinism, contact sheet packages/kit/out/contact/look-<look>.png.
 */
import { describeWorldLook, type WorldScene } from './world-looks.js';

/** Scene file, shot length, golden times (shot seconds, as the showcase stills). */
export type SketchbookScene = WorldScene;

export function describeSketchbookLook(look: string, scenes: readonly SketchbookScene[]): void {
  describeWorldLook({ style: 'sketchbook', width: 960, height: 540, tile: 2 }, look, scenes);
}
