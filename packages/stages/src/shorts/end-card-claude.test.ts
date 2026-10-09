/**
 * A short's end card (PLAN.md#13.18) never gets Claude work, on fake-claude with the scripted
 * frame renderer: the whole-video review modes leave it out (a triage or a plan naming it gets no
 * fix turn), the final review checks it by code only (no critic question, no fix turn), variants
 * of it are refused, and the QA loop itself never runs a critic or fix turn on it.
 */
import { LimitGuard } from '@reelforge/claude-bridge';
import type { FakeClaudeScript } from '@reelforge/fake-claude';
import { autocommit } from '@reelforge/project';
import {
  endCardShot,
  finalReviewSchema,
  scenesReportSchema,
  storyboardFileSchema,
  type ProjectFile,
  type StoryboardShot,
} from '@reelforge/shared';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { StageRunner } from '../runner.js';
import { DEFAULT_SCENE_SETTINGS, DEFAULT_STAGE_SETTINGS } from '../settings.js';
import { FakeClaudeHarness, writes } from '../testing/fake-claude.js';
import {
  CRITIC_OK,
  filmShots,
  sceneSource,
  writeFilm,
  type SceneVariant,
} from '../testing/film.js';
import { TestProjects, readProject, writeProject } from '../testing/project.js';
import { ScriptedFrameRenderer } from '../testing/scripted-renderer.js';
import { endCardSceneSource } from './end-card-scene.js';

const projects = new TestProjects();
const harnesses: FakeClaudeHarness[] = [];
afterEach(async () => {
  await Promise.all(harnesses.splice(0).map((harness) => harness.dispose()));
});
afterAll(() => {
  projects.dispose();
});

const END_CARD_TEXT = 'Full video on YT: Voxplain';
/** The end card scene with an overlapping-cards finding: a fix turn would be asked for it. */
const BROKEN_CARD = `// render:overlap\n${endCardSceneSource({
  shot: { id: 'end_card', treatment: 'title-card' },
  text: END_CARD_TEXT,
  format: 'portrait',
})}`;

/** A plain end card scene without the kit's card (a film's kit has none): clean or overlapping. */
function plainCard(variant: 'ok' | 'overlap'): string {
  return `${variant === 'overlap' ? '// render:overlap\n' : ''}export const meta = { id: 'end_card', title: 'End card', treatment: 'title-card' };

export function build(ctx) {
  const { three, scene, palette } = ctx;
  scene.background = new three.Color(palette.sky);
  scene.add(new three.HemisphereLight(palette.fillLight, palette.shadow, 2.2));
  const cube = new three.Mesh(
    new three.BoxGeometry(1.2, 1.2, 1.2),
    new three.MeshLambertMaterial({ color: palette.accent1, flatShading: true }),
  );
  scene.add(cube);
  return { cube };
}

export function update(t, state, ctx) {
  ctx.camera.set({ position: [0, 2, 8], target: [0, 0, 0] });
  state.cube.rotation.y = 0.4 * t;
  ctx.text.title('WATCH THE FULL VIDEO', { id: 'title', at: 0, pos: [0.5, 0.3], maxWidth: 0.8 });
}
`;
}

interface Setup {
  readonly variants: readonly SceneVariant[];
  readonly script: FakeClaudeScript;
  /** A film (no `kind: 'short'`) whose storyboard still ends with an end card. */
  readonly film?: boolean;
}

async function setup(name: string, options: Setup) {
  const shots = filmShots(options.variants.length);
  const dir = await projects.create(name);
  writeFilm(dir, shots);
  shots.forEach((shot, index) => {
    writeProject(dir, shot.scene, sceneSource(shot, options.variants[index]));
  });
  const storyboard = storyboardFileSchema.parse(JSON.parse(readProject(dir, 'storyboard.json')));
  const card: StoryboardShot = endCardShot(storyboard.shots.at(-1)?.t1 ?? 0, END_CARD_TEXT);
  const withCard = { ...storyboard, shots: [...storyboard.shots, card] };
  writeProject(dir, 'storyboard.json', JSON.stringify(withCard, null, 2));
  writeProject(dir, card.scene, BROKEN_CARD);
  if (options.film !== true) {
    const project = JSON.parse(readProject(dir, 'project.json')) as ProjectFile;
    const short: ProjectFile = {
      ...project,
      format: 'portrait',
      kind: 'short',
      short: { lengthS: 30, captions: false, endCardText: END_CARD_TEXT },
    };
    writeProject(dir, 'project.json', JSON.stringify(short, null, 2));
  }
  expect((await autocommit(dir, 'Scenes', { kind: 'manual', git: projects.git })).ok).toBe(true);
  const harness = new FakeClaudeHarness(options.script, {
    guard: new LimitGuard({ maxConcurrency: 1 }),
  });
  harnesses.push(harness);
  const runner = new StageRunner({
    projectDir: dir,
    claude: harness.runner,
    guard: harness.guard,
    git: projects.git,
    scenes: { frames: new ScriptedFrameRenderer() },
    settings: { ...DEFAULT_STAGE_SETTINGS, scenes: { ...DEFAULT_SCENE_SETTINGS, concurrency: 1 } },
  });
  return { dir, shots, card, harness, runner };
}

const NAMES_CARD = (reason: string) => JSON.stringify({ suspects: [{ shot: 'end_card', reason }] });

