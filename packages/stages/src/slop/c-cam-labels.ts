/**
 * The anti-slop knowledge of the Grim Ink world (`c-cam`, packages/kit/src/worlds/c-cam,
 * QUALITY.md §6/§8; `WorldSlopSpec` in world-labels.ts). The world is not wired yet
 * (PLAN.md#14.12), so no guard reads this until it is; calibration on the fixture film's frames is
 * 14.12's.
 *
 * Human traces: grime the scene draws on purpose (a stain that drips, plaster peeled to the
 * bricks, a crack, a puddle, flies jittering on twos), a foreground silhouette at the lens or in
 * the world, an expression that snaps on a beat (once per scene, however many cues); as options:
 * a Dutch tilt or tilted lettering (`rot`), a head jolt (`headDy`), a figure off-balance (`lean`),
 * a bow (`bow`). Counted only as member calls of the scene API (`env.ink.stain(…)`), never a local
 * helper of the same name. The ink line's swell, the mottle and hatching inside every `blob` and
 * the ink background run everywhere and never count.
 *
 * Text: the world's ink lettering (`env.ink.drawText` and its layout calls) has the on-screen
 * string as its first argument (C_CAM_TEXT_METHODS). Labels: the words of a sign, a stamp or a tag
 * that are obvious labels of the shown object. Breakthroughs (`reverse`, `poster`) are camera and
 * poster grammar, not toolkit calls: their intent is the storyboard's and the critic's check.
 */
import { C_CAM_TEXT_METHODS } from '@reelforge/prompts';
import type { WorldSlopSpec } from './world-labels.js';

/** Words of signs, stamps and tags that label the thing they are on. */
const INK_LABELS = 'open closed exit private no entry paid sold due end';

export const C_CAM_SLOP: WorldSlopSpec = {
  traceMethods: {
    stain: 1,
    peel: 1,
    crack: 1,
    puddle: 1,
    flies: 1,
    silhouette: 1,
    fgWorld: 1,
    exprAt: 1,
  },
  traceCaps: { exprAt: 1, silhouette: 2 },
  memberTraces: ['stain', 'peel', 'crack', 'puddle', 'flies', 'silhouette', 'fgWorld', 'exprAt'],
  traceOptions: [
    { key: 'rot', trace: 'rot (a Dutch tilt on a tense beat, or tilted lettering)' },
    { key: 'headDy', trace: 'headDy (a head jolt)' },
    { key: 'lean', trace: 'lean (a figure off-balance)' },
    { key: 'bow', trace: 'bow (a bow from the hips)' },
  ],
  labels: INK_LABELS.split(' '),
  labelPatterns: [],
  textMethods: C_CAM_TEXT_METHODS,
};
