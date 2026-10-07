import { listLooks, WORLDS } from '@reelforge/kit';
import { describe, expect, it } from 'vitest';
import { lookSummaries, projectStyle } from './project-settings-ipc.js';

describe('lookSummaries', () => {
  it('lists the available looks of the kit registry, voxel first', () => {
    const summaries = lookSummaries();
    expect(summaries.map((look) => look.id)).toEqual(listLooks().map((look) => look.id));
    expect(summaries[0]?.id).toBe('voxel');
    for (const look of summaries) expect(Object.keys(look)).toEqual(['id', 'label', 'description']);
    // Every built-in style offers the same looks, experimental switch or not.
    expect(lookSummaries('noir-voxel', true)).toEqual(summaries);
  });

  it("lists a world's own A/B/C looks only with experimental worlds on (PLAN.md#13.6)", () => {
    expect(lookSummaries('sketchbook', true).map((look) => look.id)).toEqual([
      'sketch-story',
      'sketch-graph',
      'sketch-loud',
    ]);
    expect(lookSummaries('sketchbook', false)).toEqual([]);
    expect(lookSummaries('comic', true).map((look) => look.id)).toEqual([
      'comic-story',
      'comic-info',
      'comic-loud',
    ]);
    expect(lookSummaries('comic', false)).toEqual([]);
    expect(lookSummaries('game-b2', true).map((look) => look.id)).toEqual([
      'rpg-explore',
      'rpg-menu',
      'rpg-boss',
    ]);
    expect(lookSummaries('game-b2', false)).toEqual([]);
    expect(lookSummaries('game-b1', true).map((look) => look.id)).toEqual([
      'atari-story',
      'atari-menu',
      'atari-boss',
    ]);
    expect(lookSummaries('game-b1', false)).toEqual([]);
  });

  it('lists no looks for a world that is not wired yet, switch or not', () => {
    // Every registered world is wired today (Game B1 last, PLAN.md#13.5 part c).
    const unwired = WORLDS.filter((world) => !world.wired).map((world) => world.id);
    expect(unwired).toEqual([]);
    for (const style of unwired) {
      expect(lookSummaries(style, true)).toEqual([]);
      expect(lookSummaries(style, false)).toEqual([]);
    }
  });
});

describe('projectStyle', () => {
  it('describes a world style and whether the switch lets it build', () => {
    expect(projectStyle('sketchbook', true)).toMatchObject({
      label: 'Sketchbook',
      world: true,
      preview: true,
      enabled: true,
    });
    expect(projectStyle('sketchbook', false)).toMatchObject({ preview: true, enabled: false });
    expect(projectStyle('comic', true)).toMatchObject({
      label: 'Comic',
      world: true,
      enabled: true,
    });
    expect(projectStyle('comic', false)).toMatchObject({ preview: true, enabled: false });
    expect(projectStyle('game-b2', true)).toMatchObject({
      label: 'Game B2: first-person RPG',
      world: true,
      enabled: true,
    });
    expect(projectStyle('game-b2', false)).toMatchObject({ preview: true, enabled: false });
    expect(projectStyle('game-b1', true)).toMatchObject({
      label: 'Game B1: Atari boss montage',
      world: true,
      enabled: true,
    });
    expect(projectStyle('game-b1', false)).toMatchObject({ preview: true, enabled: false });
    expect(projectStyle('my-own-style', false)).toEqual({
      id: 'my-own-style',
      label: 'my-own-style',
      description: '',
      world: false,
      preview: false,
      enabled: true,
    });
  });

  it('never lets a world that is not wired yet build, and says it is in development', () => {
    // Every registered world is wired today: none of them is "in development".
    expect(WORLDS.filter((world) => !world.wired)).toEqual([]);
    expect(projectStyle('game-b1', true)).not.toHaveProperty('inDevelopment');
    expect(projectStyle('sketchbook', true)).not.toHaveProperty('inDevelopment');
    expect(projectStyle('comic', true)).not.toHaveProperty('inDevelopment');
    expect(projectStyle('game-b2', true)).not.toHaveProperty('inDevelopment');
  });
});
