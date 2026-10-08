/**
 * Every keyboard shortcut of the app in one table (docs/ux/redesign-2.4.md U12, docs/ui-copy.md
 * "Keys"): the Keyboard shortcuts dialog lists it by group, the window-wide shortcuts (app-keys.ts)
 * are matched from it, and the tooltips take their key labels from it, so the three cannot drift
 * (shortcut-table.test.ts also presses every listed key against the handler that owns it). Pure.
 */

export type ShortcutGroup = 'project' | 'playback' | 'panels' | 'claude';

export const SHORTCUT_GROUPS: readonly ShortcutGroup[] = [
  'project',
  'playback',
  'panels',
  'claude',
];

export const SHORTCUT_GROUP_TITLES: Readonly<Record<ShortcutGroup, string>> = {
  project: 'Project',
  playback: 'Playback',
  panels: 'Panels',
  claude: 'Claude',
};

/** One key press: `key` as `KeyboardEvent.key` (lower case for letters) and its modifiers. */
export interface Chord {
  readonly key: string;
  readonly ctrl?: true;
  /** true: Shift must be held; false: must not; undefined: either (keys like `?` need Shift). */
  readonly shift?: boolean;
}

export interface Shortcut {
  readonly group: ShortcutGroup;
  /** The presses that trigger it (alternatives); the first one is the label in tooltips. */
  readonly chords: readonly Chord[];
  /** Shown instead of the chords when they do not read well alone ("1 / 2 / 3"). */
  readonly keys?: string;
  readonly action: string;
  /** Window-wide: works while typing in a text field too. */
  readonly inText?: true;
}

/** Window-wide shortcuts, matched by app-keys.ts. */
export const APP_SHORTCUTS = {
  shortcuts: {
    group: 'panels',
    chords: [{ key: '?' }],
    action: 'This list of shortcuts',
  },
  'toggle-chat': {
    group: 'panels',
    chords: [{ key: 'c', ctrl: true, shift: true }],
    action: 'Show / hide the chat',
    inText: true,
  },
  'needs-you': {
    group: 'panels',
    chords: [{ key: 'n', ctrl: true, shift: true }],
    action: 'Needs you: what waits for your decision',
    inText: true,
  },
  'production-line': {
    group: 'panels',
    chords: [{ key: 'l', ctrl: true, shift: true }],
    action: 'Production line: your queues of films',
    inText: true,
  },
  'stop-claude': {
    group: 'claude',
    chords: [{ key: '.', ctrl: true, shift: false }],
    action: 'Stop Claude while it works (Esc never stops it)',
    inText: true,
  },
} as const satisfies Record<string, Shortcut>;

export type AppShortcut = keyof typeof APP_SHORTCUTS;

