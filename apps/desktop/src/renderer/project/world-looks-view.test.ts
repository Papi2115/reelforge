/** "Looks of this world" with on/off boxes (PLAN.md#14.12, Grim Ink). */
import { describe, expect, it } from 'vitest';
import type { LookSummary, ProjectStyle } from '../../shared/project-settings-contract.js';
import { toggledWorldLooks, worldLookToggles, worldRowNotice } from './world-settings-view.js';

const GRIM_INK: ProjectStyle = {
  id: 'c-cam',
  label: 'Grim Ink',
  description: 'Hand-inked grimy caricature cartoon.',
  world: true,
  preview: true,
  enabled: true,
  optionalLooks: true,
};
const LOOKS: LookSummary[] = [
  { id: 'ink-scene', label: 'Ink scene', description: 'the scene' },
  { id: 'ink-insert', label: 'Ink insert', description: 'the insert' },
  { id: 'ink-poster', label: 'Ink poster', description: 'the poster' },
];

describe('looks of a world whose looks are optional', () => {
  it('says the looks can be turned off, at least one staying on', () => {
    expect(worldRowNotice('look-mode', GRIM_INK)).toEqual({
      title: 'Looks of this world',
      reason:
        'A Grim Ink film mixes its own looks: turn off the ones this film should not use (at least one stays on). The voxel looks and look mode do not apply.',
    });
    expect(worldRowNotice('look-mode', { ...GRIM_INK, optionalLooks: false })?.reason).toBe(
      'A Grim Ink film always mixes its own looks; the voxel looks and look mode do not apply.',
    );
  });

  it('letters the looks that are on by place and marks the others off', () => {
    expect(worldLookToggles(LOOKS, null).map((look) => [look.title, look.checked])).toEqual([
      ['A · Ink scene', true],
      ['B · Ink insert', true],
      ['C · Ink poster', true],
    ]);
    const some = worldLookToggles(LOOKS, ['ink-poster', 'ink-insert']);
    expect(some.map((look) => look.title)).toEqual([
      'Off · Ink scene',
      'A · Ink insert',
      'B · Ink poster',
    ]);
    expect(some.every((look) => !look.locked)).toBe(true);
  });

  it('locks the last look on', () => {
    const one = worldLookToggles(LOOKS, ['ink-scene']);
    expect(one.map((look) => [look.checked, look.locked])).toEqual([
      [true, true],
      [false, false],
      [false, false],
    ]);
    // a list of unknown looks counts as all on
    expect(worldLookToggles(LOOKS, ['comic-story']).every((look) => look.checked)).toBe(true);
  });

  it('turns looks off and on in the world order; all on removes the field', () => {
    expect(toggledWorldLooks(LOOKS, null, 'ink-insert', false)).toEqual([
      'ink-scene',
      'ink-poster',
    ]);
    expect(toggledWorldLooks(LOOKS, ['ink-poster'], 'ink-scene', true)).toEqual([
      'ink-scene',
      'ink-poster',
    ]);
    expect(toggledWorldLooks(LOOKS, ['ink-scene', 'ink-poster'], 'ink-insert', true)).toBeNull();
    // never the last one
    expect(toggledWorldLooks(LOOKS, ['ink-scene'], 'ink-scene', false)).toEqual(['ink-scene']);
  });
});
