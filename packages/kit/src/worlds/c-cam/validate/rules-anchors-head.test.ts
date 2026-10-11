import { describe, expect, it } from 'vitest';
import { neckHead, type Character, type HeadDraw } from '../draw/character.js';
import { ellipseRing, blob } from '../draw/shapes.js';
import { TEST_CHARACTER } from '../draw/test-character.js';
import { validateCharacter, TEST_POSES, type RuleCode } from './index.js';
import { measureHead } from './measure.js';
import { inkDistance } from './shape-geometry.js';

const T = TEST_CHARACTER;
const withD = (d: Partial<Character['D']>): Character => ({ ...T, D: { ...T.D, ...d } });
const codes = (ch: Character, rule: RuleCode, views?: readonly number[]): readonly string[] =>
  validateCharacter(ch, { rules: [rule], ...(views ? { views } : {}) }).findings.map(
    (f) => `${f.code}@${String(f.view)}`,
  );

describe('anchors', () => {
  it('shoulder-outside-torso: shoulders wider than the coat', () => {
    const r = validateCharacter(withD({ sw: 120 }), { rules: ['shoulder-outside-torso'] });
    expect(r.ok).toBe(false);
    const front = r.findings.filter((f) => f.view === 0);
    expect(front).toHaveLength(2);
    expect(front[0]?.fix).toMatch(/toward the body axis \(D\.sw 120 -> about \d+\)/);
    // in profile the shoulder projects onto the body axis: nothing to report
    expect(r.findings.filter((f) => f.view === 2)).toEqual([]);
  });

  it('shoulder-above-chin: at the neck-gap boundary', () => {
    const base = validateCharacter(T, { rules: ['shoulder-above-chin'] });
    const c = base.metrics['anchors: min shoulder clearance below shut chin+gap px'] ?? 0;
    expect(c).toBeGreaterThan(0);
    expect(
      validateCharacter(withD({ neckGap: 6 + c - 1e-9 }), { rules: ['shoulder-above-chin'] }).ok,
    ).toBe(true);
    const over = validateCharacter(withD({ neckGap: 6 + c + 1e-9 }), {
      rules: ['shoulder-above-chin'],
    });
    expect(over.ok).toBe(false);
    // only the tightest view fails (plain and mirrored)
    expect(new Set(over.findings.map((f) => Math.abs(f.view ?? 9)))).toHaveProperty('size', 1);
  });

  it('shoulder-above-open-chin: warns when only the open jaw reaches the shoulders', () => {
    const ch = withD({ sy: -565 });
    expect(codes(ch, 'shoulder-above-chin')).toEqual([]);
    const r = validateCharacter(ch, { rules: ['shoulder-above-open-chin'] });
    expect(r.ok).toBe(true);
    expect(r.findings.length).toBeGreaterThan(0);
    expect(r.findings.every((f) => f.severity === 'warn')).toBe(true);
  });

  it('face-anchor-off-head: a chin anchor in the air', () => {
    const anchors = T.faceAnchors;
    if (!anchors) throw new Error('fixture has face anchors');
    const ch: Character = {
      ...T,
      faceAnchors: [{ ...anchors[0], chin: [0, 80] }, anchors[1], anchors[2], anchors[3]],
    };
    const r = validateCharacter(ch, { rules: ['face-anchor-off-head'] });
    expect(r.findings.map((f) => f.view)).toEqual([0]);
    expect(r.findings[0]?.fix).toMatch(/faceAnchors\[0\]\.chin/);
  });

  it('face-anchor-off-head: at the 4 px boundary', () => {
    const anchors = T.faceAnchors;
    if (!anchors) throw new Error('fixture has face anchors');
    const ink = measureHead(T, 0).shut;
    const [hx, hy] = neckHead(T.neck[0]);
    const k = T.headScale;
    const dist = (y: number): number => inkDistance(ink, hx, hy + k * y).d;
    // head-local y straight under the front chin where the anchor is exactly d px off the ink
    const at = (d: number): number => {
      let lo = 0;
      let hi = 80;
      for (let i = 0; i < 60; i += 1) {
        const mid = (lo + hi) / 2;
        if (dist(mid) < d) lo = mid;
        else hi = mid;
      }
      return (lo + hi) / 2;
    };
    const run = (y: number): number =>
      validateCharacter(
        { ...T, faceAnchors: [{ chin: [0, y] }, anchors[1], anchors[2], anchors[3]] },
        { rules: ['face-anchor-off-head'], views: [0] },
      ).findings.length;
    expect(run(at(3.99))).toBe(0);
    expect(run(at(4.01))).toBe(1);
  });
});

/** The c-plus Captain bug: an open jaw moves a separate chin piece instead of the one outline. */
const detachedJaw: HeadDraw = (g, env, view, f) => {
  T.head(g, env, view, f);
  if (f.jaw > 0.5)
    blob(g, env, ellipseRing(0, 30 + f.jaw * 30, 30, 12, 8), T.tones.skin, { lw: 5, seed: 3 });
};

/** A beard drawn as a loop under the chin: the collar shows through the middle. */
const loopBeard: HeadDraw = (g, env, view, f) => {
  T.head(g, env, view, f);
  g.lineWidth = 8;
  g.beginPath();
  g.ellipse(0, 40, 34, 34, 0, 0, Math.PI * 2);
  g.stroke();
};

describe('head coherence', () => {
  it('head-pieces: a detached jaw tier only when the jaw opens', () => {
    const r = validateCharacter(
      { ...T, head: detachedJaw },
      { rules: ['head-pieces'], views: [0] },
    );
    expect(r.ok).toBe(false);
    expect(r.findings.length).toBeGreaterThan(0);
    for (const f of r.findings) {
      expect(f.pose).toMatch(/jaw (0\.9\d|1\.00)$/);
      expect(f.message).toMatch(/2 piece\(s\)/);
    }
    expect(r.findings.map((f) => f.pose)).toContain('deadpan jaw 1.00');
  });

  it('head-pieces: a hole through the head', () => {
    const r = validateCharacter({ ...T, head: loopBeard }, { rules: ['head-pieces'], views: [0] });
    expect(r.ok).toBe(false);
    expect(r.findings[0]?.message).toMatch(/[1-9] hole\(s\)/);
  });

  it('figure-pieces: a head lifted off the collar', () => {
    const floating: Character = {
      ...T,
      neck: [
        [0, -700],
        [12, -700],
        [26, -700],
        [0, -700],
      ],
    };
    const stand = TEST_POSES.find((p) => p.name === 'stand');
    if (!stand) throw new Error('the pose grid has a stand case');
    const opts = { rules: ['figure-pieces'] as RuleCode[], views: [0], poses: [stand] };
    expect(validateCharacter(T, opts).findings).toEqual([]);
    const r = validateCharacter(floating, opts);
    expect(r.findings).toHaveLength(1);
    expect(r.findings[0]).toMatchObject({
      code: 'figure-pieces',
      view: 0,
      pose: 'stand',
      measured: 2,
    });
  });
});
