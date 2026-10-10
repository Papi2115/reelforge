import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DEFAULT_ENV } from './brushes.js';
import { characterSchema } from './character.js';
import { face } from './face.js';
import { RecordingPaint } from './recording-paint.js';
import { proj, viewState } from './rig-views.js';
import { TEST_CHARACTER, WARDEN_DIMS as D } from './test-character.js';

describe('TEST_CHARACTER', () => {
  it('validates against characterSchema (incl. hsz, head box and face anchors)', () => {
    const parsed = characterSchema.parse(TEST_CHARACTER);
    expect(parsed).toEqual(TEST_CHARACTER);
    expect(parsed.D.hsz).toBe(parsed.arm.hsz);
    expect(parsed.D.head).toBeDefined();
    expect(parsed.faceAnchors).toHaveLength(4);
  });

  it('rejects a malformed face anchor table', () => {
    const bad = { ...TEST_CHARACTER, faceAnchors: [{ chin: [1] }, {}, {}, {}] };
    expect(characterSchema.safeParse(bad).success).toBe(false);
    expect(
      characterSchema.safeParse({ ...TEST_CHARACTER, faceAnchors: [{}, {}, {}] }).success,
    ).toBe(false);
  });

  it('keeps the shoulder joints below the head box in every view', () => {
    const head = D.head;
    if (!head) throw new Error('missing head box');
    for (const yaw of [0, 1, 2, 3, -1, -2, -3]) {
      for (const sgn of [1, -1]) {
        const s = proj(viewState(yaw), [sgn * D.sw, D.sy, D.sz || 0]);
        expect(s[1]).toBeGreaterThan(head.bottom);
      }
    }
  });

  it('draws every torso and head view', () => {
    for (const v of [0, 1, 2, 3] as const) {
      const g = new RecordingPaint();
      TEST_CHARACTER.torso(g, DEFAULT_ENV, v);
      TEST_CHARACTER.head(g, DEFAULT_ENV, v, face(0, TEST_CHARACTER.seed, 'shock'));
      expect(g.calls.length).toBeGreaterThan(100);
    }
  });
});

describe('rig / contact / figure hygiene', () => {
  const files = [
    'rig-views.ts',
    'rig-ik.ts',
    'rig-layers.ts',
    'rig-limbs.ts',
    'character.ts',
    'contact.ts',
    'figure.ts',
    'anchors.ts',
    'index.ts',
    'test-character.ts',
    'test-character-head.ts',
  ];
  const forbidden =
    /\b(Date|performance|document|window|requestAnimationFrame|setTimeout|setInterval|fillText|strokeText|filter|fetch)\b|Math\.random/;

  it('has no forbidden identifiers (comments excluded) and stays within 400 lines', () => {
    for (const name of files) {
      const source = readFileSync(fileURLToPath(new URL(name, import.meta.url)), 'utf8');
      const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
      expect(forbidden.exec(code)?.[0], name).toBeUndefined();
      expect(source.split('\n').length, name).toBeLessThanOrEqual(400);
    }
  });
});
