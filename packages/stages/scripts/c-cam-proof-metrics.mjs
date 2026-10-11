// Measures the anti-slop frame metrics on the Grim Ink concept films' proof sheets
// (docs/concepts/c-cam-style/films/*/proof), the source of C_CAM_FRAME_BUDGETS
// (packages/stages/src/slop/c-cam-labels.ts, PLAN.md#14.19). Every 16:9 cell of a sheet is scaled
// to 1920x1080 (nearest) and measured with the guards' own frameMetrics (the built dist).
// Usage: pnpm exec tsc -b && node packages/stages/scripts/c-cam-proof-metrics.mjs
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { inflateSync } from 'node:zlib';

const root = path.resolve(import.meta.dirname, '..', '..', '..');
const guards = await import(
  pathToFileURL(path.join(root, 'packages', 'stages', 'dist', 'slop', 'frame-guards.js')).href
);
const films = path.join(root, 'docs', 'concepts', 'c-cam-style', 'films');
/** Sheet layout: three cells per row, `top` + row * `stride`, cell `width` x `height`. */
const SHEETS = [
  { film: '01-samurai-edo', sheet: 'sheet', width: 500, height: 281, top: 23, stride: 304.9 },
  { film: '02-papal-conclave', sheet: 'sheet', width: 480, height: 270, top: 30, stride: 300 },
  { film: '03-apollo-11', sheet: 'sheet', width: 480, height: 270, top: 30, stride: 300 },
  { film: '03-apollo-11', sheet: 'cuts', width: 480, height: 270, top: 30, stride: 300 },
];
const ACCENT = [0x9b, 0x82, 0x36]; // c-cam accent1 = mustard
const BACKGROUND = [22, 19, 15]; // the sheets' empty cells

/** RGB(A) 8-bit PNG decoder (all five filters). */
function decodePng(buffer) {
  let offset = 8;
  let [width, height, colourType] = [0, 0, 0];
  const data = [];
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    const body = buffer.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR')
      [width, height, colourType] = [body.readUInt32BE(0), body.readUInt32BE(4), body[9]];
    if (type === 'IDAT') data.push(body);
    offset += 12 + length;
  }
  const channels = colourType === 6 ? 4 : 3;
  const raw = inflateSync(Buffer.concat(data));
  const stride = width * channels;
  const pixels = new Uint8Array(width * height * 4);
  let [previous, current] = [new Uint8Array(stride), new Uint8Array(stride)];
  for (let y = 0; y < height; y += 1) {
    const filter = raw[y * (stride + 1)];
    for (let i = 0; i < stride; i += 1) {
      const left = i >= channels ? current[i - channels] : 0;
      const up = previous[i];
      const corner = i >= channels ? previous[i - channels] : 0;
      let value = raw[y * (stride + 1) + 1 + i];
      if (filter === 1) value += left;
      else if (filter === 2) value += up;
      else if (filter === 3) value += (left + up) >> 1;
      else if (filter === 4) {
        const guess = left + up - corner;
        const [a, b, c] = [Math.abs(guess - left), Math.abs(guess - up), Math.abs(guess - corner)];
        value += a <= b && a <= c ? left : b <= c ? up : corner;
      }
      current[i] = value & 255;
    }
    for (let x = 0; x < width; x += 1) {
      pixels.set(
        [current[x * channels], current[x * channels + 1], current[x * channels + 2], 255],
        (y * width + x) * 4,
      );
    }
    [previous, current] = [current, previous];
  }
  return { width, height, data: pixels };
}

function cell(image, x0, y0, width, height) {
  const [W, H] = [1920, 1080];
  const data = new Uint8Array(W * H * 4);
  for (let y = 0; y < H; y += 1) {
    const sy = y0 + Math.floor((y * height) / H);
    for (let x = 0; x < W; x += 1) {
      const source = (sy * image.width + x0 + Math.floor((x * width) / W)) * 4;
      data.set(image.data.subarray(source, source + 4), (y * W + x) * 4);
    }
  }
  return { width: W, height: H, data };
}

function empty(image, x0, y0, width, height) {
  let [same, total] = [0, 0];
  for (let y = y0; y < y0 + height; y += 7) {
    for (let x = x0; x < x0 + width; x += 7) {
      const o = (y * image.width + x) * 4;
      const distance = [0, 1, 2].reduce(
        (sum, c) => sum + Math.abs(image.data[o + c] - BACKGROUND[c]),
        0,
      );
      total += 1;
      if (distance < 12) same += 1;
    }
  }
  return same / total > 0.95;
}

const frames = [];
for (const sheet of SHEETS) {
  const image = decodePng(
    readFileSync(path.join(films, sheet.film, 'proof', `${sheet.sheet}.png`)),
  );
  for (let row = 0; ; row += 1) {
    const y0 = Math.round(sheet.top + row * sheet.stride);
    if (y0 + sheet.height > image.height) break;
    for (let column = 0; column < 3; column += 1) {
      const x0 = column * sheet.width;
      if (empty(image, x0, y0, sheet.width, sheet.height)) continue;
      const metrics = guards.frameMetrics(cell(image, x0, y0, sheet.width, sheet.height), ACCENT);
      frames.push({ sheet: `${sheet.film}/${sheet.sheet}`, row, column, ...metrics });
    }
  }
}
const summary = (key, list = frames) => {
  const values = list.map((frame) => frame[key]).sort((a, b) => a - b);
  const at = (share) => values[Math.min(values.length - 1, Math.floor(values.length * share))];
  return { p50: at(0.5), p90: at(0.9), max: values.at(-1) };
};
const centred = frames.filter((frame) => frame.centroidOffset <= 0.05 && frame.heroOffset <= 0.05);
const report = {
  frames: frames.length,
  competing: summary('competing'),
  accentShare: summary('accentShare'),
  mirrorOfCentredFrames: summary('mirror', centred),
};
process.stdout.write(`${JSON.stringify(report, null, 2)}
`);
