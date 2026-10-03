/**
 * Listening artefact (not a check): the bundled example film through the real sound stages —
 * scene sfx + anchors from `reelforge anchors --json` (written as the sync report the scene stage
 * would leave), default cues (director + generated music), mix with stems — into
 * `out/audio-demos/`: example-mix.wav (+ spectrogram PNG), example-music.wav (the ducked bed
 * alone), example-mix-cues.json and example-mix-report.json. Runs on a temp copy (the committed
 * example is never touched) and only with REELFORGE_AUDIO_DEMOS=1:
 * `pnpm --filter @reelforge/stages sound:demo`.
 */
import { spawnSync } from 'node:child_process';
import { copyFileSync, cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { FfmpegManager } from '@reelforge/pipeline';
import { SYNC_REPORT_VERSION, type ShotSync, type SyncReport } from '@reelforge/shared';
import { describe, expect, it } from 'vitest';
import { createPipelineAudioTools } from './audio-tools.js';
import { StageRunner } from './runner.js';
import { DEFAULT_STAGE_SETTINGS } from './settings.js';
import { EXAMPLE_DIR } from './testing/example-film.js';
import { REPO_ROOT } from './testing/project.js';

const enabled = process.env['REELFORGE_AUDIO_DEMOS'] === '1';
const outDir = path.join(REPO_ROOT, 'out', 'audio-demos');
const cli = path.join(REPO_ROOT, 'packages', 'cli', 'dist', 'reelforge.mjs');

interface AnchorsJson {
  readonly shots: readonly {
    readonly id: string;
    readonly t0: number;
    readonly t1: number;
    readonly anchors: readonly { readonly phrase: string; readonly t: number }[];
    readonly cues: readonly { readonly name: string; readonly t: number }[];
  }[];
}

/** What the scenes declare, as the sync report the scene stage writes. */
function syncReportFromCli(projectDir: string): SyncReport {
  const run = spawnSync(process.execPath, [cli, 'anchors', '--json'], {
    cwd: projectDir,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  if (run.status !== 0) throw new Error(`reelforge anchors failed: ${run.stderr}`);
  const parsed = JSON.parse(run.stdout) as AnchorsJson;
  const event = (kind: 'anchor' | 'sfx', label: string, t: number) => ({
    kind,
    label,
    t,
    spokenT: t,
    phrase: kind === 'anchor' ? label : null,
    deltaMs: 0,
    verdict: 'ok' as const,
  });
  const shots: ShotSync[] = parsed.shots.map((shot) => ({
    shotId: shot.id,
    t0: shot.t0,
    t1: shot.t1,
    events: [
      ...shot.anchors.map((anchor) => event('anchor', anchor.phrase, anchor.t)),
      ...shot.cues.map((cue) => event('sfx', cue.name, cue.t)),
    ],
    problems: 0,
    maxDeltaMs: 0,
  }));
  const events = shots.reduce((sum, shot) => sum + shot.events.length, 0);
  return {
    version: SYNC_REPORT_VERSION,
    createdAt: new Date(0).toISOString(),
    toleranceMs: 150,
    shots,
    summary: { shots: shots.length, events, ok: events, problems: 0, failedShots: 0 },
  };
}

describe.runIf(enabled)('sound demo', () => {
  it('renders the example film through the sound stages', { timeout: 600_000 }, async () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'reelforge sound demo '));
    try {
      const dir = path.join(root, 'doom');
      cpSync(EXAMPLE_DIR, dir, { recursive: true });
      copyFileSync(
        path.join(dir, 'audio', 'vo.original.wav'),
        path.join(dir, 'audio', 'vo.clean.wav'),
      );
      mkdirSync(path.join(dir, '.reelforge'), { recursive: true });
      writeFileSync(
        path.join(dir, '.reelforge', 'sync-report.json'),
        JSON.stringify(syncReportFromCli(dir), null, 2),
      );
      const runner = new StageRunner({
        projectDir: dir,
        audio: createPipelineAudioTools(),
        settings: { ...DEFAULT_STAGE_SETTINGS, economy: true },
        autocommit: false,
      });
      const designed = await runner.run({ stage: 'sound-cues' });
      expect(designed.ok, JSON.stringify(designed)).toBe(true);
      const mixed = await runner.run({ stage: 'mix', stems: true });
      expect(mixed.ok, JSON.stringify(mixed)).toBe(true);

      mkdirSync(outDir, { recursive: true });
      const out = (name: string): string => path.join(outDir, name);
      copyFileSync(path.join(dir, 'audio', 'mix.wav'), out('example-mix.wav'));
      copyFileSync(path.join(dir, 'cues.json'), out('example-mix-cues.json'));
      copyFileSync(path.join(dir, '.reelforge', 'mix-report.json'), out('example-mix-report.json'));
      const ffmpeg = await FfmpegManager.create();
      if (!ffmpeg.ok) throw new Error(ffmpeg.error.message);
      const music = await ffmpeg.value.run([
        '-y',
        '-i',
        path.join(dir, 'out', 'stems', 'music.wav'),
        '-c:a',
        'pcm_s16le',
        out('example-music.wav'),
      ]);
      expect(music.ok).toBe(true);
      const spectrogram = await ffmpeg.value.run([
        '-y',
        '-i',
        out('example-mix.wav'),
        '-lavfi',
        'showspectrumpic=s=1600x600:legend=1:fscale=log:drange=100',
        '-frames:v',
        '1',
        out('example-mix.png'),
      ]);
      expect(spectrogram.ok).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true, maxRetries: 5 });
    }
  });
});
