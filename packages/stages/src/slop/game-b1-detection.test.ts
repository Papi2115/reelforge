/**
 * The Game B1 calibration's other side (PLAN.md#13.5 part c): deliberately bad game scenes and
 * frames ("planted fakes": invented words and numbers in the TV, on the HUD, in Dad's notes and in
 * the breakthroughs, missing or ungrounded intents, repeated mechanisms, too few traces, uniform
 * timing, flooded, cluttered, mirrored and repeated frames) through the public guards with the
 * showcase narration and research; at least 90 % must be caught (the approved templates and
 * goldens are the false-positive side, game-b1-guards.test.ts).
 */
import { resolveStyle } from '@reelforge/engine';
import type { RgbaImage } from '@reelforge/engine/raster';
import { describe, expect, it } from 'vitest';
import { GAME_B1_NARRATION, GAME_B1_RESEARCH } from '../testing/game-b1-slop-fixtures.js';
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

const SPEC = worldSlopSpec('game-b1');
const SETUP: AntiSlopSetup = {
  vocabulary: buildVocabulary([GAME_B1_NARRATION, GAME_B1_RESEARCH]),
  spec: SPEC,
  accent: parseHex(resolveStyle({ style: 'game-b1' }).palette.accent1),
};
const CREAM: Rgb = [0xef, 0xd9, 0xae];
const GOLDENS = goldenFrames(
  /^look-atari-(story-hook-t3\.9|story-deadline-t(2\.6|6\.3)|menu-scores-t5\.6)\.png$/,
);

function golden(name: string): RgbaImage {
  const image = GOLDENS.get(`${name}.png`);
  if (image === undefined) throw new Error(`no golden ${name}`);
  return copyFrame(image);
}

/** A Game B1 scene with three traces (a decaying shake, Dad's note underlined) around `body`. */
const scene = (body: string): string =>
  `export function build(ctx) {
  const screen = ctx.kit.fx.b1Screen({ size: [640, 360], duration: 6 });
  screen.tv((g, t) => { const sh = g.util.shake(t, 2, 3, 8, 7); g.offset(sh.x * 2, sh.y * 2); g.rect(0, 0, 160, 180, 'void'); });
  screen.note(['WEAK POINT:', 'MORE TIME'], { at: 3, x: 172, y: 190, under: 1 });
${body}
  return { screen };
}
export function update(t, state) { state.screen.update(t); }
`;

const TABLE = (intent: string, extra = ''): string =>
  `  screen.scoreTable({ intent: '${intent}', at: 0, until: 6, rows: [{ who: 'E.T', score: 1982 }, { score: 1983 }], slam: { at: 2 }${extra} });`;
const MANUAL = (intent: string, extra = ''): string =>
  `  screen.manual({ intent: '${intent}', at: 0, until: 6, steps: ['A HIT SELLS.', 'EVERYONE COPIES IT.'], figure: { caption: 'THE SHELF', shape: 'cartridge' }${extra} });`;
const CARTRIDGE = (intent: string): string =>
  `  screen.cartridge({ intent: '${intent}', action: 'pull', at: 0.6, label: 'XMAS 82' });`;

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

