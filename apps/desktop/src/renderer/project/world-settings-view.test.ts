import { describe, expect, it } from 'vitest';
import type { ProjectStyle } from '../../shared/project-settings-contract.js';
import { styleChoices } from '../../shared/style-choices.js';
import { OPTION_ROW_IDS, PROJECT_SETTINGS_ROWS } from './project-settings-view.js';
import {
  chosenStyle,
  rollLetter,
  styleBlockedText,
  worldLookLines,
  worldRowNotice,
} from './world-settings-view.js';

const SKETCHBOOK: ProjectStyle = {
  id: 'sketchbook',
  label: 'Sketchbook',
  description: 'Hand-drawn notebook.',
  world: true,
  preview: true,
  enabled: true,
};
const CRISP: ProjectStyle = {
  id: 'voxel-pixel-crisp640',
  label: 'Voxel Pixel · Crisp 640',
  description: 'Voxel.',
  world: false,
  preview: false,
  enabled: true,
};

describe('New project style (PLAN.md#13.6)', () => {
  it("starts with the settings' default style and keeps the user's offered pick", () => {
    const off = styleChoices(false);
    const on = styleChoices(true);
    expect(chosenStyle(undefined, 'noir-voxel', off)).toBe('noir-voxel');
    expect(chosenStyle(undefined, undefined, off)).toBe('voxel-pixel-crisp640');
    expect(chosenStyle('sketchbook', 'noir-voxel', on)).toBe('sketchbook');
    // Switched off again: the preview world is no longer offered.
    expect(chosenStyle('sketchbook', 'noir-voxel', off)).toBe('noir-voxel');
    expect(chosenStyle(undefined, 'gone-style', off)).toBe('voxel-pixel-crisp640');
    expect(chosenStyle(undefined, undefined, [])).toBeUndefined();
  });
});

describe('Project settings in a world (PLAN.md#13.6)', () => {
  it('shows the read-only Style row first under Visuals', () => {
    expect(PROJECT_SETTINGS_ROWS[0]).toEqual({ id: 'style', section: 'visuals' });
  });

  it('replaces look mode, characters and mascot with a reason in a world only', () => {
    const replaced = OPTION_ROW_IDS.filter((id) => worldRowNotice(id, SKETCHBOOK) !== undefined);
    expect(replaced).toEqual(['look-mode', 'characters', 'mascot']);
    expect(OPTION_ROW_IDS.filter((id) => worldRowNotice(id, CRISP) !== undefined)).toEqual([]);
    expect(worldRowNotice('mascot', undefined)).toBeUndefined();
    expect(worldRowNotice('look-mode', SKETCHBOOK)).toEqual({
      title: 'Looks of this world',
      reason:
        'A Sketchbook film always mixes its own looks; the voxel looks and look mode do not apply.',
    });
    expect(worldRowNotice('characters', SKETCHBOOK)?.reason).toBe(
      'Sketchbook draws its own heroes: the character pack and the classic hero are not used.',
    );
  });

  it('lists the world looks as A/B/C rolls', () => {
    expect(rollLetter(0)).toBe('A');
    expect(rollLetter(2)).toBe('C');
    const lines = worldLookLines([
      { id: 'sketch-story', label: 'Sketch story', description: 'felt-tip pages' },
      { id: 'sketch-graph', label: 'Sketch graph', description: 'ballpoint proofs' },
    ]);
    expect(lines.map((line) => line.title)).toEqual(['A · Sketch story', 'B · Sketch graph']);
  });

  it('says how to build a preview world while the switch is off', () => {
    expect(styleBlockedText(SKETCHBOOK)).toBeUndefined();
    expect(styleBlockedText({ ...SKETCHBOOK, enabled: false })).toBe(
      'Sketchbook is a preview world: turn on Settings → Projects → “Experimental worlds (preview)” to build this project in it.',
    );
    expect(styleBlockedText(CRISP)).toBeUndefined();
  });

  it('says a world still in development cannot be built, switch or not', () => {
    const comic = { ...SKETCHBOOK, id: 'comic', label: 'Comic', enabled: false };
    expect(styleBlockedText({ ...comic, inDevelopment: true })).toBe(
      'Comic is a world still in development: it cannot be built yet. Choose another style for a new project.',
    );
  });
});
