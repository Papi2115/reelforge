/**
 * Anti-slop calibration of the Game B2 open vocabulary (PLAN.md#13.15 phase 2): the six kit examples
 * built only through the open layer (forest, ocean, space station, medieval village, desert, city)
 * get no finding at all with their own narration and research (text provenance, traces, stagger,
 * intents and the unrequested-showcase-object guard); the film's asset packs and generator options
 * are not read as on-screen text; planted showcase objects (a cartridge, the returns clerk, E.T.,
 * the showcase levels) are caught, and the same things pass once the narration asks for them.
 */
import { describe, expect, it } from 'vitest';
import { GAME_B2_OPEN_FILMS, gameB2OpenExamples } from '../testing/game-b2-open-fixtures.js';
import { slopSourceFindings, type AntiSlopSetup } from './guards.js';
import { countTraces } from './source-guards.js';
import { onScreenTexts, parseScene } from './source-text.js';
import { buildVocabulary } from './vocabulary.js';
import { worldSlopSpec } from './world-labels.js';

const SPEC = worldSlopSpec('game-b2');
const EXAMPLES = [...gameB2OpenExamples()];
const SHOWCASE = 'unrequested showcase object';

function setup(name: string, extra = ''): AntiSlopSetup {
  const film = GAME_B2_OPEN_FILMS[name];
  if (film === undefined) throw new Error(`no narration for ${name}`);
  return {
    vocabulary: buildVocabulary([film.narration, film.research, extra]),
    spec: SPEC,
    accent: undefined,
  };
}

function source(name: string): string {
  const found = EXAMPLES.find(([file]) => file === name)?.[1];
  if (found === undefined) throw new Error(`no example ${name}`);
  return found;
}

function program(code: string) {
  const parsed = parseScene(code);
  if (parsed === undefined) throw new Error('does not parse');
  return parsed;
}

const messages = (name: string, code: string, extra = ''): string[] =>
  slopSourceFindings(setup(name, extra), code, `scenes/${name}`).map((entry) => entry.message);

/** The example with `line` added at the end of build() (view and hud exist there). */
const planted = (name: string, line: string): string =>
  source(name).replace('  return { view, hud };', `  ${line}\n  return { view, hud };`);
const replaced = (name: string, from: string, to: string): string => {
  const code = source(name);
  if (!code.includes(from)) throw new Error(`${name} has no ${from}`);
  return code.replace(from, to);
};

describe('Game B2 guards on the open-vocabulary examples', () => {
  it('has the six examples and a film for each', () => {
    expect(EXAMPLES.map(([name]) => name)).toEqual(Object.keys(GAME_B2_OPEN_FILMS));
  });

  it('reports nothing at all on any of them (0 false positives)', () => {
    const findings = EXAMPLES.flatMap(([name, code]) =>
      messages(name, code).map((message) => `${name}: ${message}`),
    );
    expect(findings).toEqual([]);
  });

  it('never reads the asset pack, ids or generator options as on-screen text', () => {
    for (const [name, code] of EXAMPLES) {
      const lines = code.split('\n');
      const build = lines.findIndex((line) => line.startsWith('export function build'));
      const texts = onScreenTexts(program(code), SPEC);
      expect(texts.length, name).toBeGreaterThan(2);
      expect(
        texts.filter((entry) => entry.line <= build).map((entry) => entry.text),
        name,
      ).toEqual([]);
    }
    // A vehicle's `body` ramp is not a toast's body.
    const city = onScreenTexts(program(source('o6_city.js')), SPEC);
    expect(city.map((entry) => entry.text)).not.toContain('sky');
  });

  it('counts the open traces once each (3-5 per example), never generator sway alone', () => {
    if (SPEC === undefined) throw new Error('no Game B2 spec');
    const totals = EXAMPLES.map(
      ([name, code]) => `${name} ${String(countTraces(program(code), SPEC).total)}`,
    );
    expect(totals).toEqual([
      'o1_forest.js 4',
      'o2_ocean.js 4',
      'o3_space.js 5',
      'o4_medieval.js 3',
      'o5_desert.js 3',
      'o6_city.js 4',
    ]);
    const flipsOnly = `const LEVEL = { sprites: [{ sprite: 'hen', flip: true }, { sprite: 'hen', flip: true }, { sprite: 'oak', flip: true }] };
const ASSETS = { sprites: { oak: { gen: 'plant', kind: 'deciduous', lean: 0.4, fps: 3 }, reeds: { gen: 'plant', kind: 'reeds', fps: 4 } } };`;
    expect(countTraces(program(flipsOnly), SPEC).total).toBe(2);
  });
});

