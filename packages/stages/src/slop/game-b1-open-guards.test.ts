/**
 * Anti-slop calibration of the Game B1 open vocabulary (PLAN.md#13.15 phase 2): the six
 * open-vocabulary examples (forest, ocean, space station, village, desert, city), each judged with
 * its own narration, raise no finding through the public source guard (text provenance of the new
 * APIs, human traces, the unrequested-showcase guard) and none of them is number-only; planted
 * fakes (showcase objects nobody asked for, invented counter values, calendar years and chalk lines,
 * runs of number-only shots) are caught.
 */
import { resolveStyle } from '@reelforge/engine';
import { describe, expect, it } from 'vitest';
import { GAME_B1_OPEN_NARRATION, gameB1OpenExamples } from '../testing/game-b1-slop-fixtures.js';
import { parseHex } from './frame-guards.js';
import { b1NumberOnlyFindings, numberOnly } from './game-b1-showcase.js';
import { slopSourceFindings, type AntiSlopSetup } from './guards.js';
import { onScreenTexts, parseScene } from './source-text.js';
import { buildVocabulary } from './vocabulary.js';
import { worldSlopSpec, type ShotProgram } from './world-labels.js';

const SPEC = worldSlopSpec('game-b1');
if (SPEC === undefined) throw new Error('no Game B1 spec');
const ACCENT = parseHex(resolveStyle({ style: 'game-b1' }).palette.accent1);
const EXAMPLES = [...gameB1OpenExamples()];
const FOREST = GAME_B1_OPEN_NARRATION['o1_forest.js'] ?? '';
const CITY = GAME_B1_OPEN_NARRATION['o6_city.js'] ?? '';

const setup = (narration: string): AntiSlopSetup => ({
  vocabulary: buildVocabulary([narration]),
  spec: SPEC,
  accent: ACCENT,
});

function program(source: string) {
  const parsed = parseScene(source);
  if (parsed === undefined) throw new Error('does not parse');
  return parsed;
}

/** A forest shot with three traces (a decaying shake, a typed place, a note) around `body`. */
const scene = (body: string, tv = ''): string =>
  `export const meta = { id: 's01', title: 'the cartridge', treatment: 'character-scene' };
export function build(ctx) {
  const screen = ctx.kit.fx.b1Screen({ size: [640, 360], duration: 6 });
  screen.generate('ranger', { kind: 'person', role: 'ranger', tool: 'document', describe: 'the ranger' });
  screen.tv((g, t) => { const sh = g.util.shake(t, 2, 3, 8, 7); g.offset(sh.x * 2, sh.y * 2); g.draw('ranger', 40, 90, { flicker: false }); g.text('THE RIDGE', 6, 164, { colour: 'tan', type: { at: 0.45, cps: 16 } }); ${tv} });
  screen.note(['OLD OAKS'], { at: 3, x: 172, y: 190, under: 1 });
${body}
  return { screen };
}
export function update(t, state) { state.screen.update(t); }
`;

const flags = (narration: string, source: string, reason: string): boolean =>
  slopSourceFindings(setup(narration), source, 'scenes/s01.js').some((entry) =>
    entry.message.startsWith(reason),
  );

/** A shot that shows only Score Block digits on black. */
const NUMBER_SHOT = `export function build(ctx) { const screen = ctx.kit.fx.b1Screen({ duration: 6 }); screen.tv((g) => { g.bands(0, 160, [[0, 'void']]); g.score('900', 40, 60, { colour: 'gold', cell: [8, 8] }); }); return { screen }; }`;
const shots = (sources: readonly string[]): ShotProgram[] =>
  sources.map((source, index) => ({ shotId: `s${String(index + 1)}`, program: program(source) }));
const monotony = (sources: readonly string[]): string[] => [
  ...b1NumberOnlyFindings(shots(sources)).keys(),
];

