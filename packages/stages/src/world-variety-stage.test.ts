/**
 * World variety on fake-claude (real run Sketchbook 1: a 2.5 min world film without a single
 * pop-up or strip): the Sketchbook storyboard prompt carries the moment catalog and the film's
 * quota; a storyboard without breakthroughs gets a repair turn with the `moment-quota` error and
 * passes once it plans a pop-up and a strip. A short test film reaches the same with the test-only
 * `worldQuotaOverride`. A world film without a continuity link (real run Sketchbook 2) gets a
 * repair turn with `continuity-quota`. No real Claude call.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { WordsFile } from '@reelforge/pipeline';
import { storyboardFileSchema, type ContinuityKind, type Roll } from '@reelforge/shared';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { StageRunner } from './runner.js';
import { DEFAULT_STAGE_SETTINGS, type StageSettings } from './settings.js';
import { FakeClaudeHarness, writes } from './testing/fake-claude.js';
import { readProject, TestProjects } from './testing/project.js';

const projects = new TestProjects();
const harnesses: FakeClaudeHarness[] = [];
afterEach(async () => {
  await Promise.all(harnesses.splice(0).map((harness) => harness.dispose()));
});
afterAll(() => {
  projects.dispose();
});

const LOOK: Readonly<Record<Roll, string>> = {
  A: 'sketch-story',
  B: 'sketch-graph',
  C: 'sketch-loud',
};
const TREATMENTS: Readonly<Record<Roll, readonly [string, string]>> = {
  A: ['character-scene', 'metaphor-object'],
  B: ['data-chart-3d', 'node-graph/timeline'],
  C: ['kinetic-text', 'title-card'],
};
const WORDS_PER_SHOT = 10;
const WORD_STEP_S = 0.45;

/** A shot plan: roll, then optional moment, page transition (`-` = none) and continuity link. */
type Plan = readonly [
  Roll,
  (string | undefined)?,
  (string | undefined)?,
  (ContinuityKind | undefined)?,
];

/** Words for shots of `lengthS` seconds: ten per shot from 0.2 s in, the last ends ~4.6 s in. */
function words(count: number, lengthS: number): WordsFile {
  const timed = Array.from({ length: count * WORDS_PER_SHOT }, (_, i) => {
    const shot = Math.floor(i / WORDS_PER_SHOT);
    const t = Math.round((shot * lengthS + 0.2 + WORD_STEP_S * (i % WORDS_PER_SHOT)) * 1000) / 1000;
    return {
      i,
      text: `word${String(i)}`,
      paragraph: shot,
      t,
      tEnd: Math.round((t + 0.35) * 1000) / 1000,
      confidence: 0.95,
      status: 'exact' as const,
    };
  });
  const total = timed.length;
  return {
    version: 1,
    lang: 'en',
    asrModel: 'small',
    words: timed,
    mismatches: [],
    stats: {
      scriptWords: total,
      asrWords: total,
      wer: 0,
      werFolded: 0,
      exact: total,
      folded: 0,
      fuzzy: 0,
      missing: 0,
      coverage: 1,
      timedShare: 1,
      insertions: 0,
      monotonic: true,
      clamped: 0,
    },
  };
}

/** A Sketchbook storyboard for `plans`, cut on each shot's first word. */
function storyboard(plans: readonly Plan[], lengthS: number, file: WordsFile): string {
  const lastEnd = file.words.at(-1)?.tEnd ?? 0;
  const shots = plans.map(([roll, moment, style, link], index) => {
    const id = `s${String(index + 1).padStart(2, '0')}`;
    return {
      id,
      t0: index === 0 ? 0 : index * lengthS + 0.2,
      t1: index + 1 < plans.length ? (index + 1) * lengthS + 0.2 : lastEnd + 0.3,
      treatment: TREATMENTS[roll][index % 2],
      intent: `Shot ${id} draws what the narration names on a taped scrap.`,
      scene: `scenes/${id}.js`,
      roll,
      look: LOOK[roll],
      ...(style === undefined || index === 0
        ? {}
        : { transitionIn: { type: 'wipe', duration: 0.8, style: `sketchbook-${style}` } }),
      ...(moment === undefined || moment === '-' ? {} : { worldMoment: moment }),
      ...(link === undefined ? {} : { continuity: { kind: link, object: 'taped scrap' } }),
    };
  });
  return JSON.stringify({ version: 1, shots }, null, 2);
}

async function worldProject(name: string, count: number, lengthS: number) {
  const dir = await projects.create(name, [], { style: 'sketchbook' });
  const file = words(count, lengthS);
  mkdirSync(path.join(dir, 'timing'), { recursive: true });
  writeFileSync(path.join(dir, 'timing', 'words.json'), JSON.stringify(file, null, 2));
  writeFileSync(path.join(dir, 'script.txt'), file.words.map((word) => word.text).join(' '));
  return { dir, file };
}

function runner(dir: string, harness: FakeClaudeHarness, settings: StageSettings): StageRunner {
  return new StageRunner({
    projectDir: dir,
    claude: harness.runner,
    guard: harness.guard,
    git: projects.git,
    settings,
  });
}

const SETTINGS: StageSettings = { ...DEFAULT_STAGE_SETTINGS, experimentalWorlds: true };
const BREAKTHROUGHS = new Set(['popup', 'strip']);

