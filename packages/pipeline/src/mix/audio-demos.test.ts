/**
 * Audition files for listening tests (not a check): one WAV per SFX category (every recipe x
 * variant, separated by silence), one per recipe, plus a spectrogram PNG of each (ffmpeg
 * showspectrumpic). Written to `out/audio-demos/` at the repo root (gitignored). Runs only with
 * REELFORGE_AUDIO_DEMOS=1: `pnpm --filter @reelforge/pipeline audio:demos`.
 */
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { FfmpegManager } from '../ffmpeg/manager.js';
import type { StereoClip } from './clip.js';
import { MIX_SAMPLE_RATE, secondsToFrames } from './dsp.js';
import { MUSIC_MOODS, generateMusic } from './music/music.js';
import { SFX_CATEGORY, SFX_RECIPES, SFX_VARIANTS, synthesizeSfx } from './sfx.js';
import { writeWavAtomic } from './wav.js';

const enabled = process.env['REELFORGE_AUDIO_DEMOS'] === '1';
const outRoot = path.resolve(import.meta.dirname, '..', '..', '..', '..', 'out', 'audio-demos');

/** Concatenates clips with `gapS` of silence after each. */
function sequence(clips: readonly StereoClip[], gapS: number): StereoClip {
  const gap = secondsToFrames(gapS);
  const total = clips.reduce((sum, clip) => sum + clip.left.length + gap, 0);
  const out = { left: new Float32Array(total), right: new Float32Array(total) };
  let at = 0;
  for (const clip of clips) {
    out.left.set(clip.left, at);
    out.right.set(clip.right, at);
    at += clip.left.length + gap;
  }
  return out;
}

async function writeWithSpectrogram(
  ffmpeg: FfmpegManager,
  file: string,
  clip: StereoClip,
  size: string,
): Promise<void> {
  const written = await writeWavAtomic(file, [clip.left, clip.right], MIX_SAMPLE_RATE, 'pcm16');
  if (!written.ok) throw new Error(written.error.message);
  const png = file.replace(/\.wav$/, '.png');
  const filter = `showspectrumpic=s=${size}:legend=1:fscale=log:drange=100`;
  const run = await ffmpeg.run(['-y', '-i', file, '-lavfi', filter, '-frames:v', '1', png]);
  if (!run.ok) throw new Error(run.error.message);
}

describe.runIf(enabled)('audio demos', () => {
  it('writes SFX auditions and spectrograms', async () => {
    const created = await FfmpegManager.create();
    if (!created.ok) throw new Error(created.error.message);
    const ffmpeg = created.value;
    const dir = path.join(outRoot, 'sfx');
    await mkdir(path.join(dir, 'recipes'), { recursive: true });
    const byCategory = new Map<string, StereoClip[]>();
    for (const recipe of SFX_RECIPES) {
      const clips = SFX_VARIANTS[recipe].map((_, seed) => synthesizeSfx(recipe, { seed }));
      const recipeClip = sequence(clips, 0.4);
      await writeWithSpectrogram(
        ffmpeg,
        path.join(dir, 'recipes', `${recipe}.wav`),
        recipeClip,
        '1200x500',
      );
      const category = SFX_CATEGORY[recipe];
      byCategory.set(category, [...(byCategory.get(category) ?? []), recipeClip]);
    }
    for (const [category, clips] of byCategory) {
      await writeWithSpectrogram(
        ffmpeg,
        path.join(dir, `${category}.wav`),
        sequence(clips, 0.8),
        '2400x700',
      );
    }
    expect(byCategory.size).toBe(5);
  }, 300_000);

  it('writes 60 s music demos per mood and spectrograms', async () => {
    const created = await FfmpegManager.create();
    if (!created.ok) throw new Error(created.error.message);
    const dir = path.join(outRoot, 'music');
    await mkdir(dir, { recursive: true });
    for (const mood of MUSIC_MOODS) {
      const music = generateMusic({ mood, seed: 1, durationS: 60 });
      await writeWithSpectrogram(
        created.value,
        path.join(dir, `${mood}.wav`),
        music.clip,
        '2400x800',
      );
    }
  }, 600_000);
});
