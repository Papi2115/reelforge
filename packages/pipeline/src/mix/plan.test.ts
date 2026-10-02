import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { monoClip, type StereoClip } from './clip.js';
import { CuesFileSchema, type CuesFileInput } from './cues.js';
import { secondsToFrames } from './dsp.js';
import { cueFiles, planMix } from './plan.js';

const BASE = path.resolve('project dir ł');
const TOTAL = secondsToFrames(10);

function plan(input: Omit<CuesFileInput, 'version'>, files: Record<string, StereoClip> = {}) {
  const cues = CuesFileSchema.parse({ version: 1, ...input });
  const clips = new Map(
    Object.entries(files).map(([file, clip]) => [path.resolve(BASE, file), clip] as const),
  );
  return planMix(cues, TOTAL, BASE, clips);
}

const second = monoClip(new Float32Array(secondsToFrames(1)).fill(0.1));

describe('planMix', () => {
  it('places sfx with gain and pan and skips cues after the end', () => {
    const result = plan(
      {
        sfx: [
          { t: 1, name: 'hit', gainDb: -6, pan: 1 },
          { t: 9.9, file: 'sfx/boom.wav' },
          { t: 12, name: 'click' },
        ],
      },
      { 'sfx/boom.wav': second },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const [hit, boom] = result.value.sfx;
    expect(result.value.sfx).toHaveLength(2);
    expect(hit?.startFrame).toBe(48_000);
    expect(hit?.gainRight).toBeCloseTo(0.501, 3);
    expect(hit?.gainLeft).toBeCloseTo(0, 10);
    // Truncated at the end of the timeline.
    expect(boom?.frames).toBe(TOTAL - secondsToFrames(9.9));
    expect(result.value.warnings).toEqual([
      'sfx[2] starts at 12.00 s, after the end of the mix (10.00 s); skipped',
    ]);
  });

  it('uses stable default seeds (editing other cues does not change a sound)', () => {
    const alone = plan({ sfx: [{ t: 2, name: 'whoosh' }] });
    const withOthers = plan({
      sfx: [
        { t: 1, name: 'whoosh' },
        { t: 2, name: 'whoosh' },
      ],
    });
    if (!alone.ok || !withOthers.ok) throw new Error('plan failed');
    expect(withOthers.value.sfx[1]?.clip).toEqual(alone.value.sfx[0]?.clip);
    expect(withOthers.value.sfx[0]?.clip).not.toEqual(alone.value.sfx[0]?.clip);
  });

  it('clamps ambience to the timeline, loops it and limits fades to half its length', () => {
    const result = plan(
      {
        ambience: [
          { from: 8, to: 20, name: 'room-tone', fadeInS: 5, fadeOutS: 0.5 },
          { from: 0, to: 4, file: 'amb/loop.wav' },
        ],
      },
      { 'amb/loop.wav': second },
    );
    if (!result.ok) throw new Error(result.error.message);
    const [room, loop] = result.value.ambience;
    expect(room).toMatchObject({
      startFrame: secondsToFrames(8),
      frames: secondsToFrames(2),
      loop: true,
      fadeInFrames: secondsToFrames(1),
      fadeOutFrames: secondsToFrames(0.5),
    });
    // 1 s file crossfaded by 0.25 s into a 0.75 s loop.
    expect(loop?.clip.left.length).toBe(secondsToFrames(0.75));
  });

  it('groups music by ducking settings and adds a silent bus when there is none', () => {
    const files = { 'm/a.wav': second, 'm/b.wav': second };
    const result = plan(
      {
        music: [
          { from: 0, to: 5, file: 'm/a.wav' },
          { from: 5, to: 10, file: 'm/b.wav', loop: true },
          { from: 0, to: 10, file: 'm/b.wav', ducking: { enabled: false } },
          { from: 0, to: 10, file: 'm/a.wav', offsetS: 3 },
        ],
      },
      files,
    );
    if (!result.ok) throw new Error(result.error.message);
    expect(
      result.value.music.map((bus) => [bus.ducking?.ratio ?? null, bus.events.length]),
    ).toEqual([
      [8, 2],
      [null, 1],
    ]);
    expect(result.value.warnings).toEqual([
      'music[3]: offsetS is past the end of m/a.wav; skipped',
    ]);
    const empty = plan({});
    expect(empty.ok && empty.value.music).toEqual([{ ducking: null, events: [] }]);
  });

  it('fails when a referenced file was not decoded', () => {
    expect(plan({ sfx: [{ t: 0, file: 'nope.wav' }] })).toMatchObject({
      ok: false,
      error: { kind: 'invalid-input' },
    });
  });
});

describe('cueFiles', () => {
  it('lists distinct resolved files in order of first use', () => {
    const cues = CuesFileSchema.parse({
      version: 1,
      sfx: [
        { t: 0, file: 'a.wav' },
        { t: 1, name: 'hit' },
        { t: 2, file: 'a.wav' },
      ],
      ambience: [{ from: 0, to: 1, file: 'b.wav' }],
      music: [{ from: 0, to: 1, file: path.resolve('abs.mp3') }],
    });
    expect(cueFiles(cues, BASE)).toEqual([
      path.resolve(BASE, 'a.wav'),
      path.resolve(BASE, 'b.wav'),
      path.resolve('abs.mp3'),
    ]);
  });
});
