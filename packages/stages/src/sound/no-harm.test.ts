/**
 * "No harm" for the voxel look (PLAN.md#12.24): films without other looks get exactly the cues and
 * the SFX + ambience buses they got before sound palettes existed. The fixture was captured from
 * the code before 12.24 (never regenerate it); a change here means voxel films sound different.
 * Compared as canonical JSON (key order kept), so reformatting the file does not matter.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { generateDefaultCues, type DefaultCuesInput } from '../stages/default-cues.js';
import {
  ALL_LOOKS,
  BROAD_FILM,
  EXAMPLE_SOUND_INPUT,
  GENERATED_MUSIC,
  MIXED_FILM,
  busHash,
} from '../testing/sound-films.js';

const FIXTURE = JSON.stringify(
  JSON.parse(
    readFileSync(path.join(import.meta.dirname, 'fixtures', 'voxel-cues.snapshot.json'), 'utf8'),
  ),
);

function voxelSnapshot(
  extra: Partial<DefaultCuesInput> = {},
  broad: DefaultCuesInput = BROAD_FILM,
): string {
  const example = generateDefaultCues({ ...EXAMPLE_SOUND_INPUT, ...extra });
  const underMusic = generateDefaultCues({
    ...EXAMPLE_SOUND_INPUT,
    music: GENERATED_MUSIC,
    ...extra,
  });
  const broadCues = generateDefaultCues({ ...broad, ...extra });
  return JSON.stringify({
    example,
    underMusic,
    broad: broadCues,
    busHashes: {
      example: busHash(example),
      underMusic: busHash(underMusic),
      broad: busHash(broadCues),
    },
  });
}

describe('voxel look: no harm (cues and buses captured before sound palettes)', () => {
  it('voxel films keep their cues and SFX + ambience buses', () => {
    expect(voxelSnapshot()).toBe(FIXTURE);
  }, 60_000);

  it('an all-voxel storyboard in a mixed project sounds the same', () => {
    const mixed = { palettes: { lookMode: 'mixed' as const, looks: ALL_LOOKS } };
    expect(voxelSnapshot(mixed)).toBe(FIXTURE);
  }, 60_000);

  it('a voxel-only project ignores the looks its storyboard names', () => {
    const voxelOnly = { palettes: { lookMode: 'voxel-only' as const, looks: ALL_LOOKS } };
    expect(voxelSnapshot(voxelOnly, MIXED_FILM)).toBe(FIXTURE);
  }, 60_000);
});
