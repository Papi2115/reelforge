/**
 * A minimal TrueType writer for the pixel title face (PLAN.md#13.12, U13): rectangle outlines only
 * (on-curve points, no hinting), the ten tables browsers require (cmap, glyf, head, hhea, hmtx,
 * loca, maxp, name, OS/2, post). Output is a pure function of the input: fixed dates, sorted
 * tables, no compression, so the checked-in file can be rebuilt byte for byte.
 */
import { EM_PIXELS, UNITS_PER_PIXEL, type PixelFaceGlyph } from './pixel-face-glyphs.js';

export interface FaceMetrics {
  /** Bitmap rows above the baseline / below it that the line reserves. */
  readonly ascentPixels: number;
  readonly descentPixels: number;
  readonly capHeightPixels: number;
}

export interface FaceNames {
  readonly family: string;
  readonly postScript: string;
  readonly version: string;
  readonly copyright: string;
  readonly license: string;
  readonly licenseUrl: string;
}

/** 2026-10-07T00:00:00Z as seconds since 1904-01-01 (head.created / head.modified). */
const FONT_TIMESTAMP = 2_082_844_800 + Date.UTC(2026, 9, 7) / 1000;
const UNITS_PER_EM = EM_PIXELS * UNITS_PER_PIXEL;

class Bytes {
  private readonly parts: number[] = [];
  get length(): number {
    return this.parts.length;
  }
  u8(value: number): this {
    this.parts.push(value & 0xff);
    return this;
  }
  u16(value: number): this {
    return this.u8(value >>> 8).u8(value);
  }
  i16(value: number): this {
    return this.u16(value < 0 ? value + 0x1_0000 : value);
  }
  u32(value: number): this {
    return this.u16(Math.floor(value / 0x1_0000) & 0xffff).u16(value & 0xffff);
  }
  u16s(values: readonly number[]): this {
    for (const value of values) this.u16(value);
    return this;
  }
  i16s(values: readonly number[]): this {
    for (const value of values) this.i16(value);
    return this;
  }
  u32s(values: readonly number[]): this {
    for (const value of values) this.u32(value);
    return this;
  }
  bytes(values: Iterable<number>): this {
    for (const value of values) this.u8(value);
    return this;
  }
  pad4(): this {
    while (this.parts.length % 4 !== 0) this.u8(0);
    return this;
  }
  done(): Uint8Array {
    return Uint8Array.from(this.parts);
  }
}

interface Box {
  readonly xMin: number;
  readonly yMin: number;
  readonly xMax: number;
  readonly yMax: number;
}

interface Outline {
  readonly advance: number;
  readonly box: Box | undefined;
  readonly data: Uint8Array;
  readonly points: number;
  readonly contours: number;
}

/** One clockwise 4-point contour per rectangle (y up, baseline at 0, cap line at capHeight). */
function outline(glyph: PixelFaceGlyph, capHeight: number): Outline {
  const advance = glyph.advance * UNITS_PER_PIXEL;
  if (glyph.rects.length === 0) {
    return { advance, box: undefined, data: new Uint8Array(), points: 0, contours: 0 };
  }
  const points = glyph.rects.flatMap((rect) => {
    const [x0, x1] = [rect.left * UNITS_PER_PIXEL, rect.right * UNITS_PER_PIXEL];
    const [y0, y1] = [
      (capHeight - rect.bottom) * UNITS_PER_PIXEL,
      (capHeight - rect.top) * UNITS_PER_PIXEL,
    ];
    return [
      [x0, y0],
      [x0, y1],
      [x1, y1],
      [x1, y0],
    ] as const;
  });
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  const box = {
    xMin: Math.min(...xs),
    yMin: Math.min(...ys),
    xMax: Math.max(...xs),
    yMax: Math.max(...ys),
  };
  const data = new Bytes()
    .i16(glyph.rects.length)
    .i16(box.xMin)
    .i16(box.yMin)
    .i16(box.xMax)
    .i16(box.yMax);
  glyph.rects.forEach((_, index) => data.u16(index * 4 + 3));
  data.u16(0); // no instructions
  points.forEach(() => data.u8(0x01)); // on-curve, long signed deltas
  let previous = 0;
  for (const x of xs) {
    data.i16(x - previous);
    previous = x;
  }
  previous = 0;
  for (const y of ys) {
    data.i16(y - previous);
    previous = y;
  }
  return {
    advance,
    box,
    data: data.pad4().done(),
    points: points.length,
    contours: glyph.rects.length,
  };
}

function ascii(text: string): number[] {
  return Array.from(text, (char) => char.charCodeAt(0));
}

function unionBox(boxes: readonly Box[]): Box {
  return {
    xMin: Math.min(...boxes.map((box) => box.xMin)),
    yMin: Math.min(...boxes.map((box) => box.yMin)),
    xMax: Math.max(...boxes.map((box) => box.xMax)),
    yMax: Math.max(...boxes.map((box) => box.yMax)),
  };
}

