import { mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { ManifestShot, RenderManifest } from '@reelforge/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { AnchorResolver, RenderIdentity } from './cache-key.js';
import { exportVideo, type ExportProgress, type ExportVideoOptions } from './export-video.js';
import { ExportStateSchema, exportPaths } from './state.js';
import {
  createFakeSourceFactory,
  createRawMedia,
  type FakeSourceOptions,
} from './testing/fakes.js';

const WIDTH = 16;
const HEIGHT = 9;
const FPS = 10;
const FRAME_BYTES = WIDTH * HEIGHT * 4;

const identity: RenderIdentity = {
  engineVersion: 'engine-1',
  kitVersion: 'kit-1',
  style: { id: 'test-style', width: WIDTH, height: HEIGHT, preset: { dither: 0.1 } },
};

const scene = (body: string): ManifestShot['scene'] => ({
  file: 'scenes/test.js',
  source: `export const meta = { id: 'x' };\nexport function build(ctx) { ${body} }\nexport function update() {}\n`,
});

function threeShots(overrides: Partial<Record<'a' | 'b' | 'c', string>> = {}): RenderManifest {
  return {
    version: 1,
    fps: FPS,
    seed: 7,
    words: {
      version: 1,
      words: [
        { text: 'hello', t: 0.2, tEnd: 0.5 },
        { text: 'world', t: 1.2, tEnd: 1.5 },
      ],
    },
    shots: [
      { id: 'a', t0: 0, t1: 1, scene: scene(overrides.a ?? "ctx.anchor('hello');") },
      { id: 'b', t0: 1, t1: 3, scene: scene(overrides.b ?? 'return 2;') },
      { id: 'c', t0: 3, t1: 4.5, scene: scene(overrides.c ?? 'return 3;') },
    ],
  };
}

/** Exact resolver over the manifest words (single-word phrases are enough here). */
const resolverFor =
  (manifest: RenderManifest): AnchorResolver =>
  (phrase) => {
    const word = manifest.words?.words.find((candidate) => candidate.text === phrase);
    return word === undefined ? undefined : { t: word.t, tEnd: word.tEnd };
  };

let projectDir = '';

beforeEach(async () => {
  projectDir = await mkdtemp(path.join(os.tmpdir(), 'reelforge export '));
});

afterEach(async () => {
  await rm(projectDir, { recursive: true, force: true });
});

function run(
  manifest: RenderManifest,
  extra: Partial<ExportVideoOptions> = {},
  beforeFrame?: FakeSourceOptions['beforeFrame'],
) {
  const source = createFakeSourceFactory({
    width: WIDTH,
    height: HEIGHT,
    ...(beforeFrame === undefined ? {} : { beforeFrame }),
  });
  const raw = createRawMedia();
  const events: ExportProgress[] = [];
  const result = exportVideo({
    projectDir,
    title: 'My: video?',
    manifest,
    identity,
    media: raw.media,
    createFrameSource: source.factory,
    workers: 1,
    thumbnailAt: null,
    resolveAnchor: resolverFor(manifest),
    onProgress: (event) => events.push(event),
    ...extra,
  });
  return { result, source, raw, events };
}

describe('exportVideo (fake frame source + raw media)', () => {
  it('renders every shot once, muxes them in order and writes thumbnail + state', async () => {
    const { result, source, raw } = run(threeShots(), { thumbnailAt: 0.5 });
    const exported = await result;
    expect(exported.ok).toBe(true);
    if (!exported.ok) return;
    expect(exported.value.output).toBe(path.join(projectDir, 'out', 'My video.mp4'));
    expect(exported.value.totalFrames).toBe(45);
    expect(exported.value.width).toBe(1920);
    expect(exported.value.height).toBe(1080);
    expect(Object.fromEntries(source.stats.framesByShot)).toEqual({ a: 11, b: 20, c: 15 });
    expect([...exported.value.renderedShots].sort()).toEqual(['a', 'b', 'c']);
    const video = await readFile(exported.value.output);
    expect(video.length).toBe(45 * FRAME_BYTES);
    // Frames are in global order: byte 0 of frame i encodes t = i / fps.
    for (const index of [0, 10, 11, 29, 30, 44]) {
      expect(video[index * FRAME_BYTES]).toBe(Math.round((index / FPS) * 1000) % 251);
    }
    expect(exported.value.thumbnail).toBe(path.join(projectDir, 'out', 'thumb.png'));
    expect(raw.stats.thumbnails).toBe(1);
    expect(source.stats.sourcesClosed).toBe(source.stats.sourcesCreated);
    const state = ExportStateSchema.parse(
      JSON.parse(await readFile(exportPaths(projectDir).stateFile, 'utf8')),
    );
    expect(state.status).toBe('complete');
    expect(state.finished.map((shot) => shot.id).sort()).toEqual(['a', 'b', 'c']);
  });

  it('writes the video to a chosen path outside out/ (thumbnail stays in out/)', async () => {
    const output = path.join(projectDir, 'elsewhere ż', 'final cut.mp4');
    const exported = await run(threeShots(), { output, thumbnailAt: 0.5 }).result;
    expect(exported.ok && exported.value.output).toBe(output);
    expect((await stat(output)).size).toBe(45 * FRAME_BYTES);
    expect(exported.ok && exported.value.thumbnail).toBe(path.join(projectDir, 'out', 'thumb.png'));
    expect(await readdir(path.dirname(output))).toEqual(['final cut.mp4']);
  });

  it('re-renders nothing when nothing changed', async () => {
    expect((await run(threeShots()).result).ok).toBe(true);
    const second = run(threeShots());
    const exported = await second.result;
    expect(exported.ok && exported.value.cachedShots.length).toBe(3);
    expect(second.source.stats.framesByShot.size).toBe(0);
    expect(second.raw.stats.segmentsOpened).toBe(0);
  });

  it('re-renders only the edited shot', async () => {
    expect((await run(threeShots()).result).ok).toBe(true);
    const edited = run(threeShots({ b: 'return 22;' }));
    const exported = await edited.result;
    expect(exported.ok).toBe(true);
    expect(Object.fromEntries(edited.source.stats.framesByShot)).toEqual({ b: 20 });
    expect(exported.ok && [...exported.value.cachedShots].sort()).toEqual(['a', 'c']);
    // The superseded segment of the old "b" is pruned.
    const segments = await readdir(exportPaths(projectDir).segmentsDir);
    expect(segments).toHaveLength(3);
  });

  it('re-renders a shot that transitions in when the previous shot changes', async () => {
    const withCrossfade = (a: string): RenderManifest => {
      const manifest = threeShots({ a });
      const [first, second, third] = manifest.shots;
      if (!first || !second || !third) throw new Error('fixture');
      return {
        ...manifest,
        shots: [first, { ...second, transitionIn: { type: 'crossfade', duration: 0.5 } }, third],
      };
    };
    expect((await run(withCrossfade("ctx.anchor('hello');")).result).ok).toBe(true);
    const edited = run(withCrossfade("ctx.anchor('hello'); return 1;"));
    expect((await edited.result).ok).toBe(true);
    expect([...edited.source.stats.framesByShot.keys()].sort()).toEqual(['a', 'b']);
  });

  it('re-renders a shot only when an anchor it uses moves', async () => {
    const manifest = threeShots();
    expect((await run(manifest).result).ok).toBe(true);
    const withWords = (helloT: number, worldT: number): RenderManifest => ({
      ...manifest,
      words: {
        version: 1,
        words: [
          { text: 'hello', t: helloT, tEnd: helloT + 0.3 },
          { text: 'world', t: worldT, tEnd: worldT + 0.3 },
        ],
      },
    });
    const unrelated = run(withWords(0.2, 1.3));
    expect((await unrelated.result).ok).toBe(true);
    expect(unrelated.source.stats.framesByShot.size).toBe(0);
    const moved = run(withWords(0.3, 1.3));
    expect((await moved.result).ok).toBe(true);
    expect([...moved.source.stats.framesByShot.keys()]).toEqual(['a']);
  });

  it('resumes an aborted export without re-rendering finished shots', async () => {
    const controller = new AbortController();
    const first = run(threeShots(), {
      signal: controller.signal,
      onProgress: (event) => {
        if (event.type === 'shot-done' && !event.cached) controller.abort();
      },
    });
    const aborted = await first.result;
    expect(aborted.ok).toBe(false);
    if (aborted.ok) return;
    expect(aborted.error.kind).toBe('cancelled');
    const renderedFirst = [...first.source.stats.framesByShot.keys()];
    expect(renderedFirst).toHaveLength(1);
    const state = ExportStateSchema.parse(
      JSON.parse(await readFile(exportPaths(projectDir).stateFile, 'utf8')),
    );
    expect(state.status).toBe('running');
    expect(state.finished.map((shot) => shot.id)).toEqual(renderedFirst);

    const second = run(threeShots());
    const resumed = await second.result;
    expect(resumed.ok).toBe(true);
    if (!resumed.ok) return;
    expect(resumed.value.resumed).toBe(true);
    expect(resumed.value.cachedShots).toEqual(renderedFirst);
    const renderedSecond = [...second.source.stats.framesByShot.keys()];
    expect(renderedSecond.sort()).toEqual(
      ['a', 'b', 'c'].filter((id) => !renderedFirst.includes(id)),
    );
  });

  it('drops the partial segment of a shot killed mid-render', async () => {
    const controller = new AbortController();
    // Abort on the 5th rendered frame (inside the first shot).
    let frames = 0;
    const first = run(threeShots(), { signal: controller.signal }, () => {
      frames += 1;
      if (frames === 5) controller.abort();
      return null;
    });
    const aborted = await first.result;
    expect(!aborted.ok && aborted.error.kind).toBe('cancelled');
    expect(first.raw.stats.segmentsAborted).toBe(1);
    expect(await readdir(exportPaths(projectDir).segmentsDir)).toEqual([]);
  });

  it('reports a frame-source failure with the shot id and writes no video', async () => {
    const source = createFakeSourceFactory({
      width: WIDTH,
      height: HEIGHT,
      beforeFrame: (shotId) =>
        shotId === 'c' ? { kind: 'frame-source', message: 'update() threw', shotId } : null,
    });
    const exported = await exportVideo({
      projectDir,
      title: 'v',
      manifest: threeShots(),
      identity,
      media: createRawMedia().media,
      createFrameSource: source.factory,
      workers: 2,
    });
    expect(exported.ok).toBe(false);
    if (exported.ok) return;
    expect(exported.error).toMatchObject({ kind: 'frame-source', shotId: 'c' });
    await expect(stat(path.join(projectDir, 'out', 'v.mp4'))).rejects.toThrow();
    expect(source.stats.sourcesClosed).toBe(source.stats.sourcesCreated);
  });

  it('runs one frame source per worker in parallel', async () => {
    const { result, source } = run(threeShots(), { workers: 3, thumbnailAt: null });
    const exported = await result;
    expect(exported.ok && exported.value.thumbnail).toBeNull();
    expect(source.stats.sourcesCreated).toBe(3);
    expect(source.stats.sourcesClosed).toBe(3);
  });

  it('muxes audio/mix.wav when present and writes chapters.txt', async () => {
    const mix = path.join(projectDir, 'audio', 'mix.wav');
    await mkdir(path.dirname(mix), { recursive: true });
    await writeFile(mix, 'RIFF');
    const manifest: RenderManifest = {
      ...threeShots(),
      shots: threeShots().shots.map((shot, index) => ({
        ...shot,
        t0: shot.t0 * 10,
        t1: index === 2 ? 45 : shot.t1 * 10,
      })),
    };
    const { result, raw } = run(manifest, {
      chapters: [
        { title: 'Intro', t: 0 },
        { title: 'Middle', t: 10 },
        { title: 'End', t: 30 },
      ],
      thumbnailAt: 12,
    });
    const exported = await result;
    expect(exported.ok).toBe(true);
    if (!exported.ok) return;
    expect(raw.stats.lastAudio).toBe(mix);
    expect(exported.value.chaptersFile).not.toBeNull();
    const chapters = await readFile(exported.value.chaptersFile ?? '', 'utf8');
    expect(chapters).toBe('0:00 Intro\n0:10 Middle\n0:30 End\n');
  });

  it('fails clearly when the preset is not an integer multiple of the render size', async () => {
    const odd: RenderIdentity = {
      ...identity,
      style: { ...identity.style, width: 480, height: 270 },
    };
    const exported = await exportVideo({
      projectDir,
      title: 'v',
      manifest: threeShots(),
      identity: odd,
      media: createRawMedia().media,
      createFrameSource: createFakeSourceFactory({ width: 480, height: 270 }).factory,
      preset: '1440p',
    });
    expect(!exported.ok && exported.error.kind).toBe('preset-mismatch');
    expect(!exported.ok && exported.error.message).toMatch(/integer/);
  });

  it('rejects frames of the wrong size', async () => {
    const exported = await exportVideo({
      projectDir,
      title: 'v',
      manifest: threeShots(),
      identity,
      media: createRawMedia().media,
      createFrameSource: createFakeSourceFactory({ width: 32, height: 18 }).factory,
    });
    expect(!exported.ok && exported.error.message).toMatch(/expected 16x9/);
  });
});
