/**
 * Test-only: a whisper download mirror folder (REELFORGE_TEST_WHISPER_MIRROR) with tiny stand-ins
 * for the release zips (whisper-cli.exe + whisper-vad-speech-segments.exe that are not runnable),
 * the models and the VAD model, plus `hashes.json` re-pinning them. Nothing real is downloaded.
 */
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { crc32 } from 'node:zlib';
import {
  SILERO_VAD_MODEL,
  WHISPER_BINARIES,
  WHISPER_MODEL_IDS,
  WHISPER_MODELS,
  type WhisperModelId,
} from '@reelforge/pipeline';
import { MIRROR_HASHES_FILE, type MirrorHashes } from '../test-hooks.js';

/** A .zip with stored (uncompressed) entries. */
export function storedZip(entries: readonly { name: string; data: Buffer }[]): Buffer {
  const parts: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.name, 'utf8');
    const crc = crc32(entry.data) >>> 0;
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x800, 6);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(entry.data.length, 18);
    local.writeUInt32LE(entry.data.length, 22);
    local.writeUInt16LE(name.length, 26);
    const header = Buffer.alloc(46);
    header.writeUInt32LE(0x02014b50, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(20, 6);
    header.writeUInt16LE(0x800, 8);
    header.writeUInt32LE(crc, 16);
    header.writeUInt32LE(entry.data.length, 20);
    header.writeUInt32LE(entry.data.length, 24);
    header.writeUInt16LE(name.length, 28);
    header.writeUInt32LE(offset, 42);
    parts.push(local, name, entry.data);
    central.push(header, name);
    offset += local.length + name.length + entry.data.length;
  }
  const directory = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, directory, end]);
}

export interface FakeMirrorOptions {
  /** Size of each fake model file (bigger = visible progress with a delay). Default 64 KB. */
  readonly modelBytes?: number;
  /** Leave whisper-cli.exe out of the zips (antivirus quarantine). */
  readonly withoutCli?: boolean;
  readonly models?: readonly WhisperModelId[];
}

/** Writes the mirror into `dir`; returns the re-pinned hashes. */
export async function writeFakeMirror(
  dir: string,
  options: FakeMirrorOptions = {},
): Promise<MirrorHashes> {
  await mkdir(dir, { recursive: true });
  const hashes: MirrorHashes = {};
  const put = async (fileName: string, data: Buffer): Promise<void> => {
    await writeFile(path.join(dir, fileName), data);
    hashes[fileName] = {
      sha256: createHash('sha256').update(data).digest('hex'),
      bytes: data.length,
    };
  };
  const files = [
    ...(options.withoutCli === true
      ? []
      : [{ name: 'Release/whisper-cli.exe', data: Buffer.from('fake whisper-cli') }]),
    { name: 'Release/whisper-vad-speech-segments.exe', data: Buffer.from('fake vad tool') },
  ];
  for (const asset of Object.values(WHISPER_BINARIES)) await put(asset.fileName, storedZip(files));
  const modelBytes = options.modelBytes ?? 64 * 1024;
  await put(SILERO_VAD_MODEL.fileName, Buffer.alloc(4096, 1));
  for (const model of options.models ?? WHISPER_MODEL_IDS) {
    await put(WHISPER_MODELS[model].fileName, Buffer.alloc(modelBytes, model.length));
  }
  await writeFile(path.join(dir, MIRROR_HASHES_FILE), JSON.stringify(hashes, null, 2));
  return hashes;
}