/** [name, example, planted source] of a showcase thing a film never asks for. */
const PLANTED: readonly (readonly [string, string, string])[] = [
  ['a held item without an icon (the default cartridge)', 'o1_forest.js', planted('o1_forest.js', "view.hold({ label: 'FUNGI' }, { at: 6 });")],
  ['a taken item without an icon', 'o2_ocean.js', replaced('o2_ocean.js', "view.take({ icon: 'conch' }", "view.take({ label: 'SHELL' }")],
  ['a thrown cartridge', 'o5_desert.js', planted('o5_desert.js', "view.throw({ kind: 'cartridge' }, { intent: 'the caravan leaves the empty flask at the oasis', at: 6, to: [11, 6.6] });")],
  ['the cartridge icon in the inventory', 'o4_medieval.js', planted('o4_medieval.js', "hud.inventory({ items: [{ icon: 'cartridge', label: 'BREAD', at: 1 }], at: 1 });")],
  ['the built-in cartridge sprite', 'o1_forest.js', planted('o1_forest.js', "view.place({ sprite: 'item', pos: [12.4, 8.6] }, { at: 5 });")],
  ['a cartridge in the sand', 'o5_desert.js', planted('o5_desert.js', "view.place({ sprite: 'sand-pile', pos: [11, 6.6] }, { at: 5 });")],
  ['the clerk as a villager', 'o4_medieval.js', planted('o4_medieval.js', "view.place({ sprite: 'clerk', pos: [12.9, 7.1] }, { at: 5 });")],
  ['the clerk as a speaker', 'o6_city.js', replaced('o6_city.js', "speaker: 'NURSE'", "speaker: 'CLERK'")],
  ['an asset id naming a cartridge', 'o3_space.js', planted('o3_space.js', "view.defineSprite('cartridge-pile', { gen: 'object', kind: 'pile' });")],
  ['an icon id naming Atari', 'o2_ocean.js', planted('o2_ocean.js', "view.defineIcon('atari-logo', { gen: 'icon', kind: 'chip' });")],
  ['E.T. in a toast', 'o3_space.js', planted('o3_space.js', "hud.toast({ head: '+ ITEM', body: 'E.T.', at: 6 });")],
  ['the landfill on the compass', 'o5_desert.js', replaced('o5_desert.js', "place: 'OASIS'", "place: 'THE LANDFILL'")],
  ['the built-in office level', 'o1_forest.js', replaced('o1_forest.js', 'level: FOREST,', "level: 'office', stencil: 'FUNGI',")],
  ['the built-in warehouse level', 'o6_city.js', replaced('o6_city.js', 'level: STREET,', "level: 'warehouse',")],
]; // prettier-ignore

/** The same things with sources that ask for them, and an intent that only names one. */
const REQUESTED: readonly (readonly [string, string, string, string])[] = [
  ['a cartridge the narration names', 'o1_forest.js', planted('o1_forest.js', "view.hold({ kind: 'cartridge' }, { at: 6 });"), 'An old game cartridge lay under the log.'],
  ['a clerk the research names', 'o6_city.js', replaced('o6_city.js', "speaker: 'NURSE'", "speaker: 'CLERK'"), 'The night clerk of the bus depot.'],
  ['a cartridge only in an intent', 'o5_desert.js', planted('o5_desert.js', "view.throw({ icon: 'flask' }, { intent: 'not a cartridge: the flask goes back into the oasis pool', at: 6, to: [11, 6.6] });"), ''],
]; // prettier-ignore

const showcase = (name: string, code: string, extra = ''): boolean =>
  messages(name, code, extra).some((message) => message.startsWith(SHOWCASE));

const caught = PLANTED.filter(([, name, code]) => showcase(name, code)).length;

describe('Game B2 unrequested showcase objects', () => {
  it(`catch ${String(caught)}/${String(PLANTED.length)} planted showcase things`, () => {
    const missed = PLANTED.filter(([, name, code]) => !showcase(name, code)).map(([what]) => what);
    expect(missed).toEqual([]);
  });

  it('pass the same things when the sources ask for them', () => {
    const flagged = REQUESTED.filter(([, name, code, extra]) => showcase(name, code, extra));
    expect(flagged.map(([what]) => what)).toEqual([]);
  });

  it('names the thing, the file and the line', () => {
    const [message] = messages('o1_forest.js', PLANTED[0]?.[2] ?? '').filter((entry) =>
      entry.startsWith(SHOWCASE),
    );
    expect(message).toMatch(
      /^unrequested showcase object: a game cartridge \(scenes\/o1_forest\.js:\d+: an item without an icon\)/,
    );
  });
});
