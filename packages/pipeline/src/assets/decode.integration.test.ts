/**
 * Asset decoding against the real ffmpeg (PLAN.md#12.11); skipped when none is found. The
 * synthetic test card (a lossless PNG) must decode to exactly the pixels our own PNG reader sees;
 * a JPEG and a video still decode the same twice and come from the cache the second time.
 */
import { createHash } from 'node:crypto';
import { cp, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { decodePng } from '@reelforge/engine/cli';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { runProcess } from '../ffmpeg/process.js';
import { ok } from '../result.js';
import { decodeArgs, decodeAsset, DECODED_ASSETS_DIR, parseDuration } from './decode.js';
import { loadManifestAssets, locateAssetFfmpeg } from './manifest-assets.js';

const FIXTURE = path.resolve(
  import.meta.dirname,
  '..',
  '..',
  '..',
  'engine',
  'test',
  'fixtures',
  'asset-test-card.png',
);
const located = locateAssetFfmpeg();
const title = located.ok
  ? 'asset decoding (ffmpeg)'
  : 'asset decoding (SKIPPED: ffmpeg not found; set REELFORGE_FFMPEG or add it to PATH)';

function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

describe('decodeArgs', () => {
  it('forces the demuxer of the verified type and local files only, before the input', () => {
    const args = decodeArgs('in.webm', 'out.pam', 'video/webm', 1.25);
    const input = args.indexOf('-i');
    expect(args.slice(0, input)).toEqual(
      expect.arrayContaining(['-protocol_whitelist', 'file', '-f', 'webm', '-ss', '1.250']),
    );
    expect(args.indexOf('webm')).toBeLessThan(input);
    expect(decodeArgs('in.jpg', 'out.pam', 'image/jpeg', undefined)).not.toContain('-ss');
  });
});

describe('parseDuration', () => {
  it('reads the input banner', () => {
    expect(parseDuration('  Duration: 00:01:02.50, start: 0.000000')).toBe(62.5);
    expect(parseDuration('no banner')).toBeUndefined();
  });
});

describe.skipIf(!located.ok)(title, () => {
  const ffmpegPath = located.ok ? located.value : '';
  const ffmpeg = () => ok(ffmpegPath);
  let project = '';

  beforeAll(async () => {
    project = await mkdtemp(path.join(os.tmpdir(), 'reelforge assets '));
    await mkdir(path.join(project, '.reelforge', 'assets'), { recursive: true });
    await cp(FIXTURE, path.join(project, '.reelforge', 'assets', 'test-card.png'));
    const jpeg = await runProcess(ffmpegPath, [
      '-hide_banner',
      '-nostdin',
      '-v',
      'error',
      '-y',
      '-i',
      FIXTURE,
      '-q:v',
      '4',
      path.join(project, '.reelforge', 'assets', 'card.jpg'),
    ]);
    if (!jpeg.ok) throw new Error(jpeg.error.message);
    const video = await runProcess(ffmpegPath, [
      '-hide_banner',
      '-nostdin',
      '-v',
      'error',
      '-y',
      '-f',
      'lavfi',
      '-i',
      'testsrc2=size=160x120:rate=25:duration=4',
      '-pix_fmt',
      'yuv420p',
      path.join(project, '.reelforge', 'assets', 'clip.mp4'),
    ]);
    if (!video.ok) throw new Error(video.error.message);
  }, 60_000);

  afterAll(async () => {
    await rm(project, { recursive: true, force: true });
  });

  async function file(name: string) {
    const bytes = await readFile(path.join(project, '.reelforge', 'assets', name));
    return { path: path.join(project, '.reelforge', 'assets', name), sha: sha256(bytes) };
  }

  it('decodes a PNG losslessly (same pixels as our PNG reader) and caches it', async () => {
    const png = await file('test-card.png');
    const decoded = await decodeAsset({
      ffmpeg,
      file: png.path,
      kind: 'image',
      mime: 'image/png',
      sha256: png.sha,
      projectDir: project,
    });
    if (!decoded.ok) throw new Error(decoded.error);
    const reference = decodePng(await readFile(FIXTURE));
    const rgb = new Uint8Array(reference.width * reference.height * 3);
    for (let pixel = 0; pixel < reference.width * reference.height; pixel += 1) {
      rgb.set(reference.data.subarray(pixel * 4, pixel * 4 + 3), pixel * 3);
    }
    expect(decoded.value.image).toMatchObject({ width: 320, height: 240, channels: 3 });
    expect(Buffer.from(decoded.value.image.data).equals(Buffer.from(rgb))).toBe(true);
    const cached = await decodeAsset({
      ffmpeg: () => {
        throw new Error('ffmpeg must not run for a cached picture');
      },
      file: png.path,
      kind: 'image',
      mime: 'image/png',
      sha256: png.sha,
      projectDir: project,
    });
    expect(cached.ok && Buffer.from(cached.value.image.data).equals(Buffer.from(rgb))).toBe(true);
  });

  it('decodes a JPEG the same way twice (fresh decode vs cache)', async () => {
    const jpeg = await file('card.jpg');
    const input = {
      ffmpeg,
      file: jpeg.path,
      kind: 'image' as const,
      mime: 'image/jpeg' as const,
      sha256: jpeg.sha,
      projectDir: project,
    };
    const first = await decodeAsset(input);
    await rm(path.join(project, DECODED_ASSETS_DIR), { recursive: true, force: true });
    const second = await decodeAsset(input);
    if (!first.ok || !second.ok) throw new Error('decode failed');
    expect(Buffer.from(first.value.image.data).equals(Buffer.from(second.value.image.data))).toBe(
      true,
    );
  });

  it('takes video stills at a time or in the middle', async () => {
    const clip = await file('clip.mp4');
    const middle = await decodeAsset({
      ffmpeg,
      file: clip.path,
      kind: 'video',
      mime: 'video/mp4',
      sha256: clip.sha,
      projectDir: project,
    });
    const early = await decodeAsset({
      ffmpeg,
      file: clip.path,
      kind: 'video',
      mime: 'video/mp4',
      sha256: clip.sha,
      at: 0.5,
      projectDir: project,
    });
    if (!middle.ok || !early.ok) throw new Error('decode failed');
    expect(middle.value.at).toBe(2);
    expect(middle.value.image).toMatchObject({ width: 160, height: 120 });
    expect(Buffer.from(middle.value.image.data).equals(Buffer.from(early.value.image.data))).toBe(
      false,
    );
    const names = await readdir(path.join(project, DECODED_ASSETS_DIR));
    expect(names.some((name) => name.includes('-at2000-'))).toBe(true);
    expect(names.some((name) => name.includes('-at500-'))).toBe(true);
  });

  it('builds manifest assets only for the refs the scenes name', async () => {
    const png = await file('test-card.png');
    const clip = await file('clip.mp4');
    const record = (
      id: string,
      kind: 'image' | 'video',
      name: string,
      sha: string,
      mime: string,
    ) => ({
      id,
      kind,
      source: 'web',
      sourceItemId: null,
      sourceUrl: '',
      downloadUrl: '',
      title: id,
      author: '',
      licence: { id: 'CC0 1.0', url: null, verified: true },
      file: `.reelforge/assets/${name}`,
      sha256: sha,
      bytes: 1,
      mime,
      width: null,
      height: null,
      mode: 'off',
      approved: false,
      fetchedAt: '2026-10-04T00:00:00Z',
    });
    await writeFile(
      path.join(project, 'assets.json'),
      JSON.stringify({
        version: 1,
        assets: [
          record('test-card', 'image', 'test-card.png', png.sha, 'image/png'),
          record('clip', 'video', 'clip.mp4', clip.sha, 'video/mp4'),
          record('unused', 'image', 'test-card.png', png.sha, 'image/png'),
        ],
      }),
    );
    const none = await loadManifestAssets({ root: project, sources: ['return 1;'], ffmpeg });
    expect(none).toEqual({ ok: true, value: undefined });
    const built = await loadManifestAssets({
      root: project,
      sources: ["ctx.assets.image('test-card')", "ctx.assets.image('clip@1.5')"],
      ffmpeg,
    });
    if (!built.ok || built.value === undefined) throw new Error('no assets');
    expect(built.value.map((asset) => [asset.ref, asset.at])).toEqual([
      ['clip@1.5', 1.5],
      ['test-card', undefined],
    ]);
    const card = built.value[1];
    expect(card?.rgb.length).toBe(320 * 240 * 4);
    expect(card?.sha256).toBe(png.sha);
  });
});

describe('loadManifestAssets without ffmpeg work', () => {
  it('is undefined without assets.json; a broken one fails only scenes that use assets', async () => {
    const project = await mkdtemp(path.join(os.tmpdir(), 'reelforge no assets '));
    try {
      const ffmpeg = () => ok('unused');
      const sources = ["ctx.assets.image('x')"];
      expect(await loadManifestAssets({ root: project, sources, ffmpeg })).toEqual({
        ok: true,
        value: undefined,
      });
      await writeFile(
        path.join(project, 'assets.json'),
        '{"version": 1, "assets": [{"id": "BAD"}]}',
      );
      const broken = await loadManifestAssets({ root: project, sources, ffmpeg });
      expect(broken).toEqual({ ok: false, error: 'assets.json does not match its schema' });
      expect(await loadManifestAssets({ root: project, sources: ['return 1;'], ffmpeg })).toEqual({
        ok: true,
        value: undefined,
      });
    } finally {
      await rm(project, { recursive: true, force: true });
    }
  });
});
