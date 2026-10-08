import { describe, expect, it } from 'vitest';
import {
  PROJECT_SETTINGS_TABS,
  projectSettingsTabs,
  SECTION_TAB,
  tabAfterKey,
} from './project-settings-tabs.js';
import {
  PROJECT_SETTINGS_ROWS,
  PROJECT_SETTINGS_SECTIONS,
  type SectionRow,
} from './project-settings-view.js';

describe('projectSettingsTabs', () => {
  it('splits the Project settings rows into section tabs, keeping every row once', () => {
    const tabs = projectSettingsTabs(PROJECT_SETTINGS_ROWS);
    expect(tabs.map((tab) => tab.title)).toEqual([
      'Visuals',
      'Characters',
      'Direction',
      'Scenes and checks',
      'Research',
      'Channel & genre',
    ]);
    const rows = tabs.flatMap((tab) => tab.sections.flatMap((section) => section.rows));
    expect(rows.map((row) => row.id).sort()).toEqual(
      PROJECT_SETTINGS_ROWS.map((row) => row.id).sort(),
    );
    const characters = tabs.find((tab) => tab.id === 'characters');
    expect(characters?.sections.map((section) => section.title)).toEqual(['Characters', 'Mascot']);
    const visuals = tabs.find((tab) => tab.id === 'visuals');
    expect(visuals?.sections[0]?.rows.map((row) => row.id)).toEqual([
      'style',
      'look-mode',
      'ambient-variation',
      'continuity-links',
    ]);
    expect(tabs.filter((tab) => tab.channelAndGenre).map((tab) => tab.id)).toEqual(['channel']);
  });

  it('puts every section in a known tab and drops tabs without rows', () => {
    for (const section of PROJECT_SETTINGS_SECTIONS) {
      expect(PROJECT_SETTINGS_TABS).toContain(SECTION_TAB[section]);
    }
    const rows: SectionRow[] = [
      { id: 'a', section: 'research' },
      { id: 'b', section: 'taste' },
    ];
    const tabs = projectSettingsTabs(rows);
    expect(tabs.map((tab) => tab.id)).toEqual(['research', 'channel']);
    expect(tabs[1]?.sections.map((section) => section.title)).toEqual(['Taste']);
  });
});

describe('tabAfterKey', () => {
  const tabs = ['visuals', 'characters', 'direction'] as const;

  it('moves with the arrows (wrapping), Home and End', () => {
    expect(tabAfterKey(tabs, 'visuals', 'ArrowDown')).toBe('characters');
    expect(tabAfterKey(tabs, 'visuals', 'ArrowUp')).toBe('direction');
    expect(tabAfterKey(tabs, 'direction', 'ArrowRight')).toBe('visuals');
    expect(tabAfterKey(tabs, 'characters', 'ArrowLeft')).toBe('visuals');
    expect(tabAfterKey(tabs, 'characters', 'Home')).toBe('visuals');
    expect(tabAfterKey(tabs, 'visuals', 'End')).toBe('direction');
  });

  it('ignores other keys and an empty list', () => {
    expect(tabAfterKey(tabs, 'visuals', 'Enter')).toBeUndefined();
    expect(tabAfterKey(tabs, 'visuals', 'Tab')).toBeUndefined();
    expect(tabAfterKey([], 'visuals', 'ArrowDown')).toBeUndefined();
  });
});
