/** The caption band of Grim Ink (PLAN.md#14.18): scene lettering stays above it when captions are on. */
import { describe, expect, it } from 'vitest';
import { slopSourceFindings, type AntiSlopSetup } from './guards.js';
import { buildVocabulary } from './vocabulary.js';
import { worldSlopSpec } from './world-labels.js';

const SPEC = worldSlopSpec('c-cam');
if (SPEC?.captionBand === undefined) throw new Error('no c-cam caption band');

const SCENE = `export function update(t, s) {
  s.stage.paint(t, (g, env) => {
    env.ink.drawText('CLOSED', { face: 'hand', size: 54, x: 1310, y: 380, seed: 12, fill: env.C.INK });
    env.ink.text('Tiberius', { role: 'label', x: 960, y: 960 });
    env.ink.drawText('RETIRED', { face: 'poster', size: 90, x: 960, y: 900, seed: 3, fill: env.C.EYE });
  });
}`;

const setup = (captions: boolean): AntiSlopSetup => ({
  vocabulary: buildVocabulary(['closed tiberius retired']),
  spec: SPEC,
  accent: undefined,
  ...(captions && SPEC.captionBand !== undefined ? { captionBand: SPEC.captionBand } : {}),
});

const band = (captions: boolean): string[] =>
  slopSourceFindings(setup(captions), SCENE, 'scenes/s07.js')
    .map((entry) => entry.message)
    .filter((message) => message.startsWith('caption band'));

describe('caption band', () => {
  it('flags lettering in the bottom 18 % only when captions are on', () => {
    expect(band(false)).toEqual([]);
    const found = band(true);
    expect(found).toHaveLength(2);
    expect(found[0]).toContain('text(…) at y 960');
    expect(found[1]).toContain('drawText(…) at y 900');
    expect(found[0]).toContain('letter above y 886');
  });
});
