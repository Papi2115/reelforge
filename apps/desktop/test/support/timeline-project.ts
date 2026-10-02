/**
 * A synthetic 10-minute project for the timeline tests (PLAN.md#6.5 perf target): ~1,700 timed
 * words, 40 shots, 150 sfx cues, an ambience and a music range and a 16 kHz voice-over WAV with
 * word-shaped bursts. Built from the CLI fixture project (its two scenes are reused).
 */
import { cp, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

export const LONG_PROJECT = { seconds: 600, words: 1_700, shots: 40, sfx: 150 } as const;
const WORD_STEP = 0.35;
const WORD_LENGTH = 0.28;
const SAMPLE_RATE = 16_000;

function wavPcm16(samples: Int16Array, sampleRate: number): Buffer {
  const header = Buffer.alloc(44);
  header.write('RIFF', 0, 'ascii');
  header.writeUInt32LE(36 + samples.byteLength, 4);
  header.write('WAVE', 8, 'ascii');
  header.write('fmt ', 12, 'ascii');
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36, 'ascii');
  header.writeUInt32LE(samples.byteLength, 40);
  return Buffer.concat([header, Buffer.from(samples.buffer)]);
}

/** Bursts under every word, louder every few words, silent between sentences. */
function voiceover(): Int16Array {
  const samples = new Int16Array(LONG_PROJECT.seconds * SAMPLE_RATE);
  let seed = 12_345;
  for (let word = 0; word < LONG_PROJECT.words; word += 1) {
    if (word % 12 === 11) continue;
    const start = Math.floor(word * WORD_STEP * SAMPLE_RATE);
    const length = Math.floor(WORD_LENGTH * SAMPLE_RATE);
    const level = 0.25 + 0.5 * ((word * 7) % 5) * 0.25;
    for (let index = 0; index < length && start + index < samples.length; index += 1) {
      seed = (Math.imul(seed, 1_103_515_245) + 12_345) >>> 0;
      const envelope = Math.sin((Math.PI * index) / length);
      const noise = (seed / 0xffff_ffff) * 2 - 1;
      samples[start + index] = Math.round(noise * envelope * level * 32_000);
    }
  }
  return samples;
}

export async function createLongProject(fixture: string, dir: string): Promise<void> {
  await cp(fixture, dir, { recursive: true });
  const shotLength = LONG_PROJECT.seconds / LONG_PROJECT.shots;
  const shots = Array.from({ length: LONG_PROJECT.shots }, (_, index) => ({
    id: `s${String(index + 1).padStart(2, '0')}`,
    t0: index * shotLength,
    t1: (index + 1) * shotLength,
    treatment: index % 2 === 0 ? 'title-card' : 'metaphor-object',
    intent: `Shot ${String(index + 1)}`,
    scene: index % 2 === 0 ? 'scenes/s01_title.js' : 'scenes/s02_calc.js',
  }));
  const words = Array.from({ length: LONG_PROJECT.words }, (_, index) => ({
    text: index % 12 === 11 ? 'calculator.' : ['Doom', 'runs', 'on', '61', 'KB'][index % 5],
    t: Math.round(index * WORD_STEP * 1000) / 1000,
    tEnd: Math.round((index * WORD_STEP + WORD_LENGTH) * 1000) / 1000,
  }));
  const cues = {
    version: 1,
    sfx: Array.from({ length: LONG_PROJECT.sfx }, (_, index) => ({
      t: index * 4 + 1,
      name: ['hit', 'whoosh', 'pop', 'click'][index % 4],
    })),
    ambience: [{ from: 0, to: 300, name: 'room-tone', gainDb: -6 }],
    music: [{ from: 280, to: 600, file: 'audio/music/bed.wav', gainDb: -12 }],
  };
  await writeFile(path.join(dir, 'storyboard.json'), JSON.stringify({ version: 1, shots }));
  await writeFile(path.join(dir, 'timing', 'words.json'), JSON.stringify({ version: 1, words }));
  await writeFile(path.join(dir, 'cues.json'), JSON.stringify(cues));
  await mkdir(path.join(dir, 'audio'), { recursive: true });
  await writeFile(path.join(dir, 'audio', 'vo.clean.wav'), wavPcm16(voiceover(), SAMPLE_RATE));
}
