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

  it('lists all three Grim Ink looks with the switch on, even those a project turned off', () => {
    // Wired in PLAN.md#14.12; the dialog shows every look of the world with its on/off box.
    expect(lookSummaries('c-cam', true).map((look) => look.id)).toEqual([
      'ink-scene',
      'ink-insert',
      'ink-poster',
    ]);
    expect(lookSummaries('c-cam', false)).toEqual([]);
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

  it('lets Grim Ink build with the switch on and says its looks can be turned off', () => {
    // No world is in development since PLAN.md#14.12.
    expect(WORLDS.filter((world) => !world.wired)).toEqual([]);
    for (const id of ['game-b1', 'sketchbook', 'comic', 'game-b2', 'c-cam']) {
      expect(projectStyle(id, true), id).not.toHaveProperty('inDevelopment');
    }
    expect(projectStyle('c-cam', true)).toMatchObject({
      label: 'Grim Ink',
      world: true,
      preview: true,
      enabled: true,
      optionalLooks: true,
    });
    expect(projectStyle('c-cam', false)).toMatchObject({ preview: true, enabled: false });
    for (const id of ['sketchbook', 'comic', 'game-b2', 'game-b1', 'noir-voxel']) {
      expect(projectStyle(id, true), id).not.toHaveProperty('optionalLooks');
    }
  });
});
