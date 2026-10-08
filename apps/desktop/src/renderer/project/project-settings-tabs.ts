/**
 * Section tabs of the Project settings dialog (docs/ux/redesign-2.4.md §8.6, U12): the same rows
 * and sections as before (project-settings-view.ts), grouped into tabs instead of one long scroll.
 * Every section belongs to one tab (typed, so a new section must pick one); a tab without rows is
 * left out, except "Channel & genre", which always shows the project's channel and genre. Pure.
 */
import {
  groupBySection,
  type ProjectSettingsSectionId,
  type SectionRow,
  type SettingsSectionView,
} from './project-settings-view.js';

export const PROJECT_SETTINGS_TABS = [
  'visuals',
  'characters',
  'direction',
  'build',
  'research',
  'channel',
] as const;
export type ProjectSettingsTabId = (typeof PROJECT_SETTINGS_TABS)[number];

export const PROJECT_SETTINGS_TAB_TITLES: Readonly<Record<ProjectSettingsTabId, string>> = {
  visuals: 'Visuals',
  characters: 'Characters',
  direction: 'Direction',
  build: 'Scenes and checks',
  research: 'Research',
  channel: 'Channel & genre',
};

/** The tab each section of the dialog lives in. */
export const SECTION_TAB: Readonly<Record<ProjectSettingsSectionId, ProjectSettingsTabId>> = {
  visuals: 'visuals',
  characters: 'characters',
  mascot: 'characters',
  research: 'research',
  direction: 'direction',
  build: 'build',
  // Taste lives with the channel (docs/ux/redesign-2.4.md "Answers" 3).
  taste: 'channel',
};

export interface ProjectSettingsTabView<Row extends SectionRow> {
  readonly id: ProjectSettingsTabId;
  readonly title: string;
  readonly sections: readonly SettingsSectionView<Row>[];
  /** The read-only Channel and Genre rows come first in this tab. */
  readonly channelAndGenre: boolean;
}

/** The tabs in display order with their sections; empty tabs (no rows) are left out. */
export function projectSettingsTabs<Row extends SectionRow>(
  rows: readonly Row[],
): ProjectSettingsTabView<Row>[] {
  const sections = groupBySection(rows);
  return PROJECT_SETTINGS_TABS.map((id) => ({
    id,
    title: PROJECT_SETTINGS_TAB_TITLES[id],
    sections: sections.filter((section) => SECTION_TAB[section.id] === id),
    channelAndGenre: id === 'channel',
  })).filter((tab) => tab.channelAndGenre || tab.sections.length > 0);
}

/**
 * The tab a key moves to in the vertical tab list (↑ / ↓ wrap, ← / → too, Home / End), or
 * undefined when the key is not a tab key.
 */
export function tabAfterKey(
  tabs: readonly ProjectSettingsTabId[],
  current: ProjectSettingsTabId,
  key: string,
): ProjectSettingsTabId | undefined {
  if (tabs.length === 0) return undefined;
  const index = Math.max(0, tabs.indexOf(current));
  switch (key) {
    case 'ArrowDown':
    case 'ArrowRight':
      return tabs[(index + 1) % tabs.length];
    case 'ArrowUp':
    case 'ArrowLeft':
      return tabs[(index - 1 + tabs.length) % tabs.length];
    case 'Home':
      return tabs[0];
    case 'End':
      return tabs.at(-1);
    default:
      return undefined;
  }
}
