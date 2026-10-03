/**
 * whisper.cpp test hooks (unpackaged app + REELFORGE_TEST_HOOKS=1 only) and the disk-space probe.
 * - REELFORGE_TEST_WHISPER_ROOT: install into this folder instead of %LOCALAPPDATA%\ReelForge\whisper.
 * - REELFORGE_TEST_WHISPER_MIRROR: "download" every asset from this folder (file named like the
 *   asset) instead of GitHub / Hugging Face. An optional `hashes.json` there
 *   (`{ "<fileName>": { "sha256": "…", "bytes": n } }`) re-pins assets to small test files; without
 *   it the real pinned hashes are checked (e.g. a folder of really downloaded files).
 * - REELFORGE_TEST_WHISPER_MIRROR_DELAY_MS: pause per 64 KB chunk (to see progress / cancel).
 */
import { createReadStream, readFileSync, statSync } from 'node:fs';
import { statfs } from 'node:fs/promises';
import path from 'node:path';
import type { AssetSpec, FetchLike, WhisperManagerOptions } from '@reelforge/pipeline';
import { z } from 'zod';

export const TEST_WHISPER_ROOT_ENV = 'REELFORGE_TEST_WHISPER_ROOT';
export const TEST_WHISPER_MIRROR_ENV = 'REELFORGE_TEST_WHISPER_MIRROR';
export const TEST_WHISPER_DELAY_ENV = 'REELFORGE_TEST_WHISPER_MIRROR_DELAY_MS';
export const MIRROR_HASHES_FILE = 'hashes.json';

const mirrorHashesSchema = z.record(
  z.string(),
  z.object({ sha256: z.string().regex(/^[0-9a-f]{64}$/), bytes: z.int().nonnegative() }),
);
export type MirrorHashes = z.infer<typeof mirrorHashesSchema>;

export type WhisperBaseOptions = Pick<WhisperManagerOptions, 'root' | 'fetch' | 'assetOverride'>;

const pause = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

/** `fetch` over a local folder: the URL's file name is read from `dir` (404 when missing). */
export function mirrorFetch(dir: string, delayMs = 0): FetchLike {
  return (url, init) => {
    const file = path.join(dir, decodeURIComponent(path.posix.basename(new URL(url).pathname)));
    let size: number;
    try {
      size = statSync(file).size;
    } catch {
      // Not mirrored: answer like a server that does not have it.
      return Promise.resolve(new Response(null, { status: 404 }));
    }
    const chunks = createReadStream(file, { highWaterMark: 64 * 1024 })[Symbol.asyncIterator]();
    const signal = init.signal ?? undefined;
    const body = new ReadableStream<Uint8Array>({
      async pull(controller) {
        if (delayMs > 0) await pause(delayMs);
        if (signal?.aborted === true) {
          await chunks.return?.();
          controller.error(Object.assign(new Error('aborted'), { name: 'AbortError' }));
          return;
        }
        const next = await chunks.next();
        if (next.done === true) controller.close();
        else controller.enqueue(new Uint8Array(next.value as Buffer));
      },
      async cancel() {
        await chunks.return?.();
      },
    });
    return Promise.resolve(
      new Response(body, { status: 200, headers: { 'content-length': String(size) } }),
    );
  };
}

/** Re-pins assets listed in the mirror's hashes.json; others keep their real hash. */
export function mirrorAssetOverride(hashes: MirrorHashes): (asset: AssetSpec) => AssetSpec {
  return (asset) => {
    const pinned = hashes[asset.fileName];
    return pinned === undefined
      ? asset
      : { ...asset, hash: { algo: 'sha256', value: pinned.sha256 }, bytes: pinned.bytes };
  };
}

function readMirrorHashes(dir: string): MirrorHashes {
  try {
    return mirrorHashesSchema.parse(
      JSON.parse(readFileSync(path.join(dir, MIRROR_HASHES_FILE), 'utf8')),
    );
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return {};
    throw error;
  }
}

/** Manager options of the hooks; `{}` when hooks are off or unset. */
export function whisperTestHooks(
  env: Readonly<Record<string, string | undefined>>,
  enabled: boolean,
): WhisperBaseOptions {
  if (!enabled) return {};
  const root = env[TEST_WHISPER_ROOT_ENV];
  const mirror = env[TEST_WHISPER_MIRROR_ENV];
  const options: { -readonly [Key in keyof WhisperBaseOptions]: WhisperBaseOptions[Key] } = {};
  if (root !== undefined && root !== '') options.root = path.resolve(root);
  if (mirror !== undefined && mirror !== '') {
    const delay = Number(env[TEST_WHISPER_DELAY_ENV] ?? '0');
    options.fetch = mirrorFetch(mirror, Number.isFinite(delay) ? delay : 0);
    options.assetOverride = mirrorAssetOverride(readMirrorHashes(mirror));
  }
  return options;
}

/** Free bytes on the drive of `dir` (its nearest existing parent); null when unknown. */
export async function diskFreeBytes(dir: string): Promise<number | null> {
  let current = path.resolve(dir);
  for (;;) {
    try {
      const stats = await statfs(current);
      return stats.bavail * stats.bsize;
    } catch {
      // Not created yet: try the parent.
      const parent = path.dirname(current);
      if (parent === current) return null;
      current = parent;
    }
  }
}
