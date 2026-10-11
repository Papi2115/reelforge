import { describe, expect, it } from 'vitest';
import { TEST_CHARACTER } from '../draw/test-character.js';
import {
  RULES,
  RULE_CODES,
  TEST_POSES,
  VALIDATE_YAWS,
  ruleSpec,
  validateCharacter,
  type RuleCode,
} from './index.js';

describe('validateCharacter on the test character', () => {
  const report = validateCharacter(TEST_CHARACTER);

  it('finds no errors in any view x pose', () => {
    const errors = report.findings.filter((f) => f.severity === 'error');
    expect(errors).toEqual([]);
    expect(report.ok).toBe(true);
  });

  it('runs every rule on the full grid', () => {
    for (const code of RULE_CODES) expect(report.checks[code] ?? 0, code).toBeGreaterThan(0);
    // both shoulders in every view; every view x static pose for the figure raster
    expect(report.checks['shoulder-outside-torso']).toBe(VALIDATE_YAWS.length * 2);
    expect(report.checks['figure-pieces']).toBe(VALIDATE_YAWS.length * TEST_POSES.length);
  });

  it('only warns where the C-CAM face guard pushes targets past reach (rig limit, not the character)', () => {
    const warnCodes = new Set(
      report.findings.filter((f) => f.severity === 'warn').map((f) => f.code),
    );
    expect([...warnCodes]).toEqual(['guard-out-of-reach']);
  });

  it('keeps the c-plus margins on the warden', () => {
    const m = report.metrics;
    expect(m['anchors: min shoulder clearance below shut chin+gap px']).toBeGreaterThan(30);
    expect(m['anchors: max face anchor distance from the head ink px']).toBe(0);
    expect(m['head: biggest hole in a head px']).toBe(0);
    expect(m['tangle: max raw pose target beyond reach (share of arm)']).toBe(0);
    expect(m['contact: max palm-on-object miss px (reachable goals)']).toBeLessThan(5);
  });

  it('is deterministic', () => {
    expect(validateCharacter(TEST_CHARACTER, { raster: false })).toEqual(
      validateCharacter(TEST_CHARACTER, { raster: false }),
    );
  });
});

describe('options and registry', () => {
  it('registers every code once, with a severity and a summary', () => {
    expect(RULES.map((r) => r.code)).toEqual([...RULE_CODES]);
    for (const r of RULES) {
      expect(['error', 'warn']).toContain(r.severity);
      expect(r.summary.length).toBeGreaterThan(10);
      expect(ruleSpec(r.code)).toBe(r);
    }
    expect(() => ruleSpec('nope' as RuleCode)).toThrow(RangeError);
  });

  it('runs only the selected rules and skips raster rules on request', () => {
    const one = validateCharacter(TEST_CHARACTER, { rules: ['shoulder-above-chin'], views: [0] });
    expect(Object.keys(one.checks)).toEqual(['shoulder-above-chin']);
    expect(one.checks['shoulder-above-chin']).toBe(1);
    const geo = validateCharacter(TEST_CHARACTER, {
      rules: ['head-pieces', 'figure-pieces', 'out-of-reach'],
      raster: false,
    });
    expect(Object.keys(geo.checks)).toEqual(['out-of-reach']);
  });

  it('reports findings with view, pose, message, fix and the broken limit', () => {
    const bad = { ...TEST_CHARACTER, D: { ...TEST_CHARACTER.D, sy: -600 } };
    const r = validateCharacter(bad, { rules: ['shoulder-above-chin'], views: [2] });
    expect(r.ok).toBe(false);
    expect(r.findings).toHaveLength(1);
    const f = r.findings[0];
    expect(f).toMatchObject({
      code: 'shoulder-above-chin',
      severity: 'error',
      view: 2,
      pose: null,
      limit: 0,
    });
    expect(f?.measured).toBeLessThan(0);
    expect(f?.message).toMatch(/px above the shut chin/);
    expect(f?.fix).toMatch(/lower the shoulders by \d+ px \(D\.sy -600 -> -5\d\d\)/);
  });
});