describe('Game B1 guards on the open-vocabulary examples', () => {
  it('has the six examples and their narration', () => {
    expect(EXAMPLES.map(([name]) => name)).toEqual(Object.keys(GAME_B1_OPEN_NARRATION));
  });

  it('reports nothing on any of them through the public source guard', () => {
    const findings = EXAMPLES.flatMap(([name, source]) =>
      slopSourceFindings(setup(GAME_B1_OPEN_NARRATION[name] ?? ''), source, name).map(
        (entry) => `${name}: ${entry.message}`,
      ),
    );
    expect(findings).toEqual([]);
  });

  it('never calls one of them number-only, even all six in a row', () => {
    expect(EXAMPLES.filter(([, source]) => numberOnly(program(source)))).toEqual([]);
    expect(monotony(EXAMPLES.map(([, source]) => source))).toEqual([]);
  });

  it('reads the new APIs: ids, descriptions and meanings are not text; counted values are', () => {
    const texts = onScreenTexts(
      program(
        scene(
          `  screen.defineSprite('stump', { rows: ['########'], colours: 'teak', describe: 'a felled oak' });
  screen.interior({ shell: 'classroom', calendar: { month: 'OCT', year: 1990, mark: 9 }, props: [{ kind: 'blackboard', x: 180, lines: ['OLD OAKS'] }, { kind: 'shelf', x: 262, items: 'books' }] });`,
          `g.counter({ means: 'old oaks left in the valley', keys: [[0, 4000], [4.6, 900]], x: 6, y: 26 });`,
        ),
      ),
      SPEC,
    );
    expect(texts.map((entry) => entry.text)).toEqual([
      'THE RIDGE',
      '4000',
      '900',
      'OLD OAKS',
      'OCT',
      '1990',
      'OLD OAKS',
      'books',
    ]);
  });
});

const CASES: readonly (readonly [string, () => boolean])[] = [
  // Showcase objects nobody asked for.
  ['a cartridge painted in the TV', () => flags(FOREST, scene('', `g.cart(112, 111, 'orange', { scale: 2 });`), 'unrequested showcase object')],
  ['an E.T. sprite', () => flags(FOREST, scene(`  screen.defineSprite('et', { rows: ['..##....', '.####...'], colours: 'teak' });`), 'unrequested showcase object')],
  ['a cartridge sprite by its description', () => flags(FOREST, scene(`  screen.defineSprite('box', { rows: ['########'], colours: 'grey', describe: 'a game cartridge' });`), 'unrequested showcase object')],
  ['a generated cartridge item', () => flags(FOREST, scene(`  screen.generate('cartridge', { kind: 'item', type: 'key' });`), 'unrequested showcase object')],
  ['a shelf of cartridges in the room', () => flags(FOREST, scene(`  screen.interior({ shell: 'office', props: [{ kind: 'shelf', x: 262, items: 'cartridges' }] });`), 'unrequested showcase object')],
  ['a manual figure of cartridges', () => flags(FOREST, scene(`  screen.manual({ intent: 'the ranger counts the old oaks every morning', at: 0, until: 6, steps: ['THE RANGER COUNTED.'], figure: { caption: 'THE RIDGE', shape: 'cartridge' } });`), 'unrequested showcase object')],
  ['a Christmas tree in the living room', () => flags(FOREST, scene(`  screen.room({ calendar: { month: 'DEC', mark: 12 }, tree: true });`), 'unrequested showcase object')],
  ['an E.T. label in the TV', () => flags(FOREST, scene('', `g.text('E.T.', 10, 30, { colour: 'tan' });`), 'unrequested showcase object')],
  ['an ATARI sign in the TV', () => flags(FOREST, scene('', `g.text('ATARI', 10, 30, { colour: 'tan' });`), 'unrequested showcase object')],
  // Invented numbers and words of the new APIs.
  ['an invented counter value', () => flags(FOREST, scene('', `g.counter({ means: 'old oaks left in the valley', keys: [[0, 4000], [4.6, 950]], x: 6, y: 26 });`), 'invented text')],
  ['an invented calendar year', () => flags(CITY, scene(`  screen.interior({ shell: 'office', calendar: { month: 'OCT', year: 1989, mark: 19 } });`), 'invented text')],
  ['invented chalk on the blackboard', () => flags(FOREST, scene(`  screen.interior({ shell: 'classroom', props: [{ kind: 'blackboard', x: 180, lines: ['PHOTOSYNTHESIS'] }] });`), 'invented text')],
  // Number-only monotony.
  ['four number-only shots in a row', () => monotony([NUMBER_SHOT, NUMBER_SHOT, NUMBER_SHOT, NUMBER_SHOT]).includes('s4')],
  ['six number-only shots in a row (from the 4th on)', () => monotony(Array.from({ length: 6 }, () => NUMBER_SHOT)).join() === 's4,s5,s6'],
]; // prettier-ignore

