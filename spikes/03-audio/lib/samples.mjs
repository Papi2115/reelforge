// Test voiceover definitions: SAPI voice + degradation recipe simulating a home recording.
import path from 'node:path';
import { OUT_DIR, SAMPLES_DIR } from './common.mjs';

/**
 * snrDb: active-speech RMS vs. noise RMS. noiseColor: anoisesrc color(s).
 * humDb: RMS of the 50/100/150 Hz mains hum in dBFS.
 * gains: piecewise gain (dB) per paragraph -> uneven level between "takes".
 */
export const SAMPLES = [
  {
    id: 'en-doom',
    lang: 'en',
    voice: 'Microsoft David Desktop',
    breakMs: 2500,
    degrade: { snrDb: 20, noiseColors: ['pink'], humDb: -50, gainsDb: [-8, -14] },
  },
  {
    id: 'pl-apollo',
    lang: 'pl',
    voice: 'Microsoft Paulina Desktop',
    breakMs: 3000,
    degrade: { snrDb: 15, noiseColors: ['pink'], humDb: -45, gainsDb: [-10, -4] },
  },
  {
    id: 'en-prism-noisy',
    lang: 'en',
    voice: 'Microsoft Zira Desktop',
    breakMs: 4000,
    degrade: { snrDb: 6, noiseColors: ['white', 'pink'], humDb: -38, gainsDb: [-6, -12] },
  },
];

export function samplePaths(sample) {
  const dir = path.join(OUT_DIR, sample.id);
  return {
    dir,
    script: path.join(SAMPLES_DIR, `${sample.id}.txt`),
    tts: path.join(dir, 'tts.16k.wav'),
    ttsEvents: path.join(dir, 'tts.events.json'),
    truth: path.join(dir, 'truth.json'),
    reference: path.join(dir, 'reference.48k.wav'),
    original: path.join(dir, 'vo.original.wav'),
    degradeReport: path.join(dir, 'degrade.json'),
  };
}
