/**
 * Sound design and export in the built app (`pnpm test:app`; PLAN.md#8.2, #9.1, #9.2) on the CLI
 * fixture project stretched to three 11 s shots, with a synthetic voice-over: default cues without
 * Claude (director SFX + a generated music bed, summarized in the panel), Render mix (−14 LUFS ±1,
 * TP ≤ −1) and its QA report in the panel, a library sound dragged onto the timeline (cue +
 * commit + preview mix of the edit), bus gain and music ducking written to cues.json, then the
 * export dialog: a 1080p30 export (ffprobe, chapters.txt with spoken titles, thumb.png, metadata),
 * cancel + resume, and YouTube suggestions from fake-claude. Never a model call. Screenshots at
 * 1280×720 in out/test-app/sound-export-*.png.
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { cp, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fakeClaudeBinPath, type FakeClaudeScript } from '@reelforge/fake-claude';
import { MAX_TITLE_WORDS, spokenChapterTitle } from '@reelforge/pipeline';
import { wordsFileSchema } from '@reelforge/shared';
import type { ElectronApplication, Page } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { logFile, settingsFile, TEST_CLAUDE_LAUNCHER_ENV } from '../src/main/app-paths.js';
import {
  fixtureProject,
  closeApp,
  launchApp,
  screenshotDir,
  stubFolderPicker,
  waitForProjectPreview,
} from './support/electron-app.js';
import { ffprobe, synthesizeVoiceover } from './support/pipeline-film.js';
import { openStage } from './support/pipeline-rows.js';

const VIDEO_SECONDS = 33;
const SUGGESTION = {
  titles: ['Doom on a calculator', 'Can a 61 KB calculator run Doom?', 'Doom runs everywhere'],
  description: 'Doom runs on almost anything, even a calculator with 61 KB of memory.',
  tags: ['doom', 'calculator', 'retro games'],
};

let app: ElectronApplication;
let page: Page;
let userDataDir: string;
let dir: string;

async function shot(name: string): Promise<void> {
  await page.screenshot({ path: path.join(screenshotDir, `sound-export-1280-${name}.png`) });
}

async function json(file: string): Promise<Record<string, unknown>> {
  return JSON.parse(await readFile(file, 'utf8')) as Record<string, unknown>;
}

async function cues(): Promise<{
  global?: Record<string, number>;
  sfx: { t: number; name?: string; seed?: number }[];
  music?: { file: string; ducking?: { ratio: number } }[];
  moods?: string[];
}> {
  return (await json(path.join(dir, 'cues.json'))) as Awaited<ReturnType<typeof cues>>;
}

function lastCommit(): string {
  return spawnSync('git', ['-C', dir, 'log', '-1', '--format=%s'], {
    encoding: 'utf8',
  }).stdout.trim();
}

async function poll<T>(
  read: () => Promise<T>,
  done: (value: T) => boolean,
  ms = 30_000,
): Promise<T> {
  const until = Date.now() + ms;
  for (;;) {
    const value = await read();
    if (done(value) || Date.now() > until) return value;
    await page.waitForTimeout(200);
  }
}

/** One click on a step opens its panel (or the export dialog). */
async function openRow(label: string): Promise<void> {
  await openStage(page, label);
}

/** The CLI fixture as three 11 s shots (YouTube chapters need ≥ 3 × 10 s), script approved. */
async function createProject(target: string): Promise<void> {
  await cp(fixtureProject, target, { recursive: true });
  const storyboardFile = path.join(target, 'storyboard.json');
  const storyboard = (await json(storyboardFile)) as { shots: Record<string, unknown>[] };
  const [title, calc] = storyboard.shots;
  storyboard.shots = [
    { ...title, t0: 0, t1: 11 },
    { ...calc, t0: 11, t1: 22 },
    { ...calc, id: 's03', t0: 22, t1: VIDEO_SECONDS, intent: 'Why it runs everywhere.' },
  ];
  await writeFile(storyboardFile, JSON.stringify(storyboard, null, 2));
  await mkdir(path.join(target, 'audio'), { recursive: true });
  synthesizeVoiceover(path.join(target, 'audio', 'vo.clean.wav'), VIDEO_SECONDS);
  const stamp = '2026-10-02T10:00:00.000Z';
  await mkdir(path.join(target, '.reelforge'), { recursive: true });
  await writeFile(
    path.join(target, '.reelforge', 'pipeline.json'),
    JSON.stringify({
      version: 1,
      updatedAt: stamp,
      stages: { script: { status: 'done', updatedAt: stamp, approvedAt: stamp } },
      queue: [],
    }),
  );
}