const CASES: readonly (readonly [string, () => boolean])[] = [
  // Text provenance in the TV, the HUD, the notes and the breakthroughs (words and numbers).
  ['invented narration line', () => sourceFlags(scene(`  screen.narrate('QUANTUM CARTRIDGE ENGINE ONLINE', { at: 1 });`), 'invented text')],
  ['invented speaker', () => sourceFlags(scene(`  screen.say('E.T. SELLS POORLY.', { speaker: 'ZORBLAX', at: 1 });`), 'invented text')],
  ['invented word in the TV', () => sourceFlags(scene(`  screen.tv((g) => { g.text('ATLANTIS', 10, 21, { colour: 'tan' }); });`), 'invented text')],
  ['fake digits in the TV', () => sourceFlags(scene(`  screen.tv((g) => { g.score('87', 12, 27, { colour: 'crimson' }); });`), 'invented text')],
  ['fake year on the HUD', () => sourceFlags(scene(`  screen.year('1977', { at: 0 });`), 'invented text')],
  ['fake number in a score row', () => sourceFlags(scene(TABLE('only the boom year has happened, the crash is locked').replace('1982', '87000')), 'invented text')],
  ['fake year as a score string', () => sourceFlags(scene(TABLE('only the boom year has happened, the crash is locked').replace('score: 1983', "score: '1940'")), 'invented text')],
  ['invented boss', () => sourceFlags(scene(`  screen.boss({ num: 1, name: 'THE DRAGON KING', at: 1 });`), 'invented text')],
  ['invented note on the glass', () => sourceFlags(scene(`  screen.note(['BUY GOLD NOW'], { at: 4, x: 400, y: 100 });`), 'invented text')],
  ['invented cartridge label', () => sourceFlags(scene(`  screen.cartridge({ intent: 'the Christmas cartridge goes back to the stores', action: 'pull', at: 0, label: 'ZELDA' });`), 'invented text')],
  ['fake two-digit year on a tag', () => sourceFlags(scene(`  screen.room({ gift: { slot: [1, 2], tag: ['E.T.', 'XMAS 77'], tagAt: [2, 3] } });`), 'invented text')],
  ['invented manual rule', () => sourceFlags(scene(MANUAL('a flood of copies makes buyers stop buying any game').replace("'EVERYONE COPIES IT.'", "'A WIZARD CASTS SPELLS.'")), 'invented text')],
  ['invented correction word', () => sourceFlags(scene(MANUAL('a flood of copies makes buyers stop buying any game', `, correction: { step: 1, strike: 'HIT', write: 'SWORD', at: 3 }`)), 'invented text')],
  ['invented place on the level map', () => sourceFlags(scene(`  screen.levelSelect({ intent: 'the story goes back a year to the Christmas it started', at: 0, until: 3, nodes: [{ label: 'XMAS 82', icon: 'home', x: 24, y: 118 }, { label: 'ATLANTIS 83', icon: 'pit', x: 104, y: 124 }], route: { from: 1, to: 0, at: 0.3 } });`), 'invented text')],
  ['decorative lives', () => sourceFlags(scene(`  screen.lives({ label: 'LIVES', max: 3, keys: [[0, 3]] });`), 'invented text')],
  // Breakthrough and seam intents.
  ['score table without an intent', () => sourceFlags(scene(`  screen.scoreTable({ at: 0, until: 6, rows: [{ score: 1982 }, { score: 1983 }], slam: { at: 2 } });`), 'scoreTable without an intent')],
  ['generic score table intent', () => sourceFlags(scene(TABLE('the scores')), 'generic scoreTable intent')],
  ['score table intent with only game words', () => sourceFlags(scene(TABLE('the high score table')), 'scoreTable intent')],
  ['manual intent the narration never makes', () => sourceFlags(scene(MANUAL('a dramatic journey through destiny and fate')), 'manual intent')],
  ['cartridge without an intent', () => sourceFlags(scene(`  screen.cartridge({ action: 'pull', at: 0.6, label: 'XMAS 82' });`), 'cartridge without an intent')],
  ['the same score table mechanism twice', () => repeats(TABLE('only the boom year has happened, the crash is locked'), TABLE('the landfill comes after the crash and the revival'))],
  ['the same manual figure twice', () => repeats(MANUAL('a flood of copies makes buyers stop buying any game'), MANUAL('shelves fill with look-alikes until the market floods'))],
  ['the same cartridge swap twice', () => repeats(CARTRIDGE('the Christmas cartridge goes back to the stores'), CARTRIDGE('the Christmas cartridge goes back to the stores again'))],
  // Human traces.
  ['no traces', () => sourceFlags(`export function build(ctx) { const screen = ctx.kit.fx.b1Screen({ duration: 6 }); screen.narrate('ATARI RULES THE LIVING ROOM.', { at: 1 }); return { screen }; }`, 'too few human traces')],
  ['two traces', () => sourceFlags(`export function build(ctx) { const screen = ctx.kit.fx.b1Screen({ duration: 6 }); screen.note(['MORE TIME'], { at: 1, x: 1, y: 1 }); screen.boss({ num: 1, name: 'THE DEADLINE', at: 1 }); return { screen }; }`, 'too few human traces')],
  ['shakes on one hit only', () => sourceFlags(`export function build(ctx) { const screen = ctx.kit.fx.b1Screen({ duration: 6 }); screen.tv((g, t) => { g.util.shake(t, 1, 3, 8, 1); g.util.shake(t, 1, 3, 8, 2); g.util.shake(t, 3, 3, 8, 3); }); return { screen }; }`, 'too few human traces')],
  // Stagger variance.
  ['narration on the same gap', () => sourceFlags(scene(`  screen.narrate('BOSS ONE: THE DEADLINE.', { at: 1 });\n  screen.narrate('ABOUT FIVE WEEKS', { at: 1.5 });\n  screen.narrate('TO BUILD THE WHOLE GAME.', { at: 2 });\n  screen.narrate('MORE TIME.', { at: 2.5 });`), 'stagger variance')],
  ['notes slapped on in a linear loop', () => sourceFlags(scene(`  for (let i = 0; i < 5; i += 1) screen.note(['MORE TIME'], { at: 1 + i * 0.3, x: 100 + i * 60, y: 100 });`), 'stagger variance')],
  // Frames.
  ['approved hook flooded with the accent', () => frameFlags(paintRect(golden('look-atari-story-hook-t3.9'), 0, 0, 640, 90, SETUP.accent ?? [0, 0, 0]), 'accent colour')],
  ['approved deadline plus eight HUD icons (24 px)', () => {
    const frame = golden('look-atari-story-deadline-t2.6');
    for (let index = 0; index < 8; index += 1) paintRect(frame, 40 + index * 70, 150, 24, 24, CREAM);
    return frameFlags(frame, 'clutter');
  }],
  ['mirrored approved deadline', () => frameFlags(mirrorLeftHalf(golden('look-atari-story-deadline-t6.3')), 'centred and symmetric')],
  ['the same screen twice', () => sameFlags(golden('look-atari-menu-scores-t5.6'), golden('look-atari-menu-scores-t5.6'))],
  ['the same hook nudged 4 px', () => sameFlags(golden('look-atari-story-hook-t3.9'), shiftRight(golden('look-atari-story-hook-t3.9'), 4))],
]; // prettier-ignore

/** Misses of today with the reason (a regression guard): none expected. */
const KNOWN_MISSES: readonly string[] = [];

const missed = CASES.filter(([, caught]) => !caught()).map(([name]) => name);
const caught = CASES.length - missed.length;

describe('Game B1 guards on planted fakes', () => {
  it(`catch ${String(caught)}/${String(CASES.length)} deliberately bad cases (target ≥ 90 %)`, () => {
    expect(caught / CASES.length).toBeGreaterThanOrEqual(0.9);
  });

  it('miss only the known blind spots today (regression guard)', () => {
    expect(missed).toEqual(KNOWN_MISSES);
  });
});
