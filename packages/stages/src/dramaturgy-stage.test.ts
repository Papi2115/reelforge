/**
 * Dramaturgy on fake-claude (PLAN.md#12.25–12.27): the script asks for surprise beats and open
 * loops only with the switches on; the storyboard plans interrupt markers (validated, repaired,
 * locked shots keep theirs) and writes loops.json, whose deliberately unclosed loop is reported
 * as a ⚠ warning in the stage record, the storyboard report and the dramaturgy report; the scene
 * build gets the directives; the mix adds the hits of accepted silence-hit moments.
 */
import {
  DRAMATURGY_REPORT_FILE,
  dramaturgyReportSchema,
  storyboardFileSchema,
  storyboardReportSchema,
  type LoopsFile,
  type StoryboardShot,
} from '@reelforge/shared';
import { CuesFileSchema } from '@reelforge/pipeline';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { mixMoments, sceneDramaturgyVars } from './dramaturgy.js';
import { setShotsLocked } from './locks.js';
import { StageRunner } from './runner.js';
import { withMomentHits } from './stages/mix.js';
import { FakeClaudeHarness, writes, type Step } from './testing/fake-claude.js';
import { TestProjects, goldenFile, readProject, writeProject } from './testing/project.js';

const projects = new TestProjects();
const harnesses: FakeClaudeHarness[] = [];
afterEach(async () => {
  await Promise.all(harnesses.splice(0).map((harness) => harness.dispose()));
});
afterAll(() => {
  projects.dispose();
});

const SWITCHES_ON = { patternInterrupts: 'auto', openLoops: 'auto', revealMoments: 'auto' };

function switchOn(dir: string, switches: Record<string, string> = SWITCHES_ON): void {
  const project = JSON.parse(readProject(dir, 'project.json')) as Record<string, unknown>;
  // voxel-only: the golden storyboard has no rolls (the look rules are not under test here).
  const next = { ...project, lookMode: 'voxel-only', ...switches };
  writeProject(dir, 'project.json', JSON.stringify(next, null, 2));
}

const GOLDEN = JSON.parse(goldenFile('storyboard.json')) as { version: 1; shots: StoryboardShot[] };

function storyboard(marks: Readonly<Record<string, StoryboardShot['interrupt']>>): string {
  const shots = GOLDEN.shots.map((shot) =>
    marks[shot.id] === undefined ? shot : { ...shot, interrupt: marks[shot.id] },
  );
  return JSON.stringify({ ...GOLDEN, shots }, null, 2);
}

const SHRINK = { kind: 'scale-shift' as const, note: 'the glass shrinks to a drop' };
const MARKED = storyboard({ s04_rainbow: SHRINK });

/** One closed loop and one deliberately left open. */
const LOOPS: LoopsFile = {
  version: 1,
  loops: [
    {
      id: 'why-colours',
      question: 'where do the colours come from?',
      openedAt: { t: 2.225, shotId: 's01_hook', phrase: 'quick experiment' },
      plannedCloseAt: { t: 26.745, shotId: 's06_red_violet' },
      closedAt: { t: 26.745, shotId: 's06_red_violet', phrase: 'Red bends the least' },
      foreshadowed: true,
      status: 'closed',
      veil: true,
    },
    {
      id: 'newton-secret',
      question: 'what did Newton use?',
      openedAt: { t: 30.325, shotId: 's07_newton' },
      plannedCloseAt: { t: 36.4, shotId: 's07_newton' },
      foreshadowed: false,
      status: 'open',
    },
  ],
};

async function setup(name: string, steps: readonly Step[], golden: readonly string[]) {
  const dir = await projects.create(name, golden);
  const harness = new FakeClaudeHarness(steps);
  harnesses.push(harness);
  const runner = new StageRunner({
    projectDir: dir,
    claude: harness.runner,
    guard: harness.guard,
    git: projects.git,
  });
  return { dir, harness, runner };
}

const STORYBOARD_INPUTS = ['script.txt', 'timing/words.json'];

