import { STYLE_REGISTRY } from '@reelforge/engine';
import { WORLDS } from '@reelforge/kit';
import { describe, expect, it } from 'vitest';
import {
  describeStyle,
  isOfferedStyle,
  STYLE_DESCRIPTIONS,
  styleChoices,
  styleLabel,
} from './style-choices.js';

const BUILT_IN = ['voxel-pixel-crisp640', 'noir-voxel', 'soft-480'];

describe('style choices (PLAN.md#13.6)', () => {
  it('offers the built-in styles only while experimental worlds are off', () => {
    expect(styleChoices(false).map((choice) => choice.id)).toEqual(BUILT_IN);
    expect(styleChoices(false).every((choice) => !choice.world && !choice.preview)).toBe(true);
    expect(isOfferedStyle('sketchbook', false)).toBe(false);
    expect(isOfferedStyle('comic', false)).toBe(false);
    expect(isOfferedStyle('game-b2', false)).toBe(false);
    expect(isOfferedStyle('game-b1', false)).toBe(false);
    expect(isOfferedStyle('noir-voxel', false)).toBe(true);
  });

  it('adds Sketchbook, Comic, Game B2 and Game B1 as preview worlds with the switch on, built-ins first', () => {
    const choices = styleChoices(true);
    expect(choices.map((choice) => choice.id)).toEqual([
      ...BUILT_IN,
      'sketchbook',
      'comic',
      'game-b2',
      'game-b1',
    ]);
    expect(choices.at(-1)).toEqual({
      id: 'game-b1',
      label: 'Game B1: Atari boss montage',
      description: 'Atari 2600 game in a 1982 living room: CRT picture, boss cards, sticky notes.',
      world: true,
      preview: true,
    });
    expect(choices.at(-2)).toEqual({
      id: 'game-b2',
      label: 'Game B2: first-person RPG',
      description: 'First-person RPG: a corridor walk with a HUD, dialogue and inventory.',
      world: true,
      preview: true,
    });
    expect(choices.at(-3)).toEqual({
      id: 'comic',
      label: 'Comic',
      description: 'Comic book pages: panels, halftone print, speech bubbles and onomatopoeia.',
      world: true,
      preview: true,
    });
    expect(choices.at(-4)).toEqual({
      id: 'sketchbook',
      label: 'Sketchbook',
      description:
        'Hand-drawn notebook: felt-tip pages, graph paper, pop-up and accordion moments.',
      world: true,
      preview: true,
    });
    expect(isOfferedStyle('sketchbook', true)).toBe(true);
    expect(isOfferedStyle('comic', true)).toBe(true);
    expect(isOfferedStyle('game-b2', true)).toBe(true);
    expect(isOfferedStyle('game-b1', true)).toBe(true);
    expect(isOfferedStyle('no-such-style', true)).toBe(false);
  });

  it('never offers a world that is not wired yet, switch or not', () => {
    // Grim Ink (c-cam, PLAN.md#14.2) is registered but not wired yet.
    const unwired = WORLDS.filter((world) => !world.wired).map((world) => world.id);
    expect(unwired).toEqual(['c-cam']);
    expect(styleChoices(true).map((choice) => choice.id)).not.toContain('c-cam');
    for (const id of unwired) {
      expect(STYLE_REGISTRY.allIds).toContain(id);
      expect(isOfferedStyle(id, true)).toBe(false);
      expect(isOfferedStyle(id, false)).toBe(false);
      // Still described (the header names a hand-edited project's style).
      expect(describeStyle(id)?.world).toBe(true);
    }
  });

  it('has a one-line description for every registered style', () => {
    for (const id of STYLE_REGISTRY.allIds) {
      const description = STYLE_DESCRIPTIONS[id] ?? '';
      expect(description.length, id).toBeGreaterThan(20);
      expect(description.length, id).toBeLessThanOrEqual(90);
      expect(describeStyle(id)?.description).toBe(description);
    }
  });

  it('names styles by their display name, a world by its own, unknown ids as is', () => {
    expect(styleLabel('voxel-pixel-crisp640')).toBe('Voxel Pixel · Crisp 640');
    expect(styleLabel('sketchbook')).toBe('Sketchbook');
    expect(styleLabel('my-own-style')).toBe('my-own-style');
    expect(describeStyle('my-own-style')).toBeUndefined();
  });
});