beforeAll(async () => {
  userDataDir = await mkdtemp(path.join(tmpdir(), 'reelforge sound ż-'));
  dir = path.join(userDataDir, 'Dźwięk i eksport');
  await createProject(dir);
  const script: FakeClaudeScript = {
    version: 1,
    rules: [
      {
        scenario: 'ok',
        reply: JSON.stringify(SUGGESTION),
        promptIncludes: 'You write the YouTube upload text',
      },
    ],
    default: { scenario: 'ok', reply: 'ok' },
  };
  const sidecar = path.join(userDataDir, 'fake-claude-script.json');
  await writeFile(sidecar, JSON.stringify(script));
  await mkdir(screenshotDir, { recursive: true });
  app = await launchApp(userDataDir, {
    env: {
      [TEST_CLAUDE_LAUNCHER_ENV]: JSON.stringify({
        command: process.execPath,
        args: [fakeClaudeBinPath],
      }),
      FAKE_CLAUDE_SCRIPT: sidecar,
      REELFORGE_TEST_HOOKS: '1',
    },
  });
  page = await app.firstWindow();
  await page.getByRole('region', { name: 'Start' }).waitFor();
  await app.evaluate(({ BrowserWindow }) => {
    BrowserWindow.getAllWindows()[0]?.setContentSize(1280, 720);
  });
  await page.waitForFunction(() => window.innerWidth === 1280 && window.innerHeight === 720);
  await stubFolderPicker(app, dir);
  await page.getByRole('button', { name: 'Open project…' }).click();
  await waitForProjectPreview(page);
}, 180_000);

afterAll(async () => {
  await closeApp(app);
  await cp(logFile(userDataDir), path.join(screenshotDir, 'sound-export-main.log')).catch(
    () => undefined,
  );
  await rm(userDataDir, { recursive: true, force: true, maxRetries: 5 });
});

