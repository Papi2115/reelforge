import { describe, expect, it } from 'vitest';
import { FakeMedia, ManualEnvironment } from './fake-media.js';
import { STALL_TIMEOUT_MS } from './media-watch.js';
import { Player, SCRUB_SNIPPET_INTERVAL_MS, SCRUB_SNIPPET_MS } from './player.js';

const FRAME_MS = 1000 / 60;

function setup(duration = 10): {
  player: Player;
  env: ManualEnvironment;
  seeks: number[];
  errors: unknown[];
} {
  const env = new ManualEnvironment();
  const errors: unknown[] = [];
  const player = new Player(env, (error) => errors.push(error));
  const seeks: number[] = [];
  player.attachTarget({ requestSeek: (t) => seeks.push(t) });
  player.setVideo(duration, 30);
  return { player, env, seeks, errors };
}

/** Runs `count` display frames of `ms` each. */
function run(env: ManualEnvironment, count: number, ms = FRAME_MS, media?: FakeMedia): void {
  for (let index = 0; index < count; index += 1) env.advance(ms, media);
}

describe('Player on the system clock', () => {
  it('requests each video frame once, on the frame grid, while time advances', () => {
    const { player, env, seeks } = setup();
    player.play();
    run(env, 60);
    // 1 s at 60 Hz display, 30 fps video: 30 distinct frames, none twice.
    expect(seeks).toHaveLength(31);
    expect(new Set(seeks).size).toBe(seeks.length);
    expect(seeks.every((t) => Math.abs(t * 30 - Math.round(t * 30)) < 1e-9)).toBe(true);
    expect(player.getState().time).toBeCloseTo(1, 1);
    expect(player.getState().playing).toBe(true);
  });

  it('drops frames instead of drifting when a frame takes too long', () => {
    const { player, env, seeks } = setup();
    player.play();
    run(env, 3);
    // A 250 ms stall (busy main thread): the next frame is the one at the master time.
    env.advance(250);
    const last = seeks.at(-1) ?? 0;
    expect(last).toBeCloseTo(Math.floor((0.25 + (3 * FRAME_MS) / 1000) * 30) / 30, 9);
    player.frameDrawn(0, 2);
    player.frameDrawn(last, 2);
    expect(player.frameStats().dropped).toBeGreaterThan(5);
  });

  it('plays faster and slower with the speed', () => {
    const { player, env } = setup();
    player.setRate(2);
    player.play();
    run(env, 30);
    expect(player.getState().time).toBeCloseTo(1, 1);
    player.setRate(0.5);
    run(env, 60);
    expect(player.getState().time).toBeCloseTo(1.5, 1);
    player.shiftRate(1);
    expect(player.getState().rate).toBe(0.75);
    player.shiftRate(-1);
    player.shiftRate(-1);
    expect(player.getState().rate).toBe(0.5);
  });

  it('seeks during playback and keeps playing from there', () => {
    const { player, env, seeks } = setup();
    player.play();
    run(env, 10);
    player.seek(5);
    expect(seeks.at(-1)).toBe(5);
    run(env, 30);
    expect(player.getState().time).toBeCloseTo(5.5, 1);
    expect(player.getState().playing).toBe(true);
  });

  it('stops at the end, or loops', () => {
    const { player, env, seeks } = setup(1);
    player.play();
    run(env, 70);
    expect(player.getState()).toMatchObject({ playing: false, time: 1 });
    expect(seeks.at(-1)).toBe(1);
    // Play at the end starts over.
    player.setLoop(true);
    player.play();
    run(env, 66);
    expect(player.getState().playing).toBe(true);
    expect(player.getState().time).toBeLessThan(0.2);
  });

  it('pauses on the frame on screen', () => {
    const { player, env, seeks } = setup();
    player.play();
    run(env, 7);
    player.pause();
    const { time } = player.getState();
    expect(time * 30).toBeCloseTo(Math.round(time * 30), 9);
    expect(seeks.at(-1)).toBe(time);
    expect(env.frames.size).toBe(0);
  });

  it('steps by frames and seconds and clamps to the video', () => {
    const { player } = setup(2);
    player.seek(1);
    player.step(1);
    expect(player.getState().time).toBeCloseTo(31 / 30, 9);
    player.step(-2);
    expect(player.getState().time).toBeCloseTo(29 / 30, 9);
    player.jump(5);
    expect(player.getState().time).toBe(2);
    player.perform({ kind: 'start' });
    expect(player.getState().time).toBe(0);
    player.perform({ kind: 'end' });
    expect(player.getState().time).toBe(2);
  });

  it('keeps a seek made before the video is loaded, clamped once it is', () => {
    const env = new ManualEnvironment();
    const player = new Player(env, () => undefined);
    // A shot clicked while the project's video still loads (duration not known yet).
    player.seek(2.2);
    expect(player.getState().time).toBe(2.2);
    player.setVideo(7.5, 30);
    expect(player.getState().time).toBe(2.2);
    player.seek(9);
    player.seek(-1);
    expect(player.getState().time).toBe(0);
    const late = new Player(env, () => undefined);
    late.seek(12);
    late.setVideo(7.5, 30);
    expect(late.getState().time).toBe(7.5);
  });

  it('runs keyboard actions', () => {
    const { player } = setup();
    player.perform({ kind: 'faster' });
    expect(player.getState()).toMatchObject({ playing: true, rate: 1 });
    player.perform({ kind: 'faster' });
    expect(player.getState().rate).toBe(1.25);
    player.perform({ kind: 'pause' });
    expect(player.getState().playing).toBe(false);
    player.perform({ kind: 'toggle' });
    expect(player.getState().playing).toBe(true);
    player.perform({ kind: 'mute' });
    expect(player.getState().muted).toBe(true);
  });

  it('notifies subscribers with a new state object', () => {
    const { player } = setup();
    const states = [player.getState()];
    const unsubscribe = player.subscribe(() => states.push(player.getState()));
    player.seek(2);
    unsubscribe();
    player.seek(3);
    expect(states.map((state) => state.time)).toEqual([0, 2]);
  });
});

