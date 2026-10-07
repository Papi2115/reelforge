/** Style checks of `reelforge validate` / `status` with world styles (PLAN.md#13, ADR-029). */
import { STYLE_REGISTRY, type StyleRegistry } from '@reelforge/engine';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EXPERIMENTAL_WORLDS_ENV } from '../commands/kit-docs-world.js';
import { copyFixtureProject, runCli } from '../testing/fixture.js';
import { styleProblems } from './checks.js';

/** The same styles with Sketchbook shipped (no longer experimental). */
const SHIPPED: StyleRegistry = {
  ids: STYLE_REGISTRY.allIds,
  allIds: STYLE_REGISTRY.allIds,
  entry: (id) => STYLE_REGISTRY.entry(id),
  find: (id) => STYLE_REGISTRY.find(id),
  isExperimental: () => false,
};

describe('styleProblems', () => {
  it('accepts built-in styles either way', () => {
    expect(styleProblems('noir-voxel', STYLE_REGISTRY, false)).toEqual([]);
    expect(styleProblems('noir-voxel', STYLE_REGISTRY, true)).toEqual([]);
  });

  it('accepts an experimental world style only with experimental worlds on', () => {
    expect(STYLE_REGISTRY.isExperimental('comic')).toBe(true);
    expect(styleProblems('comic', STYLE_REGISTRY, true)).toEqual([]);
    expect(styleProblems('comic', STYLE_REGISTRY, false)[0]?.message).toBe(
      'style "comic" is an experimental world; turn on Experimental worlds in Settings',
    );
    expect(STYLE_REGISTRY.isExperimental('sketchbook')).toBe(true);
    expect(styleProblems('sketchbook', STYLE_REGISTRY, true)).toEqual([]);
    expect(styleProblems('sketchbook', STYLE_REGISTRY, false)).toEqual([
      {
        severity: 'error',
        file: 'project.json',
        at: 'style',
        message:
          'style "sketchbook" is an experimental world; turn on Experimental worlds in Settings',
        fix: 'do not change the style yourself: ask the user to turn on Experimental worlds in Settings',
      },
    ]);
  });

  it('accepts a shipped world style without the switch', () => {
    expect(styleProblems('sketchbook', SHIPPED, false)).toEqual([]);
  });

  it('rejects unknown styles, listing world styles only when they are usable', () => {
    const [off] = styleProblems('vaporwave', STYLE_REGISTRY, false);
    expect(off?.message).toBe('unknown style preset "vaporwave"');
    expect(off?.fix).toBe('use one of: voxel-pixel-crisp640, noir-voxel, soft-480');
    const [on] = styleProblems('vaporwave', STYLE_REGISTRY, true);
    expect(on?.fix).toBe(
      'use one of: voxel-pixel-crisp640, noir-voxel, soft-480, sketchbook, comic',
    );
  });

  it('rejects a world that is not wired yet, switch or not, even when shipped', () => {
    for (const style of ['game-b2']) {
      expect(STYLE_REGISTRY.entry(style)).toBeDefined();
      for (const registry of [STYLE_REGISTRY, SHIPPED]) {
        for (const experimental of [false, true]) {
          expect(styleProblems(style, registry, experimental)).toEqual([
            {
              severity: 'error',
              file: 'project.json',
              at: 'style',
              message: `style "${style}" is a world still in development; it cannot be used for a project yet`,
              fix: 'do not change the style yourself: ask the user to pick another style for this project',
            },
          ]);
        }
      }
    }
  });
});

describe('reelforge validate on a Sketchbook project', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it(`passes with ${EXPERIMENTAL_WORLDS_ENV}=1 and explains the switch without it`, async () => {
    const project = await copyFixtureProject();
    try {
      await project.edit('project.json', '"voxel-pixel-crisp640"', '"sketchbook"');
      vi.stubEnv(EXPERIMENTAL_WORLDS_ENV, '1');
      const on = await runCli(project.root, 'validate');
      expect(on.stdout).toContain('0 errors');
      expect(on.code).toBe(0);
      vi.stubEnv(EXPERIMENTAL_WORLDS_ENV, '');
      const off = await runCli(project.root, 'validate');
      expect(off.code).toBe(1);
      expect(off.stdout).toContain(
        'style "sketchbook" is an experimental world; turn on Experimental worlds in Settings',
      );
    } finally {
      await project.remove();
    }
  });
});
