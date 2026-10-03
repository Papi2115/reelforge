/**
 * Palette `voxel` = the 1.x sound design, unchanged: the `CUE_RULES` choices, scene sounds as the
 * scene asked, no look accents, room-tone / hum beds alternating per shot group (-28 dB) and one
 * faint room-tone under generated music (-32 dB; no hum, nothing low under the music).
 */
import type { SoundPalette } from './types.js';

const BEDS = ['room-tone', 'hum'] as const;

export const VOXEL_PALETTE: SoundPalette = {
  id: 'voxel',
  label: 'Voxel',
  sfx: {},
  accents: {},
  ambience: {
    key: () => '',
    bed: (_key, groupIndex) => BEDS[groupIndex % BEDS.length] ?? 'room-tone',
    gainDb: -28,
    underMusic: () => 'room-tone',
    underMusicGainDb: -32,
  },
};
