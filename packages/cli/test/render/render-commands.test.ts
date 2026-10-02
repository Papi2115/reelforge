/**
 * Rendering commands on a copy of the fixture project, through the real engine harness
 * (Playwright Chromium + SwiftShader). Paths contain spaces and Polish letters.
 */
import { readFile } from 'node:fs/promises';
import { computeFrameStats, decodePng } from '@reelforge/engine/cli';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { copyFixtureProject, runCli, type TempProject } from '../../src/testing/fixture.js';

let project: TempProject;

beforeAll(async () => {
  project = await copyFixtureProject();
});

afterAll(async () => {
  await project.remove();
});

interface FramesReport {
  readonly frames: readonly { t: number; globalT: number; file: string; blank: string | null }[];
  readonly issues: readonly unknown[];
}

describe('reelforge frames', () => {
  it('renders 5 default frames of a shot at its timeline place, with card QA', async () => {
    const run = await runCli(project.root, 'frames', '--shot', 's02', '--json');
    expect(run.code).toBe(0);
    const report = JSON.parse(run.stdout) as FramesReport;
    expect(report.issues).toEqual([]);
    expect(report.frames.map((frame) => frame.t)).toEqual([0, 1.33, 2.65, 3.97, 5.26]);
    expect(report.frames[0]?.globalT).toBeCloseTo(2.2);
    const image = decodePng(await readFile(report.frames[2]?.file ?? ''));
    expect([image.width, image.height]).toEqual([640, 360]);
    expect(computeFrameStats(image.data).dominantColorShare).toBeLessThan(0.9);
    const text = await runCli(
      project.root,
      'frames',
      '--scene',
      'scenes/s01_title.js',
      '--at',
      '1',
    );
    expect(text.stdout).toContain(
      'shot s01 · scenes/s01_title.js · global 0.00–2.20s (2.20s) · 640x360',
    );
    expect(text.stdout).toMatch(/t=1\.00s\s+.*Zażółć gęślą.*s01_t1\.000\.png/);
    expect(text.stdout).toContain('text cards: ok');
  });

  it('reports overlapping and clipped cards, and lint errors block rendering', async () => {
    await project.edit(
      'scenes/s02_calc.js',
      "{ id: 'memory', at: state.hit.t });",
      "{ id: 'memory', at: 0 });\n  ctx.text.title('OVERLAP HERE', { id: 'big', pos: [0.2, 0.85], scale: 3 });",
    );
    const cards = await runCli(project.root, 'frames', '--shot', 's02', '--at', '2');
    expect(cards.code).toBe(1);
    expect(cards.stdout).toContain('[card-overlap] cards "big" and "memory" overlap');
    expect(cards.stdout).toContain(
      '[card-outside-safe-area] card "big" extends outside the safe area',
    );
    await project.edit('scenes/s01_title.js', 'rng.range(2.5, 4.5)', 'Math.random() * 4');
    const lint = await runCli(project.root, 'frames', '--shot', 's01');
    expect(lint.code).toBe(1);
    expect(lint.stdout).toContain('1 lint error in scenes/s01_title.js (not rendered)');
    expect(lint.stdout).not.toContain('frames (t = local shot time');
  });

  it('reports a scene that throws while rendering as a scene problem, not a reelforge bug', async () => {
    const fresh = await copyFixtureProject();
    try {
      await fresh.edit('scenes/s01_title.js', 'maxWidth: 0.8,', 'maxWidth: 0.8, position: [0, 0],');
      const run = await runCli(fresh.root, 'frames', '--shot', 's01', '--at', '0,1');
      expect(run.code).toBe(1);
      expect(run.stderr).toBe('');
      expect(run.stdout).not.toContain('internal error');
      expect(run.stdout).toMatch(
        /scene failed: rendering t=0\.00s: \[shot s01\] ctx\.text\.title\(\): options: Unrecognized key: "position"/,
      );
    } finally {
      await fresh.remove();
    }
  });
});

describe('reelforge contact-sheet and render-shot', () => {
  it('writes one labelled grid image with a row per shot', async () => {
    const fresh = await copyFixtureProject();
    try {
      const run = await runCli(fresh.root, 'contact-sheet', '--json');
      expect(run.code).toBe(0);
      const report = JSON.parse(run.stdout) as {
        file: string;
        shots: { id: string; times: number[] }[];
      };
      expect(report.shots.map((shot) => [shot.id, shot.times])).toEqual([
        ['s01', [0.37, 1.1, 1.83]],
        ['s02', [0.88, 2.65, 4.42]],
      ]);
      const sheet = decodePng(await readFile(report.file));
      // 3 half-size tiles (320x180) + gaps; title band + 2 rows of (label + tile + gap).
      expect([sheet.width, sheet.height]).toEqual([3 * 320 + 4 * 6, 36 + 2 * (28 + 180 + 6)]);
      const strip = await runCli(fresh.root, 'render-shot', 's01', '--step', '0.5');
      expect(strip.code).toBe(0);
      expect(strip.stdout).toMatch(/strip: .*clip\.png/);
      expect(strip.stdout).toContain('frames: 5 PNGs at 0.00s, 0.50s, 1.00s, 1.50s, 2.00s');
    } finally {
      await fresh.remove();
    }
  });

  it('marks a shot that fails to build with a failure row and exits 1', async () => {
    const fresh = await copyFixtureProject();
    try {
      await fresh.edit('scenes/s02_calc.js', "anchor('61 KB')", "anchor('62 KB')");
      const run = await runCli(fresh.root, 'contact-sheet', '--per-shot', '2');
      expect(run.code).toBe(1);
      expect(run.stdout).toContain(
        '[s02] load: [shot s02] anchor("62 KB", 1) is not spoken in words.json',
      );
    } finally {
      await fresh.remove();
    }
  });
});

describe('reelforge anchors (build-only dry run)', () => {
  it('lists anchors and cues per shot with the landing check', async () => {
    const fresh = await copyFixtureProject();
    try {
      const ok = await runCli(fresh.root, 'anchors');
      expect(ok.code).toBe(0);
      expect(ok.stdout).toContain(
        'ok      "61 KB" spoken 3.70–4.50s (local 1.50s): sfx "hit" lands +0.00s',
      );
      await fresh.edit(
        'scenes/s02_calc.js',
        "sfx.at(hit.t, 'hit');",
        "sfx.at(hit.t + 0.3, 'hit');",
      );
      await fresh.edit('scenes/s01_title.js', "anchor('Doom')", "anchor('Doom', 2)");
      const bad = await runCli(fresh.root, 'anchors');
      expect(bad.code).toBe(1);
      expect(bad.stdout).toContain(
        'MISS    "61 KB" spoken 3.70–4.50s (local 1.50s): nearest sfx "hit" is +0.30s off',
      );
      expect(bad.stdout).toMatch(
        /OUTSIDE "Doom" #2 spoken 6\.50–7\.10s .*spoken outside this shot \(0\.00–2\.20s\)/,
      );
      await fresh.edit('scenes/s02_calc.js', "anchor('61 KB')", "anchor('62 KB')");
      const missing = await runCli(fresh.root, 'anchors', '--shot', 's02');
      expect(missing.stdout).toContain(
        'hint: Anchor "62 KB" was not found in words.json. Closest matches: "61 KB"',
      );
    } finally {
      await fresh.remove();
    }
  });
});
