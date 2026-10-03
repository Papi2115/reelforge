/**
 * Minimal streaming .zip extractor (stored + deflate, zip64 sizes/offsets, CRC-32 checked) so
 * installing whisper.cpp needs no external tool (Git Bash tar cannot read zips; ADR-003).
 */
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, open, type FileHandle } from 'node:fs/promises';
import path from 'node:path';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createInflateRaw, crc32 } from 'node:zlib';
import { systemErrorCode, type WhisperError } from './errors.js';
import { err, ok, type Result } from '../result.js';

const EOCD_SIGNATURE = 0x06054b50;
const ZIP64_LOCATOR_SIGNATURE = 0x07064b50;
const ZIP64_EOCD_SIGNATURE = 0x06064b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const LOCAL_SIGNATURE = 0x04034b50;
const MAX_COMMENT = 0xffff;
const U32_MAX = 0xffffffff;

interface ZipEntry {
  readonly name: string;
  readonly method: number;
  readonly crc: number;
  readonly compressedSize: number;
  readonly size: number;
  readonly localHeaderOffset: number;
}

async function readAt(handle: FileHandle, position: number, length: number): Promise<Buffer> {
  const buffer = Buffer.alloc(length);
  const { bytesRead } = await handle.read(buffer, 0, length, position);
  return buffer.subarray(0, bytesRead);
}

function bigToNumber(value: bigint): number {
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('zip64 value too large');
  return Number(value);
}

/** Locates the central directory (offset, entry count), following the zip64 locator if present. */
async function centralDirectory(
  handle: FileHandle,
  fileSize: number,
): Promise<{ offset: number; count: number }> {
  const tailLength = Math.min(fileSize, MAX_COMMENT + 22);
  const tail = await readAt(handle, fileSize - tailLength, tailLength);
  let eocd = -1;
  for (let k = tail.length - 22; k >= 0; k--) {
    if (tail.readUInt32LE(k) === EOCD_SIGNATURE) {
      eocd = k;
      break;
    }
  }
  if (eocd < 0) throw new Error('not a zip file (no end-of-central-directory record)');
  let count = tail.readUInt16LE(eocd + 10);
  let offset = tail.readUInt32LE(eocd + 16);
  const locatorAt = eocd - 20;
  if (locatorAt >= 0 && tail.readUInt32LE(locatorAt) === ZIP64_LOCATOR_SIGNATURE) {
    const zip64At = bigToNumber(tail.readBigUInt64LE(locatorAt + 8));
    const record = await readAt(handle, zip64At, 56);
    if (record.readUInt32LE(0) !== ZIP64_EOCD_SIGNATURE) throw new Error('broken zip64 record');
    count = bigToNumber(record.readBigUInt64LE(32));
    offset = bigToNumber(record.readBigUInt64LE(48));
  }
  return { offset, count };
}

/** Applies the zip64 extended-information extra field to fields stored as 0xFFFFFFFF. */
function applyZip64(extra: Buffer, entry: ZipEntry): ZipEntry {
  let k = 0;
  while (k + 4 <= extra.length) {
    const id = extra.readUInt16LE(k);
    const length = extra.readUInt16LE(k + 2);
    if (id === 0x0001) {
      let cursor = k + 4;
      const next = (): number => {
        const value = bigToNumber(extra.readBigUInt64LE(cursor));
        cursor += 8;
        return value;
      };
      const size = entry.size === U32_MAX ? next() : entry.size;
      const compressedSize = entry.compressedSize === U32_MAX ? next() : entry.compressedSize;
      const localHeaderOffset =
        entry.localHeaderOffset === U32_MAX ? next() : entry.localHeaderOffset;
      return { ...entry, size, compressedSize, localHeaderOffset };
    }
    k += 4 + length;
  }
  return entry;
}

