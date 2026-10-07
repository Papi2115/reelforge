/**
 * Anti-slop calibration of the Game B1 world (PLAN.md#13.5 part c, QUALITY.md §8): no finding on
 * the approved Game B1 template scenes (text provenance of the TV, the HUD, the notes and the
 * breakthroughs with the showcase narration and research notes, human traces, stagger variance,
 * breakthrough and seam intents) and on the Game B1 look goldens (clutter, accent share,
 * symmetry, same composition); the planted fakes are in game-b1-detection.test.ts.
 */
import { resolveStyle } from '@reelforge/engine';
import { describe, expect, it } from 'vitest';
import {
  GAME_B1_NARRATION,
  GAME_B1_RESEARCH,
  gameB1Examples,
} from '../testing/game-b1-slop-fixtures.js';
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

const GAME = worldSlopSpec('game-b1');
if (GAME === undefined) throw new Error('no Game B1 spec');
const KINDS = GAME.breakthroughs ?? {};
const VOCABULARY = buildVocabulary([GAME_B1_NARRATION, GAME_B1_RESEARCH]);
const ACCENT = parseHex(resolveStyle({ style: 'game-b1' }).palette.accent1);
const SETUP = { vocabulary: VOCABULARY, spec: GAME, accent: ACCENT };
const EXAMPLES = [...gameB1Examples()];
const GOLDENS = [...goldenFrames(/^look-atari-.*\.png$/)];

function program(source: string) {
  const parsed = parseScene(source);
  if (parsed === undefined) throw new Error('does not parse');
  return parsed;
}

describe('Game B1 guards on the approved templates', () => {
  it('has the templates and goldens it judges', () => {
    expect(EXAMPLES).toHaveLength(14);
    expect(GOLDENS).toHaveLength(42);
  });

  it('reads the TV, the HUD, the notes and the breakthroughs as on-screen text', () => {
    const texts = onScreenTexts(
      program(`export function build(ctx) {
  const screen = ctx.kit.fx.b1Screen({ duration: 6 });
  screen.tv((g, t) => { g.text('NEW MEXICO', 10, 21, { colour: 'tan' }); g.score('5', 12, 27, { colour: 'crimson' }); });
  screen.room({ calendar: { month: 'DEC', mark: 25 }, gift: { slot: [1, 2], tag: ['E.T.', 'XMAS 82'], tagAt: [2, 3] } });
  screen.year('1982', { at: -1 });
  screen.narrate('ATARI RULES THE LIVING ROOM.', { at: 1 });
  screen.say('E.T. SELLS POORLY.', { speaker: 'CLERK', at: 2 });
  screen.boss({ num: 1, name: 'THE DEADLINE', at: 1, hp: { n: 5, label: 'WEEKS' } });
  screen.note(['WEAK POINT:', 'MORE TIME'], { at: 3, x: 1, y: 1 });
  screen.cartridge({ intent: 'x', action: 'pull', at: 0, label: 'XMAS 82' });
  screen.scoreTable({ intent: 'x', at: 0, until: 6, rows: [{ who: 'E.T', score: 1982 }, { score: '1983' }], slam: { at: 2 }, ring: { at: 3, note: 'BOOM!' }, prompt: { text: 'INSERT COIN', at: 4 } });
  screen.manual({ intent: 'x', at: 0, until: 6, steps: ['A HIT SELLS.'], figure: { caption: 'THE SHELF', shape: 'cartridge' }, correction: { step: 1, strike: 'HIT', write: 'ANY', at: 3 } });
  return { screen };
}`),
      GAME,
    );
    expect(texts.map((entry) => entry.text)).toEqual([
      'NEW MEXICO',
      '5',
      'DEC',
      'E.T. XMAS 82',
      '1982',
      'ATARI RULES THE LIVING ROOM.',
      'E.T. SELLS POORLY.',
      'CLERK',
      'THE DEADLINE',
      'WEEKS',
      'WEAK POINT:',
      'MORE TIME',
      'XMAS 82',
      'E.T',
      '1982',
      '1983',
      'BOOM!',
      'INSERT COIN',
      'A HIT SELLS.',
      'THE SHELF',
      'HIT',
      'ANY',
    ]);
  });

  it('passes every on-screen string of the templates', () => {
    const flagged = EXAMPLES.flatMap(([name, source]) =>
      inventedTexts(onScreenTexts(program(source), GAME), VOCABULARY, GAME).map(
        (entry) => `${name}: ${entry.text} (${entry.unknown.join(', ')})`,
      ),
    );
    expect(flagged).toEqual([]);
  });

  it('finds at least three human traces in every template', () => {
    const counts = EXAMPLES.map(([name, source]) => [
      name,
      countTraces(program(source), GAME).total,
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
    expect(
      film.flatMap((shot) => shot.specs.map((spec) => `${spec.kind}: ${String(spec.mechanism)}`)),
    ).toEqual([
      'calendarZoom: undefined',
      'cartridge: undefined',
      'scoreTable: enter draw-in + initials arcade',
      'cartridge: undefined',
      'manual: enter cut + exit turn + figure.shape cartridge + figure.layout shelf',
      'levelSelect: undefined',
      'scoreTable: enter cut + initials typed',
      'manual: enter slide + exit cut + figure.shape person + figure.layout pile',
      'levelSelect: undefined',
    ]);
    expect(repeatedBreakthroughFindings(film).size).toBe(0);
  });

  it('reports nothing at all on the templates through the public source guard', () => {
    const findings = EXAMPLES.flatMap(([name, source]) =>
      slopSourceFindings(SETUP, source, name).map((entry) => `${name}: ${entry.message}`),
    );
    expect(findings).toEqual([]);
  });
});

describe('Game B1 guards on the approved goldens', () => {
  it('finds no clutter, accent flood or centred symmetry on any Game B1 golden', () => {
    const flagged = GOLDENS.flatMap(([name, image]) =>
      slopFrameFindings(SETUP, [{ t: 1, image }], { treatment: 'map' }).map(
        (entry) => `${name}: ${entry.message}`,
      ),
    );
    expect(flagged).toEqual([]);
  });

  it('never calls two different Game B1 scenes the same composition', () => {
    const keys = GOLDENS.map(([name, image]) => ({ shot: { id: name }, frame: { t: 1, image } }));
    const scene = (name: string | undefined): string => (name ?? '').replace(/-t[\d.]+\.png$/, '');
    const flagged = [...sameCompositionFindings(keys).keys()].filter((id) => {
      const index = GOLDENS.findIndex(([name]) => name === id);
      return scene(GOLDENS[index - 1]?.[0]) !== scene(id);
    });
    expect(flagged).toEqual([]);
  });
});
