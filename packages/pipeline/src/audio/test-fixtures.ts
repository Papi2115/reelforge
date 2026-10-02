/**
 * Test-only: synthesises small deterministic "voice-over" WAVs with ffmpeg lavfi (harmonic tone
 * bursts with a syllable-rate envelope + seeded noise + hum). Nothing is committed to the repo.
 */
import type { FfmpegError } from '../ffmpeg/errors.js';
import type { FfmpegManager } from '../ffmpeg/manager.js';
import type { Result } from '../result.js';

export type FixtureKind = 'quiet-clean' | 'uneven-hum' | 'noisy-stereo' | 'long-pause';

interface FixtureSpec {
  readonly durationS: number;
  /** [start, end, amplitude] spans of "speech". */
  readonly spans: readonly (readonly [number, number, number])[];
  readonly noise: { readonly color: 'pink' | 'white'; readonly amplitude: number };
  readonly humAmplitude: number;
  readonly stereo: boolean;
}

export const FIXTURES: Readonly<Record<FixtureKind, FixtureSpec>> = {
  'quiet-clean': {
    durationS: 8,
    spans: [
      [0.5, 3.5, 0.03],
      [4.5, 7.5, 0.03],
    ],
    noise: { color: 'pink', amplitude: 0.001 },
    humAmplitude: 0,
    stereo: false,
  },
  'uneven-hum': {
    durationS: 8,
    spans: [
      [0.5, 3.5, 0.1],
      [4.5, 7.5, 0.04],
    ],
    noise: { color: 'pink', amplitude: 0.006 },
    humAmplitude: 0.006,
    stereo: false,
  },
  'noisy-stereo': {
    durationS: 8,
    spans: [
      [0.5, 3.5, 0.2],
      [4.5, 7.5, 0.16],
    ],
    noise: { color: 'white', amplitude: 0.05 },
    humAmplitude: 0.01,
    stereo: true,
  },
  'long-pause': {
    durationS: 10,
    spans: [
      [0.5, 3, 0.08],
      [7, 9.5, 0.08],
    ],
    noise: { color: 'pink', amplitude: 0.003 },
    humAmplitude: 0,
    stereo: false,
  },
};

function speechExpression(spans: FixtureSpec['spans']): string {
  const gate = spans
    .map(
      ([start, end, amplitude]) =>
        `${String(amplitude)}*between(t,${String(start)},${String(end)})`,
    )
    .join('+');
  const harmonics = 'sin(2*PI*150*t)+0.5*sin(2*PI*300*t)+0.3*sin(2*PI*450*t)+0.2*sin(2*PI*900*t)';
  const syllables = 'pow(0.55+0.45*sin(2*PI*3.7*t),2)';
  return `(${gate})*(${harmonics})*${syllables}`;
}

export function fixtureArgs(kind: FixtureKind, outputPath: string): string[] {
  const spec = FIXTURES[kind];
  const d = String(spec.durationS);
  const sources = [
    `aevalsrc='${speechExpression(spec.spans)}':s=48000:d=${d}[speech]`,
    `anoisesrc=color=${spec.noise.color}:amplitude=${String(spec.noise.amplitude)}:seed=42:r=48000:d=${d}[noise]`,
    `sine=f=50:r=48000:d=${d},volume=${String(spec.humAmplitude)}[hum]`,
  ];
  const mix = `[speech][noise][hum]amix=inputs=3:normalize=0:duration=first`;
  const layout = spec.stereo ? ',pan=stereo|c0=c0|c1=0.9*c0[out]' : '[out]';
  return [
    '-filter_complex',
    `${sources.join(';')};${mix}${layout}`,
    '-map',
    '[out]',
    '-c:a',
    'pcm_s16le',
    '-y',
    outputPath,
  ];
}

export async function generateFixture(
  ffmpeg: FfmpegManager,
  kind: FixtureKind,
  outputPath: string,
): Promise<Result<void, FfmpegError>> {
  const run = await ffmpeg.run(fixtureArgs(kind, outputPath));
  return run.ok ? { ok: true, value: undefined } : run;
}
