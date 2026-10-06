import type { RenderManifest } from '@reelforge/shared';
import { describe, expect, it } from 'vitest';
import type { ProjectManifestResult } from '../../shared/snapshot-contract.js';
import {
  affectsPreview,
  emptyStagePlayback,
  emptyStageTitle,
  resolvePreview,
} from './preview-source.js';

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
    expect(resolved).toEqual({ kind: 'video', manifest: manifest('demo'), note: undefined });
  });

  it("shows the project's video when it can be built", async () => {
    const resolved = await resolvePreview(
      { kind: 'project', revision: 1 },
      api({ status: 'ready', manifest: manifest('s01') }),
    );
    expect(resolved).toEqual({ kind: 'video', manifest: manifest('s01'), note: undefined });
  });

  it("shows the project's video with placeholders and says how many shots are built", async () => {
    const three: RenderManifest = {
      ...manifest('s01'),
      shots: ['s01', 's02', 's03'].map((id, index) => ({
        id,
        t0: index,
        t1: index + 1,
        scene: { file: `scenes/${id}.js`, source: 'x' },
      })),
    };
    const resolved = await resolvePreview(
      { kind: 'project', revision: 1 },
      api({ status: 'ready', manifest: three, placeholderShots: ['s02', 's03'] }),
    );
    expect(resolved).toEqual({
      kind: 'video',
      manifest: three,
      note: '1 of 3 shots built — the rest show placeholders',
    });
  });

  it('shows the empty stage, never the demo, while a project has no video', async () => {
    let demoAsked = false;
    const projectApi = (result: ProjectManifestResult): Parameters<typeof resolvePreview>[1] => ({
      ...api(result),
      getDemoManifest: () => {
        demoAsked = true;
        return Promise.resolve(manifest('demo'));
      },
    });
    const source = { kind: 'project', revision: 2 } as const;
    expect(await resolvePreview(source, projectApi({ status: 'no-storyboard' }))).toEqual({
      kind: 'empty',
      problem: undefined,
    });
    const broken = await resolvePreview(
      source,
      projectApi({ status: 'unavailable', reason: 'shot s02: scenes/s02.js is missing' }),
    );
    expect(broken).toEqual({
      kind: 'empty',
      problem: 'The preview cannot be built: shot s02: scenes/s02.js is missing',
    });
    expect(demoAsked).toBe(false);
  });

  it('titles the empty stage with the next action', () => {
    expect(emptyStageTitle('Describe the video in the brief, then write the script.')).toBe(
      'Nothing to show yet — Describe the video in the brief, then write the script.',
    );
    expect(emptyStageTitle(undefined)).toBe(
      'Nothing to show yet — Your video plays here once its shots are planned.',
    );
  });
});

describe('emptyStagePlayback', () => {
  it('gives the player the voiceover length, so it plays before the storyboard exists', () => {
    expect(emptyStagePlayback(31.25, { duration: 0 })).toEqual({ duration: 31.25 });
    expect(emptyStagePlayback(31.25, { duration: 31.25 })).toBeNull();
  });

  it('has nothing to play without audio and stops a video that went away', () => {
    expect(emptyStagePlayback(0, { duration: 0 })).toBeNull();
    expect(emptyStagePlayback(0, { duration: 12 })).toEqual({ duration: 0 });
    expect(emptyStagePlayback(Number.NaN, { duration: 0 })).toBeNull();
  });
});

describe('variant preview', () => {
  it('plays the variant manifest with a note, else the project video', async () => {
    const source = { kind: 'variant', revision: 3, shotId: 's01', key: 'v2' } as const;
    const ready = { status: 'ready', manifest: manifest('s01') } as const;
    const variant = { status: 'ready', manifest: manifest('v2') } as const;
    expect(await resolvePreview(source, api(ready, variant))).toEqual({
      kind: 'video',
      manifest: manifest('v2'),
      note: 'Previewing variant 2 of s01 · not saved until you pick it',
    });
    const gone = { status: 'unavailable', reason: 'removed' } as const;
    expect(await resolvePreview(source, api(ready, gone))).toEqual({
      kind: 'video',
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
    expect(affectsPreview(event(['characters/roles/firefighter.json']))).toBe(true);
    expect(affectsPreview(event(['characters/accessories/shoulderRadio.json']))).toBe(true);
    expect(affectsPreview(event(['out/video.mp4', 'cues.json', 'script.txt']))).toBe(false);
    expect(affectsPreview(event([], true))).toBe(true);
  });
});
