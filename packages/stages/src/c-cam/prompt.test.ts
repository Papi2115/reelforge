/**
 * The style digest of the Grim Ink direction and module prompts (PLAN.md#14.17): the world's whole
 * craft brief, never cut. The quality lab's first round found the brief 34 characters over the
 * budget, so its last rule (the period's props) never reached the direction or module turns.
 */
import { worldPromptText } from '@reelforge/prompts';
import { describe, expect, it } from 'vitest';
import { STYLE_DIGEST_BUDGET, styleDigest } from './prompt.js';

describe('Grim Ink style digest', () => {
  it('carries the whole craft brief, its period rule included', () => {
    const brief = worldPromptText('c-cam')?.craftBrief ?? '';
    expect(brief.length).toBeLessThanOrEqual(STYLE_DIGEST_BUDGET);
    expect(styleDigest()).toBe(brief);
    expect(styleDigest()).toContain('Props and gag objects of the period');
    expect(styleDigest()).not.toContain('…');
  });
});
