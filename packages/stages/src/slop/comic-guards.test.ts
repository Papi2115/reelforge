/**
 * Anti-slop calibration of the Comic world (PLAN.md#13.3 part c, QUALITY.md §8): no finding on the
 * approved comic template scenes (text provenance with the showcase narration and research notes,
 * human traces, stagger variance, breakthrough intents) and on the comic look goldens (clutter,
 * accent share, symmetry, same composition); the planted fakes are in comic-detection.test.ts.
 */
import { resolveStyle } from '@reelforge/engine';
import { describe, expect, it } from 'vitest';
import { COMIC_NARRATION, COMIC_RESEARCH, comicExamples } from '../testing/comic-slop-fixtures.js';
import { goldenFrames } from '../testing/slop-fixtures.js';
import {
  breakthroughIntentFindings,
  breakthroughSpecs,
  repeatedBreakthroughFindings,
} from './breakthrough-intent.js';
import { parseHex } from './frame-guards.js';
import { sameCompositionFindings, slopFrameFindings, slopSourceFindings } from './guards.js';
import { countTraces, MIN_HUMAN_TRACES, uniformTimings } from './source-guards.js';
import { onScreenTexts, parseScene } from './source-text.js';
import { inventedTexts } from './text-provenance.js';
import { buildVocabulary } from './vocabulary.js';
import { worldSlopSpec } from './world-labels.js';

const COMIC = worldSlopSpec('comic');
if (COMIC === undefined) throw new Error('no Comic spec');
const KINDS = COMIC.breakthroughs ?? {};
const VOCABULARY = buildVocabulary([COMIC_NARRATION, COMIC_RESEARCH]);
const ACCENT = parseHex(resolveStyle({ style: 'comic' }).palette.accent1);
const SETUP = { vocabulary: VOCABULARY, spec: COMIC, accent: ACCENT };
const EXAMPLES = [...comicExamples()];
const GOLDENS = [...goldenFrames(/^look-comic-.*\.png$/)];

function program(source: string) {
  const parsed = parseScene(source);
  if (parsed === undefined) throw new Error('does not parse');
  return parsed;
}

describe('Comic guards on the approved templates', () => {
  it('has the templates and goldens it judges', () => {
    expect(EXAMPLES).toHaveLength(12);
    expect(GOLDENS).toHaveLength(36);
  });

  it('reads the comic lettering as on-screen text', () => {
    const texts = onScreenTexts(
      program(`export function build(ctx) {
  const page = ctx.kit.fx.comicPage({});
  page.caption('JULY 20, 1969.', { x: 1, y: 2, at: 0 });
  page.balloon('GO.', { x: 1, y: 2, at: 0 });
  page.sfx('BEEEP', { x: 1, y: 2, at: 0 });
  page.panel([0, 0, 9, 0, 9, 9, 0, 9]).draw((g) => g.text('LOAD', 1, 2));
  page.flashback({ intent: 'x', when: 'EIGHT YEARS EARLIER...', beats: [], stamp: { text: '1961', at: 1 } });
  return { page };
}`),
      COMIC,
    );
    expect(texts.map((entry) => [entry.text, entry.role])).toEqual([
      ['JULY 20, 1969.', undefined],
      ['GO.', undefined],
      ['BEEEP', 'sound'],
      ['LOAD', undefined],
      ['EIGHT YEARS EARLIER...', undefined],
      ['1961', undefined],
    ]);
  });

  it('passes every on-screen string of the templates', () => {
    const flagged = EXAMPLES.flatMap(([name, source]) =>
      inventedTexts(onScreenTexts(program(source), COMIC), VOCABULARY, COMIC).map(
        (entry) => `${name}: ${entry.text} (${entry.unknown.join(', ')})`,
      ),
    );
    expect(flagged).toEqual([]);
  });

  it('finds at least three human traces in every template', () => {
    const counts = EXAMPLES.map(([name, source]) => [
      name,
      countTraces(program(source), COMIC).total,
    ]);
    expect(counts.filter(([, total]) => Number(total) < MIN_HUMAN_TRACES)).toEqual([]);
  });

  it('finds no uniform timing, no weak intent and no repeat in the templates', () => {
    expect(EXAMPLES.filter(([, source]) => uniformTimings(program(source)).length > 0)).toEqual([]);
    const intents = EXAMPLES.flatMap(([name, source]) =>
      breakthroughIntentFindings(program(source), name, KINDS, VOCABULARY).map((f) => f.message),
    );
    expect(intents).toEqual([]);
    const film = EXAMPLES.map(([name, source]) => ({
      shotId: name,
      specs: breakthroughSpecs(program(source), KINDS),
    }));
    expect(film.flatMap((shot) => shot.specs.map((spec) => spec.mechanism))).toEqual([
      'cover page + arrange rows',
      'cover strip + arrange row',
      'assemble merge + pieces grid',
      'assemble unfold + pieces grid',
    ]);
    expect(repeatedBreakthroughFindings(film).size).toBe(0);
  });

  it('reports nothing at all on the templates through the public source guard', () => {
    const findings = EXAMPLES.flatMap(([name, source]) =>
      slopSourceFindings(SETUP, source, name).map((entry) => entry.message),
    );
    expect(findings).toEqual([]);
  });
});

describe('Comic guards on the approved goldens', () => {
  it('finds no clutter, accent flood or centred symmetry on any comic golden', () => {
    const flagged = GOLDENS.flatMap(([name, image]) =>
      slopFrameFindings(SETUP, [{ t: 1, image }], { treatment: 'map' }).map(
        (entry) => `${name}: ${entry.message}`,
      ),
    );
    expect(flagged).toEqual([]);
  });

  it('never calls two different comic scenes the same composition', () => {
    const keys = GOLDENS.map(([name, image]) => ({ shot: { id: name }, frame: { t: 1, image } }));
    const scene = (name: string | undefined): string => (name ?? '').replace(/-t[\d.]+\.png$/, '');
    const flagged = [...sameCompositionFindings(keys).keys()].filter((id) => {
      const index = GOLDENS.findIndex(([name]) => name === id);
      return scene(GOLDENS[index - 1]?.[0]) !== scene(id);
    });
    expect(flagged).toEqual([]);
  });
});
