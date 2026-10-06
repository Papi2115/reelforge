/**
 * Readability (PLAN.md#11.2): every text colour of the theme (styles.css :root) reaches WCAG AA
 * (4.5:1) on every surface it is used on, including the tinted chips (alpha over the panel); the
 * control border reaches 3:1 (non-text) and disabled text 4.5:1 (docs/ux/redesign-2.4.md U2).
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

type Rgba = readonly [number, number, number, number];

const css = readFileSync(new URL('../../src/renderer/styles.css', import.meta.url), 'utf8');
const root = /:root\s*\{([^}]*)\}/.exec(css)?.[1] ?? '';

function variable(name: string): string {
  const match = new RegExp(`--${name}:\\s*([^;]+);`).exec(root);
  if (!match?.[1]) throw new Error(`--${name} missing in styles.css`);
  return match[1].trim();
}

function parseColour(value: string): Rgba {
  const hex = /^#([0-9a-f]{6})$/i.exec(value);
  if (hex?.[1]) {
    const n = Number.parseInt(hex[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1];
  }
  const rgb = /^rgb\((\d+) (\d+) (\d+)(?: \/ (\d+)%)?\)$/.exec(value);
  if (rgb) {
    return [
      Number(rgb[1]),
      Number(rgb[2]),
      Number(rgb[3]),
      rgb[4] === undefined ? 1 : Number(rgb[4]) / 100,
    ];
  }
  throw new Error(`unsupported colour ${value}`);
}

function over(top: Rgba, bottom: Rgba): Rgba {
  const alpha = top[3];
  return [
    top[0] * alpha + bottom[0] * (1 - alpha),
    top[1] * alpha + bottom[1] * (1 - alpha),
    top[2] * alpha + bottom[2] * (1 - alpha),
    1,
  ];
}

function luminance([r, g, b]: Rgba): number {
  const channel = (value: number): number => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrast(text: Rgba, background: Rgba): number {
  const [light, dark] = [luminance(text), luminance(background)].sort((a, b) => b - a);
  return ((light ?? 0) + 0.05) / ((dark ?? 0) + 0.05);
}

const colour = (name: string): Rgba => parseColour(variable(name));
const SURFACES = ['bg', 'panel', 'panel-raised'] as const;
const TEXTS = ['text', 'muted', 'accent-text', 'ok', 'warn', 'error'] as const;

describe('theme contrast', () => {
  it('passes 4.5:1 for every text colour on every surface', () => {
    for (const surface of SURFACES) {
      for (const text of TEXTS) {
        const ratio = contrast(colour(text), colour(surface));
        expect(ratio, `--${text} on --${surface}: ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it('passes 4.5:1 inside the tinted status chips and on the accent button', () => {
    const panel = colour('panel');
    const chips: readonly (readonly [string, string])[] = [
      ['ok', 'ok-soft'],
      ['accent-text', 'accent-soft'],
    ];
    for (const [text, tint] of chips) {
      const background = over(colour(tint), panel);
      const ratio = contrast(colour(text), background);
      expect(ratio, `--${text} on --${tint}: ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(4.5);
    }
    expect(contrast(colour('on-accent'), colour('accent'))).toBeGreaterThanOrEqual(4.5);
  });

  it('passes 3:1 for the control border (non-text) on every surface', () => {
    for (const surface of SURFACES) {
      const ratio = contrast(colour('border-control'), colour(surface));
      expect(ratio, `--border-control on --${surface}: ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(
        3,
      );
    }
  });

  it('keeps disabled text readable (4.5:1) on every surface, without opacity', () => {
    for (const surface of SURFACES) {
      const ratio = contrast(colour('text-disabled'), colour(surface));
      expect(ratio, `--text-disabled on --${surface}: ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(
        4.5,
      );
    }
    // Disabled controls are dimmed by colour, never by opacity (opacity drags text below 4.5:1).
    const disabledRules = [...css.matchAll(/([^{}]*disabled[^{}]*)\{([^}]*)\}/g)];
    expect(disabledRules.length).toBeGreaterThan(0);
    for (const [, selector, body] of disabledRules) {
      expect(body, `${selector?.trim() ?? ''} uses opacity`).not.toMatch(/opacity/);
    }
  });
});
