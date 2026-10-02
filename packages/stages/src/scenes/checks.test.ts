/** Programmatic critics (PLAN.md#7.5) on synthetic frames: no Claude, no browser. */
import { lintScene, type CardDiagnostic } from '@reelforge/engine';
import { describe, expect, it } from 'vitest';
import {
  blankFrameFindings,
  cardFindings,
  consoleFindings,
  fixableFindings,
  formatFinding,
  lintFindings,
} from './checks.js';
import { programmaticCritique } from './critic.js';
import { smokeTimes } from './qa.js';
import type { RenderedFrame, ShotRenderOk } from './tools.js';

const W = 64;
const H = 36;

function image(
  paint: (x: number, y: number) => readonly [number, number, number],
): RenderedFrame['image'] {
  const data = new Uint8Array(W * H * 4);
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) data.set([...paint(x, y), 255], (y * W + x) * 4);
  }
  return { width: W, height: H, data };
}

const scene = image((x, y) => [(x * 4) % 256, (y * 7) % 256, (x + y) % 256]);
/** A rendered frame "broken" by pixel manipulation: everything painted over in one colour. */
const blank = image(() => [12, 10, 40]);
/** Two-colour dither pattern of a flat background: still blank. */
const dithered = image((x, y) => ((x + y) % 2 === 0 ? [12, 10, 40] : [14, 12, 44]));
/** Three-colour dither + scanlines of an empty background: blank by content, not by colours. */
const scanned = image((x, y) =>
  y % 2 === 1 ? [8, 8, 30] : (x + y) % 4 === 0 ? [12, 10, 40] : [16, 14, 48],
);
/** The same background with one small object: not blank. */
const withObject = image((x, y) =>
  x >= 24 && x < 40 && y >= 8 && y < 24 ? [250, 60, 160] : y % 2 === 1 ? [8, 8, 30] : [16, 14, 48],
);

const overlap: CardDiagnostic = {
  rule: 'card-overlap',
  severity: 'error',
  shotId: 's01',
  cards: ['a', 'b'],
  t0: 0.5,
  t1: 1.2,
  message: 'cards "a" and "b" overlap by 40x8 px',
  fix: 'Move one card.',
};

function render(
  frames: RenderedFrame[],
  cards: CardDiagnostic[] = [],
  errors: string[] = [],
): ShotRenderOk {
  return { ok: true, width: W, height: H, frames, cards, anchors: [], cues: [], errors };
}

describe('programmatic critique', () => {
  it('passes a normal frame and flags blank / uniform ones with their time', () => {
    expect(blankFrameFindings([{ t: 0, image: scene }])).toEqual([]);
    const found = blankFrameFindings([
      { t: 0, image: scene },
      { t: 1.5, image: blank },
      { t: 2, image: dithered },
    ]);
    expect(found.map((entry) => [entry.source, entry.t])).toEqual([
      ['blank', 1.5],
      ['blank', 2],
    ]);
    expect(found[0]?.message).toContain('100% of the pixels are one colour');
    const [byContent] = blankFrameFindings([{ t: 3, image: scanned }]);
    expect(byContent?.message).toContain(
      'nothing stands out from the background (0.0% of the frame)',
    );
    expect(blankFrameFindings([{ t: 3, image: withObject }])).toEqual([]);
  });

  it('turns card diagnostics and console errors into fixable findings', () => {
    const findings = programmaticCritique(
      render([{ t: 0, image: scene }], [overlap], ['WebGL: lost', 'WebGL: lost']),
    );
    expect(findings.map((entry) => entry.source)).toEqual(['cards', 'console']);
    expect(fixableFindings(findings)).toHaveLength(2);
    const [card] = cardFindings([overlap]);
    expect(card && formatFinding(card)).toBe(
      '[cards] (t=0.50 s) [card-overlap] cards "a" and "b" overlap by 40x8 px. Fix: Move one card.',
    );
    expect(consoleFindings(['x', 'x'])).toHaveLength(1);
  });

  it('reports lint errors as fatal findings with position and fix', () => {
    const source =
      "export const meta = { id: 's01' };\nexport function build() { return { r: Math.random() }; }\nexport function update() {}\n";
    const findings = lintFindings(
      lintScene(source, { filename: 'scenes/s01.js' }),
      'scenes/s01.js',
    );
    expect(findings.length).toBeGreaterThan(0);
    expect(findings[0]).toMatchObject({ source: 'lint', fatal: true });
    expect(findings[0]?.message).toMatch(/^scenes\/s01\.js:2:\d+ \[/);
  });
});

describe('smokeTimes', () => {
  it('samples start, quarters and end - 0.1 s', () => {
    expect(smokeTimes(4)).toEqual([0, 1, 2, 3, 3.9]);
    expect(smokeTimes(2.2)).toEqual([0, 0.55, 1.1, 1.65, 2.1]);
    expect(smokeTimes(0.05)).toEqual([0, 0.013, 0.025, 0.038]);
  });
});
