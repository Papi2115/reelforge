import type { CharacterSettings } from '@reelforge/prompts';
import type { StoryboardShot } from '@reelforge/shared';
import { describe, expect, it } from 'vitest';
import { characterSourceFindings } from './source-checks-characters.js';

const SHOT: StoryboardShot = {
  id: 's04',
  t0: 20,
  t1: 26,
  treatment: 'data-chart-3d',
  intent: 'Sales by year.',
  scene: 'scenes/s04.js',
};
const MASCOT_SHOT: StoryboardShot = {
  ...SHOT,
  mascot: { role: 'pointer', action: 'points at the 2007 bar' },
};
const FOX: CharacterSettings = { characters: 'pack', mascot: 'fox' };
const PACK: CharacterSettings = { characters: 'pack', mascot: 'none' };
const CLASSIC: CharacterSettings = { characters: 'classic', mascot: 'none' };

const FOX_SCENE = "const fox = ctx.kit.cast.mascot('fox', { pose: 'point' });";
const BULB_SCENE = 'const bulb = ctx.kit.cast.mascot("bulb");';
const PERSON_SCENE = "const doc = ctx.kit.cast.person('doctor');";
const HERO_SCENE = 'const hero = ctx.kit.props.character({ pose: "wave" });';

const summary = (findings: readonly { severity: string; message: string }[]): string[] =>
  findings.map((entry) => `${entry.severity}: ${entry.message.split(':')[1]?.trim() ?? ''}`);

describe('characterSourceFindings (PLAN.md#12.20)', () => {
  it('accepts the chosen mascot where the storyboard plans it', () => {
    expect(characterSourceFindings(FOX_SCENE, 's04.js', MASCOT_SHOT, FOX)).toEqual([]);
    expect(characterSourceFindings(PERSON_SCENE, 's04.js', SHOT, FOX)).toEqual([]);
  });

  it('asks for the mascot in a planned mascot shot, and for the right one', () => {
    const missing = characterSourceFindings(PERSON_SCENE, 's04.js', MASCOT_SHOT, FOX);
    expect(missing).toHaveLength(1);
    expect(missing[0]).toMatchObject({ severity: 'error', source: 'scene' });
    expect(missing[0]?.message).toContain("never calls kit.cast.mascot('fox')");
    const wrong = characterSourceFindings(BULB_SCENE, 's04.js', MASCOT_SHOT, FOX);
    expect(wrong).toHaveLength(1);
    expect(wrong[0]?.message).toContain("calls kit.cast.mascot('bulb') but the channel's mascot");
  });

  it('warns about a mascot the storyboard did not plan', () => {
    expect(summary(characterSourceFindings(FOX_SCENE, 's04.js', SHOT, FOX))).toEqual([
      'warning: shows the mascot although the storyboard did not plan it in this shot (its screen time is planned sparsely); remove it or plan it in the storyboard.',
    ]);
    expect(characterSourceFindings(FOX_SCENE, 's04.js', SHOT, PACK)[0]?.message).toContain(
      'this project has none',
    );
  });

  it('warns about the classic hero in a pack project and kit.cast in a classic one', () => {
    const hero = characterSourceFindings(HERO_SCENE, 's04.js', SHOT, PACK);
    expect(hero).toHaveLength(1);
    expect(hero[0]).toMatchObject({ severity: 'warning' });
    expect(hero[0]?.message).toContain('kit.props.character (the classic hoodie hero)');
    const cast = characterSourceFindings(PERSON_SCENE, 's04.js', SHOT, CLASSIC);
    expect(cast[0]?.message).toContain('uses kit.cast (the character pack)');
    // A pre-2.3.5 scene in a classic project: nothing.
    expect(characterSourceFindings(HERO_SCENE, 's04.js', SHOT, CLASSIC)).toEqual([]);
  });
});
