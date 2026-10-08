/**
 * The Comic calibration's other side (PLAN.md#13.3 part c): deliberately bad comic scenes and
 * frames ("planted fakes") through the public guards with the showcase narration and research;
 * at least 90 % must be caught (the approved templates and goldens are the false-positive side,
 * comic-guards.test.ts).
 */
import { resolveStyle } from '@reelforge/engine';
import type { RgbaImage } from '@reelforge/engine/raster';
import { describe, expect, it } from 'vitest';
import { COMIC_NARRATION, COMIC_RESEARCH } from '../testing/comic-slop-fixtures.js';
import {
  copyFrame,
  goldenFrames,
  mirrorLeftHalf,
  paintRect,
  shiftRight,
  type Rgb,
} from '../testing/slop-fixtures.js';
import { breakthroughSpecs, repeatedBreakthroughFindings } from './breakthrough-intent.js';
import { parseHex } from './frame-guards.js';
import {
  sameCompositionFindings,
  slopFrameFindings,
  slopSourceFindings,
  type AntiSlopSetup,
} from './guards.js';
import { parseScene } from './source-text.js';
import { buildVocabulary } from './vocabulary.js';
import { worldSlopSpec } from './world-labels.js';

const SPEC = worldSlopSpec('comic');
const SETUP: AntiSlopSetup = {
  vocabulary: buildVocabulary([COMIC_NARRATION, COMIC_RESEARCH]),
  spec: SPEC,
  accent: parseHex(resolveStyle({ style: 'comic' }).palette.accent1),
};
const INK: Rgb = [0x1b, 0x17, 0x14];
const GOLDENS = goldenFrames(/^look-comic-story-(hook-t6\.9|descent-t7\.9|descent-t3)\.png$/);

function golden(name: string): RgbaImage {
  const image = GOLDENS.get(`${name}.png`);
  if (image === undefined) throw new Error(`no golden ${name}`);
  return copyFrame(image);
}

/** A comic scene with three traces (thumbprint, smudge, pencil note) around `body`. */
const scene = (body: string): string =>
  `export function build(ctx) {
  const page = ctx.kit.fx.comicPage({ seed: 3, anchor: ctx.anchor });
  page.thumbprint(600, 340);
  page.smudge(300, 200, { length: 8 });
  page.note('WHAT IS 1202?', { x: 480, y: 330, at: 2.1 });
${body}
  return { page };
}
export function update(t, state) { state.page.update(t); }
`;

const FLASHBACK = (intent: string, extra = ''): string =>
  `  page.flashback({ intent: '${intent}', when: 'EIGHT YEARS EARLIER...', beats: [{ at: 1, draw: (g) => g.rect(0, 0, 9, 9, 'paper') }]${extra} });`;

const sourceFlags = (source: string, reason: string): boolean =>
  slopSourceFindings(SETUP, source, 'scenes/s01.js').some((entry) =>
    entry.message.startsWith(reason),
  );

const frameFlags = (image: RgbaImage, reason: string): boolean =>
  slopFrameFindings(SETUP, [{ t: 1, image }], { treatment: 'map' }).some((entry) =>
    entry.message.startsWith(reason),
  );

const sameFlags = (first: RgbaImage, second: RgbaImage): boolean =>
  sameCompositionFindings([
    { shot: { id: 's01' }, frame: { t: 1, image: first } },
    { shot: { id: 's02' }, frame: { t: 1, image: second } },
  ]).has('s02');

function repeats(first: string, second: string): boolean {
  const kinds = SPEC?.breakthroughs ?? {};
  const specs = (source: string) => {
    const program = parseScene(scene(source));
    return program === undefined ? [] : breakthroughSpecs(program, kinds);
  };
  return repeatedBreakthroughFindings([
    { shotId: 's03', specs: specs(first) },
    { shotId: 's11', specs: specs(second) },
  ]).has('s11');
}

const SPREAD = (intent: string, assemble: string): string =>
  `  page.spread({ intent: '${intent}', art: (g) => g.rect(0, 0, 640, 360, 'paper'), assemble: '${assemble}' });`;

