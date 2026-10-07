/**
 * Comic breakthroughs are never a template (PLAN.md#13.15, real run Comic 2). The kit's three
 * panel-break examples (examples/comic/open/b1-b3), each judged against its own narration and
 * research notes, report nothing but the replay of their own mechanism; their goldens pass the
 * frame guards. Planted cases: a flashback or spread with a showcase template's options, a panel
 * break without an intent or with a generic one, and the same panel-break mechanism twice in a film.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveStyle } from '@reelforge/engine';
import { describe, expect, it } from 'vitest';
import { goldenFrames } from '../testing/slop-fixtures.js';
import { breakthroughSpecs, repeatedBreakthroughFindings } from './breakthrough-intent.js';
import { COMIC_BREAK_EXAMPLES, panelBreakMechanism } from './comic-breakthroughs.js';
import { parseHex } from './frame-guards.js';
import { slopFrameFindings, slopSourceFindings, type AntiSlopSetup } from './guards.js';
import { parseScene } from './source-text.js';
import { buildVocabulary } from './vocabulary.js';
import { worldSlopSpec } from './world-labels.js';

const COMIC = worldSlopSpec('comic');
if (COMIC === undefined) throw new Error('no Comic spec');
const SPEC = COMIC;
const KINDS = SPEC.breakthroughs ?? {};
const OPEN = fileURLToPath(new URL('../../../kit/examples/comic/open/', import.meta.url));

const EXAMPLES = [
  {
    file: 'b1_glacier.js',
    name: 'b1 (glacier)',
    narration:
      'In 1900 the glacier reached the lake. Every summer since, it has pulled back up the valley: today the ice ends two kilometres from the shore.',
    research:
      'Alpine valley glaciers have retreated since the end of the Little Ice Age; many that reached their lakes around 1900 now end kilometres up the valley. The terminus is measured each summer.',
  },
  {
    file: 'b2_bridge.js',
    name: 'b2 (bridge)',
    narration:
      'Three villages on two banks, and no bridge between them. Then the bridge opened, and the three villages grew into one city.',
    research:
      'Settlements on opposite banks of a river often merged into one town after the first permanent bridge; before it, ferries were the only crossing.',
  },
  {
    file: 'b3_levee.js',
    name: 'b3 (levee)',
    narration:
      'For a week the river pushed against the levee. At dawn one section cracked, and the water dragged the rest of the wall down with it.',
    research:
      'Levee breaches often start where one section is undermined; once it fails, the flow scours the neighbouring sections and the breach widens as the river pours through.',
  },
] as const;

function program(source: string) {
  const parsed = parseScene(source);
  if (parsed === undefined) throw new Error('does not parse');
  return parsed;
}

function setupFor(narration: string, research: string): AntiSlopSetup {
  return { vocabulary: buildVocabulary([narration, research]), spec: SPEC, accent: undefined };
}

const source = (file: string): string => readFileSync(path.join(OPEN, file), 'utf8');

describe('Comic panel-break examples (false positives)', () => {
  it('registers exactly the mechanisms the example files have', () => {
    const read = EXAMPLES.map(({ file, name }) => [
      name,
      breakthroughSpecs(program(source(file)), KINDS)[0]?.mechanism,
    ]);
    expect(Object.fromEntries(read)).toEqual(COMIC_BREAK_EXAMPLES);
    expect(new Set(Object.values(COMIC_BREAK_EXAMPLES)).size).toBe(3);
  });

  it.each(EXAMPLES)('$file reports nothing but the replay of its own mechanism', (example) => {
    const setup = setupFor(example.narration, example.research);
    const messages = slopSourceFindings(setup, source(example.file), example.file).map(
      (entry) => entry.message,
    );
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatch(/^panelBreak replays the kit example/);
  });

  it('a film of the three repeats no mechanism and no intent', () => {
    const film = EXAMPLES.map(({ file }) => ({
      shotId: file,
      specs: breakthroughSpecs(program(source(file)), KINDS),
    }));
    expect(repeatedBreakthroughFindings(film).size).toBe(0);
  });

  it('their goldens pass the frame guards', () => {
    const accent = parseHex(resolveStyle({ style: 'comic' }).palette.accent1);
    const setup = { ...setupFor('', ''), accent };
    const goldens = [...goldenFrames(/^look-break-comic-.*\.png$/)];
    expect(goldens).toHaveLength(10);
    const flagged = goldens.flatMap(([name, image]) =>
      slopFrameFindings(setup, [{ t: 1, image }], { treatment: 'map' }).map(
        (entry) => `${name}: ${entry.message}`,
      ),
    );
    expect(flagged).toEqual([]);
  });
});

/** A river-town page with three traces around `body`. */
const page = (body: string): string => `export function build(ctx) {
  const page = ctx.kit.fx.comicPage({ seed: 3, anchor: ctx.anchor, duration: 8 });
  page.thumbprint(600, 340);
  page.smudge(300, 200, { length: 8 });
  page.coffeeRing(520, 300, 22);
${body}
  return { page };
}
`;
const TOWN = setupFor(
  'The river flooded the lower town in spring. The new dam held back the water and the town moved up the hill.',
  'Spring floods drowned the lower town; the dam was finished the next year.',
);
const found = (body: string): string[] =>
  slopSourceFindings(TOWN, page(body), 'scenes/s04.js').map((entry) => entry.message);
