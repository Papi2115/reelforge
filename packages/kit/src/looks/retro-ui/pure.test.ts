import { describe, expect, it } from 'vitest';
import { CRISP_PALETTE, TOKENS_ONLY_PALETTE } from '../../testing/palettes.js';
import {
  blit,
  charPositions,
  clipText,
  createCanvas,
  ditherPick,
  drawText,
  fitHeading,
  textWidth,
  wrap,
  CLEAR,
  type PixelCanvas,
} from './canvas.js';
import { iconKindOf } from './chrome.js';
import { C, dimIndex, resolveRoles, ROLE_NAMES, tintMap } from './colors.js';
import { paintTube, powerState, tubePoint } from './crt-screen.js';
import { MarkTracker } from './marks.js';
import { drawPhoto, photoValue, PHOTO_KINDS } from './photo.js';
import { drawStamp } from './stamp.js';
import { scheduleLines, terminalRows } from './typing.js';

function inked(canvas: PixelCanvas): number {
  return canvas.data.reduce((sum, value) => sum + (value === CLEAR ? 0 : 1), 0);
}

describe('retro-ui canvas', () => {
  it('draws both fonts, including the glyphs the kit fonts lack', () => {
    const canvas = createCanvas(80, 12);
    expect(drawText(canvas, 'AB', 0, 0, C.cream)).toBe(textWidth('AB'));
    expect(textWidth('C:\\>', { mono: true })).toBe(4 * 6 - 1);
    const slash = createCanvas(8, 8);
    drawText(slash, '\\', 0, 0, C.green);
    // Our backslash, not the 5x7 fallback box (which inks 20 pixels).
    expect(inked(slash)).toBe(7);
    const small = createCanvas(8, 8);
    drawText(small, '\\', 0, 0, C.green, { font: 'small' });
    expect(inked(small)).toBe(5);
  });

  it('fits headings: the asked style, else scale 1, else cut at scale 1', () => {
    const big = { scale: 2, bold: true };
    expect(fitHeading('MEMO', 100, big)).toEqual({ text: 'MEMO', style: big });
    const smaller = fitHeading('MISSION RULES', textWidth('MISSION RULES', { bold: true }), big);
    expect(smaller).toEqual({ text: 'MISSION RULES', style: { ...big, scale: 1 } });
    const cut = fitHeading('MISSION RULES AND ALARM CODES', 80, big);
    expect(cut.text).toBe(clipText('MISSION RULES AND ALARM CODES', 80, { bold: true }));
    expect(textWidth(cut.text, cut.style)).toBeLessThanOrEqual(80);
  });

  it('wraps by width and keeps the line count', () => {
    const lines = wrap('CALC.EXE HAS PERFORMED AN ILLEGAL OPERATION', 80, 3);
    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines.slice(0, -1)) expect(textWidth(line)).toBeLessThanOrEqual(80);
    expect(wrap('ONE TWO THREE FOUR', 20, 2, { mono: true })).toHaveLength(2);
  });

  it('dithers a ramp with ordered thresholds and blits without clear pixels', () => {
    const ramp = [C.black, C.cream];
    expect(ditherPick(0, 0, 0, ramp)).toBe(C.black);
    expect(ditherPick(3, 3, 1, ramp)).toBe(C.cream);
    const half = Array.from({ length: 16 }, (_value, index) =>
      ditherPick(index % 4, Math.floor(index / 4), 0.5, ramp),
    );
    expect(half.filter((value) => value === C.cream)).toHaveLength(8);
    const source = createCanvas(2, 1);
    source.data[0] = C.pink;
    const target = createCanvas(4, 1);
    target.data.fill(C.navy);
    blit(source, target, 1, 0);
    expect([...target.data]).toEqual([C.navy, C.pink, C.navy, C.navy]);
  });
});

