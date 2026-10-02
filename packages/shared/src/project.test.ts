import { describe, expect, it } from 'vitest';
import { briefFileSchema, projectFileSchema } from './index.js';

describe('projectFileSchema', () => {
  const project = {
    version: 1,
    title: 'Doom on a calculator',
    language: 'en',
    style: 'voxel-pixel-crisp640',
    fps: 30,
    seed: 2115,
  };

  it('accepts a minimal project and optional models/palette', () => {
    expect(projectFileSchema.safeParse(project).success).toBe(true);
    const full = {
      ...project,
      models: { scenes: 'opus' },
      palette: { wood: '#8a5a2b', woodDark: '#4a2a10' },
    };
    expect(projectFileSchema.safeParse(full).success).toBe(true);
  });

  it('reports wrong versions, languages and seeds by path', () => {
    const result = projectFileSchema.safeParse({
      ...project,
      version: 2,
      language: 'de',
      seed: -1,
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path.join('.')).sort()).toEqual([
      'language',
      'seed',
      'version',
    ]);
  });
});

describe('briefFileSchema', () => {
  it('needs a topic and a language', () => {
    expect(briefFileSchema.safeParse({ version: 1, topic: 'x', language: 'pl' }).success).toBe(
      true,
    );
    expect(briefFileSchema.safeParse({ version: 1, language: 'pl' }).success).toBe(false);
  });
});
