import { describe, expect, it } from 'vitest';
import { projectFileSchema } from './project.js';
import { enabledWorldLooks, worldLooksSchema, worldRollLetter } from './world-looks.js';

const LOOKS = [{ id: 'ink-scene' }, { id: 'ink-insert' }, { id: 'ink-poster' }];
const ids = (looks: readonly { id: string }[]): string[] => looks.map((look) => look.id);

describe('world looks of a project (PLAN.md#14.12)', () => {
  it('keeps every look when the project names none', () => {
    expect(ids(enabledWorldLooks(LOOKS, undefined))).toEqual([
      'ink-scene',
      'ink-insert',
      'ink-poster',
    ]);
  });

  it('keeps the named looks in the world order', () => {
    expect(ids(enabledWorldLooks(LOOKS, ['ink-poster', 'ink-scene']))).toEqual([
      'ink-scene',
      'ink-poster',
    ]);
    expect(ids(enabledWorldLooks(LOOKS, ['ink-insert', 'comic-story']))).toEqual(['ink-insert']);
  });

  it('never leaves a film without looks', () => {
    expect(ids(enabledWorldLooks(LOOKS, ['comic-story']))).toEqual(ids(LOOKS));
  });

  it('letters the rolls by place', () => {
    expect([0, 1, 2].map(worldRollLetter)).toEqual(['A', 'B', 'C']);
  });

  it('needs at least one look, no duplicates, kebab-case ids', () => {
    expect(worldLooksSchema.safeParse(['ink-scene']).success).toBe(true);
    expect(worldLooksSchema.safeParse([]).success).toBe(false);
    expect(worldLooksSchema.safeParse(['ink-scene', 'ink-scene']).success).toBe(false);
    expect(worldLooksSchema.safeParse(['Ink Scene']).success).toBe(false);
  });

  it('is an optional project.json field', () => {
    const project = {
      version: 1,
      title: 'Grim',
      language: 'en',
      style: 'c-cam',
      fps: 24,
      seed: 7,
    };
    expect(projectFileSchema.safeParse(project).success).toBe(true);
    expect(projectFileSchema.safeParse({ ...project, worldLooks: ['ink-scene'] }).success).toBe(
      true,
    );
    expect(projectFileSchema.safeParse({ ...project, worldLooks: [] }).success).toBe(false);
  });
});
