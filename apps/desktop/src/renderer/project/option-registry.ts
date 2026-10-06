/**
 * One component per option row (project-settings-view.ts OPTION_ROW_IDS): the Project settings
 * dialog and the steps' "All options" sections look rows up here, never re-implement them.
 */
import type { JSX } from 'react';
import { CharactersRow, MascotRow } from './CharacterRows.js';
import {
  AmbientRow,
  ContinuityLinksRow,
  DramaturgyRow,
  EditingRow,
  LookModeRow,
  SceneCountRow,
  SoundPaletteRow,
  TensionMapRow,
} from './option-rows.js';
import type { OptionRowId } from './project-settings-view.js';
import { ResearchRow } from './ResearchRow.js';
import type { RowProps } from './SettingRow.js';

export const OPTION_ROWS: Readonly<Record<OptionRowId, (props: RowProps) => JSX.Element>> = {
  'look-mode': LookModeRow,
  'ambient-variation': AmbientRow,
  'continuity-links': ContinuityLinksRow,
  characters: CharactersRow,
  mascot: MascotRow,
  'research-assets': ResearchRow,
  'tension-map': TensionMapRow,
  dramaturgy: DramaturgyRow,
  editing: EditingRow,
  'scene-count': SceneCountRow,
  'sound-palette': SoundPaletteRow,
};
