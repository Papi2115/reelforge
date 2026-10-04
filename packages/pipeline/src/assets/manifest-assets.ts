/**
 * The `assets` of a render manifest (PLAN.md#12.11): for every asset ref the scenes name (and
 * that assets.json lists), the decoded picture as base64 RGB. Nothing is shipped (and the
 * manifest stays exactly as before) when no scene names an asset.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { assetsFileSchema, type AssetRecord, type ManifestAsset } from '@reelforge/shared';
import { describeError } from '../ffmpeg/errors.js';
import { locateFfmpeg } from '../ffmpeg/locate.js';
import { err, ok, type Result } from '../result.js';
import { decodeAsset } from './decode.js';
import { refAt, referencedAssetRefs, refId } from './refs.js';

export interface ManifestAssetsInput {
  /** Project folder (assets.json, the files and the decoded cache live in it). */
  readonly root: string;
  /** Scene and project-prop sources of the video. */
  readonly sources: readonly string[];
  /** ffmpeg binary path, or why it is unavailable; only asked when a picture is not decoded yet. */
  readonly ffmpeg: () => Result<string, string>;
  readonly signal?: AbortSignal | undefined;
}

/** ffmpeg for decoding assets: the configured path, else REELFORGE_FFMPEG, PATH, common dirs. */
export function locateAssetFfmpeg(configuredPath?: string): Result<string, string> {
  const located = locateFfmpeg(configuredPath === undefined ? {} : { configuredPath });
  return located.ok ? ok(located.value.ffmpegPath) : err(located.error.message);
}

async function readCatalogue(root: string): Promise<Result<AssetRecord[], string>> {
  let text: string;
  try {
    text = await readFile(path.join(root, 'assets.json'), 'utf8');
  } catch (error) {
    const missing = (error as NodeJS.ErrnoException).code === 'ENOENT';
    return missing ? ok([]) : err(`assets.json cannot be read: ${describeError(error)}`);
  }
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (error) {
    return err(`assets.json is not valid JSON: ${describeError(error)}`);
  }
  const parsed = assetsFileSchema.safeParse(json);
  return parsed.success ? ok(parsed.data.assets) : err('assets.json does not match its schema');
}

/** Absolute path of a record's file, refused when it leaves the project folder. */
function assetPath(root: string, record: AssetRecord): Result<string, string> {
  const absolute = path.resolve(root, record.file);
  const relative = path.relative(path.resolve(root), absolute);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    return err(`asset ${record.id}: ${record.file} is outside the project folder`);
  }
  return ok(absolute);
}

/** Manifest assets for the refs the sources name; undefined when there are none. */
export async function loadManifestAssets(
  input: ManifestAssetsInput,
): Promise<Result<ManifestAsset[] | undefined, string>> {
  const usesAssets = input.sources.some((source) => /\bassets\s*\.\s*image\s*\(/.test(source));
  const catalogue = await readCatalogue(input.root);
  if (!catalogue.ok) return usesAssets ? catalogue : ok(undefined);
  const records = new Map(catalogue.value.map((record) => [record.id, record]));
  const refs = referencedAssetRefs(input.sources, new Set(records.keys()));
  if (refs.length === 0) return ok(undefined);
  const assets: ManifestAsset[] = [];
  for (const ref of refs) {
    const record = records.get(refId(ref));
    if (!record) continue;
    const file = assetPath(input.root, record);
    if (!file.ok) return file;
    const decoded = await decodeAsset({
      ffmpeg: input.ffmpeg,
      file: file.value,
      kind: record.kind,
      mime: record.mime,
      sha256: record.sha256,
      at: record.kind === 'video' ? refAt(ref) : undefined,
      projectDir: input.root,
      signal: input.signal,
    });
    if (!decoded.ok) return err(`asset ${ref} cannot be decoded: ${decoded.error}`);
    const { image, at } = decoded.value;
    assets.push({
      ref,
      id: record.id,
      file: record.file,
      mime: record.mime,
      sha256: record.sha256,
      ...(at === undefined ? {} : { at }),
      width: image.width,
      height: image.height,
      rgb: Buffer.from(image.data.buffer, image.data.byteOffset, image.data.byteLength).toString(
        'base64',
      ),
    });
  }
  return ok(assets);
}
