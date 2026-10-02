/**
 * Test support (not exported from the package index): a counting FrameSource that synthesizes
 * deterministic frames, and an ExportMedia that writes raw bytes instead of running ffmpeg.
 */
import { appendFile, readFile, writeFile } from 'node:fs/promises';
import type { RenderManifest } from '@reelforge/shared';
import type { ExportError } from '../errors.js';
import type { FrameSource, FrameSourceFactory, ShotRange } from '../frame-source.js';
import type { ExportMedia, SegmentWriter } from '../media.js';
import { err, ok, type Result } from '../../result.js';

export interface FakeSourceStats {
  /** Frames rendered per shot id (the last id of the opened range). */
  readonly framesByShot: Map<string, number>;
  /** Shots opened, in order. */
  readonly opened: string[];
  sourcesCreated: number;
  sourcesClosed: number;
}

export interface FakeSourceOptions {
  readonly width: number;
  readonly height: number;
  readonly gpu?: string;
  /** Called before each frame; return an error to fail that frame. */
  readonly beforeFrame?: (shotId: string, t: number) => ExportError | null;
}

/** First byte of every pixel encodes the frame time, so outputs are checkable. */
export function fakeFrame(width: number, height: number, t: number): Uint8Array {
  const frame = new Uint8Array(width * height * 4);
  frame.fill(Math.round(t * 1000) % 251);
  return frame;
}

export function createFakeSourceFactory(options: FakeSourceOptions): {
  readonly factory: FrameSourceFactory;
  readonly stats: FakeSourceStats;
} {
  const stats: FakeSourceStats = {
    framesByShot: new Map(),
    opened: [],
    sourcesCreated: 0,
    sourcesClosed: 0,
  };
  const factory: FrameSourceFactory = () => {
    stats.sourcesCreated += 1;
    let current: ShotRange | null = null;
    let closed = false;
    const source: FrameSource = {
      open(_manifest: RenderManifest, range: ShotRange) {
        current = range;
        const shotId = range.shotIds.at(-1) ?? '?';
        stats.opened.push(shotId);
        return Promise.resolve(
          ok({ width: options.width, height: options.height, gpu: options.gpu ?? 'Fake GPU' }),
        );
      },
      renderFrame(t: number): Promise<Result<Uint8Array, ExportError>> {
        if (current === null) {
          return Promise.resolve(err({ kind: 'frame-source', message: 'not opened' }));
        }
        const shotId = current.shotIds.at(-1) ?? '?';
        const failure = options.beforeFrame?.(shotId, t) ?? null;
        if (failure !== null) return Promise.resolve(err(failure));
        stats.framesByShot.set(shotId, (stats.framesByShot.get(shotId) ?? 0) + 1);
        return Promise.resolve(ok(fakeFrame(options.width, options.height, t)));
      },
      close() {
        if (!closed) stats.sourcesClosed += 1;
        closed = true;
        return Promise.resolve();
      },
    };
    return source;
  };
  return { factory, stats };
}

export interface RawMediaStats {
  segmentsOpened: number;
  segmentsAborted: number;
  muxes: number;
  lastAudio: string | null;
  thumbnails: number;
}

/** Segments are raw concatenated frames; the "mp4" is the concatenation of the segments. */
export function createRawMedia(outputKey = 'raw-test-media'): {
  readonly media: ExportMedia;
  readonly stats: RawMediaStats;
} {
  const stats: RawMediaStats = {
    segmentsOpened: 0,
    segmentsAborted: 0,
    muxes: 0,
    lastAudio: null,
    thumbnails: 0,
  };
  const media: ExportMedia = {
    outputKey,
    encoderLabel: 'raw (test)',
    segmentExtension: '.raw',
    openSegment(spec): SegmentWriter {
      stats.segmentsOpened += 1;
      let created = false;
      return {
        async write(frame) {
          if (!created) await writeFile(spec.file, frame);
          else await appendFile(spec.file, frame);
          created = true;
          return ok(undefined);
        },
        async finish() {
          if (!created) await writeFile(spec.file, new Uint8Array());
          return ok(undefined);
        },
        abort() {
          stats.segmentsAborted += 1;
          return Promise.resolve();
        },
      };
    },
    async concatAndMux(spec) {
      stats.muxes += 1;
      stats.lastAudio = spec.audio;
      const parts = await Promise.all(spec.segments.map((segment) => readFile(segment)));
      await writeFile(spec.output, Buffer.concat(parts));
      return ok(undefined);
    },
    async writeThumbnail(spec, rgba) {
      stats.thumbnails += 1;
      await writeFile(spec.file, rgba);
      return ok(undefined);
    },
  };
  return { media, stats };
}
