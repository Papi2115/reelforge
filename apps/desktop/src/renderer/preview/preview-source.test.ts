import type { RenderManifest } from '@reelforge/shared';
import { describe, expect, it } from 'vitest';
import type { ProjectManifestResult } from '../../shared/snapshot-contract.js';
import { affectsPreview, NO_STORYBOARD_NOTE, resolvePreview } from './preview-source.js';

const manifest = (id: string): RenderManifest => ({
  version: 1,
  fps: 30,
  seed: 1,
  shots: [{ id, t0: 0, t1: 1, scene: { file: `scenes/${id}.js`, source: 'x' } }],
});

function api(
  result: ProjectManifestResult,
  variant: ProjectManifestResult = { status: 'no-storyboard' },
): Parameters<typeof resolvePreview>[1] {
  return {
    getDemoManifest: () => Promise.resolve(manifest('demo')),
    getProjectManifest: () => Promise.resolve(result),
    getVariantManifest: () => Promise.resolve(variant),
  };
}

describe('resolvePreview', () => {
  it('shows the demo on the start screen', async () => {
    const resolved = await resolvePreview({ kind: 'demo' }, api({ status: 'no-storyboard' }));
    expect(resolved).toEqual({ manifest: manifest('demo'), note: undefined });
  });

  it("shows the project's video when it can be built", async () => {
    const resolved = await resolvePreview(
      { kind: 'project', revision: 1 },
      api({ status: 'ready', manifest: manifest('s01') }),
    );
    expect(resolved).toEqual({ manifest: manifest('s01'), note: undefined });
  });

  it('falls back to the demo with a note', async () => {
    const source = { kind: 'project', revision: 2 } as const;
    expect(await resolvePreview(source, api({ status: 'no-storyboard' }))).toEqual({
      manifest: manifest('demo'),
      note: NO_STORYBOARD_NOTE,
    });
    const broken = await resolvePreview(
      source,
      api({ status: 'unavailable', reason: 'shot s02: scenes/s02.js is missing' }),
    );
    expect(broken.note).toBe(
      'Project preview unavailable (shot s02: scenes/s02.js is missing) · showing the demo scene',
    );
  });
});

describe('variant preview', () => {
  it('plays the variant manifest with a note, else the project video', async () => {
    const source = { kind: 'variant', revision: 3, shotId: 's01', key: 'v2' } as const;
    const ready = { status: 'ready', manifest: manifest('s01') } as const;
    const variant = { status: 'ready', manifest: manifest('v2') } as const;
    expect(await resolvePreview(source, api(ready, variant))).toEqual({
      manifest: manifest('v2'),
      note: 'Previewing variant 2 of s01 · not saved until you pick it',
    });
    const gone = { status: 'unavailable', reason: 'removed' } as const;
    expect(await resolvePreview(source, api(ready, gone))).toEqual({
      manifest: manifest('s01'),
      note: undefined,
    });
  });
});

describe('affectsPreview', () => {
  const event = (paths: string[], truncated = false) => ({ dir: 'C:\\x', paths, truncated });

  it('reacts to video inputs only', () => {
    expect(affectsPreview(event(['scenes/s01.js']))).toBe(true);
    expect(affectsPreview(event(['storyboard.json']))).toBe(true);
    expect(affectsPreview(event(['timing/words.json']))).toBe(true);
    expect(affectsPreview(event(['project.json']))).toBe(true);
    expect(affectsPreview(event(['kit-ext/props/fridge.js']))).toBe(true);
    expect(affectsPreview(event(['directions.json']))).toBe(true);
    expect(affectsPreview(event(['out/video.mp4', 'cues.json', 'script.txt']))).toBe(false);
    expect(affectsPreview(event([], true))).toBe(true);
  });
});