const PANELS = `panels: [{ id: 'a', box: [20, 20, 300, 300], draw: (g) => g.rect(0, 0, 9, 9, 'ink') }]`;
const INTENT = "intent: 'the dam held back the river and the town moved up the hill'";
const DAM = 'the new dam held back the spring floods';
const HILL = 'the lower town moved up the hill';

describe('Comic breakthrough originality (planted)', () => {
  it.each([
    [
      "page.flashback({ intent: 'the river flooded the lower town in spring', when: 'IN SPRING...', cover: 'strip', arrange: 'row', beats: [] });",
      'example f2',
    ],
    [
      "page.flashback({ intent: 'the river flooded the lower town in spring', when: 'IN SPRING...', cover: 'page', arrange: 'rows', beats: [] });",
      'f1',
    ],
    [
      "page.spread({ intent: 'the town moved up the hill above the dam', art: () => {}, assemble: 'merge', pieces: 'grid' });",
      's1',
    ],
    [
      "page.spread({ intent: 'the town moved up the hill above the dam', art: () => {}, assemble: 'unfold' });",
      'example s2',
    ],
  ])('flags a showcase template: %s', (body, source) => {
    const message = found(body).find((entry) => entry.includes('replays a showcase template'));
    expect(message).toContain(source);
  });

  it('lets other combinations and an invented panel break through', () => {
    for (const body of [
      "page.flashback({ intent: 'the river flooded the lower town in spring', when: 'IN SPRING...', cover: 'strip', arrange: 'pile', beats: [] });",
      "page.spread({ intent: 'the town moved up the hill above the dam', art: () => {}, assemble: 'merge', pieces: 'halves' });",
      `page.panelBreak({ ${INTENT}, ${PANELS}, moves: [{ target: 'a', at: 2, to: { y: -120 } }] });`,
    ]) {
      expect(found(body)).toEqual([]);
    }
  });

  it('flags a panel break without an intent or with a generic one', () => {
    const moves = "moves: [{ target: 'a', at: 2, to: { y: -120 } }]";
    expect(found(`page.panelBreak({ ${PANELS}, ${moves} });`)[0]).toMatch(
      /^panelBreak without an intent/,
    );
    expect(found(`page.panelBreak({ intent: 'the big reveal', ${PANELS}, ${moves} });`)[0]).toMatch(
      /^generic panelBreak intent/,
    );
  });

  it('flags the same panel-break mechanism twice in a film, not two different ones', () => {
    const shot = (shotId: string, intent: string, moves: string) => ({
      shotId,
      specs: breakthroughSpecs(
        program(page(`page.panelBreak({ ${`intent: '${intent}'`}, ${PANELS}, ${moves} });`)),
        KINDS,
      ),
    });
    const lift = "moves: [{ target: 'a', at: 2, to: { y: -120 } }], gutters: { kind: 'lift' }";
    const tilt = "moves: [{ target: 'a', at: 1, to: { y: 40 } }], gutters: { kind: 'lift' }";
    const turn = "moves: [{ target: 'a', at: 1, to: { rotate: 6 } }], gutters: { kind: 'tear' }";
    const twice = repeatedBreakthroughFindings([shot('s02', DAM, lift), shot('s07', HILL, tilt)]);
    expect(twice.get('s07')?.[0]?.message).toMatch(
      /mechanism "enter cut \+ moves y \+ gutters lift"/,
    );
    expect(
      repeatedBreakthroughFindings([shot('s02', DAM, lift), shot('s07', HILL, turn)]).size,
    ).toBe(0);
  });

  it('reads no mechanism from panels or moves built at run time', () => {
    const options = program('page.panelBreak({ intent: "x", panels: list, moves: [] })');
    const specs = breakthroughSpecs(options, KINDS);
    expect(specs[0]?.mechanism).toBeUndefined();
    expect(panelBreakMechanism(undefined)).toBe('enter  + moves none + gutters keep');
  });
});