/** What must NOT be flagged (the requested showcase object, short runs, the console swap). */
const CLEAN: readonly (readonly [string, () => boolean])[] = [
  ['a cartridge the narration names', () => flags(`${FOREST} The ranger kept an old Atari cartridge.`, scene('', `g.cart(112, 111, 'orange', { scale: 2 });`), 'unrequested showcase object')],
  ['the console swap with a neutral intent', () => flags(FOREST, scene(`  screen.cartridge({ intent: 'the ranger walks the ridge again, a new morning in the slot', action: 'insert', at: 0.6, label: 'THE RIDGE' });`), 'unrequested showcase object')],
  ['an intent that mentions a cartridge (not on screen)', () => flags(FOREST, scene(`  screen.cartridge({ intent: 'the cartridge of the ridge goes in: a new morning', action: 'insert', at: 0.6 });`), 'unrequested showcase object')],
  ['a generated tree named tree', () => flags(FOREST, scene(`  screen.assets({ version: 1, world: 'game-b1', generated: { tree: { kind: 'tree', shape: 'round' } } });`), 'unrequested showcase object')],
  ['three number-only shots in a row', () => monotony([NUMBER_SHOT, NUMBER_SHOT, NUMBER_SHOT]).length > 0],
  ['four number shots broken by a sprite shot', () => monotony([NUMBER_SHOT, NUMBER_SHOT, scene(''), NUMBER_SHOT, NUMBER_SHOT]).length > 0],
]; // prettier-ignore

const caught = CASES.filter(([, hit]) => hit()).length;
const falsePositives = CLEAN.filter(([, hit]) => hit()).map(([name]) => name);

describe('Game B1 open-vocabulary guards on planted fakes', () => {
  it(`catch ${String(caught)}/${String(CASES.length)} planted fakes`, () => {
    expect(CASES.filter(([, hit]) => !hit()).map(([name]) => name)).toEqual([]);
  });

  it(`flag none of the ${String(CLEAN.length)} legitimate cases`, () => {
    expect(falsePositives).toEqual([]);
  });

  it('name the object, the line and what to do instead', () => {
    const [entry] = slopSourceFindings(
      setup(FOREST),
      scene('', `g.cart(112, 111, 'orange', { scale: 2 });`),
      'scenes/s01.js',
    ).filter((item) => item.message.startsWith('unrequested'));
    expect(entry?.message).toBe(
      "unrequested showcase object: a cartridge (scenes/s01.js:5) - the narration never mentions it. Draw this film's own things (its assets, screen.defineSprite / screen.generate, a room that fits the film).",
    );
    expect(SPEC.filmChecks).toBe(b1NumberOnlyFindings);
    expect(monotony(Array.from({ length: 4 }, () => NUMBER_SHOT))).toEqual(['s4']);
    const [run] = b1NumberOnlyFindings(shots(Array.from({ length: 4 }, () => NUMBER_SHOT))).get(
      's4',
    ) ?? [{ message: '' }];
    expect(run?.message).toContain('number-only monotony: 4 shots in a row (s1, s2, s3, s4)');
  });
});
