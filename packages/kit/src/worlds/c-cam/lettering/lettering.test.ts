/**
 * C-CAM ink lettering (PLAN.md#14.7): every character the three concept films put on screen
 * exists in the face that draws it, the layout is a pure function of its input (prefix-stable,
 * measured width = laid width), word wrap, the ink ribbon (0.4x-1.9x swell, tapered ends, round
 * dots), the thud-in on twos, and no clock/RNG/DOM/system-font API in the module.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  FACES,
  FACE_NAMES,
  THUD_FPS,
  drawText,
  faceChars,
  glyphOf,
  hasGlyph,
  layoutText,
  measureText,
  smoothStroke,
  strokeRibbon,
  textSpan,
  thudIn,
  thudScale,
  wrapText,
  type FaceName,
  type InkSurface,
  type LaidStroke,
  type Pt,
} from './index.js';

/** On-screen strings of the films (docs/concepts/c-cam-style/films/*), by the face that draws them. */
const FILM_STRINGS: Readonly<Record<FaceName, readonly string[]>> = {
  // Titles (posterWord), stamps, tags, signs, gauges, the DSKY and the carved stone.
  poster: [
    'WOULD YOU SURVIVE',
    'AS A SAMURAI',
    'IN PEACEFUL JAPAN?',
    'EDO PERIOD  ·  c. 1750',
    'CLACK',
    'RICE',
    'RICE · LOANS',
    'HOW NOT TO',
    'CHOOSE A POPE',
    'VITERBO  ·  1268',
    '?',
    'CUM CLAVE',
    '= "WITH A KEY"',
    'LANDING ON THE MOON?',
    'APOLLO 11  ·  1969',
    'VS',
    'YOUR COMPUTER',
    'A MODERN PHONE',
    'GO!',
    'DESCENT FUEL',
    'LOW LEVEL',
    'MASTER ALARM',
    'MASTER',
    'ALARM',
    'NO SMOKING',
    'UPLINK TEMP PROG RESTART KEY REL OPR ERR VERB NOUN',
    'VERB + 7 8 9 CLR NOUN - 4 5 6 PRO 0 1 2 3 ENTR RSET',
    '00000',
    '1202',
  ],
  // Ledger lines, the book's spine and heading, the chalked year slate, the sleeper's z.
  hand: [
    'DEBTS',
    'YOU',
    'rice loan',
    'interest',
    'loan',
    'new loan',
    'late fee',
    'z',
    '1268',
    '1269',
    '1270',
  ],
};

/** Every character of the films' caption lines (`film.js`): either face may letter captions. */
const CAPTION_CHARS = ' ,.01256789:?ABDEFGIJLMNOPRSTVWYabcdefghiklmnopqrstuvwxy';

const base = { size: 40, x: 100, y: 200, seed: 5 } as const;

class RecordingSurface implements InkSurface {
  readonly calls: { points: readonly Pt[]; widths: readonly number[]; fill: string }[] = [];
  ribbon(points: readonly Pt[], widths: readonly number[], fill: string): void {
    this.calls.push({ points, widths, fill });
  }
}

function arcFractions(points: readonly Pt[]): number[] {
  const arcs = [0];
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1] ?? { x: 0, y: 0 };
    const b = points[i] ?? a;
    arcs.push((arcs[i - 1] ?? 0) + Math.hypot(b.x - a.x, b.y - a.y));
  }
  const total = arcs[arcs.length - 1] ?? 1;
  return arcs.map((arc) => arc / total);
}

/** Points from flat x, y pairs. */
function xy(...flat: number[]): Pt[] {
  return flat.flatMap((x, i) => (i % 2 === 0 ? [{ x, y: flat[i + 1] ?? 0 }] : []));
}

function laidStroke(pts: Pt[], closed = false): LaidStroke {
  return { pts, corners: pts.map(() => false), closed, char: 0, key: 99 };
}