const CASES: readonly (readonly [string, () => boolean])[] = [
  // Text provenance in the comic lettering.
  ['invented caption', () => sourceFlags(scene(`  page.caption('QUANTUM DRIVE ONLINE', { x: 9, y: 9, at: 1 });`), 'invented text')],
  ['invented name in a balloon', () => sourceFlags(scene(`  page.balloon('Captain Zorblax here.', { x: 9, y: 9, at: 1 });`), 'invented text')],
  ['fake number on a stamp', () => sourceFlags(scene(`  page.stamp('4096', { x: 9, y: 9, at: 1 });`), 'invented text')],
  ['fake percentage in a panel', () => sourceFlags(scene(`  page.panel([0, 0, 9, 0, 9, 9, 0, 9]).draw((g) => g.text('87% FASTER', 4, 4));`), 'invented text')],
  ['a word that is no sound slammed as sfx', () => sourceFlags(scene(`  page.sfx('SYNERGY', { x: 9, y: 9, at: 1 });`), 'invented text')],
  ['invented flashback time stamp', () => sourceFlags(scene(FLASHBACK('the deadline was set in 1961 for the Moon').replace('EIGHT YEARS EARLIER...', 'IN THE YEAR 3000...')), 'invented text')],
  ['lorem ipsum in a margin note', () => sourceFlags(scene(`  page.note('lorem ipsum dolor', { x: 9, y: 9, at: 1 });`), 'invented text')],
  ['invented spread title', () => sourceFlags(scene(`  page.draw((g) => g.standing('ATLANTIS', { x: 9, y0: 300, y1: 280, h0: 30, h1: 20 }));`), 'invented text')],
  ['fake display digits', () => sourceFlags(scene(`  page.draw((g) => g.digits('7777', 9, 9));`), 'invented text')],
  // Breakthrough intents.
  ['flashback without an intent', () => sourceFlags(scene(`  page.flashback({ when: 'EIGHT YEARS EARLIER...', beats: [] });`), 'flashback without an intent')],
  ['generic flashback intent', () => sourceFlags(scene(FLASHBACK('the flashback')), 'generic flashback intent')],
  ['intent the narration never makes', () => sourceFlags(scene(FLASHBACK('a dramatic journey through destiny and fate')), 'flashback intent')],
  ['spread without an intent', () => sourceFlags(scene(`  page.spread({ art: (g) => g.rect(0, 0, 9, 9, 'paper') });`), 'spread without an intent')],
  ['the same flashback mechanism twice', () => repeats(FLASHBACK('the deadline was set in 1961 for the Moon'), FLASHBACK('the logbook of 1947 kept the moth from the relay'))],
  ['the same spread intent twice', () => repeats(SPREAD('Eagle landed on the Sea of Tranquility', 'merge'), SPREAD('Eagle has landed on the Sea of Tranquility', 'unfold'))],
  // Human traces.
  ['no traces', () => sourceFlags(`export function build(ctx) { const page = ctx.kit.fx.comicPage({}); page.panels('2-up'); page.balloon('GO.', { x: 9, y: 9, at: 1 }); return { page }; }`, 'too few human traces')],
  ['two traces', () => sourceFlags(`export function build(ctx) { const page = ctx.kit.fx.comicPage({}); page.thumbprint(1, 1); page.smudge(9, 9); return { page }; }`, 'too few human traces')],
  ['seeded jitter only', () => sourceFlags(`export function build(ctx) { const page = ctx.kit.fx.comicPage({}); page.panel([0, 0, 9, 0, 9, 9, 0, 9]).draw((g) => { g.rect(g.rnd('a', 1), g.rnd('a', 2), g.range('b', 1, 0, 9), g.range('b', 2, 0, 9), 'ink'); }); return { page }; }`, 'too few human traces')],
  // Stagger variance.
  ['balloons on the same gap', () => sourceFlags(scene(`  page.balloon('GO.', { x: 1, y: 1, at: 1 });\n  page.balloon('GO.', { x: 1, y: 2, at: 1.5 });\n  page.balloon('GO.', { x: 1, y: 3, at: 2 });\n  page.balloon('GO.', { x: 1, y: 4, at: 2.5 });`), 'stagger variance')],
  ['ticks in a linear loop', () => sourceFlags(scene(`  for (let i = 0; i < 5; i += 1) page.tick(40, 80 + i * 40, { at: 1 + i * 0.3 });`), 'stagger variance')],
  // Frames.
  ['approved page flooded with the accent', () => frameFlags(paintRect(golden('look-comic-story-hook-t6.9'), 0, 0, 640, 90, SETUP.accent ?? [0, 0, 0]), 'accent colour')],
  ['approved page plus eight stickers', () => {
    const frame = golden('look-comic-story-descent-t7.9');
    for (let index = 0; index < 8; index += 1) paintRect(frame, 30 + index * 75, 330, 16, 16, INK);
    return frameFlags(frame, 'clutter');
  }],
  ['mirrored approved page', () => frameFlags(mirrorLeftHalf(golden('look-comic-story-hook-t6.9')), 'centred and symmetric')],
  ['the same page twice', () => sameFlags(golden('look-comic-story-descent-t7.9'), golden('look-comic-story-descent-t7.9'))],
  ['the same page nudged 4 px', () => sameFlags(golden('look-comic-story-hook-t6.9'), shiftRight(golden('look-comic-story-hook-t6.9'), 4))],
]; // prettier-ignore

/**
 * Known blind spot: the clutter guard counts connected high-contrast blocks, and on a comic page
 * the inked panel borders join every mark into one or two components (all 36 comic goldens count
 * 1-3), so stickers inside the panels are not seen. Per-panel counting is a backlog item.
 */
const KNOWN_MISSES = ['approved page plus eight stickers'];

const missed = CASES.filter(([, caught]) => !caught()).map(([name]) => name);
const caught = CASES.length - missed.length;

describe('Comic guards on planted fakes', () => {
  it(`catch ${String(caught)}/${String(CASES.length)} deliberately bad cases (target ≥ 90 %)`, () => {
    expect(caught / CASES.length).toBeGreaterThanOrEqual(0.9);
  });

  it('miss only the known blind spot today (regression guard)', () => {
    expect(missed).toEqual(KNOWN_MISSES);
  });
});