describe('the end card of a short gets no Claude work', { timeout: 120_000 }, () => {
  it('fix what looks wrong: left out of the triage, a plan naming it gets no fix turn', async () => {
    const [first] = filmShots(1);
    if (first === undefined) throw new Error('no s01');
    const { dir, harness, runner } = await setup('card review', {
      variants: ['overlap', 'ok'],
      script: {
        version: 1,
        rules: [
          {
            scenario: 'tools-write',
            reply: NAMES_CARD('the end card looks plain'),
            promptIncludes: '.reelforge/frames/qa/review/sheet-1.png',
          },
          {
            scenario: 'tools-write',
            reply: JSON.stringify({
              fixes: [
                { shot: 'end_card', change: 'Redesign the end card (CHANGE-CARD).' },
                { shot: 's01', change: 'Move the clashing card (CHANGE-S01).' },
              ],
            }),
            promptIncludes: 'You plan fixes',
          },
          {
            ...writes({ 'scenes/s01.js': sceneSource(first) }, 'Done.'),
            promptIncludes: 'CHANGE-S01',
          },
        ],
        default: { scenario: 'tools-write', reply: CRITIC_OK },
      },
    });
    const result = await runner.run({ stage: 'scenes', action: 'fix-what-looks-wrong' });
    expect(result.ok && result.value.metrics).toMatchObject({ flagged: 1, fixed: 1 });
    const triage = harness.specs.find((spec) => spec.prompt.includes('review/sheet-1.png'));
    expect(triage?.prompt).not.toContain('end_card');
    const fixes = harness.specs.filter((spec) => spec.stage === 'scene-fix');
    expect(fixes).toHaveLength(1);
    expect(fixes[0]?.prompt).toContain('CHANGE-S01');
    expect(harness.specs.some((spec) => spec.prompt.includes('You plan fixes'))).toBe(true);
    expect(fixes.some((spec) => spec.prompt.includes('end_card'))).toBe(false);
    expect(readProject(dir, 'scenes/end_card.js')).toBe(BROKEN_CARD);
  });

  it('phone legibility does not check or fix it', async () => {
    const { dir, harness, runner } = await setup('card legibility', {
      variants: ['ok', 'ok'],
      script: { version: 1, default: { scenario: 'tools-write', reply: CRITIC_OK } },
    });
    const result = await runner.run({ stage: 'scenes', action: 'phone-legibility' });
    expect(result.ok && result.value.message).toBe(
      'Review (phone-legibility): 0 shots flagged, 0 fixed',
    );
    expect(harness.specs).toEqual([]);
    expect(readProject(dir, 'scenes/end_card.js')).toBe(BROKEN_CARD);
  });

  it('final review: checked by code and reported, no critic question and no fix turn', async () => {
    const { dir, harness, runner } = await setup('card final', {
      variants: ['ok', 'ok'],
      script: {
        version: 1,
        rules: [
          {
            scenario: 'tools-write',
            reply: NAMES_CARD('the end card looks plain'),
            promptIncludes: '.reelforge/frames/qa/final/sheet-1.png',
          },
        ],
        default: { scenario: 'tools-write', reply: CRITIC_OK },
      },
    });
    const result = await runner.run({ stage: 'scenes', action: 'final-review' });
    expect(result.ok && result.value.metrics).toMatchObject({ fixed: 0 });
    expect(harness.specs.map((spec) => spec.stage)).toEqual(['critic']);
    expect(harness.specs[0]?.prompt).not.toContain('end_card');
    const review = finalReviewSchema.parse(
      JSON.parse(readProject(dir, '.reelforge/final-review.json')),
    );
    const card = review.shots.find((entry) => entry.shotId === 'end_card');
    expect(card).toMatchObject({ autoFixed: false, status: 'warning' });
    expect(card?.findings.map((entry) => entry.message).join(' ')).toContain('overlap');
    expect(card?.findings.map((entry) => entry.message).join(' ')).not.toContain(
      'the end card looks plain',
    );
    expect(readProject(dir, 'scenes/end_card.js')).toBe(BROKEN_CARD);
  });

  it('refuses variants of it without a Claude turn', async () => {
    const { harness, runner } = await setup('card variants', {
      variants: ['ok'],
      script: { version: 1, default: { scenario: 'tools-write', reply: CRITIC_OK } },
    });
    const result = await runner.run({
      stage: 'scenes',
      action: 'variants',
      shots: ['end_card'],
      variants: { kind: 'generate', count: 2 },
    });
    expect(!result.ok && result.error).toMatchObject({ kind: 'invalid-input' });
    expect(!result.ok && result.error.message).toContain('end card');
    expect(harness.specs).toEqual([]);
  });

  it.each([
    ['a clean scene: no critic turn', 'ok', 'ok'],
    ['a scene with a code error: no fix turn', 'overlap', 'warning'],
  ] as const)('the QA loop of an end card, whoever built it: %s', async (_, variant, status) => {
    // A film whose storyboard ends with an end card: its scene is built by a Claude turn here (the
    // app writes it only in a short), so only the QA loop's own guard keeps the rest away.
    const { dir, card, harness, runner } = await setup(`card qa loop ${variant}`, {
      variants: ['ok'],
      film: true,
      script: {
        version: 1,
        rules: [
          {
            ...writes({ 'scenes/end_card.js': plainCard(variant) }, 'Built it.'),
            promptIncludes: 'Write `scenes/end_card.js`',
          },
        ],
        default: { scenario: 'tools-write', reply: CRITIC_OK },
      },
    });
    const result = await runner.run({ stage: 'scenes', shots: [card.id] });
    expect(result.ok).toBe(true);
    expect(harness.specs.map((spec) => spec.stage)).toEqual(['scene-build']);
    const report = scenesReportSchema.parse(
      JSON.parse(readProject(dir, '.reelforge/scenes-report.json')),
    );
    const entry = report.shots.find((shot) => shot.shotId === 'end_card');
    expect(entry).toMatchObject({ status, fixIterations: 0, critic: [] });
  });
});