/** 26 shots of 6 s (~156 s): a pop-up at 18 s, a strip at 78 s, five other moments. */
const LONG: readonly Plan[] = [
  ['A'],
  ['B'],
  ['A', '-', undefined, 'zoom-through'],
  ['C', 'popup', 'page-flip'],
  ['A'],
  ['B', 'envelope'],
  ['A'],
  ['C', 'sticky-slap'],
  ['A', '-', 'torn-strip'],
  ['B'],
  ['A'],
  ['B'],
  ['C', 'flipbook', 'riffle'],
  ['B', 'strip'],
  ['A'],
  ['B', 'ruler-graph'],
  ['A', '-', undefined, 'shared-object'],
  ['C'],
  ['A'],
  ['B'],
  ['A'],
  ['C'],
  ['A'],
  ['B'],
  ['A'],
  ['C'],
];

const plainOf = (plans: readonly Plan[]): Plan[] =>
  plans.map(([roll, , style, link]): Plan => [roll, '-', style, link]);
const unlinked = (plans: readonly Plan[]): Plan[] =>
  plans.map(([roll, moment, style]): Plan => [roll, moment, style]);

describe('world variety on fake-claude', { timeout: 120_000 }, () => {
  it('repairs a storyboard without breakthroughs into a varied film plan', async () => {
    const { dir, file } = await worldProject('variety long', LONG.length, 6);
    const harness = new FakeClaudeHarness([
      writes({ 'storyboard.json': storyboard(plainOf(LONG), 6, file) }),
      writes({ 'storyboard.json': storyboard(LONG, 6, file) }),
    ]);
    harnesses.push(harness);
    const result = await runner(dir, harness, SETTINGS).run({ stage: 'storyboard' });
    if (!result.ok) throw new Error(JSON.stringify(result.error));
    expect(result.value.metrics['repairs']).toBe(1);
    const [first, repair] = harness.specs.filter((spec) => spec.stage === 'storyboard');
    expect(first?.prompt).toContain('Page moments (`"worldMoment"` per shot');
    expect(first?.prompt).toContain(
      '- `popup` (breakthrough; look `sketch-loud`; a shot of at least 4.5 s)',
    );
    expect(first?.prompt).toContain(
      'needs at least 2 and at most 5, of at least 2 different kinds',
    );
    expect(repair?.prompt).toContain('moment-quota');
    const written = storyboardFileSchema.parse(JSON.parse(readProject(dir, 'storyboard.json')));
    const durationS = written.shots.at(-1)?.t1 ?? 0;
    const breakthroughs = written.shots.filter((shot) => BREAKTHROUGHS.has(shot.worldMoment ?? ''));
    expect(breakthroughs.length).toBeGreaterThanOrEqual(Math.floor(durationS / 60));
    expect(new Set(breakthroughs.map((shot) => shot.worldMoment)).size).toBe(2);
    expect(new Set(written.shots.map((shot) => shot.worldMoment ?? 'plain')).size).toBe(7);
  });

  it('repairs a world film without continuity links (the signature cut)', async () => {
    const { dir, file } = await worldProject('variety links', LONG.length, 6);
    const harness = new FakeClaudeHarness([
      writes({ 'storyboard.json': storyboard(unlinked(LONG), 6, file) }),
      writes({ 'storyboard.json': storyboard(LONG, 6, file) }),
    ]);
    harnesses.push(harness);
    const result = await runner(dir, harness, SETTINGS).run({ stage: 'storyboard' });
    if (!result.ok) throw new Error(JSON.stringify(result.error));
    expect(result.value.metrics['repairs']).toBe(1);
    const [first, repair] = harness.specs.filter((spec) => spec.stage === 'storyboard');
    expect(first?.prompt).toContain('In this world the link is the signature cut');
    expect(first?.prompt).toContain('needs at least 2 links');
    expect(repair?.prompt).toContain('continuity-quota');
    expect(repair?.prompt).not.toContain('moment-quota');
    const written = storyboardFileSchema.parse(JSON.parse(readProject(dir, 'storyboard.json')));
    expect(written.shots.flatMap((shot) => shot.continuity?.kind ?? [])).toEqual([
      'zoom-through',
      'shared-object',
    ]);
  });

  it('asks a 50 s test film for both kinds with the test-only quota override', async () => {
    const plans: Plan[] = [
      ['A'],
      ['C', 'popup', 'page-flip'],
      ['A', '-', undefined, 'shared-object'],
      ['B', '-', 'riffle'],
      ['A'],
      ['C', '-', 'tape-peel'],
      ['A'],
      ['B'],
      ['A'],
      ['C'],
    ];
    const withStrip = plans.map((plan, index): Plan => (index === 7 ? ['B', 'strip'] : plan));
    const { dir, file } = await worldProject('variety override', plans.length, 5);
    const harness = new FakeClaudeHarness([
      writes({ 'storyboard.json': storyboard(plans, 5, file) }),
      writes({ 'storyboard.json': storyboard(withStrip, 5, file) }),
    ]);
    harnesses.push(harness);
    const settings = { ...SETTINGS, worldQuotaOverride: { minBreakthroughs: 2 } };
    const result = await runner(dir, harness, settings).run({ stage: 'storyboard' });
    if (!result.ok) throw new Error(JSON.stringify(result.error));
    expect(result.value.metrics['repairs']).toBe(1);
    const [first, repair] = harness.specs.filter((spec) => spec.stage === 'storyboard');
    expect(first?.prompt).toContain(
      'needs at least 2 and at most 2, of at least 2 different kinds',
    );
    expect(repair?.prompt).toContain('moment-quota');
    const written = storyboardFileSchema.parse(JSON.parse(readProject(dir, 'storyboard.json')));
    expect(written.shots.map((shot) => shot.worldMoment).filter(Boolean)).toEqual([
      'popup',
      'strip',
    ]);
  });
});
