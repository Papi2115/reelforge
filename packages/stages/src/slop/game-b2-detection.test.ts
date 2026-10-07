/**
 * The Game B2 calibration's other side (PLAN.md#13.4 part c): deliberately bad game scenes and
 * frames ("planted fakes") through the public guards with the showcase narration and research;
 * at least 90 % must be caught (the approved templates and goldens are the false-positive side,
 * game-b2-guards.test.ts).
 */
import { resolveStyle } from '@reelforge/engine';
import type { RgbaImage } from '@reelforge/engine/raster';
import { describe, expect, it } from 'vitest';
import { GAME_B2_NARRATION, GAME_B2_RESEARCH } from '../testing/game-b2-slop-fixtures.js';
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

const SPEC = worldSlopSpec('game-b2');
const SETUP: AntiSlopSetup = {
  vocabulary: buildVocabulary([GAME_B2_NARRATION, GAME_B2_RESEARCH]),
  spec: SPEC,
  accent: parseHex(resolveStyle({ style: 'game-b2' }).palette.accent1),
};
const PAPER: Rgb = [0xf5, 0xe7, 0xc6];
const GOLDENS = goldenFrames(
  /^look-rpg-(explore-warehouse-t4|explore-corridor-t3\.5|menu-quest_log-t3\.3)\.png$/,
);

function golden(name: string): RgbaImage {
  const image = GOLDENS.get(`${name}.png`);
  if (image === undefined) throw new Error(`no golden ${name}`);
  return copyFrame(image);
}

/** A Game B2 scene with three traces (the bulb, the reach, a shake) around `body`. */
const scene = (body: string): string =>
  `export function build(ctx) {
  const view = ctx.kit.fx.b2View({ level: 'returns-free', path: [{ at: 0, x: 2.5, y: 2.5 }] });
  const hud = ctx.kit.fx.b2Hud({ view });
  view.switchOn('bulb', { at: 0.4 });
  view.take({ label: 'E.T.', band: 'pink' }, { at: 1.2, from: [3, 2, 0.4] });
  view.shake({ at: 2.6, amp: 1.5 });
${body}
  return { view, hud };
}
export function update(t, state) { state.view.update(t); state.hud.update(t); }
`;

const AUTOMAP = (intent: string, extra = ''): string =>
  `  view.automap({ intent: '${intent}', at: 1, until: 5, rooms: [{ cell: [2, 2], label: 'THE WAREHOUSE' }]${extra} });`;
const TALLY = (intent: string, extra = ''): string =>
  `  hud.tally({ intent: '${intent}', at: 0, until: 6, rows: [{ label: 'SOLD', value: 1500000 }]${extra} });`;
