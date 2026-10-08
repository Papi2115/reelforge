/**
 * Comic page flow and continuity guards (comic-flow.ts; Papi after real run Comic 2: dry
 * transitions, pages that always unfold the same way, nothing carried across panels). The two
 * page-flow examples (examples/comic/open/p1-p2) report nothing against their own sources; planted
 * films are caught: a dry run of plain cuts, the same flow on three pages in a row, a long film
 * that carries nothing across three panels or shots; a flow or thread without a real intent.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { StoryboardShot } from '@reelforge/shared';
import { describe, expect, it } from 'vitest';
import { comicFlowFilmFindings, pageFlowOf, shotEntry } from './comic-flow.js';
import { slopSourceFindings } from './guards.js';
import { parseScene } from './source-text.js';
import { buildVocabulary } from './vocabulary.js';
import { worldSlopSpec, type ShotEntry, type ShotProgram } from './world-labels.js';

const SPEC = worldSlopSpec('comic');
if (SPEC === undefined) throw new Error('no Comic spec');
const OPEN = fileURLToPath(new URL('../../../kit/examples/comic/open/', import.meta.url));

function program(source: string) {
  const parsed = parseScene(source);
  if (parsed === undefined) throw new Error('does not parse');
  return parsed;
}

const scene = (body: string) =>
  program(
    `export function build(ctx) { const page = ctx.kit.fx.comicPage({}); ${body} return { page }; }`,
  );
const TWO_UP = "page.layout([{ at: 0, backdrop: 'forest' }, { at: 2, backdrop: 'meadow' }]);";
const DOWN = "page.flow({ intent: 'x', direction: 'down', beats: [] });";
const THREAD = "page.thread({ intent: 'x', through: [], draw: () => {} });";

function film(entries: readonly ShotEntry[], bodies: readonly string[] = []): ShotProgram[] {
  return entries.map((entry, i) => ({
    shotId: `s${String(i + 1).padStart(2, '0')}`,
    program: scene(bodies[i] ?? ''),
    entry,
  }));
}

const messages = (shots: readonly ShotProgram[]) =>
  [...comicFlowFilmFindings(shots)].flatMap(([id, found]) =>
    found.map((entry) => `${id}: ${entry.message.split(':')[0] ?? ''}`),
  );

describe('Comic flow guards', () => {
  it('reads how a storyboard shot enters', () => {
    const shot = (extra: Partial<StoryboardShot>): StoryboardShot => ({
      id: 's',
      t0: 0,
      t1: 4,
      treatment: 'kinetic-text',
      intent: 'x',
      scene: 's.js',
      ...extra,
    });
    expect(shotEntry(shot({ transitionIn: { type: 'cut' } }))).toBe('cut');
    expect(shotEntry(shot({}))).toBe('cut');
    const wipe = { type: 'wipe' as const, duration: 0.9, style: 'comic-page-turn' };
    expect(shotEntry(shot({ transitionIn: wipe }))).toBe('page');
    const link = { type: 'crossfade' as const, duration: 1, style: 'continuity-zoom-through' };
    expect(shotEntry(shot({ transitionIn: link }))).toBe('link');
  });

  it('reads the page flow of a scene', () => {
    expect(pageFlowOf(scene(TWO_UP))).toBe('layout 2 beats');
    expect(pageFlowOf(scene("page.panels('strip');"))).toBe('panels strip');
    expect(pageFlowOf(scene(DOWN))).toBe('flow down');
    expect(pageFlowOf(scene('page.panel([0, 0, 9, 0, 9, 9, 0, 9]);'))).toBeUndefined();
  });

  it('flags a dry run of plain cuts, not one broken by a page transition or a link', () => {
    const dry = film(['cut', 'cut', 'cut', 'cut', 'cut']);
    expect(messages(dry)).toEqual(['s05: dry run']);
    const turned = film(['cut', 'cut', 'cut', 'page', 'cut', 'cut'], Array(6).fill(THREAD));
    expect(messages(turned)).toEqual([]);
    const flowing = film(['cut', 'cut', 'cut', 'cut', 'cut'], ['', '', DOWN]);
    expect(messages(flowing)).toEqual([]);
  });

  it('flags the same page flow on three pages in a row', () => {
    const same = film(['cut', 'page', 'link', 'page'], [TWO_UP, TWO_UP, TWO_UP, DOWN]);
    expect(messages(same)).toEqual(['s03: same page flow on 3 pages in a row (layout 2 beats)']);
    const varied = film(['cut', 'page', 'link', 'page'], [TWO_UP, DOWN, TWO_UP, DOWN]);
    expect(messages(varied)).toEqual([]);
  });

  it('flags a long film that carries nothing across three panels or shots', () => {
    const entries: ShotEntry[] = ['cut', 'page', 'cut', 'link', 'page', 'cut'];
    expect(messages(film(entries))).toEqual(['s01: no long continuity']);
    expect(messages(film(entries, ['', '', THREAD]))).toEqual([]);
    expect(messages(film(['cut', 'page', 'link', 'link', 'page', 'cut']))).toEqual([]);
  });

  it('flags a flow or thread without a real intent in a scene', () => {
    const setup = { vocabulary: buildVocabulary(['a river town']), spec: SPEC, accent: undefined };
    const source = (body: string) =>
      `export function build(ctx) { const page = ctx.kit.fx.comicPage({}); page.thumbprint(1, 1); page.smudge(2, 2); page.coffeeRing(3, 3); ${body} return { page }; }`;
    const found = (body: string) =>
      slopSourceFindings(setup, source(body), 's.js').map((entry) => entry.message);
    expect(found("page.flow({ direction: 'down', beats: [] });")[0]).toMatch(
      /^flow without an intent/,
    );
    expect(found("page.thread({ intent: 'the motion', through: [], draw: () => {} });")[0]).toMatch(
      /^generic thread intent/,
    );
  });
});

const EXAMPLES = [
  {
    file: 'p1_well.js',
    narration:
      'The well is forty metres deep. The bucket drops past the stones, past the dark, and hits the water.',
    research: 'Hand-dug wells were lined with stones; a bucket on a rope drew the water up.',
  },
  {
    file: 'p2_letter.js',
    narration:
      'The letter left the city on Monday, crossed the mountains by train, the sea by ship, and reached the farm on Friday.',
    research:
      'Mail crossed the country by train and the sea by steamship; a letter took about five days.',
  },
] as const;

describe('Comic page-flow examples (false positives)', () => {
  it.each(EXAMPLES)('$file reports nothing against its own sources', (example) => {
    const setup = {
      vocabulary: buildVocabulary([example.narration, example.research]),
      spec: SPEC,
      accent: undefined,
    };
    const source = readFileSync(path.join(OPEN, example.file), 'utf8');
    expect(slopSourceFindings(setup, source, example.file).map((entry) => entry.message)).toEqual(
      [],
    );
  });
});
