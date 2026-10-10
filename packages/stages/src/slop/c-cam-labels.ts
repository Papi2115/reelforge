/**
 * The anti-slop knowledge of the Grim Ink world (`c-cam`, packages/kit/src/worlds/c-cam,
 * QUALITY.md §6/§8; `WorldSlopSpec` in world-labels.ts), calibrated in PLAN.md#14.12 on the kit's
 * c-cam examples and the world's goldens (c-cam-guards.test.ts: no finding on any of them; the frame
 * guards keep their general budgets, the widest place frame has 6 competing elements).
 *
 * Human traces: grime the scene draws on purpose (a stain that drips, plaster peeled to the
 * bricks, a crack, a puddle, flies jittering on twos), a foreground silhouette at the lens or in
 * the world, an expression that snaps on a beat (once per scene, however many cues); as options:
 * a Dutch tilt or tilted lettering (`rot`), a head jolt (`headDy`), a figure off-balance (`lean`),
 * a bow (`bow`), a micro-acting gag (`gag`: gum, sweat, a sip, PLAN.md#14.15), and what a place
 * paints in front of its people (`kit.places.<id>.foreground(…)`, once). Counted only as member
 * calls of the scene API (`env.ink.stain(…)`), never a local helper of the same name. The ink line's swell, the mottle and hatching inside every `blob` and
 * the ink background run everywhere and never count.
 *
 * Text: the world's ink lettering (`env.ink.drawText` and its layout calls) has the on-screen
 * string as its first argument (C_CAM_TEXT_METHODS). Labels: the words a grimy place prints on its
 * own things - a door or wall sign, a rubber stamp on a form, the heads of a ledger, the end card
 * of a poster - that are obvious labels of the shown object. Anything else (a poster's line, a
 * price, a name) still needs the narration or the research notes. Breakthroughs (`reverse`, `poster`) are camera and
 * poster grammar, not toolkit calls: their intent is the storyboard's and the critic's check.
 */
import { C_CAM_TEXT_METHODS } from '@reelforge/prompts';
import type { WorldSlopSpec } from './world-labels.js';

/** Words of signs, stamps, ledgers and tags that label the thing they are on. */
const INK_LABELS = [
  // door and wall signs
  'open closed exit private no entry in out push pull staff only keep danger caution warning wet floor fire smoking toilets',
  // rubber stamps on forms and letters
  'paid sold due void approved denied rejected received filed overdue urgent confidential copy draft cancelled',
  // the printed heads of a ledger or a bill
  'total balance debit credit net qty ref',
  // the end card of a poster
  'end',
].join(' ');

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
    foreground: 1,
  },
  traceCaps: { exprAt: 1, silhouette: 2, foreground: 1 },
  memberTraces: [
    'stain',
    'peel',
    'crack',
    'puddle',
    'flies',
    'silhouette',
    'fgWorld',
    'exprAt',
    'foreground',
  ],
  traceOptions: [
    { key: 'rot', trace: 'rot (a Dutch tilt on a tense beat, or tilted lettering)' },
    { key: 'headDy', trace: 'headDy (a head jolt)' },
    { key: 'lean', trace: 'lean (a figure off-balance)' },
    { key: 'bow', trace: 'bow (a bow from the hips)' },
    { key: 'gag', trace: 'gag (a micro-acting gag)' },
  ],
  labels: INK_LABELS.split(' '),
  labelPatterns: [],
  textMethods: C_CAM_TEXT_METHODS,
};
