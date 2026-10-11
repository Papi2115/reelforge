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
    expect(isOfferedStyle('c-cam', false)).toBe(false);
    expect(isOfferedStyle('noir-voxel', false)).toBe(true);
  });

  it('adds the five worlds as preview worlds with the switch on, built-ins first', () => {
    const choices = styleChoices(true);
    expect(choices.map((choice) => choice.id)).toEqual([
      ...BUILT_IN,
      'sketchbook',
      'comic',
      'game-b2',
      'game-b1',
      'c-cam',
    ]);
    // Grim Ink, wired in PLAN.md#14.12.
    expect(choices.at(-1)).toEqual({
      id: 'c-cam',
      label: 'Grim Ink',
      description:
        'Hand-inked grimy caricature cartoon in muddy full colour at 1080p, acting on twos.',
      world: true,
      preview: true,
    });
    expect(choices.at(-2)).toEqual({
      id: 'game-b1',
      label: 'Game B1: Atari boss montage',
      description: 'Atari 2600 game in a 1982 living room: CRT picture, boss cards, sticky notes.',
      world: true,
      preview: true,
    });
    expect(choices.at(-3)).toEqual({
      id: 'game-b2',
      label: 'Game B2: first-person RPG',
      description: 'First-person RPG: a corridor walk with a HUD, dialogue and inventory.',
      world: true,
      preview: true,
    });
    expect(choices.at(-4)).toEqual({
      id: 'comic',
      label: 'Comic',
      description: 'Comic book pages: panels, halftone print, speech bubbles and onomatopoeia.',
      world: true,
      preview: true,
    });
    expect(choices.at(-5)).toEqual({
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

  it('offers every registered world: none is still in development', () => {
    expect(WORLDS.filter((world) => !world.wired)).toEqual([]);
    expect(isOfferedStyle('c-cam', true)).toBe(true);
    expect(describeStyle('c-cam')?.world).toBe(true);
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
