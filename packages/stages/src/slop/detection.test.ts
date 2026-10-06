/**
 * The 13.7 acceptance target: deliberately bad scenes and frames ("seeded slop") through the
 * public guards; at least 90 % must be caught (the approved goldens/templates are the
 * false-positive side, in the guards' own test files).
 */
import { resolveStyle } from '@reelforge/engine';
import type { RgbaImage } from '@reelforge/engine/raster';
import { describe, expect, it } from 'vitest';
import {
  blankFrame,
  copyFrame,
  goldenFrames,
  INK,
  mirrorLeftHalf,
  paintDisc,
  paintRect,
  PAPER,
  RED,
  shiftRight,
  SHOWCASE_NARRATION,
  SHOWCASE_RESEARCH,
  type Rgb,
} from '../testing/slop-fixtures.js';
import { parseHex } from './frame-guards.js';
import {
  sameCompositionFindings,
  slopFrameFindings,
  slopSourceFindings,
  type AntiSlopSetup,
} from './guards.js';
import { buildVocabulary } from './vocabulary.js';
import { worldSlopSpec } from './world-labels.js';

const SETUP: AntiSlopSetup = {
  vocabulary: buildVocabulary([SHOWCASE_NARRATION, SHOWCASE_RESEARCH]),
  spec: worldSlopSpec('sketchbook'),
  accent: parseHex(resolveStyle({ style: 'sketchbook' }).palette.accent1),
};
const VOXEL_ACCENT = parseHex(resolveStyle({ style: 'voxel-pixel-crisp640' }).palette.accent1);
const GOLDENS = goldenFrames(
  /^(look-sketch-story-(quarter-t8|gregory-t5\.5|gregory-t7\.6)|kit-voxel-demo-t2\.5)\.png$/,
);

function golden(name: string): RgbaImage {
  const image = GOLDENS.get(`${name}.png`);
  if (image === undefined) throw new Error(`no golden ${name}`);
  return copyFrame(image);
}

/** A world scene with three traces (tape, loop, red pen) around `body`. */
const scene = (body: string): string =>
  `export function build(ctx) {
  const page = ctx.kit.fx.sketchPage({ size: [960, 540] });
  page.tape(10, 10, 60, 20, 4);
  page.loop(300, 200, 40, 20);
  page.underline(100, 200, 300, { tool: 'red' });
${body}
  return { page };
}
export function update(t, state) { state.page.update(t); }
`;

const sourceFlags = (source: string, reason: string): boolean =>
  slopSourceFindings(SETUP, source, 'scenes/s01.js').some((entry) =>
    entry.message.startsWith(reason),
  );

const frameFlags = (image: RgbaImage, reason: string, accent = SETUP.accent): boolean =>
  slopFrameFindings({ ...SETUP, accent }, [{ t: 1, image }], { treatment: 'map' }).some((entry) =>
    entry.message.startsWith(reason),
  );

const sameFlags = (first: RgbaImage, second: RgbaImage): boolean =>
  sameCompositionFindings([
    { shot: { id: 's01' }, frame: { t: 1, image: first } },
    { shot: { id: 's02' }, frame: { t: 1, image: second } },
  ]).has('s02');

function scattered(count: number, size: number, color: Rgb): RgbaImage {
  const frame = blankFrame(960, 540, PAPER);
  for (let index = 0; index < count; index += 1) {
    paintRect(frame, 70 + (index % 6) * 145, 70 + Math.floor(index / 6) * 170, size, size, color);
  }
  return frame;
}

function centredBadge(): RgbaImage {
  const frame = paintRect(blankFrame(960, 540, PAPER), 0, 0, 36, 540, INK);
  paintDisc(frame, 480, 270, 120, INK);
  for (const [x, y] of [
    [300, 120],
    [660, 120],
    [300, 420],
    [660, 420],
  ] as const) {
    paintDisc(frame, x, y, 24, INK);
  }
  return frame;
}