describe('retro-ui colours', () => {
  it('resolves every role in Crisp 640 and in a tokens-only palette', () => {
    for (const palette of [CRISP_PALETTE, TOKENS_ONLY_PALETTE]) {
      const colors = resolveRoles(palette);
      for (const role of ROLE_NAMES) expect(palette[colors.names[role]]).toBeDefined();
      expect(colors.rgba[3]).toBe(0);
    }
    expect(resolveRoles(CRISP_PALETTE).names.cyan).toBe('brightTeal');
  });

  it('dims one tone and maps tints onto the phosphor ramp', () => {
    expect(dimIndex(C.cream)).toBe(C.grey);
    expect(dimIndex(C.black)).toBe(C.black);
    const green = tintMap(resolveRoles(CRISP_PALETTE), 'green');
    expect(green[C.navy]).toBe(C.black);
    expect(green[C.cream]).toBe(C.green);
    expect(new Set([...green].slice(1))).toEqual(new Set([C.black, C.forest, C.green]));
    expect(tintMap(resolveRoles(CRISP_PALETTE), 'color')[C.pink]).toBe(C.pink);
  });

  it('guesses icon kinds from labels', () => {
    expect(iconKindOf('TRASH')).toBe('trash');
    expect(iconKindOf('MY PC')).toBe('computer');
    expect(iconKindOf('README.TXT')).toBe('file');
    expect(iconKindOf('GAMES')).toBe('folder');
  });
});

describe('terminal typing schedule', () => {
  const options = { start: 0.5, cps: 10, pause: 0.3, outputGap: 0.1 };

  it('types input lines, prints output and honours `at` without overlapping', () => {
    const schedule = scheduleLines(
      [
        { text: 'DIR', input: true },
        { text: 'OK', input: false },
        { text: 'RUN', input: true, at: 2 },
        { text: 'LATE', input: false, at: 0 },
      ],
      options,
    );
    const [first, second, third, fourth] = schedule.lines;
    expect(first).toMatchObject({ shownFrom: 0.5, start: 0.5, end: 0.8 });
    expect(second?.start).toBeCloseTo(1.1);
    expect(third).toMatchObject({ start: 2, end: 2.3 });
    expect(third?.shownFrom).toBeCloseTo(1.1);
    expect(fourth?.start).toBeCloseTo(2.3);
    expect(schedule.idleFrom).toBeCloseTo(2.4);
  });

  it('shows partial typing with the cursor, then an idle prompt', () => {
    const schedule = scheduleLines([{ text: 'HELLO', input: true }], options);
    expect(terminalRows(schedule, 0.2).rows).toEqual([]);
    const typing = terminalRows(schedule, 0.75);
    expect(typing.rows[0]?.text).toBe('HE');
    expect(typing).toMatchObject({ cursor: { row: 0, column: 2 }, typing: true });
    const idle = terminalRows(schedule, 5);
    expect(idle.rows.map((row) => row.text)).toEqual(['HELLO', '']);
    expect(idle.cursor).toEqual({ row: 1, column: 0 });
    expect(terminalRows(schedule, 0.75)).toEqual(typing);
  });
});