/** cmap format 4 (BMP), referenced by the Unicode and the Windows Unicode BMP records. */
function cmapTable(glyphs: readonly PixelFaceGlyph[]): Uint8Array {
  const pairs = glyphs
    .flatMap((glyph, index) => glyph.codePoints.map((code) => ({ code, glyph: index + 1 })))
    .sort((a, b) => a.code - b.code);
  const segments: { start: number; end: number; delta: number }[] = [];
  for (const { code, glyph } of pairs) {
    const last = segments.at(-1);
    const delta = (glyph - code + 0x1_0000) % 0x1_0000;
    if (last !== undefined && last.end === code - 1 && last.delta === delta) last.end = code;
    else segments.push({ start: code, end: code, delta });
  }
  segments.push({ start: 0xffff, end: 0xffff, delta: 1 });
  const count = segments.length;
  const searchRange = 2 ** Math.floor(Math.log2(count)) * 2;
  const sub = new Bytes()
    .u16(4)
    .u16(16 + count * 8)
    .u16(0)
    .u16(count * 2)
    .u16(searchRange)
    .u16(Math.log2(searchRange / 2))
    .u16(count * 2 - searchRange);
  segments.forEach((segment) => sub.u16(segment.end));
  sub.u16(0);
  segments.forEach((segment) => sub.u16(segment.start));
  segments.forEach((segment) => sub.u16(segment.delta));
  segments.forEach(() => sub.u16(0));
  const records = 2;
  return new Bytes()
    .u16(0)
    .u16(records)
    .u16(0)
    .u16(3)
    .u32(4 + records * 8)
    .u16(3)
    .u16(1)
    .u32(4 + records * 8)
    .bytes(sub.done())
    .done();
}

function nameTable(names: FaceNames): Uint8Array {
  const strings: [number, string][] = [
    [0, names.copyright],
    [1, names.family],
    [2, 'Regular'],
    [3, `${names.family} Regular ${names.version}`],
    [4, names.family],
    [5, `Version ${names.version}`],
    [6, names.postScript],
    [13, names.license],
    [14, names.licenseUrl],
  ];
  const storage = new Bytes();
  const header = new Bytes()
    .u16(0)
    .u16(strings.length)
    .u16(6 + strings.length * 12);
  for (const [id, text] of strings) {
    const offset = storage.length;
    for (const char of text) storage.u16(char.charCodeAt(0));
    header
      .u16(3)
      .u16(1)
      .u16(0x0409)
      .u16(id)
      .u16(storage.length - offset)
      .u16(offset);
  }
  return new Bytes().bytes(header.done()).bytes(storage.done()).done();
}

function checksum(table: Uint8Array): number {
  let sum = 0;
  for (let offset = 0; offset < table.length; offset += 4) {
    const word =
      (table[offset] ?? 0) * 0x100_0000 +
      ((table[offset + 1] ?? 0) << 16) +
      ((table[offset + 2] ?? 0) << 8) +
      (table[offset + 3] ?? 0);
    sum = (sum + word) % 0x1_0000_0000;
  }
  return sum;
}

