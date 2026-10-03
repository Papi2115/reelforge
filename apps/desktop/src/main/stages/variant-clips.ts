/**
 * Looping low-res clips of the Variants view (PLAN.md#11.3): a card (the shot's current scene or
 * a variant) rendered through the stages' frame renderer — the same engine as preview and export
 * (CLAUDE.md §3.3) — at 8–24 points of the shot's own time range, downscaled 2× and written as PNG
 * under `.reelforge/frames/variants/<shot>/<key>/` (git-ignored, served by the media protocol).
 * A clip is reused while its scene source and shot times are unchanged. One render at a time.
 */
import { createHash } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { encodePng, type RgbaImage } from '@reelforge/engine/raster';
import { shotVariantFile, storyboardFileSchema, type StoryboardShot } from '@reelforge/shared';
import type { FrameRenderer } from '@reelforge/stages';
import { z } from 'zod';
import type { VariantClip, VariantKey } from '../../shared/variants-contract.js';
import { describeError } from '../logger.js';

/** Frames per second of the clip's playback. */
export const CLIP_FPS = 6;
/** Longest loop (s): longer shots play as a time-lapse of the whole shot. */
export const CLIP_MAX_S = 4;
export const CLIP_MIN_FRAMES = 8;
export const CLIP_MAX_FRAMES = 24;
const RENDER_TIMEOUT_MS = 120_000;

const clipMetaSchema = z.object({
  key: z.string(),
  frames: z.array(z.string()),
  fps: z.number().positive(),
  revision: z.number(),
});

/** Local shot times of a card's clip, spread over the whole shot (ms precision). */
export function clipTimes(duration: number): number[] {
  const count = Math.min(
    CLIP_MAX_FRAMES,
    Math.max(CLIP_MIN_FRAMES, Math.round(Math.min(duration, CLIP_MAX_S) * CLIP_FPS)),
  );
  const last = Math.max(0, duration - 0.05);
  return Array.from(
    { length: count },
    (_, index) => Math.round(((last * index) / Math.max(1, count - 1)) * 1000) / 1000,
  );
}

/** Playback rate so the loop lasts min(shot, CLIP_MAX_S) seconds. */
export function clipFps(duration: number, frames: number): number {
  const seconds = Math.max(0.5, Math.min(duration, CLIP_MAX_S));
  return Math.round((frames / seconds) * 100) / 100;
}

/** Every second pixel of every second row (pixel art stays crisp). */
export function halfSize(image: RgbaImage): RgbaImage {
  const width = Math.max(1, Math.floor(image.width / 2));
  const height = Math.max(1, Math.floor(image.height / 2));
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const from = (y * 2 * image.width + x * 2) * 4;
      data.set(image.data.subarray(from, from + 4), (y * width + x) * 4);
    }
  }
  return { width, height, data };
}

/** Project-relative scene file of a card. */
export function cardScene(shot: Pick<StoryboardShot, 'id' | 'scene'>, key: VariantKey): string {
  return key === 'current' ? shot.scene : shotVariantFile(shot.id, Number(key.slice(1)));
}

export function clipDir(shotId: string, key: VariantKey): string {
  return `.reelforge/frames/variants/${shotId}/${key}`;
}

function inProject(dir: string, relative: string): string {
  return path.join(dir, ...relative.split('/'));
}

async function readShot(dir: string, shotId: string): Promise<StoryboardShot | undefined> {
  const text = await readFile(inProject(dir, 'storyboard.json'), 'utf8');
  const parsed = storyboardFileSchema.safeParse(JSON.parse(text));
  return parsed.success ? parsed.data.shots.find((shot) => shot.id === shotId) : undefined;
}

async function cached(dir: string, key: string, folder: string): Promise<VariantClip | undefined> {
  try {
    const raw: unknown = JSON.parse(await readFile(inProject(dir, `${folder}/clip.json`), 'utf8'));
    const meta = clipMetaSchema.safeParse(raw);
    if (!meta.success || meta.data.key !== key) return undefined;
    return {
      status: 'ok',
      frames: meta.data.frames,
      fps: meta.data.fps,
      revision: meta.data.revision,
    };
  } catch {
    return undefined; // no clip yet (or an unreadable one): rendered again
  }
}

export class VariantClips {
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private readonly frames: FrameRenderer) {}

  /** The card's clip: cached, else rendered (after any render in progress). */
  clip(dir: string, shotId: string, key: VariantKey): Promise<VariantClip> {
    const next = this.queue.then(() => this.renderClip(dir, shotId, key));
    this.queue = next.catch(() => undefined);
    return next;
  }

  private async renderClip(dir: string, shotId: string, key: VariantKey): Promise<VariantClip> {
    try {
      const shot = await readShot(dir, shotId);
      if (shot === undefined) return { status: 'error', message: `unknown shot ${shotId}` };
      const scene = cardScene(shot, key);
      const source = await readFile(inProject(dir, scene), 'utf8');
      const duration = shot.t1 - shot.t0;
      const times = clipTimes(duration);
      const hash = createHash('sha256')
        .update(JSON.stringify([source, shot.t0, shot.t1, times]))
        .digest('hex');
      const folder = clipDir(shotId, key);
      const hit = await cached(dir, hash, folder);
      if (hit !== undefined) return hit;
      const rendered = await this.frames.renderShot(
        {
          projectDir: dir,
          shotId,
          times,
          cards: false,
          ...(key === 'current' ? {} : { scene }),
        },
        AbortSignal.timeout(RENDER_TIMEOUT_MS),
      );
      if (!rendered.ok) return { status: 'error', message: rendered.error };
      await rm(inProject(dir, folder), { recursive: true, force: true });
      await mkdir(inProject(dir, folder), { recursive: true });
      const files: string[] = [];
      for (const [index, frame] of rendered.frames.entries()) {
        const file = `${folder}/f${String(index).padStart(2, '0')}.png`;
        await writeFile(inProject(dir, file), encodePng(halfSize(frame.image)));
        files.push(file);
      }
      const clip = {
        status: 'ok' as const,
        frames: files,
        fps: clipFps(duration, files.length),
        revision: Number.parseInt(hash.slice(0, 8), 16),
      };
      await writeFile(
        inProject(dir, `${folder}/clip.json`),
        JSON.stringify({ key: hash, frames: clip.frames, fps: clip.fps, revision: clip.revision }),
      );
      return clip;
    } catch (error) {
      return { status: 'error', message: describeError(error) };
    }
  }
}