describe('Player with audio as the master clock', () => {
  it('shows the frame at the audio position', () => {
    const { player, env, seeks } = setup();
    const media = new FakeMedia(10);
    player.attachMedia(media);
    player.play();
    expect(player.getState().clock).toBe('audio');
    run(env, 60, FRAME_MS, media);
    expect(player.getState().time).toBeCloseTo(1, 1);
    // The audio stalls: the picture waits for it.
    const stalled = seeks.length;
    media.paused = true;
    run(env, 30, FRAME_MS, media);
    expect(seeks.length).toBe(stalled);
  });

  it('plays a short, rate-limited audio snippet per scrub while paused', () => {
    const { player, env } = setup();
    const media = new FakeMedia(10);
    player.attachMedia(media);
    player.scrub(2);
    expect(media.currentTime).toBe(2);
    expect(media.plays).toEqual([2]);
    expect(media.paused).toBe(false);
    env.advance(SCRUB_SNIPPET_INTERVAL_MS / 2);
    player.scrub(2.5);
    // Too soon for another snippet; the audio still moves with the playhead.
    expect(media.plays).toEqual([2]);
    expect(media.currentTime).toBe(2.5);
    env.advance(SCRUB_SNIPPET_MS);
    expect(media.paused).toBe(true);
    env.advance(SCRUB_SNIPPET_INTERVAL_MS);
    player.scrub(3);
    expect(media.plays).toEqual([2, 3]);
    // The player itself stayed paused at the scrub position.
    expect(player.getState()).toMatchObject({ playing: false, time: 3 });
  });

  it('plays no snippet when muted, and none after pressing play', () => {
    const { player, env } = setup();
    const media = new FakeMedia(10);
    player.attachMedia(media);
    player.setMuted(true);
    expect(media.muted).toBe(true);
    player.scrub(1);
    expect(media.plays).toEqual([]);
    player.setMuted(false);
    env.advance(SCRUB_SNIPPET_INTERVAL_MS);
    player.scrub(2);
    player.play();
    env.advance(SCRUB_SNIPPET_MS * 2, media);
    // The snippet timer must not pause real playback.
    expect(media.paused).toBe(false);
  });

  it('reloads failed audio once and resumes it at the current time', () => {
    const { player, env, errors } = setup();
    const media = new FakeMedia(10);
    player.attachMedia(media);
    player.play();
    run(env, 30, FRAME_MS, media);
    media.error = { message: 'PIPELINE_ERROR_READ' };
    media.emit('error');
    expect(errors).toHaveLength(1);
    expect(media.loads).toBe(1);
    // While the source reloads, the picture goes on on the system clock.
    expect(player.getState().clock).toBe('system');
    run(env, 30);
    expect(player.getState().time).toBeCloseTo(1, 1);
    media.loaded();
    expect(player.getState()).toMatchObject({ clock: 'audio', audioProblem: null });
    expect(media.plays.at(-1)).toBeCloseTo(1, 1);
    run(env, 30, FRAME_MS, media);
    expect(player.getState().time).toBeCloseTo(1.5, 1);
  });

  it('gives up with a visible warning when the reloaded audio fails too', () => {
    const { player, env, errors } = setup();
    const media = new FakeMedia(10);
    player.attachMedia(media);
    player.play();
    media.error = { message: 'PIPELINE_ERROR_READ' };
    media.emit('error');
    media.error = { message: 'MEDIA_ERR_SRC_NOT_SUPPORTED' };
    media.emit('error');
    expect(errors).toHaveLength(2);
    expect(media.loads).toBe(1);
    expect(player.getState()).toMatchObject({
      clock: 'system',
      audioProblem:
        'Preview audio failed: MEDIA_ERR_SRC_NOT_SUPPORTED. The preview plays on without sound.',
    });
    run(env, 30);
    expect(player.getState().time).toBeCloseTo(0.5, 1);
    player.dismissAudioProblem();
    expect(player.getState().audioProblem).toBeNull();
    // A new source (e.g. after Render mix) starts with a clean slate.
    player.attachMedia(new FakeMedia(10));
    expect(player.getState().clock).toBe('audio');
  });

  it('reloads audio that waits for data without progress, not audio that recovers', () => {
    const { player, env } = setup();
    const media = new FakeMedia(10);
    player.attachMedia(media);
    player.play();
    media.emit('waiting');
    // It catches up on its own: no reload.
    run(env, Math.ceil(STALL_TIMEOUT_MS / FRAME_MS) + 1, FRAME_MS, media);
    expect(media.loads).toBe(0);
    media.emit('stalled');
    // No progress (the media is not advanced) for the whole timeout.
    run(env, Math.ceil(STALL_TIMEOUT_MS / FRAME_MS) + 1);
    expect(media.loads).toBe(1);
  });

  it('notes audio that ends well before the video', () => {
    const { player, env } = setup(10);
    const media = new FakeMedia(4);
    player.attachMedia(media);
    player.play();
    run(env, 5 * 60, FRAME_MS, media);
    expect(player.getState()).toMatchObject({
      playing: true,
      clock: 'system',
      audioProblem: 'Preview audio ends at 4.0 s, the video runs to 10.0 s: no sound after that.',
    });
  });
});