/** Builds the font file: glyph 0 is `.notdef`, then `glyphs` in order. */
export function writeTrueType(
  notdef: PixelFaceGlyph,
  glyphs: readonly PixelFaceGlyph[],
  metrics: FaceMetrics,
  names: FaceNames,
): Uint8Array {
  const outlines = [notdef, ...glyphs].map((glyph) => outline(glyph, metrics.capHeightPixels));
  const boxes = outlines.flatMap((item) => (item.box === undefined ? [] : [item.box]));
  const bounds = unionBox(boxes);
  const ascent = metrics.ascentPixels * UNITS_PER_PIXEL;
  const descent = metrics.descentPixels * UNITS_PER_PIXEL;
  const glyf = new Bytes();
  const loca = new Bytes();
  const hmtx = new Bytes();
  for (const item of outlines) {
    loca.u32(glyf.length);
    glyf.bytes(item.data);
    hmtx.u16(item.advance).i16(item.box?.xMin ?? 0);
  }
  loca.u32(glyf.length);
  const inked = outlines.filter((item) => item.box !== undefined);
  const lsbs = inked.map((item) => item.box?.xMin ?? 0);
  const rsbs = inked.map((item) => item.advance - (item.box?.xMax ?? 0));
  const advances = outlines.map((item) => item.advance).filter((advance) => advance > 0);
  const codes = glyphs.flatMap((glyph) => glyph.codePoints);

  const head = new Bytes()
    .u32s([0x0001_0000, 0x0001_0000, 0, 0x5f0f_3cf5])
    // flags: baseline at y = 0, integer scaling; dates: created, modified.
    .u16s([0b1001, UNITS_PER_EM])
    .u32s([0, FONT_TIMESTAMP, 0, FONT_TIMESTAMP])
    .i16s([bounds.xMin, bounds.yMin, bounds.xMax, bounds.yMax])
    // macStyle, lowestRecPPEM, fontDirectionHint, indexToLocFormat (long), glyphDataFormat.
    .i16s([0, 8, 2, 1, 0]);
  const hhea = new Bytes()
    .u32(0x0001_0000)
    .i16s([ascent, -descent, 0])
    .u16(Math.max(...advances))
    .i16s([Math.min(...lsbs), Math.min(...rsbs), bounds.xMax])
    // caret rise / run / offset, four reserved, metricDataFormat.
    .i16s([1, 0, 0, 0, 0, 0, 0, 0])
    .u16(outlines.length);
  const maxp = new Bytes()
    .u32(0x0001_0000)
    .u16s([outlines.length, maxOf(outlines, 'points'), maxOf(outlines, 'contours')])
    // composite points / contours, zones, then twilight points .. component depth: none.
    .u16s([0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0]);
  const os2 = os2Table({ advances, codes, ascent, descent, capHeight: metrics.capHeightPixels });
  const post = new Bytes()
    .u32s([0x0003_0000, 0])
    .i16s([-UNITS_PER_PIXEL, UNITS_PER_PIXEL])
    .u32s([0, 0, 0, 0, 0]);

  const tables: [string, Uint8Array][] = [
    ['OS/2', os2],
    ['cmap', cmapTable(glyphs)],
    ['glyf', glyf.done()],
    ['head', head.done()],
    ['hhea', hhea.done()],
    ['hmtx', hmtx.done()],
    ['loca', loca.done()],
    ['maxp', maxp.done()],
    ['name', nameTable(names)],
    ['post', post.done()],
  ];
  return assemble(tables);
}

function maxOf(outlines: readonly Outline[], field: 'points' | 'contours'): number {
  return Math.max(...outlines.map((item) => item[field]));
}

interface Os2Inputs {
  readonly advances: readonly number[];
  readonly codes: readonly number[];
  readonly ascent: number;
  readonly descent: number;
  readonly capHeight: number;
}

/** OS/2 version 4. */
function os2Table(inputs: Os2Inputs): Uint8Array {
  const pixel = UNITS_PER_PIXEL;
  const { advances, codes, ascent, descent } = inputs;
  const average = advances.reduce((sum, advance) => sum + advance, 0) / advances.length;
  return (
    new Bytes()
      // version, xAvgCharWidth, weight (regular), width (normal), fsType (installable).
      .u16(4)
      .i16(Math.round(average))
      .u16s([400, 5, 0])
      // Subscript and superscript size / offset, strikeout size / position, family class.
      .i16s([6 * pixel, 6 * pixel, 0, pixel, 6 * pixel, 6 * pixel, 0, 4 * pixel])
      .i16s([pixel, 3 * pixel, 0])
      .bytes(new Uint8Array(10))
      // Unicode ranges: Basic Latin, Latin-1 Supplement, Latin Extended-A, General Punctuation;
      // Currency Symbols.
      .u32s([0x8000_0007, 0b10, 0, 0])
      .bytes(ascii('NONE'))
      // fsSelection: REGULAR | USE_TYPO_METRICS; first and last character.
      .u16s([0x40 | 0x80, Math.min(...codes), Math.min(0xffff, Math.max(...codes))])
      .i16s([ascent, -descent, 0])
      .u16s([ascent, descent])
      // Code pages 1252 (Latin 1) and 1250 (Latin 2: Polish).
      .u32s([0b11, 0])
      .i16s([inputs.capHeight * pixel, inputs.capHeight * pixel])
      // default char (.notdef), break char (space), max context.
      .u16s([0, 0x20, 1])
      .done()
  );
}

/** Table directory + 4-byte aligned tables + head.checkSumAdjustment. */
function assemble(tables: readonly [string, Uint8Array][]): Uint8Array {
  const count = tables.length;
  const searchRange = 2 ** Math.floor(Math.log2(count)) * 16;
  const directory = new Bytes()
    .u32(0x0001_0000)
    .u16(count)
    .u16(searchRange)
    .u16(Math.log2(searchRange / 16))
    .u16(count * 16 - searchRange);
  const body = new Bytes();
  let offset = 12 + count * 16;
  let headOffset = 0;
  for (const [tag, data] of tables) {
    if (tag === 'head') headOffset = offset;
    directory.bytes(ascii(tag));
    directory.u32(checksum(data)).u32(offset).u32(data.length);
    body.bytes(data).pad4();
    offset = 12 + count * 16 + body.length;
  }
  const font = new Bytes().bytes(directory.done()).bytes(body.done()).done();
  const adjustment = (0xb1b0_afba - checksum(font) + 0x1_0000_0000) % 0x1_0000_0000;
  new DataView(font.buffer).setUint32(headOffset + 8, adjustment);
  return font;
}
