// Creates a throwaway "video project" folder for CLI probes: CLAUDE.md + a 64x64 two-colour PNG.
// Usage: node spikes/01-cli-bridge/make-project.mjs "<target dir>"   (the path may contain spaces)

import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { crc32, deflateSync } from 'node:zlib';

export const PROJECT_CODEWORD = 'MARMALADE-7';

/**
 * @param {string} type
 * @param {Buffer} data
 * @returns {Buffer}
 */
function pngChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData));
  return Buffer.concat([length, typeAndData, crc]);
}

/**
 * Encodes an RGB PNG whose left half is `left` and right half is `right`.
 * @param {number} size
 * @param {[number, number, number]} left
 * @param {[number, number, number]} right
 * @returns {Buffer}
 */
export function twoColourPng(size, left, right) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header.writeUInt8(8, 8); // bit depth
  header.writeUInt8(2, 9); // colour type: truecolour RGB
  const rows = [];
  for (let y = 0; y < size; y += 1) {
    const row = Buffer.alloc(1 + size * 3); // filter byte 0 = None
    for (let x = 0; x < size; x += 1) {
      const [r, g, b] = x < size / 2 ? left : right;
      row.writeUInt8(r, 1 + x * 3);
      row.writeUInt8(g, 2 + x * 3);
      row.writeUInt8(b, 3 + x * 3);
    }
    rows.push(row);
  }
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return Buffer.concat([
    signature,
    pngChunk('IHDR', header),
    pngChunk('IDAT', deflateSync(Buffer.concat(rows))),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

/** @param {string} dir */
export function makeProject(dir) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    path.join(dir, 'CLAUDE.md'),
    `# Probe project\n\nThe project codeword is ${PROJECT_CODEWORD}. Mention it when asked for the codeword.\n`,
    'utf8',
  );
  writeFileSync(path.join(dir, 'swatch.png'), twoColourPng(64, [20, 60, 230], [250, 210, 0]));
}

const invokedDirectly =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  const target = process.argv[2];
  if (target === undefined) throw new Error('usage: node make-project.mjs "<target dir>"');
  makeProject(target);
  process.stdout.write(`project created in ${target}\n`);
}