describe('C-CAM lettering glyphs', () => {
  it.each(Object.entries(FILM_STRINGS))('the %s face draws every film string', (face, texts) => {
    const missing = texts.flatMap((text) =>
      Array.from(text).filter((c) => !hasGlyph(face as FaceName, c)),
    );
    expect(missing).toEqual([]);
  });

  it('both faces draw every film string and every caption character', () => {
    const all = [...FILM_STRINGS.poster, ...FILM_STRINGS.hand, CAPTION_CHARS].join('');
    for (const face of FACE_NAMES) {
      expect(Array.from(all).filter((c) => !hasGlyph(face, c))).toEqual([]);
    }
  });

  it('covers A-Z and 0-9 in both faces, a-z in the hand; poster lower case is its capital', () => {
    const caps = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    for (const face of FACE_NAMES) for (const c of caps) expect(faceChars(face)).toContain(c);
    for (const c of 'abcdefghijklmnopqrstuvwxyz') {
      expect(faceChars('hand')).toContain(c);
      expect(glyphOf('poster', c)).toBe(glyphOf('poster', c.toUpperCase()));
    }
    expect(glyphOf('hand', 'é')).toBeUndefined();
  });

  it('has well-formed skeletons (finite points, a corner flag per point, a positive advance)', () => {
    for (const face of FACE_NAMES) {
      for (const char of faceChars(face)) {
        const glyph = glyphOf(face, char);
        expect(glyph?.width).toBeGreaterThan(0);
        for (const stroke of glyph?.strokes ?? []) {
          expect(stroke.pts.length).toBeGreaterThanOrEqual(2);
          expect(stroke.corners).toHaveLength(stroke.pts.length);
          for (const p of stroke.pts)
            expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true);
        }
      }
    }
  });
});

describe('C-CAM lettering layout', () => {
  it('is a pure function of its input', () => {
    const options = { ...base, face: 'hand' as const, rot: -1, align: 'center' as const };
    expect(layoutText('RICE · LOANS', options)).toEqual(layoutText('RICE · LOANS', options));
    expect(layoutText('RICE · LOANS', { ...options, seed: 6 })).not.toEqual(
      layoutText('RICE · LOANS', options),
    );
    const a = new RecordingSurface();
    const b = new RecordingSurface();
    drawText('CLACK', a, { ...base, face: 'poster', fill: '#000' });
    drawText('CLACK', b, { ...base, face: 'poster', fill: '#000' });
    expect(a.calls).toEqual(b.calls);
  });

  it.each(FACE_NAMES)('lays a prefix out like the start of the whole string (%s)', (face) => {
    const word = 'CUM CLAVE';
    const full = layoutText(word, { ...base, face, align: 'left' });
    for (let n = 0; n <= word.length; n += 1) {
      const part = layoutText(word.slice(0, n), { ...base, face, align: 'left' });
      expect(part.strokes).toEqual(full.strokes.slice(0, part.strokes.length));
      expect(part.strokes.every((stroke) => stroke.char < n)).toBe(true);
    }
  });

  it('keeps a centred prefix in place when given the width of the whole string', () => {
    const options = { ...base, face: 'poster' as const, align: 'center' as const };
    const alignWidth = measureText('CUM CLAVE', base.size, 'poster');
    const full = layoutText('CUM CLAVE', options);
    const part = layoutText('CUM C', { ...options, alignWidth });
    expect(part.strokes).toEqual(full.strokes.slice(0, part.strokes.length));
  });

  it.each(FACE_NAMES)('measures exactly the laid width (%s)', (face) => {
    for (const text of [...FILM_STRINGS.poster, ...FILM_STRINGS.hand, '', ' ', 'a  b ']) {
      for (const track of [0, 1.5]) {
        const laid = layoutText(text, { ...base, face, track, seed: 9, wobble: 2 });
        expect(laid.width).toBe(measureText(text, base.size, face, track));
      }
    }
  });

  it('measures linearly in size, with tracking between glyphs and a space after the gap', () => {
    const at = (size: number, track = 0): number => measureText('MASTER', size, 'poster', track);
    expect(measureText('', 40, 'hand')).toBe(0);
    expect(at(80)).toBeCloseTo(2 * at(40), 9);
    expect(at(40, 2) - at(40)).toBeCloseTo((5 * 2 * 40) / 10, 9);
    expect(measureText('A B', 40, 'hand')).toBeCloseTo(
      measureText('AB', 40, 'hand') + (FACES.hand.space * 40) / 10,
      9,
    );
  });

  it('aligns about the anchor and rotates the line about it', () => {
    const span = (align: 'left' | 'center' | 'right'): readonly number[] =>
      textSpan(layoutText('NO SMOKING', { ...base, face: 'poster', align, wobble: 0 }));
    const width = measureText('NO SMOKING', base.size, 'poster');
    expect(span('left')[0]).toBeCloseTo(base.x, 0);
    expect(span('right')[2]).toBeCloseTo(base.x, 0);
    const [x0 = 0, , x1 = 0] = span('center');
    expect((x0 + x1) / 2).toBeCloseTo(base.x, 0);
    expect(x1 - x0).toBeCloseTo(width, 0);
    const turned = layoutText('I', { ...base, face: 'poster', wobble: 0, rot: 90 });
    const [tx0, , tx1] = textSpan(turned);
    // Positive turns are clockwise on the y-down page (canvas `rotate`): the top goes right.
    expect(tx0).toBeGreaterThanOrEqual(base.x - 1e-9);
    expect(tx1).toBeGreaterThan(base.x + base.size * 0.9);
  });

  it('skips characters a face cannot draw and tags strokes with their character index', () => {
    const laid = layoutText('a☃b', { ...base, face: 'hand' });
    expect(new Set(laid.strokes.map((stroke) => stroke.char))).toEqual(new Set([0, 2]));
    expect(laid.width).toBe(measureText('ab', base.size, 'hand'));
  });
});