describe('dramaturgy stages', { timeout: 60_000 }, () => {
  it('script: surprise beats and open loops only with the switches on', async () => {
    const steps = [
      writes({ 'research.md': goldenFile('research.md') }),
      writes({ 'beats.md': goldenFile('beats.md'), 'script.txt': goldenFile('script.txt') }),
    ];
    const off = await setup('drama script off', steps, ['brief.json']);
    expect((await off.runner.run({ stage: 'script' })).ok).toBe(true);
    expect(off.harness.specs[1]?.prompt).not.toContain('Surprise beats');
    const on = await setup('drama script on', steps, ['brief.json']);
    switchOn(on.dir);
    expect((await on.runner.run({ stage: 'script' })).ok).toBe(true);
    const prompt = on.harness.specs[1]?.prompt ?? '';
    expect(prompt).toContain('3. Surprise beats (pattern interrupts are on for this project)');
    expect(prompt).toContain('4. Open loops (on for this project)');
  });

  it('storyboard: interrupt markers and loops.json; an unclosed loop is a ⚠ warning', async () => {
    const { dir, harness, runner } = await setup(
      'drama storyboard',
      [writes({ 'storyboard.json': MARKED, 'loops.json': JSON.stringify(LOOPS, null, 2) })],
      STORYBOARD_INPUTS,
    );
    switchOn(dir);
    const result = await runner.run({ stage: 'storyboard' });
    expect(result.ok).toBe(true);
    const prompt = harness.specs[0]?.prompt ?? '';
    expect(prompt).toContain('Pattern interrupts (on for this project)');
    expect(prompt).toContain('Plan 0–2 interrupts in this 0:37 film');
    expect(prompt).toContain('write `loops.json` next to the storyboard');
    const unclosed = '⚠ loop newton-secret "what did Newton use?" is never closed';
    const warnings = result.ok ? result.value.warnings : [];
    expect(warnings.some((line) => line.startsWith(unclosed))).toBe(true);
    const report = storyboardReportSchema.parse(
      JSON.parse(readProject(dir, '.reelforge/reports/storyboard.json')),
    );
    expect(report.warnings.some((line) => line.startsWith(unclosed))).toBe(true);
    const drama = dramaturgyReportSchema.parse(
      JSON.parse(readProject(dir, DRAMATURGY_REPORT_FILE)),
    );
    expect(drama).toMatchObject({
      source: 'storyboard',
      interrupts: { planned: 1, realised: 0 },
      loops: { count: 2, open: 1 },
    });
    const written = storyboardFileSchema.parse(JSON.parse(readProject(dir, 'storyboard.json')));
    expect(written.shots.find((shot) => shot.id === 's04_rainbow')?.interrupt).toEqual(SHRINK);
  });

  it('storyboard: repairs an interrupt in the first 5 s', async () => {
    const early = storyboard({ s01_hook: SHRINK });
    const { dir, harness, runner } = await setup(
      'drama storyboard repair',
      [writes({ 'storyboard.json': early }), writes({ 'storyboard.json': MARKED })],
      STORYBOARD_INPUTS,
    );
    switchOn(dir, { patternInterrupts: 'auto' });
    const result = await runner.run({ stage: 'storyboard' });
    expect(result.ok && result.value.metrics['repairs']).toBe(1);
    expect(harness.specs[1]?.prompt).toContain('interrupt-too-early');
  });

  it('storyboard: a locked shot keeps its marker', async () => {
    const { dir, harness, runner } = await setup(
      'drama storyboard locked',
      [
        writes({ 'storyboard.json': storyboard({ s04_rainbow: SHRINK, s07_newton: SHRINK }) }),
        writes({ 'storyboard.json': MARKED }),
      ],
      [...STORYBOARD_INPUTS, 'storyboard.json'],
    );
    switchOn(dir, { patternInterrupts: 'auto' });
    writeProject(dir, 'storyboard.json', MARKED);
    const locked = await setShotsLocked(
      dir,
      ['s07_newton'],
      true,
      new Date('2026-10-04T08:00:00Z'),
    );
    expect(locked.ok).toBe(true);
    const result = await runner.run({ stage: 'storyboard' });
    expect(result.ok && result.value.metrics['repairs']).toBe(1);
    expect(harness.specs[1]?.prompt).toContain('interrupt-locked');
  });

  it('scene build: the interrupt and veil directives of a shot', () => {
    const shots = storyboardFileSchema.parse(JSON.parse(MARKED)).shots;
    const shot = (id: string): StoryboardShot => {
      const found = shots.find((candidate) => candidate.id === id);
      if (found === undefined) throw new Error(id);
      return found;
    };
    const drama = { interrupts: true, loops: LOOPS };
    expect(sceneDramaturgyVars(drama, shots, shot('s04_rainbow'))['interruptDirective']).toContain(
      'ctx.camera.dollyZoom',
    );
    expect(sceneDramaturgyVars(drama, shots, shot('s06_red_violet'))['veilDirective']).toContain(
      'ctx.anchor("Red bends the least").t',
    );
    expect(sceneDramaturgyVars(drama, shots, shot('s01_hook'))['veilDirective']).toContain(
      'without revealing it',
    );
    expect(sceneDramaturgyVars(undefined, shots, shot('s04_rainbow'))).toEqual({});
  });

  it('mix: accepted silence hits become bed silences and hit cues', async () => {
    const dir = await projects.create('drama mix', []);
    const moment = {
      id: 'silence-hit-s06_red_violet-26745',
      kind: 'silence-hit',
      shotId: 's06_red_violet',
      at: 26.745,
      word: 'Red',
      tension: 0.9,
      from: 26.2,
      to: 26.745,
      status: 'accepted',
    };
    writeProject(dir, 'moments.json', JSON.stringify({ version: 1, moments: [moment] }));
    expect(await mixMoments(dir, {})).toEqual({ silences: [], hits: [] });
    expect(await mixMoments(dir, { revealMoments: 'auto' })).toEqual({
      silences: [{ from: 26.2, to: 26.745 }],
      hits: [26.745],
    });
    const cues = CuesFileSchema.parse({ version: 1, sfx: [{ t: 30, name: 'whoosh' }] });
    expect(withMomentHits(cues, [])).toBe(cues);
    expect(withMomentHits(cues, [26.745]).sfx.map((cue) => [cue.t, cue.name])).toEqual([
      [26.745, 'hit'],
      [30, 'whoosh'],
    ]);
  });
});