const THROW = (intent: string): string =>
  `  view.throw({ label: 'E.T.' }, { intent: '${intent}', at: 3, target: 'pile' });`;

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
  // Text provenance in the HUD and the level.
  ['invented narration line', () => sourceFlags(scene(`  hud.narrate('QUANTUM CARTRIDGE ENGINE ONLINE', { at: 1 });`), 'invented text')],
  ['invented speaker', () => sourceFlags(scene(`  hud.say('E.T. SELLS POORLY.', { speaker: 'ZORBLAX', at: 1 });`), 'invented text')],
  ['invented place on the compass', () => sourceFlags(scene(`  hud.compass({ at: 0, year: '1982', place: 'ATLANTIS' });`), 'invented text')],
  ['fake year on the compass', () => sourceFlags(scene(`  hud.compass({ at: 0, year: '1977', place: 'THE OFFICE' });`), 'invented text')],
  ['fake number in a tally row', () => sourceFlags(scene(TALLY('millions made, far fewer sold', `, stamp: { text: 'UNSOLD' }`).replace('1500000', '87000')), 'invented text')],
  ['invented boss', () => sourceFlags(scene(`  hud.boss({ name: 'THE DRAGON KING', keys: [[0, 1]] });`), 'invented text')],
  ['invented quest toast', () => sourceFlags(scene(`  hud.toast({ head: 'NEW QUEST', body: 'DEFEAT THE WIZARD', at: 2 });`), 'invented text')],
  ['invented sign in the level', () => sourceFlags(scene(`  view.place({ sprite: 'sign', pos: [3, 3], label: 'BANK' }, { at: 2 });`), 'invented text')],
  ['invented stinger', () => sourceFlags(scene(`  hud.stinger('EPIC WIN', { at: 3 });`), 'invented text')],
  ['decorative HP meter', () => sourceFlags(scene(`  hud.meter({ label: 'HP', keys: [[0, 12]] });`), 'invented text')],
  ['decorative ammo counter', () => sourceFlags(scene(`  hud.status({ label: 'AMMO 99', at: 0 });`), 'invented text')],
  ['fake damage number', () => sourceFlags(scene(`  hud.meter({ label: 'MARKET', keys: [[0, 12]] });\n  hud.damage({ text: '-87', at: 2, on: 'meter' });`), 'invented text')],
  ['invented choices', () => sourceFlags(scene(`  hud.choose({ speaker: 'CLERK', options: ['FIGHT', 'FLEE'], at: 1, until: 3, steps: [] });`), 'invented text')],
  // Breakthrough and throw intents.
  ['automap without an intent', () => sourceFlags(scene(`  view.automap({ at: 1, until: 5 });`), 'automap without an intent')],
  ['generic automap intent', () => sourceFlags(scene(AUTOMAP('the automap')), 'generic automap intent')],
  ['tally intent the narration never makes', () => sourceFlags(scene(TALLY('a dramatic journey through destiny and fate')), 'tally intent')],
  ['throw without an intent', () => sourceFlags(scene(`  view.throw({ label: 'E.T.' }, { at: 3, target: 'pile' });`), 'throw without an intent')],
  ['the same automap mechanism twice', () => repeats(AUTOMAP('the office and the warehouse are done', `, enter: 'wipe'`), AUTOMAP('the stores come next, then the returns desk', `, enter: 'wipe'`))],
  ['the same tally intent twice', () => repeats(TALLY('millions made, far fewer sold'), TALLY('millions made and far fewer sold', `, backdrop: 'live'`))],
  ['the same throw twice', () => repeats(THROW('the cartridge goes back onto the returns pile'), THROW('the cartridge goes back onto the pile of returns'))],
  // Human traces.
  ['no traces', () => sourceFlags(`export function build(ctx) { const view = ctx.kit.fx.b2View({ level: 'hall' }); const hud = ctx.kit.fx.b2Hud({ view }); hud.narrate('ATARI BETS ON A HIT', { at: 1 }); return { view, hud }; }`, 'too few human traces')],
  ['two traces', () => sourceFlags(`export function build(ctx) { const view = ctx.kit.fx.b2View({ level: 'hall' }); view.switchOn('bulb', { at: 0.4 }); view.take({ label: 'E.T.' }, { at: 1, from: [1, 1, 0.4] }); return { view }; }`, 'too few human traces')],
  ['shakes on one hit only', () => sourceFlags(`export function build(ctx) { const view = ctx.kit.fx.b2View({ level: 'hall' }); const hud = ctx.kit.fx.b2Hud({ view }); view.shake({ at: 1 }); hud.shake({ at: 1 }); view.shake({ at: 3 }); return { view, hud }; }`, 'too few human traces')],
  // Stagger variance.
  ['narration on the same gap', () => sourceFlags(scene(`  hud.narrate('ATARI BETS ON A HIT', { at: 1 });\n  hud.narrate('AND FILLS THE WAREHOUSE.', { at: 1.5 });\n  hud.narrate('AN OFFICE, A WAREHOUSE', { at: 2 });\n  hud.narrate('THE GAME IS MADE.', { at: 2.5 });`), 'stagger variance')],
  ['stock dropping in a linear loop', () => sourceFlags(scene(`  for (let i = 0; i < 5; i += 1) view.place({ sprite: 'boxes', pos: [3, 3] }, { at: 1 + i * 0.3 });`), 'stagger variance')],
  // Frames.
  ['approved walk flooded with the accent', () => frameFlags(paintRect(golden('look-rpg-explore-warehouse-t4'), 0, 0, 640, 90, SETUP.accent ?? [0, 0, 0]), 'accent colour')],
  ['approved walk plus eight HUD icons (24 px, an inventory slot)', () => {
    const frame = golden('look-rpg-explore-corridor-t3.5');
    for (let index = 0; index < 8; index += 1) paintRect(frame, 40 + index * 70, 150, 24, 24, PAPER);
    return frameFlags(frame, 'clutter');
  }],
  ['mirrored approved walk', () => frameFlags(mirrorLeftHalf(golden('look-rpg-explore-warehouse-t4')), 'centred and symmetric')],
  ['the same screen twice', () => sameFlags(golden('look-rpg-menu-quest_log-t3.3'), golden('look-rpg-menu-quest_log-t3.3'))],
  ['the same walk nudged 4 px', () => sameFlags(golden('look-rpg-explore-warehouse-t4'), shiftRight(golden('look-rpg-explore-warehouse-t4'), 4))],
]; // prettier-ignore

/** None today; a regression guard lists the misses here with the reason. */
const KNOWN_MISSES: readonly string[] = [];

const missed = CASES.filter(([, caught]) => !caught()).map(([name]) => name);
const caught = CASES.length - missed.length;

describe('Game B2 guards on planted fakes', () => {
  it(`catch ${String(caught)}/${String(CASES.length)} deliberately bad cases (target ≥ 90 %)`, () => {
    expect(caught / CASES.length).toBeGreaterThanOrEqual(0.9);
  });

  it('miss only the known blind spots today (regression guard)', () => {
    expect(missed).toEqual(KNOWN_MISSES);
  });
});