describe('sound design', () => {
  it('generates the default cues without Claude and renders the mix within the loudness bar', async () => {
    await openRow('Sound design mixed');
    const panel = page.getByRole('region', { name: 'Sound design' });
    await panel.waitFor();
    // Calm default (PLAN.md#11.2): the library and the ducking start folded away.
    expect(
      await panel.getByRole('button', { name: /^Sound library/ }).getAttribute('aria-expanded'),
    ).toBe('false');
    await shot('sound-default');
    const before = JSON.stringify(await cues());
    await panel.getByRole('button', { name: 'Default cues (no Claude)' }).click();
    const generated = await poll(cues, (value) => (value.music?.length ?? 0) > 0, 60_000);
    expect(JSON.stringify(generated)).not.toBe(before);
    // The director's SFX (seeded variants) and one generated, ducked music bed for the one act.
    expect(generated.sfx.length).toBeGreaterThan(0);
    expect(generated.sfx.every((cue) => typeof cue.seed === 'number')).toBe(true);
    expect(generated.moods).toHaveLength(1);
    const bed = generated.music?.[0]?.file ?? '';
    expect(bed).toMatch(/^audio\/music\/gen-/);
    expect(existsSync(path.join(dir, ...bed.split('/')))).toBe(true);
    const summary = panel.getByTestId('cue-summary');
    await expect
      .poll(() => summary.textContent())
      .toContain(`1 music bed (${generated.moods?.[0] ?? ''})`);
    await panel.getByRole('button', { name: 'Render mix', exact: true }).click();
    await poll(
      () => Promise.resolve(existsSync(path.join(dir, '.reelforge', 'mix-report.json'))),
      Boolean,
      120_000,
    );
    const readout = panel.getByTestId('mix-readout');
    await readout.getByText(/LUFS ✓/).waitFor({ timeout: 30_000 });
    const qaList = panel.getByRole('list', { name: 'Mix report' });
    await qaList.getByText(/Music ducking under speech: [\d.]+ dB$/).waitFor({ timeout: 30_000 });
    const qa = (await json(path.join(dir, '.reelforge', 'mix-report.json'))) as {
      checks: { id: string; status: string }[];
    };
    const status = Object.fromEntries(qa.checks.map((check) => [check.id, check.status]));
    expect(status).toMatchObject({ loudness: 'pass', 'true-peak': 'pass', clipping: 'pass' });
    expect(['pass', 'warn']).toContain(status['ducking']);
    expect(await qaList.getByRole('listitem').count()).toBe(qa.checks.length);
    await shot('sound-report');
    const report = (await json(path.join(dir, '.reelforge', 'reports', 'mix.json'))) as {
      after: { integratedLufs: number; truePeakDbtp: number };
    };
    expect(Math.abs(report.after.integratedLufs + 14)).toBeLessThanOrEqual(1);
    expect(report.after.truePeakDbtp).toBeLessThanOrEqual(-1);
    await expect.poll(() => readout.textContent()).toMatch(/dBTP ✓/);
  }, 240_000);

  it('drags a library sound onto the timeline: cue, commit and a preview mix of the edit', async () => {
    const panel = page.getByRole('region', { name: 'Sound design' });
    const count = (await cues()).sfx.length;
    const canvas = page.locator('canvas.timeline-canvas');
    const box = await canvas.boundingBox();
    const pxPerSecond = Number(await canvas.getAttribute('data-px-per-second'));
    const scrollX = Number(await canvas.getAttribute('data-scroll-x'));
    if (box === null) throw new Error('no timeline');
    await panel.getByRole('button', { name: /^Sound library/ }).click();
    // Exact name: the built-in library also has shape-pop, cap-pop, paper-pop…
    const item = panel.getByRole('listitem', { name: 'Drag pop onto the timeline', exact: true });
    await item.dragTo(canvas, { targetPosition: { x: 15 * pxPerSecond - scrollX, y: 83 } });
    const added = await poll(cues, (value) => value.sfx.length > count);
    const pop = added.sfx.find((cue) => cue.name === 'pop' && Math.abs(cue.t - 15) < 0.3);
    expect(pop, JSON.stringify(added.sfx)).toBeDefined();
    expect(
      await poll(
        () => Promise.resolve(lastCommit()),
        (subject) => subject === 'Add sfx cue pop',
      ),
    ).toBe('Add sfx cue pop');
    // The edit is audible in the preview within a few seconds (mix.wav + the re-rendered window).
    await panel.getByText(/^Preview mix [\d.]+–[\d.]+ s updated/).waitFor({ timeout: 20_000 });
    const previews = (await readdir(path.join(dir, '.reelforge', 'cache', 'preview'))).filter(
      (name) => name.startsWith('mix-preview-'),
    );
    expect(previews.length).toBeGreaterThan(0);
    await shot('sound-panel');
  }, 120_000);

  it('writes a bus gain and the music ducking into cues.json', async () => {
    const panel = page.getByRole('region', { name: 'Sound design' });
    const slider = panel.getByRole('slider', { name: 'Sound effects level (dB)' });
    await slider.focus();
    for (let step = 0; step < 12; step += 1) await slider.press('ArrowLeft');
    const gained = await poll(cues, (value) => value.global?.['sfxGainDb'] === -6);
    expect(gained.global?.['sfxGainDb']).toBe(-6);
    await expect.poll(lastCommit).toBe('Sound: SFX bus -6 dB');

    const music = path.join(userDataDir, 'bed music.wav');
    synthesizeVoiceover(music, 12);
    await stubFolderPicker(app, music);
    await panel.getByRole('tab', { name: /^Music/ }).click();
    const beds = (await cues()).music?.length ?? 0;
    await panel.getByRole('button', { name: 'Import Music files…' }).click();
    await panel.getByRole('button', { name: 'Add bed music.wav at the playhead' }).click();
    await poll(cues, (value) => (value.music?.length ?? 0) === beds + 1);
    await panel.getByRole('button', { name: /^Music ducking/ }).click();
    const ducking = panel.getByRole('group', { name: 'Music ducking amount' });
    await expect
      .poll(() => ducking.getByRole('button', { name: 'Medium' }).getAttribute('aria-pressed'))
      .toBe('true');
    await ducking.getByRole('button', { name: 'Strong' }).click();
    const ducked = await poll(cues, (value) => value.music?.[0]?.ducking?.ratio === 14);
    expect(ducked.music?.[0]?.ducking?.ratio).toBe(14);
    await shot('sound-music');
    await panel.getByRole('button', { name: 'Render mix', exact: true }).click();
    await panel
      .getByText('Cues changed since this render.')
      .waitFor({ state: 'detached', timeout: 120_000 });
  }, 240_000);
});

