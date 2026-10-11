/**
 * `ink.text` of Grim Ink (PLAN.md#14.18): the prototypes' system fonts when installed (a fake
 * canvas target records the canvas calls), the CC0 ink lettering of brief 02 otherwise (call for
 * call identical to `drawText` with the role's cap height), font probing and the font report.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { KitError } from '../../../errors.js';
import { C } from '../core.js';
import { RecordingPaint } from '../draw/recording-paint.js';
import { drawText, measureText } from '../lettering/index.js';
import { paintInkSurface } from '../lettering/paint-surface.js';
import { fallbackCap, inkText, measureInkText, roleFont } from './ink-text.js';
import { ROLE_SPECS, inkFontReport, resetFontProbe } from './roles.js';
import { fakeTarget } from './fake-text-target.js';

afterEach(() => {
  resetFontProbe();
});

/** Relative luminance (WCAG) of a #rrggbb colour. */
function luminance(hex: string): number {
  const channel = (index: number): number => {
    const value = Number.parseInt(hex.slice(1 + index * 2, 3 + index * 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(0) + 0.7152 * channel(1) + 0.0722 * channel(2);
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return ((hi ?? 0) + 0.05) / ((lo ?? 0) + 0.05);
}

describe('ink.text', () => {
  it('letters a caption like the prototype with the installed system font', () => {
    const target = fakeTarget(['Arial Black']);
    const g = new RecordingPaint();
    const result = inkText(g, target, 'So what do you do with freedom?', {
      role: 'caption',
      x: 960,
      y: 1010,
    });
    expect(result.fallback).toBe(false);
    expect(roleFont('caption', 46)).toBe("bold 46px 'Arial Black', Arial, sans-serif");
    expect(target.calls).toContain(
      'strokeText So what do you do with freedom? 0 0 #16120e lw 11 round',
    );
    expect(target.calls).toContain(
      "fillText So what do you do with freedom? 0 0 #e2d8b8 bold 46px 'Arial Black', Arial, sans-serif",
    );
    expect(target.calls[1]).toBe('translate 960 1010');
    expect(g.calls).toEqual([]);
  });

  it('falls back to the CC0 lettering, call for call the same as drawText', () => {
    const viaRole = new RecordingPaint();
    const result = inkText(viaRole, fakeTarget([]), 'OPTIONAL', {
      role: 'poster',
      x: 900,
      y: 400,
      size: 120,
      outline: false,
      seed: 5,
    });
    expect(result.fallback).toBe(true);
    const cap = fallbackCap('poster', 120);
    const direct = new RecordingPaint();
    drawText('OPTIONAL', paintInkSurface(direct), {
      face: 'poster',
      size: cap,
      x: 900,
      y: 400 + cap / 2,
      seed: 5,
      align: 'center',
      rot: 0,
      track: ROLE_SPECS.poster.track,
      fill: ROLE_SPECS.poster.fill,
      layers: [{ fill: ROLE_SPECS.poster.fill }],
    });
    expect(viaRole.toLines()).toEqual(direct.toLines());
    expect(result.width).toBe(measureText('OPTIONAL', cap, 'poster', ROLE_SPECS.poster.track));
  });

  it('keeps the prototype caption width in the fallback (track) and draws the outline under', () => {
    const width = measureInkText(undefined, 'SO WHAT DO YOU DO WITH FREEDOM?', 'caption');
    // bold 46 px Arial Black measures 985.5 px in Chromium on Windows
    expect(Math.abs(width - 985.5)).toBeLessThan(10);
    const g = new RecordingPaint();
    inkText(g, undefined, 'FREE', { role: 'caption', x: 0, y: 0 });
    const fills = g.calls.filter((call) => call.op === 'set:fillStyle').map((call) => call.args[0]);
    expect(fills[0]).toBe('#16120e');
    expect(fills.indexOf('#e2d8b8')).toBeGreaterThan(0);
  });

  it('reads on any ground: bone on ink, ink against the sand and walls', () => {
    const { fill, outline } = ROLE_SPECS.caption;
    expect(contrast(fill, outline ?? '')).toBeGreaterThan(12);
    for (const ground of [C.MUSTARD, C.CLAY, C.LINEN, '#c4a75a']) {
      // the outline separates the letters from a light ground, the fill from a dark one (WCAG
      // large text: 3:1; the highlight never relies on the accent colour)
      expect(Math.max(contrast(outline ?? '', ground), contrast(fill, ground))).toBeGreaterThan(3);
    }
  });

  it('checks its options and reports the fonts the roles miss', () => {
    expect(() =>
      inkText(new RecordingPaint(), undefined, 'X', { role: 'shout' as never, x: 0, y: 0 }),
    ).toThrow(KitError);
    expect(inkFontReport(undefined)).toMatchObject({ fallback: true });
    const report = inkFontReport(fakeTarget(['Arial Black', 'Arial', 'Impact', 'Georgia']));
    expect(report.missing).toEqual(['Courier New', 'Times New Roman']);
    expect(report.fallbackRoles).toEqual(['digits']);
  });
});