describe('C-CAM lettering wrap', () => {
  const size = 30;
  const width = (text: string): number => measureText(text, size, 'hand');

  it('keeps a line that fits whole, runs of spaces included', () => {
    expect(wrapText('EDO PERIOD  ·  c. 1750', 1e6, size, 'hand')).toEqual([
      'EDO PERIOD  ·  c. 1750',
    ]);
  });

  it('breaks greedily at spaces and drops the spaces at a break', () => {
    const text = 'rice loan interest new loan late fee';
    const limit = width('rice loan interest');
    const lines = wrapText(text, limit, size, 'hand');
    expect(lines).toEqual(['rice loan interest', 'new loan late fee']);
    for (const line of lines) expect(width(line)).toBeLessThanOrEqual(limit);
    expect(lines.join(' ')).toBe(text);
  });

  it('keeps a word wider than the limit whole on its own line', () => {
    expect(wrapText('A RESTART B', width('A'), size, 'hand')).toEqual(['A', 'RESTART', 'B']);
  });

  it('starts a new line at every newline and keeps empty lines', () => {
    expect(wrapText('MASTER\n\nALARM', 1e6, size, 'poster')).toEqual(['MASTER', '', 'ALARM']);
    expect(wrapText('', 100, size, 'poster')).toEqual(['']);
  });
});

describe('C-CAM lettering ink', () => {
  const baseWidth = 4;

  it('swells within 0.4x-1.9x of the base width inside a stroke and tapers both open ends', () => {
    const laid = layoutText('MASTER ALARM rice loan', { ...base, size: 60, face: 'hand' });
    for (const stroke of laid.strokes) {
      const ribbon = strokeRibbon(stroke, baseWidth, 60, FACES.hand.swell, FACES.hand.taper);
      expect(ribbon.widths).toHaveLength(ribbon.points.length);
      for (const w of ribbon.widths) expect(w).toBeLessThanOrEqual(1.9 * baseWidth * 1.0001);
      if (stroke.closed || ribbon.widths[0] === 0) continue; // loops have no ends; dots
      const fractions = arcFractions(ribbon.points);
      const inside = ribbon.widths.filter((_, i) => Math.abs((fractions[i] ?? 0) - 0.5) < 0.35);
      for (const w of inside) expect(w).toBeGreaterThanOrEqual(0.4 * baseWidth * 0.9999);
      const inner = Math.max(...ribbon.widths);
      expect(ribbon.widths[0]).toBeLessThan(0.25 * baseWidth);
      expect(ribbon.widths[ribbon.widths.length - 1]).toBeLessThan(0.25 * baseWidth);
      expect(inner).toBeGreaterThan(0.4 * baseWidth);
    }
  });

  it('keeps a closed stroke untapered and its ends joined', () => {
    const ring = laidStroke(xy(0, 0, 50, 0, 50, 50, 0, 50, 0, 0), true);
    const ribbon = strokeRibbon(ring, baseWidth, 60, 1, 1);
    expect(ribbon.points[0]).toEqual(ribbon.points[ribbon.points.length - 1]);
    for (const w of ribbon.widths) expect(w).toBeGreaterThanOrEqual(0.4 * baseWidth * 0.9999);
  });

  it('turns a very short stroke into a round dot', () => {
    const dot = strokeRibbon(laidStroke(xy(10, 10, 11, 11)), baseWidth, 60, 1, 1);
    const widest = Math.max(...dot.widths);
    expect(widest).toBeCloseTo(1.7 * baseWidth, 6);
    expect(dot.widths[0]).toBe(0);
    const first = dot.points[0] ?? { x: 0, y: 0 };
    const last = dot.points[dot.points.length - 1] ?? first;
    expect(Math.hypot(last.x - first.x, last.y - first.y)).toBeCloseTo(widest, 6);
  });

  it('smooths through the control points, keeps corners sharp and wraps loops', () => {
    const pts = xy(0, 0, 10, 0, 10, 10);
    const open = smoothStroke(pts, [false, true, false], false, 1);
    expect(open[0]).toEqual(pts[0]);
    expect(open[open.length - 1]).toEqual(pts[2]);
    expect(open).toContainEqual(pts[1]);
    // With a pinned corner the first leg stays on the line y = 0.
    expect(open.slice(0, 10).every((p) => Math.abs(p.y) < 1e-9)).toBe(true);
    const loop = smoothStroke([...pts, { x: 0, y: 0 }], [false, false, false, false], true, 1);
    expect(loop[0]).toEqual(loop[loop.length - 1]);
  });

  it('draws every layer of a character before the next character, with offsets and widths', () => {
    const surface = new RecordingSurface();
    const layers = [{ fill: 'ink', widthScale: 1.5, dx: 2, dy: 3 }, { fill: 'paper' }];
    drawText('HI', surface, { ...base, face: 'poster', fill: 'x', layers });
    const strokesOf = (c: string): number => glyphOf('poster', c)?.strokes.length ?? 0;
    const fills = surface.calls.map((call) => call.fill);
    const h = strokesOf('H');
    const run = (fill: string): string[] => Array.from({ length: h }, () => fill);
    expect(fills.slice(0, 2 * h)).toEqual([...run('ink'), ...run('paper')]);
    expect(fills).toHaveLength(2 * (h + strokesOf('I')));
    const [shadow, plain] = [surface.calls[0], surface.calls[h]];
    expect(shadow?.points[0]?.x).toBeCloseTo((plain?.points[0]?.x ?? 0) + 2, 9);
    expect(shadow?.widths[3]).toBeCloseTo((plain?.widths[3] ?? 0) * 1.5, 9);
  });

  it('scales characters about their centre and hides those at scale 0', () => {
    const draw = (charScale?: (index: number) => number): RecordingSurface => {
      const surface = new RecordingSurface();
      drawText('GO', surface, { ...base, face: 'poster', fill: 'x', charScale });
      return surface;
    };
    const plain = draw();
    expect(draw(() => 1).calls).toEqual(plain.calls);
    const onlyG = draw((index) => (index === 0 ? 1 : 0));
    expect(onlyG.calls).toEqual(plain.calls.slice(0, glyphOf('poster', 'G')?.strokes.length));
    const big = draw((index) => (index === 0 ? 2 : 1));
    expect(big.calls[0]?.widths[2]).toBeCloseTo((plain.calls[0]?.widths[2] ?? 0) * 2, 9);
  });
});

