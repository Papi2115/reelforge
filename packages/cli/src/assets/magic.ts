/**
 * File type by magic bytes (the server's Content-Type is never trusted): PNG, JPEG, WebP, GIF,
 * MP4 (ISO BMFF with an MP4 brand) and WebM (EBML with DocType "webm"). Everything else — SVG,
 * HTML, scripts, executables, archives, QuickTime/HEIC/Matroska — is rejected. Image sizes are
 * read from the headers when cheap.
 */
import type { AssetKind, AssetMime } from '@reelforge/shared';

export interface SniffedType {
  readonly mime: AssetMime;
  readonly kind: AssetKind;
  /** Safe file extension (no dot). */
  readonly ext: string;
}

/** Bytes needed to sniff any supported type. */
export const SNIFF_BYTES = 4096;

const MP4_BRANDS = new Set([
  'isom',
  'iso2',
  'iso4',
  'iso5',
  'iso6',
  'mp41',
  'mp42',
  'avc1',
  'dash',
  'M4V ',
  'mmp4',
]);

function ascii(bytes: Uint8Array, from: number, length: number): string {
  return String.fromCharCode(...bytes.subarray(from, from + length));
}

function startsWith(bytes: Uint8Array, signature: readonly number[], offset = 0): boolean {
  return signature.every((value, index) => bytes[offset + index] === value);
}

export function sniffType(bytes: Uint8Array): SniffedType | undefined {
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return { mime: 'image/png', kind: 'image', ext: 'png' };
  }
  if (startsWith(bytes, [0xff, 0xd8, 0xff]))
    return { mime: 'image/jpeg', kind: 'image', ext: 'jpg' };
  const gif = ascii(bytes, 0, 6);
  if (gif === 'GIF87a' || gif === 'GIF89a') return { mime: 'image/gif', kind: 'image', ext: 'gif' };
  if (ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'WEBP') {
    return { mime: 'image/webp', kind: 'image', ext: 'webp' };
  }
  if (ascii(bytes, 4, 4) === 'ftyp' && MP4_BRANDS.has(ascii(bytes, 8, 4))) {
    return { mime: 'video/mp4', kind: 'video', ext: 'mp4' };
  }
  if (startsWith(bytes, [0x1a, 0x45, 0xdf, 0xa3])) {
    // EBML header: DocType element 0x4282 followed by a size byte and "webm".
    const header = ascii(bytes, 0, Math.min(bytes.length, 64));
    if (header.includes('B\u0082\u0084webm')) {
      return { mime: 'video/webm', kind: 'video', ext: 'webm' };
    }
  }
  return undefined;
}

export interface Dimensions {
  readonly width: number;
  readonly height: number;
}

function pngSize(bytes: Uint8Array): Dimensions | undefined {
  if (bytes.length < 24 || ascii(bytes, 12, 4) !== 'IHDR') return undefined;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

function gifSize(bytes: Uint8Array): Dimensions | undefined {
  if (bytes.length < 10) return undefined;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: view.getUint16(6, true), height: view.getUint16(8, true) };
}

function jpegSize(bytes: Uint8Array): Dimensions | undefined {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 2;
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) return undefined;
    const marker = bytes[offset + 1] ?? 0;
    if (marker === 0xff) {
      offset += 1;
      continue;
    }
    const length = view.getUint16(offset + 2);
    const isFrame = marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);
    if (isFrame) return { width: view.getUint16(offset + 7), height: view.getUint16(offset + 5) };
    offset += 2 + length;
  }
  return undefined;
}

function webpSize(bytes: Uint8Array): Dimensions | undefined {
  if (bytes.length < 30) return undefined;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const chunk = ascii(bytes, 12, 4);
  const uint24 = (at: number): number => view.getUint16(at, true) + ((bytes[at + 2] ?? 0) << 16);
  if (chunk === 'VP8X') return { width: uint24(24) + 1, height: uint24(27) + 1 };
  if (chunk === 'VP8 ') {
    return { width: view.getUint16(26, true) & 0x3fff, height: view.getUint16(28, true) & 0x3fff };
  }
  if (chunk === 'VP8L') {
    const bits = view.getUint32(21, true);
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  }
  return undefined;
}

/** Pixel size of an image file's bytes, or undefined (videos, unreadable headers). */
export function imageDimensions(bytes: Uint8Array, mime: AssetMime): Dimensions | undefined {
  const size =
    mime === 'image/png'
      ? pngSize(bytes)
      : mime === 'image/gif'
        ? gifSize(bytes)
        : mime === 'image/jpeg'
          ? jpegSize(bytes)
          : mime === 'image/webp'
            ? webpSize(bytes)
            : undefined;
  return size !== undefined && size.width > 0 && size.height > 0 ? size : undefined;
}
