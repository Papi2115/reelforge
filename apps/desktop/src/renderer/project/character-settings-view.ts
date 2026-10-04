/**
 * View model of the "Characters" and "Mascot" sections of Project settings (PLAN.md#12.20,
 * ADR-025): the two character styles, the mascot cards (None + the pack's four, with their crop of
 * the preview sheet `mascots.png`, the kit's `character-mascots` golden at 640x360) and when the
 * cards are disabled (mascots belong to the pack). Also the new-project defaults of Settings.
 */
import {
  MASCOT_CHOICES,
  MASCOT_PROFILES,
  type CharacterMode,
  type MascotChoice,
  type MascotId,
} from '@reelforge/shared';
import type { ProjectSettings } from '../../shared/project-settings-contract.js';

export interface CharacterChoice {
  readonly value: CharacterMode;
  readonly title: string;
  readonly hint: string;
}

/** Pack first: the default of new projects. */
export const CHARACTER_CHOICES: readonly CharacterChoice[] = [
  {
    value: 'pack',
    title: 'Pack style (new)',
    hint: 'People come from the character pack: ten cast members (scientist, doctor, engineer, teacher…), a faceless mannequin for anyone anonymous, and new professions built in the same style.',
  },
  {
    value: 'classic',
    title: 'Classic (hoodie guy)',
    hint: 'The original voxel hero in a hoodie, as in projects made before ReelForge 2.3.5. No mascot.',
  },
];

export const CHARACTERS_NOTE =
  'Applies to the next Storyboard and Scenes build. Shots already built keep their people; no step is marked out of date.';

export const MASCOT_NOTE =
  'Applies to the next Storyboard and Scenes build. The mascot gets a little screen time in impersonal roles only (pointing, carrying, reacting, standing in for you), never as a doctor, a scientist or any real person.';

export const MASCOT_CLASSIC_NOTE =
  'Mascots belong to the character pack: choose “Pack style (new)” under Characters to pick one.';

/** A mascot's crop of the preview sheet, in sheet pixels (640x360). */
export interface SpriteCrop {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export const MASCOT_SHEET_SIZE = { width: 640, height: 360 } as const;

const CROP_WIDTH = 130;
const CROP_TOP = 98;
const CROP_HEIGHT = 158;
/** Left edge of each mascot's crop (they stand at x ≈ 75, 238, 403, 565 in the sheet). */
const CROP_LEFT: Readonly<Record<MascotId, number>> = {
  bulb: 10,
  screen: 173,
  fox: 338,
  bean: 500,
};

export function mascotCrop(id: MascotId): SpriteCrop {
  return { x: CROP_LEFT[id], y: CROP_TOP, width: CROP_WIDTH, height: CROP_HEIGHT };
}

export interface MascotCard {
  readonly value: MascotChoice;
  readonly title: string;
  readonly blurb: string;
  /** Undefined for "No mascot". */
  readonly crop: SpriteCrop | undefined;
  readonly checked: boolean;
  readonly disabled: boolean;
}

/** None + the four mascots; all disabled while the project uses the classic hero. */
export function mascotCards(
  settings: Pick<ProjectSettings, 'characters' | 'mascot'>,
): MascotCard[] {
  const disabled = settings.characters !== 'pack';
  return MASCOT_CHOICES.map((value) => {
    const checked = settings.mascot === value;
    if (value === 'none') {
      return {
        value,
        title: 'No mascot',
        blurb: 'The film tells its story with people and objects only.',
        crop: undefined,
        checked,
        disabled,
      };
    }
    const profile = MASCOT_PROFILES[value];
    return {
      value,
      title: profile.label,
      blurb: profile.blurb,
      crop: mascotCrop(value),
      checked,
      disabled,
    };
  });
}

/** `bulb` → `Bulb`; `none` → `No mascot` (Settings → Projects select). */
export function mascotOptionLabel(value: MascotChoice): string {
  return value === 'none' ? 'No mascot' : MASCOT_PROFILES[value].label;
}

export function isMascotChoice(value: string): value is MascotChoice {
  return (MASCOT_CHOICES as readonly string[]).includes(value);
}

export const NEW_PROJECT_DEFAULTS_HINT =
  'New projects start with these characters and this mascot, so a channel mascot carries over; each project can change them in Project settings.';