describe('C-CAM title thud-in', () => {
  const frames = (t0: number): number[] =>
    Array.from({ length: 16 }, (_, frame) => {
      const thud = thudIn(frame / 24, t0);
      return thud.visible ? thud.scale : 0;
    });

  it('slams in at 1.6x, overshoots and settles at 1.0x on twos', () => {
    expect(frames(0)).toEqual([1.6, 1.6, 1.25, 1.25, 0.9, 0.9, 1.05, 1.05, 1, 1, 1, 1, 1, 1, 1, 1]);
    expect(frames(1 / 12)).toEqual([
      0, 0, 1.6, 1.6, 1.25, 1.25, 0.9, 0.9, 1.05, 1.05, 1, 1, 1, 1, 1, 1,
    ]);
  });

  it('holds every pose for two frames at 24 fps whatever the start time', () => {
    for (const t0 of [0.04, 0.1, 0.15, 0.8, 1.4, 0.9 + 0.04 * 7]) {
      const sequence = frames(t0);
      for (let frame = 0; frame < sequence.length; frame += 2) {
        expect(sequence[frame + 1]).toBe(sequence[frame]);
      }
      const first = thudIn(t0, t0);
      expect(first.step <= 0).toBe(true);
      expect(thudIn(t0 + 1 / THUD_FPS + 1e-9, t0).visible).toBe(true);
    }
  });

  it('starts the letters of a word one after another', () => {
    const scale = thudScale(0.1, 0);
    expect(scale(0)).toBe(1.25);
    expect(scale(1)).toBe(1.6);
    expect(scale(3)).toBe(0);
    expect(thudScale(10, 0)(20)).toBe(1);
  });
});

describe('C-CAM lettering determinism guard', () => {
  it('uses no clock, RNG, DOM, timers or system-font text API', () => {
    const dir = fileURLToPath(new URL('.', import.meta.url));
    const sources = readdirSync(dir).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'));
    expect(sources.length).toBeGreaterThanOrEqual(8);
    const forbidden =
      /\bDate\b|Math\.random|\bperformance\b|\bdocument\b|\bwindow\b|\bsetTimeout\b|\bsetInterval\b|requestAnimationFrame|fillText|strokeText|\bfetch\b|from 'node:/;
    for (const file of sources) {
      expect(readFileSync(`${dir}${file}`, 'utf8'), file).not.toMatch(forbidden);
    }
  });
});
