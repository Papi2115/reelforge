/** The storyboard's annotation plan reaches the scene-build prompt as hints (PLAN.md#11.8). */
import type { StoryboardShot } from '@reelforge/shared';
import { describe, expect, it } from 'vitest';
import { render } from '../stages/repair.js';
import { annotationPlanText } from './shot-job.js';

const SHOT: StoryboardShot = {
  id: 's03_calc',
  t0: 4,
  t1: 9,
  treatment: 'metaphor-object',
  intent: 'The calculator on the desk; lands on "the keypad".',
  scene: 'scenes/s03_calc.js',
};

function buildPrompt(shot: StoryboardShot): string {
  const prompt = render('scene-build', {
    shotId: shot.id,
    shotScene: shot.scene,
    shotJson: shot,
    shotWords: [],
    neighbours: [],
    styleId: 'voxel-pixel-crisp640',
    annotationPlan: annotationPlanText(shot),
  });
  if (!prompt.ok) throw new Error('scene-build did not render');
  return prompt.value;
}

describe('annotation plan in the scene-build prompt', () => {
  it('lists the planned marks as hints with ctx.annotate and leaves the section out otherwise', () => {
    const planned: StoryboardShot = {
      ...SHOT,
      annotations: [
        { kind: 'arrow', phrase: 'the keypad', target: 'calculator keypad', reason: 'place' },
        { kind: 'pin', phrase: 'Casio', target: 'calculator', text: 'CASIO FX', reason: 'name' },
      ],
    };
    expect(annotationPlanText(planned)).toBe(
      [
        '- "the keypad" (place): arrow on calculator keypad',
        '- "Casio" (name): pin on calculator, text "CASIO FX"',
      ].join('\n'),
    );
    const prompt = buildPrompt(planned);
    expect(prompt).toContain('Annotation plan from the storyboard (hints, not orders)');
    expect(prompt).toContain('`ctx.annotate.*`');
    expect(prompt).toContain('- "Casio" (name): pin on calculator, text "CASIO FX"');
    expect(annotationPlanText(SHOT)).toBeUndefined();
    expect(buildPrompt(SHOT)).not.toContain('Annotation plan');
  });
});
