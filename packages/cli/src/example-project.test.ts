/**
 * Integrity of the bundled example project (templates/examples/doom-on-a-calculator, PLAN.md#10.3):
 * every file validates, every scene passes the determinism lint, every anchor a scene asks for
 * is spoken inside its shot, and the voice-over stays small. Rendering is covered by
 * test/render/example-project.test.ts.
 */
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { AnchorIndex, CuesFileSchema, WordsFileSchema } from '@reelforge/pipeline';
import { storyboardFileSchema } from '@reelforge/shared';
import { describe, expect, it } from 'vitest';
import { runCli } from './testing/fixture.js';

const EXAMPLE = path.resolve(
  import.meta.dirname,
  '..',
  '..',
  '..',
  'templates',
  'examples',
  'doom-on-a-calculator',
);
const MAX_VOICEOVER_BYTES = 1.5 * 1024 * 1024;
/** `anchor('phrase')` / `anchor("phrase", 2)` calls (ctx.anchor, not kit `obj.anchor(name)`). */
const ANCHOR_CALL = /(?<![.\w])anchor\(\s*(['"])(.+?)\1\s*(?:,\s*(\d+)\s*)?\)/g;

async function readJson(file: string): Promise<unknown> {
  return JSON.parse(await readFile(path.join(EXAMPLE, file), 'utf8')) as unknown;
}

interface WavInfo {
  readonly channels: number;
  readonly sampleRate: number;
  readonly bitsPerSample: number;
  readonly durationS: number;
}

function wavInfo(bytes: Buffer): WavInfo {
  expect(bytes.toString('ascii', 0, 4)).toBe('RIFF');
  expect(bytes.toString('ascii', 8, 12)).toBe('WAVE');
  let offset = 12;
  let format: Omit<WavInfo, 'durationS'> | undefined;
  while (offset + 8 <= bytes.length) {
    const id = bytes.toString('ascii', offset, offset + 4);
    const size = bytes.readUInt32LE(offset + 4);
    if (id === 'fmt ') {
      format = {
        channels: bytes.readUInt16LE(offset + 10),
        sampleRate: bytes.readUInt32LE(offset + 12),
        bitsPerSample: bytes.readUInt16LE(offset + 22),
      };
    }
    if (id === 'data' && format !== undefined) {
      const frameBytes = (format.channels * format.bitsPerSample) / 8;
      return { ...format, durationS: size / frameBytes / format.sampleRate };
    }
    offset += 8 + size + (size % 2);
  }
  throw new Error('no fmt/data chunk in the WAV file');
}

describe('example project: doom-on-a-calculator', () => {
  it('validates (project, brief, storyboard, words, cues) without warnings', async () => {
    const run = await runCli(EXAMPLE, 'validate');
    expect(run.stderr).toBe('');
    expect(run.stdout).toContain('0 errors, 0 warnings');
    expect(run.code).toBe(0);
  });

  it('passes the scene lint for every scene file', async () => {
    const run = await runCli(EXAMPLE, 'lint');
    expect(run.stdout).toContain('7 files: 0 errors, 0 warnings');
    expect(run.code).toBe(0);
  });

  it('has contiguous shots with varied treatments covering the voice-over', async () => {
    const storyboard = storyboardFileSchema.parse(await readJson('storyboard.json'));
    const words = WordsFileSchema.parse(await readJson('timing/words.json'));
    const audio = wavInfo(await readFile(path.join(EXAMPLE, 'audio', 'vo.original.wav')));
    const shots = storyboard.shots;
    expect(shots.length).toBeGreaterThanOrEqual(6);
    expect(shots.length).toBeLessThanOrEqual(8);
    expect(shots[0]?.t0).toBe(0);
    shots.forEach((shot, index) => {
      if (index > 0) expect(shot.t0).toBe(shots[index - 1]?.t1);
      if (index > 1) {
        const run = [shots[index - 2], shots[index - 1], shot].map((item) => item?.treatment);
        expect(new Set(run).size).toBeGreaterThan(1);
      }
    });
    expect(new Set(shots.map((shot) => shot.treatment)).size).toBeGreaterThanOrEqual(5);
    const lastWord = words.words.at(-1);
    expect(lastWord?.tEnd).toBeLessThan(shots.at(-1)?.t1 ?? 0);
    expect(Math.abs((shots.at(-1)?.t1 ?? 0) - audio.durationS)).toBeLessThan(0.1);
    expect(words.stats.coverage).toBe(1);
  });

  it('keeps the voice-over small (mono 16-bit, at most 1.5 MB)', async () => {
    const file = path.join(EXAMPLE, 'audio', 'vo.original.wav');
    const audio = wavInfo(await readFile(file));
    expect((await stat(file)).size).toBeLessThanOrEqual(MAX_VOICEOVER_BYTES);
    expect(audio).toMatchObject({ channels: 1, bitsPerSample: 16 });
    expect(audio.sampleRate).toBeGreaterThanOrEqual(16_000);
    expect(audio.durationS).toBeGreaterThan(25);
    expect(audio.durationS).toBeLessThan(35);
  });

  it('resolves every anchor a scene asks for inside its own shot', async () => {
    const storyboard = storyboardFileSchema.parse(await readJson('storyboard.json'));
    const words = WordsFileSchema.parse(await readJson('timing/words.json'));
    const index = new AnchorIndex(words.words, { lang: words.lang });
    const sceneFiles = (await readdir(path.join(EXAMPLE, 'scenes'))).filter((name) =>
      name.endsWith('.js'),
    );
    expect(sceneFiles).toHaveLength(storyboard.shots.length);
    let anchors = 0;
    for (const shot of storyboard.shots) {
      const source = await readFile(path.join(EXAMPLE, ...shot.scene.split('/')), 'utf8');
      for (const match of source.matchAll(ANCHOR_CALL)) {
        const phrase = match[2] ?? '';
        const nth = match[3] === undefined ? 1 : Number(match[3]);
        const resolved = index.resolve(phrase, nth);
        expect(resolved.ok, `${shot.id}: anchor("${phrase}", ${String(nth)})`).toBe(true);
        if (!resolved.ok) continue;
        expect(
          resolved.value.t,
          `${shot.id}: "${phrase}" starts in the shot`,
        ).toBeGreaterThanOrEqual(shot.t0);
        expect(resolved.value.t, `${shot.id}: "${phrase}" starts in the shot`).toBeLessThan(
          shot.t1,
        );
        anchors += 1;
      }
    }
    expect(anchors).toBeGreaterThanOrEqual(storyboard.shots.length);
  });

  it('schedules every sound cue inside the video', async () => {
    const storyboard = storyboardFileSchema.parse(await readJson('storyboard.json'));
    const cues = CuesFileSchema.parse(await readJson('cues.json'));
    const end = storyboard.shots.at(-1)?.t1 ?? 0;
    expect(cues.sfx.length).toBeGreaterThan(0);
    for (const cue of cues.sfx) expect(cue.t).toBeLessThan(end);
    for (const bed of cues.ambience) expect(bed.to).toBeLessThanOrEqual(end);
  });
});
