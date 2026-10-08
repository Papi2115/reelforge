import { describe, expect, it } from 'vitest';
import type { VariantCard } from '../../shared/variants-contract.js';
import { composerKeyAction } from '../chat/composer-keys.js';
import { isCommandBarKey } from '../direction/direction-view.js';
import { transportAction, type TransportKey } from '../preview/transport-keys.js';
import { isLockShortcut } from '../stages/locks-view.js';
import { cardKeyAction, isVariantsShortcut } from '../stages/variants-view.js';
import { timelineKeyAction } from '../timeline/timeline-gestures.js';
import { appShortcut } from './app-keys.js';
import {
  APP_SHORTCUTS,
  chordLabel,
  LOCAL_SHORTCUTS,
  SHORTCUT_GROUPS,
  shortcutSections,
  type AppShortcut,
  type Chord,
  type LocalShortcut,
  type Shortcut,
} from './shortcut-table.js';

function press(chord: Chord, typing = false): TransportKey {
  return {
    key: chord.key,
    shiftKey: chord.shift === true,
    ctrlKey: chord.ctrl === true,
    altKey: false,
    metaKey: false,
    repeat: false,
    target: typing
      ? { tagName: 'TEXTAREA', contentEditable: false }
      : { tagName: 'BODY', contentEditable: false },
  };
}

const card = (key: VariantCard['key']): VariantCard => ({
  key,
  title: key,
  direction: null,
  status: 'ready',
  qa: null,
  notes: [],
  reason: null,
});
const CARDS = [card('current'), card('v1'), card('v2'), card('v3')];

/**
 * The handler that owns each listed key, asked whether it reacts to the press: a row in the
 * dialog for a key that does nothing fails here.
 */
const PROBES: Readonly<Record<LocalShortcut, (key: TransportKey) => boolean>> = {
  'play-pause': (key) => transportAction(key)?.kind === 'toggle',
  'step-frame': (key) => transportAction(key)?.kind === 'step',
  'step-second': (key) => transportAction(key)?.kind === 'jump',
  'start-end': (key) => ['start', 'end'].includes(transportAction(key)?.kind ?? ''),
  jkl: (key) => ['slower', 'pause', 'faster'].includes(transportAction(key)?.kind ?? ''),
  mute: (key) => transportAction(key)?.kind === 'mute',
  'lock-shot': isLockShortcut,
  variants: isVariantsShortcut,
  'pick-variant': (key) => cardKeyAction(key, CARDS, 0)?.kind === 'select',
  undo: (key) => timelineKeyAction(key, true)?.kind === 'undo',
  redo: (key) => timelineKeyAction(key, true)?.kind === 'redo',
  'delete-cue': (key) => timelineKeyAction(key, true)?.kind === 'delete',
  'nudge-cue': (key) => timelineKeyAction(key, true)?.kind === 'nudge',
  zoom: (key) => timelineKeyAction(key, true)?.kind === 'zoom',
  escape: (key) => timelineKeyAction(key, true)?.kind === 'clear-selection',
  'direct-shot': (key) => isCommandBarKey({ ...key, targetTag: 'BODY', targetEditable: false }),
  send: (key) => composerKeyAction({ ...key, isComposing: false }) === 'send',
  'new-line': (key) =>
    key.shiftKey && composerKeyAction({ ...key, isComposing: false }) === undefined,
};

describe('shortcut table', () => {
  it('matches every window-wide shortcut from the table', () => {
    for (const id of Object.keys(APP_SHORTCUTS) as AppShortcut[]) {
      const shortcut: Shortcut = APP_SHORTCUTS[id];
      for (const chord of shortcut.chords) {
        expect(appShortcut(press(chord)), `${id} ${chordLabel(chord)}`).toBe(id);
        expect(appShortcut(press(chord, true))).toBe(shortcut.inText === true ? id : undefined);
      }
    }
  });

  it('lists only keys that do what the dialog says', () => {
    for (const id of Object.keys(LOCAL_SHORTCUTS) as LocalShortcut[]) {
      const shortcut: Shortcut = LOCAL_SHORTCUTS[id];
      for (const chord of shortcut.chords) {
        expect(PROBES[id](press(chord)), `${id} ${chordLabel(chord)}`).toBe(true);
      }
    }
  });

  it('never stops Claude with Escape', () => {
    for (const typing of [false, true]) {
      expect(appShortcut(press({ key: 'Escape' }, typing))).toBeUndefined();
    }
    expect(composerKeyAction({ key: 'Escape', shiftKey: false, isComposing: false })).toBe(
      undefined,
    );
  });

  it('labels chords like the tooltips', () => {
    expect(chordLabel({ key: 'c', ctrl: true, shift: true })).toBe('Ctrl+Shift+C');
    expect(chordLabel({ key: '.', ctrl: true, shift: false })).toBe('Ctrl+.');
    expect(chordLabel({ key: 'ArrowLeft', shift: true })).toBe('Shift+←');
    expect(chordLabel({ key: ' ' })).toBe('Space');
    expect(chordLabel({ key: 'Escape' })).toBe('Esc');
  });

  it('gives the dialog every shortcut once, in the four groups', () => {
    const sections = shortcutSections();
    expect(sections.map((section) => section.title)).toEqual([
      'Project',
      'Playback',
      'Panels',
      'Claude',
    ]);
    expect(sections.map((section) => section.group)).toEqual(SHORTCUT_GROUPS);
    const ids = sections.flatMap((section) => section.rows.map((row) => row.id));
    expect(ids.sort()).toEqual(
      [...Object.keys(APP_SHORTCUTS), ...Object.keys(LOCAL_SHORTCUTS)].sort(),
    );
    for (const section of sections) expect(section.rows.length).toBeGreaterThan(0);
    const claude = sections.find((section) => section.group === 'claude');
    expect(claude?.rows.map((row) => row.keys)).toEqual(['Ctrl+.', 'Enter', 'Shift+Enter']);
    const panels = sections.find((section) => section.group === 'panels');
    expect(panels?.rows.find((row) => row.id === 'needs-you')?.keys).toBe('Ctrl+Shift+N');
    expect(panels?.rows.find((row) => row.id === 'production-line')?.keys).toBe('Ctrl+Shift+L');
  });
});