describe('CRT tube', () => {
  it('switches power by t', () => {
    expect(powerState(1)).toEqual({ mode: 'on', k: 1 });
    expect(powerState(0, 1).mode).toBe('off');
    expect(powerState(1.25, 1)).toEqual({ mode: 'warming', k: 0.5 });
    expect(powerState(2.4, 1, 2.2).mode).toBe('collapsing');
    expect(powerState(4, 1, 2.2).mode).toBe('off');
  });

  it('maps content points onto the curved tube and back to the centre', () => {
    const content = { width: 100, height: 80 };
    const output = { width: 200, height: 160 };
    expect(tubePoint([50, 40], content, output, 1)).toEqual([100, 80]);
    const flat = tubePoint([10, 10], content, output, 0);
    expect(flat[0]).toBeCloseTo(20);
    const [x] = tubePoint([10, 10], content, output, 1);
    expect(x).toBeGreaterThan(20);
  });

  it('paints scanlines one tone darker and is pure in t', () => {
    const colors = resolveRoles(CRISP_PALETTE);
    const content = createCanvas(20, 10);
    content.data.fill(C.cream);
    const options = {
      tint: tintMap(colors, 'color'),
      luminance: colors.luminance,
      curvature: 0,
      scanlines: true,
      flicker: 0,
      seed: 1,
    };
    const out = createCanvas(40, 20);
    paintTube(out, content, options, powerState(1), 1);
    expect(out.data[10 * 40 + 20]).toBe(C.cream);
    expect(out.data[11 * 40 + 20]).toBe(C.grey);
    const again = createCanvas(40, 20);
    paintTube(again, content, { ...options, flicker: 1 }, powerState(1), 1.3);
    const twice = createCanvas(40, 20);
    paintTube(twice, content, { ...options, flicker: 1 }, powerState(1), 1.3);
    expect(twice.data).toEqual(again.data);
  });

  it('gives dark pixels next to bright ones a glow, but never inverse-video ink', () => {
    const colors = resolveRoles(CRISP_PALETTE);
    const content = createCanvas(20, 10);
    content.data.fill(C.green);
    content.data[4 * 20 + 5] = C.black;
    content.data[4 * 20 + 12] = C.inverseInk;
    const options = {
      tint: tintMap(colors, 'green'),
      luminance: colors.luminance,
      curvature: 0,
      scanlines: false,
      flicker: 0,
      seed: 1,
    };
    const out = createCanvas(40, 20);
    paintTube(out, content, options, powerState(1), 1);
    // Plain black inside the fill glows one tone darker than the fill; the ink stays black.
    expect(out.data[8 * 40 + 10]).toBe(dimIndex(C.green));
    expect(out.data[8 * 40 + 24]).toBe(C.black);
    expect(out.data[8 * 40 + 25]).toBe(C.black);
  });
});

describe('photos, stamps and marks', () => {
  it('photos are pure value fields in 0..1', () => {
    for (const kind of PHOTO_KINDS) {
      for (const [u, v] of [
        [0.1, 0.1],
        [0.5, 0.5],
        [0.9, 0.95],
      ] as const) {
        const value = photoValue(kind, u, v, 7);
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(1);
        expect(photoValue(kind, u, v, 7)).toBe(value);
      }
    }
    const canvas = createCanvas(30, 20);
    drawPhoto(canvas, { x: 0, y: 0, w: 30, h: 20 }, 'city', 3, [C.black, C.cream], 4);
    expect(inked(canvas)).toBe(600);
  });

  it('a stamp prints from its time on, see-through while it comes down', () => {
    const at = [40, 20] as const;
    const before = createCanvas(80, 40);
    drawStamp(before, 'TOP SECRET', at, C.pink, 1, -0.1);
    expect(inked(before)).toBe(0);
    const landing = createCanvas(80, 40);
    drawStamp(landing, 'TOP SECRET', at, C.pink, 1, 0.5);
    const printed = createCanvas(80, 40);
    drawStamp(printed, 'TOP SECRET', at, C.pink, 1, 2);
    expect(inked(landing)).toBeGreaterThan(0);
    expect(inked(printed)).toBeGreaterThan(0);
  });

  it('marks give anchors at the phrase and highlight from their time', () => {
    const marks = [{ text: 'doom', at: 1 }, { text: 'missing' }];
    const draw = (t: number) => {
      const canvas = createCanvas(120, 12);
      const tracker = new MarkTracker(marks, t, { mode: 'marker', color: C.amber });
      tracker.text(canvas, 'RUNS DOOM', 2, 2, C.black);
      return { canvas, anchors: tracker.anchors([0, 0]) };
    };
    const early = draw(0.5);
    const late = draw(2);
    const x = 2 + (charPositions('RUNS DOOM').xs[5] ?? 0) + textWidth('DOOM') / 2;
    expect(early.anchors['mark:doom']?.[0]).toBeCloseTo(x, 0);
    expect(early.anchors['mark:missing']).toEqual([0, 0]);
    expect(early.canvas.data.includes(C.amber)).toBe(false);
    expect(late.canvas.data.includes(C.amber)).toBe(true);
  });
});