async function listZipEntries(zipPath: string): Promise<ZipEntry[]> {
  const handle = await open(zipPath, 'r');
  try {
    const { size } = await handle.stat();
    const { offset, count } = await centralDirectory(handle, size);
    const directory = await readAt(handle, offset, size - offset);
    const entries: ZipEntry[] = [];
    let k = 0;
    for (let n = 0; n < count; n++) {
      if (directory.readUInt32LE(k) !== CENTRAL_SIGNATURE)
        throw new Error('broken central directory');
      const flags = directory.readUInt16LE(k + 8);
      const nameLength = directory.readUInt16LE(k + 28);
      const extraLength = directory.readUInt16LE(k + 30);
      const commentLength = directory.readUInt16LE(k + 32);
      const nameBytes = directory.subarray(k + 46, k + 46 + nameLength);
      const base: ZipEntry = {
        // Bit 11 = UTF-8 names; otherwise CP437, which is ASCII for the names we expect.
        name: nameBytes.toString((flags & 0x800) !== 0 ? 'utf8' : 'latin1'),
        method: directory.readUInt16LE(k + 10),
        crc: directory.readUInt32LE(k + 16),
        compressedSize: directory.readUInt32LE(k + 20),
        size: directory.readUInt32LE(k + 24),
        localHeaderOffset: directory.readUInt32LE(k + 42),
      };
      const extra = directory.subarray(k + 46 + nameLength, k + 46 + nameLength + extraLength);
      entries.push(applyZip64(extra, base));
      k += 46 + nameLength + extraLength + commentLength;
    }
    return entries;
  } finally {
    await handle.close();
  }
}

/** Resolves an entry name inside `destDir`, rejecting absolute paths and `..` (zip slip). */
function safeEntryPath(destDir: string, name: string): string {
  const parts = name.split(/[\\/]+/).filter((part) => part !== '' && part !== '.');
  if (/^[a-zA-Z]:/.test(name) || name.startsWith('/') || parts.includes('..')) {
    throw new Error(`unsafe path in zip: ${name}`);
  }
  return path.join(destDir, ...parts);
}

async function extractEntry(
  zipPath: string,
  handle: FileHandle,
  entry: ZipEntry,
  target: string,
): Promise<void> {
  const header = await readAt(handle, entry.localHeaderOffset, 30);
  if (header.readUInt32LE(0) !== LOCAL_SIGNATURE)
    throw new Error(`broken local header: ${entry.name}`);
  const dataStart =
    entry.localHeaderOffset + 30 + header.readUInt16LE(26) + header.readUInt16LE(28);
  await mkdir(path.dirname(target), { recursive: true });
  let crc = 0;
  let written = 0;
  const check = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      crc = crc32(chunk, crc);
      written += chunk.length;
      callback(null, chunk);
    },
  });
  const source =
    entry.compressedSize === 0
      ? [Buffer.alloc(0)]
      : createReadStream(zipPath, { start: dataStart, end: dataStart + entry.compressedSize - 1 });
  if (entry.method === 0) await pipeline(source, check, createWriteStream(target));
  else if (entry.method === 8)
    await pipeline(source, createInflateRaw(), check, createWriteStream(target));
  else throw new Error(`unsupported compression method ${String(entry.method)}: ${entry.name}`);
  if (written !== entry.size || crc >>> 0 !== entry.crc >>> 0) {
    throw new Error(`corrupt zip entry (size/CRC mismatch): ${entry.name}`);
  }
}

/** Extracts every entry into `destDir`; returns the extracted file paths. */
export async function extractZip(
  zipPath: string,
  destDir: string,
): Promise<Result<string[], WhisperError>> {
  try {
    return ok(await extractAll(zipPath, destDir));
  } catch (error) {
    return err({
      kind: 'extract-failed',
      message: `cannot extract ${path.basename(zipPath)}: ${error instanceof Error ? error.message : String(error)}`,
      path: zipPath,
      code: systemErrorCode(error),
    });
  }
}

async function extractAll(zipPath: string, destDir: string): Promise<string[]> {
  const entries = await listZipEntries(zipPath);
  const handle = await open(zipPath, 'r');
  const files: string[] = [];
  try {
    for (const entry of entries) {
      const target = safeEntryPath(destDir, entry.name);
      if (entry.name.endsWith('/') || entry.name.endsWith('\\')) {
        await mkdir(target, { recursive: true });
        continue;
      }
      await extractEntry(zipPath, handle, entry, target);
      files.push(target);
    }
  } finally {
    await handle.close();
  }
  return files;
}
