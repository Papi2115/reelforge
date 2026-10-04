/**
 * Pure pixel helpers of the asset pipeline (PLAN.md#12.11, ADR-014): PAM (P7) read/write - the
 * format ffmpeg decodes into and the decoded cache uses - and the integer area downscale that
 * bounds what a render manifest carries. Same input, same bytes, on every platform.
 */
import { ASSET_SOURCE_MAX_EDGE } from '@reelforge/shared';

/** Decoded picture: 8-bit samples, `channels` per pixel (3 = RGB, 4 = RGBA), rows top-down. */
export interface RasterImage {
  readonly width: number;
  readonly height: number;
  readonly channels: 3 | 4;
  readonly data: Uint8Array;
}

const TUPLE_TYPES: Readonly<Record<number, string>> = { 3: 'RGB', 4: 'RGB_ALPHA' };

export function encodePam(image: RasterImage): Buffer {
  const header =
    `P7\nWIDTH ${String(image.width)}\nHEIGHT ${String(image.height)}\nDEPTH ${String(image.channels)}\n` +
    `MAXVAL 255\nTUPLTYPE ${TUPLE_TYPES[image.channels] ?? 'RGB'}\nENDHDR\n`;
  return Buffer.concat([Buffer.from(header, 'latin1'), image.data]);
}

/** Reads an 8-bit RGB or RGBA PAM; throws a descriptive Error for anything else. */
export function decodePam(file: Uint8Array): RasterImage {
  const bytes = Buffer.from(file.buffer, file.byteOffset, file.byteLength);
  const end = bytes.indexOf('ENDHDR\n', 0, 'latin1');
  if (bytes.toString('latin1', 0, 3) !== 'P7\n' || end < 0) throw new Error('not a PAM (P7) file');
  const fields = new Map<string, string>();
  for (const line of bytes.toString('latin1', 3, end).split('\n')) {
    const [key, ...rest] = line.trim().split(/\s+/);
    if (key !== undefined && key !== '' && !key.startsWith('#')) fields.set(key, rest.join(' '));
  }
  const width = Number(fields.get('WIDTH'));
  const height = Number(fields.get('HEIGHT'));
  const depth = Number(fields.get('DEPTH'));
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) {
    throw new Error('PAM: invalid size');
  }
  if ((depth !== 3 && depth !== 4) || fields.get('MAXVAL') !== '255') {
    throw new Error(`PAM: only 8-bit RGB/RGBA is supported (DEPTH ${String(depth)})`);
  }
  const start = end + 'ENDHDR\n'.length;
  const length = width * height * depth;
  if (bytes.length < start + length) throw new Error('PAM: truncated pixel data');
  return {
    width,
    height,
    channels: depth,
    data: new Uint8Array(bytes.subarray(start, start + length)),
  };
}

/** Size that fits `maxEdge` keeping the aspect (never upscales). */
export function fittedSize(
  width: number,
  height: number,
  maxEdge: number,
): { readonly width: number; readonly height: number } {
  const longest = Math.max(width, height);
  if (longest <= maxEdge) return { width, height };
  return {
    width: Math.max(1, Math.round((width * maxEdge) / longest)),
    height: Math.max(1, Math.round((height * maxEdge) / longest)),
  };
}

/**
 * RGB of `image` downscaled by area averaging so its longest edge is at most `maxEdge`
 * (integers only; alpha is composited over black, which is what the opaque frame would show).
 */
export function normalizeRaster(image: RasterImage, maxEdge = ASSET_SOURCE_MAX_EDGE): RasterImage {
  const size = fittedSize(image.width, image.height, maxEdge);
  const out = new Uint8Array(size.width * size.height * 3);
  const spanX = Int32Array.from({ length: size.width + 1 }, (_, index) =>
    Math.floor((index * image.width) / size.width),
  );
  const spanY = Int32Array.from({ length: size.height + 1 }, (_, index) =>
    Math.floor((index * image.height) / size.height),
  );
  const { channels, data } = image;
  for (let ty = 0; ty < size.height; ty += 1) {
    const y0 = spanY[ty] ?? 0;
    const y1 = Math.max(y0 + 1, spanY[ty + 1] ?? 0);
    for (let tx = 0; tx < size.width; tx += 1) {
      const x0 = spanX[tx] ?? 0;
      const x1 = Math.max(x0 + 1, spanX[tx + 1] ?? 0);
      let r = 0;
      let g = 0;
      let b = 0;
      for (let y = y0; y < y1; y += 1) {
        for (let x = x0; x < x1; x += 1) {
          const at = (y * image.width + x) * channels;
          const alpha = channels === 4 ? (data[at + 3] ?? 255) : 255;
          r += Math.floor(((data[at] ?? 0) * alpha + 127) / 255);
          g += Math.floor(((data[at + 1] ?? 0) * alpha + 127) / 255);
          b += Math.floor(((data[at + 2] ?? 0) * alpha + 127) / 255);
        }
      }
      const count = (y1 - y0) * (x1 - x0);
      const target = (ty * size.width + tx) * 3;
      out[target] = Math.floor((2 * r + count) / (2 * count));
      out[target + 1] = Math.floor((2 * g + count) / (2 * count));
      out[target + 2] = Math.floor((2 * b + count) / (2 * count));
    }
  }
  return { width: size.width, height: size.height, channels: 3, data: out };
}
