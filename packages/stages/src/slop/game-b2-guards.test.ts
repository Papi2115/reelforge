/**
 * Anti-slop calibration of the Game B2 world (PLAN.md#13.4 part c, QUALITY.md §8): no finding on
 * the approved Game B2 template scenes (text provenance of the HUD and level with the showcase
 * narration and research notes, human traces, stagger variance, breakthrough and throw intents)
 * and on the Game B2 look goldens (clutter, accent share, symmetry, same composition); the planted
 * fakes are in game-b2-detection.test.ts.
 */
import { resolveStyle } from '@reelforge/engine';
import { describe, expect, it } from 'vitest';
import {
  GAME_B2_NARRATION,
  GAME_B2_RESEARCH,
  gameB2Examples,
} from '../testing/game-b2-slop-fixtures.js';
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

const GAME = worldSlopSpec('game-b2');
if (GAME === undefined) throw new Error('no Game B2 spec');
const KINDS = GAME.breakthroughs ?? {};
const VOCABULARY = buildVocabulary([GAME_B2_NARRATION, GAME_B2_RESEARCH]);
const ACCENT = parseHex(resolveStyle({ style: 'game-b2' }).palette.accent1);
const SETUP = { vocabulary: VOCABULARY, spec: GAME, accent: ACCENT };
const EXAMPLES = [...gameB2Examples()];
const GOLDENS = [...goldenFrames(/^look-rpg-.*\.png$/)];

function program(source: string) {
  const parsed = parseScene(source);
  if (parsed === undefined) throw new Error('does not parse');
  return parsed;
}

describe('Game B2 guards on the approved templates', () => {
  it('has the templates and goldens it judges', () => {
    expect(EXAMPLES).toHaveLength(11);
    expect(GOLDENS).toHaveLength(33);
  });

  it('reads the HUD, the level and the tally as on-screen text', () => {
    const texts = onScreenTexts(
      program(`const LEVEL = { name: 'toy-store-aisle', grid: [], legend: { s: { wall: 'shelf', label: 'E.T.' } } };
export function build(ctx) {
  const view = ctx.kit.fx.b2View({ level: LEVEL });
  const hud = ctx.kit.fx.b2Hud({ view });
  hud.compass({ at: 0, year: '1982', place: 'THE WAREHOUSE' });
  hud.narrate('ATARI BETS ON A HIT', { at: 1 });
  hud.say('E.T. SELLS POORLY.', { speaker: 'CLERK', at: 2 });
  hud.boss({ name: 'RETURNS DESK', label: 'UNSOLD', keys: [[0, 1]] });
  hud.toast({ head: '+ ITEM', body: 'E.T. CARTRIDGE', at: 3 });
  hud.tally({ intent: 'x', rows: [{ label: 'MADE', value: 4000000 }], stamp: { text: 'UNSOLD' } });
  hud.stinger('TOO MANY', { at: 4 });
  return { view, hud };
}`),
      GAME,
    );
    expect(texts.map((entry) => entry.text)).toEqual([
      'E.T.',
      '1982',
      'THE WAREHOUSE',
      'ATARI BETS ON A HIT',
      'E.T. SELLS POORLY.',
      'CLERK',
      'RETURNS DESK',
      'UNSOLD',
      '+ ITEM',
      'E.T. CARTRIDGE',
      'MADE',
      '4000000',
      'UNSOLD',
      'TOO MANY',
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
      'throw: undefined',
      'automap: enter wipe + exit fold',
      'automap: enter unfold + exit fold',
      'tally: backdrop freeze + enter melt + exit dissolve',
      'tally: backdrop live + enter cut + exit melt',
      'throw: undefined',
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

describe('Game B2 guards on the approved goldens', () => {
  it('finds no clutter, accent flood or centred symmetry on any Game B2 golden', () => {
    const flagged = GOLDENS.flatMap(([name, image]) =>
      slopFrameFindings(SETUP, [{ t: 1, image }], { treatment: 'map' }).map(
        (entry) => `${name}: ${entry.message}`,
      ),
    );
    expect(flagged).toEqual([]);
  });

  it('never calls two different Game B2 scenes the same composition', () => {
    const keys = GOLDENS.map(([name, image]) => ({ shot: { id: name }, frame: { t: 1, image } }));
    const scene = (name: string | undefined): string => (name ?? '').replace(/-t[\d.]+\.png$/, '');
    const flagged = [...sameCompositionFindings(keys).keys()].filter((id) => {
      const index = GOLDENS.findIndex(([name]) => name === id);
      return scene(GOLDENS[index - 1]?.[0]) !== scene(id);
    });
    expect(flagged).toEqual([]);
  });
});
