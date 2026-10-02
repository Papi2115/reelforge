import { describe, expect, it } from 'vitest';
import { FakeMedia } from './fake-media.js';
import { PlaybackClock } from './playback-clock.js';

function setup(): { clock: PlaybackClock; time: { ms: number }; errors: unknown[] } {
  const time = { ms: 1000 };
  const errors: unknown[] = [];
  const clock = new PlaybackClock(
    () => time.ms,
    (error) => errors.push(error),
  );
  return { clock, time, errors };
}

describe('PlaybackClock without audio (system clock)', () => {
  it('runs at the playback rate only while playing', () => {
    const { clock, time } = setup();
    expect(clock.source).toBe('system');
    time.ms += 500;
    expect(clock.time()).toBe(0);
    clock.play();
    time.ms += 500;
    expect(clock.time()).toBeCloseTo(0.5, 9);
    clock.setRate(2);
    time.ms += 500;
    expect(clock.time()).toBeCloseTo(1.5, 9);
    clock.pause();
    time.ms += 500;
    expect(clock.time()).toBeCloseTo(1.5, 9);
  });

  it('seeks during playback and keeps running from there', () => {
    const { clock, time } = setup();
    clock.play();
    time.ms += 250;
    clock.seek(4);
    time.ms += 250;
    expect(clock.time()).toBeCloseTo(4.25, 9);
  });
});

describe('PlaybackClock with audio (master clock)', () => {
  it('follows the media element while playing, so it cannot drift', () => {
    const { clock, time } = setup();
    const media = new FakeMedia(10);
    clock.attachMedia(media);
    expect(clock.source).toBe('audio');
    clock.seek(2);
    expect(media.currentTime).toBe(2);
    clock.play();
    expect(media.plays).toEqual([2]);
    expect(clock.source).toBe('audio');
    // The audio runs slower than the system clock (e.g. a stall): the picture follows the audio.
    time.ms += 1000;
    media.currentTime = 2.8;
    expect(clock.time()).toBe(2.8);
    clock.pause();
    expect(media.paused).toBe(true);
    expect(clock.time()).toBe(2.8);
  });

  it('applies speed and pitch preservation to the media element', () => {
    const { clock } = setup();
    const media = new FakeMedia(10);
    clock.attachMedia(media);
    clock.setRate(0.5);
    expect(media.playbackRate).toBe(0.5);
    expect(media.preservesPitch).toBe(true);
    clock.play();
    expect(media.playbackRate).toBe(0.5);
  });

  it('continues on the system clock past the end of shorter audio', () => {
    const { clock, time } = setup();
    const media = new FakeMedia(3);
    clock.attachMedia(media);
    clock.seek(2.5);
    clock.play();
    time.ms += 600;
    media.advance(600);
    expect(clock.time()).toBe(3);
    expect(clock.source).toBe('system');
    time.ms += 1000;
    expect(clock.time()).toBeCloseTo(4, 9);
    // Seeking back into the audio makes it the master again.
    clock.seek(1);
    expect(clock.source).toBe('audio');
    expect(media.plays).toEqual([2.5, 1]);
  });

  it('starts on the system clock until the audio metadata arrives', () => {
    const { clock, time } = setup();
    const media = new FakeMedia(Number.NaN);
    media.readyState = 0;
    clock.attachMedia(media);
    clock.play();
    expect(clock.source).toBe('system');
    time.ms += 500;
    media.readyState = 1;
    media.duration = 10;
    clock.mediaReady();
    expect(clock.source).toBe('audio');
    expect(media.plays).toEqual([0.5]);
  });

  it('falls back to the system clock when the audio cannot play', async () => {
    const { clock, time, errors } = setup();
    const media = new FakeMedia(10);
    media.rejectNext = new Error('NotSupportedError');
    clock.attachMedia(media);
    clock.play();
    await Promise.resolve();
    await Promise.resolve();
    expect(errors).toHaveLength(1);
    expect(clock.source).toBe('system');
    time.ms += 1000;
    expect(clock.time()).toBeCloseTo(1, 9);
  });

  it('ignores a play() interrupted by pause()', async () => {
    const { clock, errors } = setup();
    const media = new FakeMedia(10);
    media.rejectNext = Object.assign(new Error('interrupted'), { name: 'AbortError' });
    clock.attachMedia(media);
    clock.play();
    clock.pause();
    await Promise.resolve();
    await Promise.resolve();
    expect(errors).toEqual([]);
  });

  it('keeps time and play state when the audio is swapped', () => {
    const { clock, time } = setup();
    const first = new FakeMedia(10);
    clock.attachMedia(first);
    clock.play();
    first.currentTime = 1.5;
    const second = new FakeMedia(10);
    clock.attachMedia(second);
    expect(first.paused).toBe(true);
    expect(second.plays).toEqual([1.5]);
    clock.attachMedia(undefined);
    time.ms += 500;
    expect(clock.time()).toBeCloseTo(2, 9);
  });
});