const CASES: readonly (readonly [string, () => boolean])[] = [
  // Text provenance.
  ['lorem ipsum', () => sourceFlags(scene(`  page.write('Lorem ipsum dolor sit amet', { x: 99, y: 99 });`), 'invented text')],
  ['invented label', () => sourceFlags(scene(`  page.write('QUANTUM CORE', { x: 99, y: 99 });`), 'invented text')],
  ['fake percentage', () => sourceFlags(scene(`  page.write('87% faster', { x: 99, y: 99 });`), 'invented text')],
  ['buzzwords', () => sourceFlags(scene(`  page.write('synergy matrix unlocked', { x: 99, y: 99 });`), 'invented text')],
  ['fake year', () => sourceFlags(scene(`  page.write('Founded 2031', { x: 99, y: 99 });`), 'invented text')],
  ['fake money', () => sourceFlags(scene(`  ctx.text.title('$4.2B market');`), 'invented text')],
  ['invented name in a pop-up', () => sourceFlags(scene(`  page.popup({ elements: [{ kind: 'tag', lines: ['Neural', 'Pathways'] }] });`), 'invented text')],
  // Human traces.
  ['no traces', () => sourceFlags(`export function build(ctx) { const page = ctx.kit.fx.sketchPage({}); page.write('leap day', { x: 1, y: 1 }); return { page }; }`, 'too few human traces')],
  ['two traces', () => sourceFlags(`export function build(ctx) { const page = ctx.kit.fx.sketchPage({}); page.tape(1, 1, 9, 9); page.underline(1, 9, 9); return { page }; }`, 'too few human traces')],
  ['no world calls at all', () => sourceFlags(`export function build(ctx) { ctx.text.title('leap day'); return {}; }`, 'too few human traces')],
  // Stagger variance.
  ['same gaps', () => sourceFlags(scene(`  page.write('leap', { x: 1, y: 1, at: 1 });\n  page.write('day', { x: 1, y: 2, at: 1.1 });\n  page.write('year', { x: 1, y: 3, at: 1.2 });\n  page.write('days', { x: 1, y: 4, at: 1.3 });`), 'stagger variance')],
  ['linear loop', () => sourceFlags(scene(`  for (let i = 0; i < 8; i += 1) page.stroke([i, 0, i, 9], { at: 0.4 + i * 0.1 });`), 'stagger variance')],
  ['same durations', () => sourceFlags(scene(`  page.stroke([0, 0, 9, 9], { at: 0.2, dur: 0.25 });\n  page.stroke([0, 0, 9, 9], { at: 0.7, dur: 0.25 });\n  page.stroke([0, 0, 9, 9], { at: 0.9, dur: 0.25 });\n  page.stroke([0, 0, 9, 9], { at: 1.6, dur: 0.25 });`), 'stagger variance')],
  // Clutter and accent.
  ['twelve scattered marks', () => frameFlags(scattered(12, 40, INK), 'clutter')],
  ['icon row spam', () => frameFlags(scattered(9, 30, INK), 'clutter')],
  ['approved page plus eight stickers', () => {
    const frame = golden('look-sketch-story-quarter-t8');
    for (let index = 0; index < 8; index += 1) paintRect(frame, 80 + index * 105, 500, 26, 26, INK);
    return frameFlags(frame, 'clutter');
  }],
  ['red wash', () => frameFlags(paintRect(blankFrame(960, 540, PAPER), 0, 0, 960, 180, RED), 'accent colour')],
  ['approved page with a red block', () => frameFlags(paintRect(golden('look-sketch-story-quarter-t8'), 420, 300, 440, 200, RED), 'accent colour')],
  ['voxel frame flooded with the accent', () => {
    const accent = VOXEL_ACCENT ?? [0, 0, 0];
    return frameFlags(paintRect(golden('kit-voxel-demo-t2.5'), 0, 0, 640, 90, accent), 'accent colour', VOXEL_ACCENT);
  }],
  // Symmetry.
  ['centred badge with mirrored dots', () => frameFlags(centredBadge(), 'centred and symmetric')],
  ['mirrored approved page', () => frameFlags(mirrorLeftHalf(golden('look-sketch-story-quarter-t8')), 'centred and symmetric')],
  ['centred block on a plain page', () => frameFlags(paintRect(blankFrame(960, 540, PAPER), 330, 170, 300, 200, INK), 'centred and symmetric')],
  // Same composition.
  ['the same frame twice', () => sameFlags(golden('look-sketch-story-gregory-t7.6'), golden('look-sketch-story-gregory-t7.6'))],
  ['the same page a beat later', () => sameFlags(golden('look-sketch-story-gregory-t5.5'), golden('look-sketch-story-gregory-t7.6'))],
  ['the same page nudged 4 px', () => sameFlags(golden('look-sketch-story-quarter-t8'), shiftRight(golden('look-sketch-story-quarter-t8'), 4))],
  ['the same page with one more mark', () => {
    const next = paintRect(golden('look-sketch-story-quarter-t8'), 700, 420, 40, 12, INK);
    return sameFlags(golden('look-sketch-story-quarter-t8'), next);
  }],
]; // prettier-ignore

const missed = CASES.filter(([, caught]) => !caught()).map(([name]) => name);
const caught = CASES.length - missed.length;

describe('anti-slop guards on seeded slop', () => {
  it(`catch ${String(caught)}/${String(CASES.length)} deliberately bad cases (target ≥ 90 %)`, () => {
    expect(caught / CASES.length).toBeGreaterThanOrEqual(0.9);
  });

  it('miss none of the seeded cases today (regression guard)', () => {
    expect(missed).toEqual([]);
  });
});