/** Shortcuts handled where they apply (player, shots, timeline, chat box, dialogs). */
export const LOCAL_SHORTCUTS = {
  'play-pause': { group: 'playback', chords: [{ key: ' ' }], action: 'Play / pause' },
  'step-frame': {
    group: 'playback',
    chords: [{ key: 'ArrowLeft' }, { key: 'ArrowRight' }],
    action: 'One frame back / forward',
  },
  'step-second': {
    group: 'playback',
    chords: [
      { key: 'ArrowLeft', shift: true },
      { key: 'ArrowRight', shift: true },
    ],
    keys: 'Shift+← / →',
    action: 'One second back / forward',
  },
  'start-end': {
    group: 'playback',
    chords: [{ key: 'Home' }, { key: 'End' }],
    action: 'Start / end of the video',
  },
  jkl: {
    group: 'playback',
    chords: [{ key: 'j' }, { key: 'k' }, { key: 'l' }],
    action: 'Slower / pause / play faster',
  },
  mute: { group: 'playback', chords: [{ key: 'm' }], action: 'Mute' },
  'lock-shot': {
    group: 'project',
    chords: [{ key: 'l', shift: true }],
    action: 'Lock / unlock the selected shot',
  },
  variants: { group: 'project', chords: [{ key: 'v' }], action: 'Variants of the selected shot' },
  'pick-variant': {
    group: 'project',
    chords: [{ key: '1' }, { key: '2' }, { key: '3' }],
    keys: '1 / 2 / 3',
    action: 'Choose a variant (Variants) or an opening (Hook lab)',
  },
  undo: { group: 'project', chords: [{ key: 'z', ctrl: true }], action: 'Undo a timeline edit' },
  redo: {
    group: 'project',
    chords: [
      { key: 'y', ctrl: true },
      { key: 'z', ctrl: true, shift: true },
    ],
    action: 'Redo a timeline edit',
  },
  'delete-cue': {
    group: 'project',
    chords: [{ key: 'Delete' }],
    action: 'Delete the selected sound on the timeline',
  },
  'nudge-cue': {
    group: 'project',
    chords: [{ key: 'ArrowLeft' }, { key: 'ArrowRight' }],
    action: 'Move the selected sound on the timeline (Shift: more)',
  },
  'direct-shot': {
    group: 'panels',
    chords: [{ key: '/' }],
    action: 'Direct the shot: type a direction under the preview',
  },
  zoom: {
    group: 'panels',
    chords: [{ key: '+' }, { key: '-' }],
    keys: '+ / −',
    action: 'Zoom the timeline in / out',
  },
  escape: {
    group: 'panels',
    chords: [{ key: 'Escape' }],
    action: 'Close the menu or dialog on top; on the timeline, clear the selection',
  },
  send: { group: 'claude', chords: [{ key: 'Enter' }], action: 'Send the message' },
  'new-line': { group: 'claude', chords: [{ key: 'Enter', shift: true }], action: 'New line' },
} as const satisfies Record<string, Shortcut>;

export type LocalShortcut = keyof typeof LOCAL_SHORTCUTS;

const KEY_NAMES: Readonly<Record<string, string>> = {
  ' ': 'Space',
  ArrowLeft: '←',
  ArrowRight: '→',
  ArrowUp: '↑',
  ArrowDown: '↓',
  Escape: 'Esc',
  '-': '−',
};

/** `Ctrl+Shift+C`, `Shift+←`, `Space`, `?`. */
export function chordLabel(chord: Chord): string {
  const key =
    KEY_NAMES[chord.key] ?? (chord.key.length === 1 ? chord.key.toUpperCase() : chord.key);
  return [...(chord.ctrl ? ['Ctrl'] : []), ...(chord.shift === true ? ['Shift'] : []), key].join(
    '+',
  );
}

/** What the dialog shows in the key column: `Ctrl+Y / Ctrl+Shift+Z`, `J / K / L`. */
export function shortcutKeys(shortcut: Shortcut): string {
  return shortcut.keys ?? shortcut.chords.map(chordLabel).join(' / ');
}

/** The key label of a window-wide shortcut for tooltips: "Hide chat (Ctrl+Shift+C)". */
export function appShortcutKeys(id: AppShortcut): string {
  const [first] = APP_SHORTCUTS[id].chords;
  return chordLabel(first);
}

export interface ShortcutRow {
  readonly id: string;
  readonly keys: string;
  readonly action: string;
}

export interface ShortcutSection {
  readonly group: ShortcutGroup;
  readonly title: string;
  readonly rows: readonly ShortcutRow[];
}

/** The Keyboard shortcuts dialog: every shortcut of both tables, by group, in table order. */
export function shortcutSections(): ShortcutSection[] {
  const all: [string, Shortcut][] = [
    ...Object.entries(APP_SHORTCUTS),
    ...Object.entries(LOCAL_SHORTCUTS),
  ];
  return SHORTCUT_GROUPS.map((group) => ({
    group,
    title: SHORTCUT_GROUP_TITLES[group],
    rows: all
      .filter(([, shortcut]) => shortcut.group === group)
      .map(([id, shortcut]) => ({ id, keys: shortcutKeys(shortcut), action: shortcut.action })),
  }));
}