describe('export dialog', () => {
  function dialog() {
    return page.getByRole('dialog', { name: 'Export video' });
  }

  function job(name: string) {
    return dialog().getByRole('listitem', { name: `Export ${name}` });
  }

  it('exports 1080p30 with chapters, a chosen thumbnail frame and the YouTube template', async () => {
    await openRow('Video exported');
    await dialog().waitFor();
    await dialog().getByText('1080p (Full HD) · 1920×1080 · ×3').waitFor();
    await dialog().getByRole('combobox', { name: 'Encoder' }).selectOption('cpu');
    await dialog().getByRole('button', { name: 'Test encoder' }).click();
    await dialog()
      .getByText(/^libx264 works \(CPU\)/)
      .waitFor({ timeout: 30_000 });
    await dialog().getByRole('radio', { name: 'Draft (fast)' }).check();
    await dialog()
      .getByRole('button', { name: /^Use playhead frame/ })
      .click();
    await shot('export-dialog');
    await dialog().getByRole('button', { name: 'Add to queue' }).click();
    const first = job('Doom on a calculator.mp4');
    await first.getByTestId('export-report').waitFor({ timeout: 300_000 });
    await shot('export-done');

    const output = path.join(dir, 'out', 'Doom on a calculator.mp4');
    const info = ffprobe(output);
    expect(info.durationS).toBeGreaterThan(VIDEO_SECONDS - 0.5);
    expect(info.durationS).toBeLessThan(VIDEO_SECONDS + 0.5);
    expect(info.streams.find((stream) => stream.codec_type === 'video')).toMatchObject({
      width: 1920,
      height: 1080,
    });
    expect(info.streams.some((stream) => stream.codec_type === 'audio')).toBe(true);
    // Chapter titles: the key phrase spoken at the chapter's start (the fixture's timing/words.json),
    // else the scene's title. The fixture's words end at 7.1 s, so 0:11 and 0:22 keep theirs.
    const chapters = await readFile(path.join(dir, 'out', 'chapters.txt'), 'utf8');
    const lines = chapters
      .trimEnd()
      .split('\n')
      .map((line) => /^(\d+:\d\d) (.+)$/.exec(line));
    expect(lines.map((match) => match?.[1])).toEqual(['0:00', '0:11', '0:22']);
    for (const match of lines) {
      const titleWords = (match?.[2] ?? '').split(' ').filter((word) => word !== '');
      expect(titleWords.length).toBeGreaterThan(0);
      expect(titleWords.length).toBeLessThanOrEqual(MAX_TITLE_WORDS);
    }
    const timed = wordsFileSchema.parse(await json(path.join(dir, 'timing', 'words.json'))).words;
    expect(lines[0]?.[2]).toBe(spokenChapterTitle(timed, 0, 11, MAX_TITLE_WORDS));
    expect(chapters).toBe(
      '0:00 Doom Runs\n0:11 Calculator with 61 KB\n0:22 Calculator with 61 KB\n',
    );
    const thumb = await readFile(path.join(dir, 'out', 'thumb.png'));
    expect(thumb.readUInt32BE(16)).toBe(1280);
    expect(thumb.readUInt32BE(20)).toBe(720);
    const meta = await json(path.join(dir, 'out', 'metadata.json'));
    expect(meta).toMatchObject({ version: 1, source: 'template' });
    expect(String(meta['description'])).toContain('0:11 Calculator with 61 KB');
    expect(existsSync(path.join(dir, 'out', 'youtube.md'))).toBe(true);
    await expect.poll(() => first.textContent()).toMatch(/Re-rendered 3 of 3 shots/);
  }, 420_000);

  it('cancels an export and resumes it with the finished shots from the cache', async () => {
    await dialog().getByRole('radio', { name: 'High' }).check();
    await dialog().getByRole('textbox', { name: 'File name' }).fill('Doom high');
    await dialog().getByRole('button', { name: 'Add to queue' }).click();
    const second = job('Doom high.mp4');
    await second.locator('.export-shots li').first().waitFor({ timeout: 120_000 });
    await second.getByRole('button', { name: 'Cancel' }).click();
    await second.getByText('Cancelled', { exact: true }).waitFor({ timeout: 60_000 });
    await second.getByRole('button', { name: 'Resume' }).click();
    await second.getByTestId('export-report').waitFor({ timeout: 300_000 });
    const info = ffprobe(path.join(dir, 'out', 'Doom high.mp4'));
    expect(info.durationS).toBeGreaterThan(VIDEO_SECONDS - 0.5);
    await expect.poll(() => second.textContent()).toMatch(/Re-rendered \d of 3 shots/);
    const settings = (await json(settingsFile(userDataDir))) as {
      export: { quality: string };
      performance: { encoder: string };
    };
    expect(settings.export.quality).toBe('high');
    expect(settings.performance.encoder).toBe('cpu');
  }, 420_000);

  it('suggests title, description and tags with Claude (fake) and copies them', async () => {
    const youtube = dialog().getByRole('region', { name: 'YouTube' });
    await youtube.getByRole('button', { name: 'Suggest with Claude' }).click();
    await youtube.getByText('Can a 61 KB calculator run Doom?').waitFor({ timeout: 60_000 });
    await youtube.getByText('by Claude').waitFor();
    const meta = await json(path.join(dir, 'out', 'metadata.json'));
    expect(meta).toMatchObject({ source: 'claude', titles: SUGGESTION.titles });
    await youtube.getByRole('button', { name: 'Copy title 2' }).click();
    await youtube.getByRole('button', { name: 'Copy title 2' }).getByText('Copied ✓').waitFor();
    // Polled: another program may hold the Windows clipboard open for a moment while we read.
    await expect
      .poll(() => app.evaluate(({ clipboard }) => clipboard.readText()), { timeout: 5_000 })
      .toBe('Can a 61 KB calculator run Doom?');
    await shot('export-youtube');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      1280,
    );
  }, 120_000);
});
