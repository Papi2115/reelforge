import { listLooks } from '@reelforge/kit';
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
  });

  it('lists no looks for a world that is not wired yet, switch or not', () => {
    for (const style of ['game-b2']) {
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
    expect(projectStyle('game-b2', true)).toMatchObject({
      world: true,
      enabled: false,
      inDevelopment: true,
    });
    expect(projectStyle('game-b2', false)).toMatchObject({ enabled: false, inDevelopment: true });
    expect(projectStyle('sketchbook', true)).not.toHaveProperty('inDevelopment');
    expect(projectStyle('comic', true)).not.toHaveProperty('inDevelopment');
  });
});
