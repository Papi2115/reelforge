import { describe, expect, it } from 'vitest';
import { CuesFileSchema } from './cues.js';
import { hashSeed } from './dsp.js';
import { windowCues } from './preview.js';

const cues = CuesFileSchema.parse({
  version: 1,
  global: { voGainDb: -1 },
  sfx: [
    { t: 4, name: 'hit' },
    { t: 12.5, name: 'whoosh', gainDb: -3 },
    { t: 15, file: 'audio/sfx/boom.wav' },
    { t: 31, name: 'pop' },
  ],
  ambience: [
    { from: 0, to: 40, name: 'room-tone' },
    { from: 14, to: 18, name: 'wind', fadeInS: 1, fadeOutS: 1 },
    { from: 35, to: 50, name: 'hum' },
  ],
  music: [{ from: 5, to: 60, file: 'audio/music/bed.wav', offsetS: 2, loop: true }],
});

describe('windowCues', () => {
  const windowed = windowCues(cues, 10, 20);

  it('keeps the cues inside the window, moved to 0 s, with the full-timeline seeds', () => {
    expect(windowed.global).toMatchObject({ voGainDb: -1, durationS: 20 });
    expect(windowed.sfx).toEqual([
      expect.objectContaining({
        t: 2.5,
        name: 'whoosh',
        gainDb: -3,
        seed: hashSeed('whoosh@12.500'),
      }),
      expect.objectContaining({ t: 5, file: 'audio/sfx/boom.wav' }),
    ]);
    expect(windowed.sfx[1]).not.toHaveProperty('seed');
  });

  it('cuts ranges at the window edges without fades there', () => {
    expect(windowed.ambience).toEqual([
      expect.objectContaining({
        from: 0,
        to: 20,
        fadeInS: 0,
        fadeOutS: 0,
        seed: hashSeed('room-tone@0.000'),
      }),
      expect.objectContaining({ from: 4, to: 8, fadeInS: 1, fadeOutS: 1 }),
    ]);
    // Music that started before the window continues from where it would be.
    expect(windowed.music).toEqual([
      expect.objectContaining({ from: 0, to: 20, offsetS: 7, fadeInS: 0, fadeOutS: 0 }),
    ]);
  });

  it('is schema-valid output', () => {
    expect(CuesFileSchema.safeParse(windowed).success).toBe(true);
  });
});
