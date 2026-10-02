/**
 * Minimal PNG codec for golden frames: writes 8-bit RGBA, non-interlaced, filter 0; reads back
 * only files of that exact shape (which is all this harness produces). Uses node:zlib only.
 */
import { deflateSync, inflateSync } from 'node:zlib';

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export interface RgbaImage {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8Array;
}

const CRC_TABLE = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = (CRC_TABLE[(crc ^ byte) & 0xff] ?? 0) ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type: string, payload: Buffer): Buffer {
  const typeAndPayload = Buffer.concat([Buffer.from(type, 'latin1'), payload]);
  const header = Buffer.alloc(4);
  header.writeUInt32BE(payload.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndPayload));
  return Buffer.concat([header, typeAndPayload, crc]);
}

export function encodePng(image: RgbaImage): Buffer {
  const { width, height, data } = image;
  if (data.length !== width * height * 4)
    throw new RangeError('encodePng: data is not width*height*4 bytes');
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([8, 6, 0, 0, 0], 8); // bit depth 8, colour type RGBA, deflate, filter set 0, no interlace
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let row = 0; row < height; row += 1) {
    raw.set(data.subarray(row * stride, (row + 1) * stride), row * (stride + 1) + 1);
  }
  return Buffer.concat([
    SIGNATURE,
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

export function decodePng(file: Buffer): RgbaImage {
  if (!file.subarray(0, 8).equals(SIGNATURE)) throw new Error('decodePng: not a PNG');
  let offset = 8;
  let width = 0;
  let height = 0;
  const idat: Buffer[] = [];
  while (offset < file.length) {
    const length = file.readUInt32BE(offset);
    const type = file.toString('latin1', offset + 4, offset + 8);
    const payload = file.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = payload.readUInt32BE(0);
      height = payload.readUInt32BE(4);
      if (!payload.subarray(8, 13).equals(Buffer.from([8, 6, 0, 0, 0]))) {
        throw new Error('decodePng: only 8-bit RGBA non-interlaced PNGs are supported');
      }
    } else if (type === 'IDAT') {
      idat.push(payload);
    }
    offset += 12 + length;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * 4;
  const data = new Uint8Array(stride * height);
  for (let row = 0; row < height; row += 1) {
    if (raw[row * (stride + 1)] !== 0)
      throw new Error('decodePng: only filter type 0 is supported');
    data.set(raw.subarray(row * (stride + 1) + 1, (row + 1) * (stride + 1)), row * stride);
  }
  return { width, height, data };
}
