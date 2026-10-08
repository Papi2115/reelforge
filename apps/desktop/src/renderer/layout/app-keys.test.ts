import { describe, expect, it } from 'vitest';
import type { TransportKey } from '../preview/transport-keys.js';
import {
  appShortcut,
  NEEDS_YOU_KEYS,
  PRODUCTION_LINE_KEYS,
  STOP_CLAUDE_KEYS,
  TOGGLE_CHAT_KEYS,
} from './app-keys.js';

function key(patch: Partial<TransportKey>): TransportKey {
  return {
    key: '',
    shiftKey: false,
    ctrlKey: false,
    altKey: false,
    metaKey: false,
    repeat: false,
    target: { tagName: 'BODY', contentEditable: false },
    ...patch,
  };
}

describe('appShortcut', () => {
  it('toggles the chat with Ctrl+Shift+C, also from a text field', () => {
    expect(appShortcut(key({ key: 'C', ctrlKey: true, shiftKey: true }))).toBe('toggle-chat');
    const field = { tagName: 'TEXTAREA', contentEditable: false };
    expect(appShortcut(key({ key: 'C', ctrlKey: true, shiftKey: true, target: field }))).toBe(
      'toggle-chat',
    );
    expect(appShortcut(key({ key: 'c', ctrlKey: true }))).toBeUndefined();
    expect(
      appShortcut(key({ key: 'C', ctrlKey: true, shiftKey: true, altKey: true })),
    ).toBeUndefined();
  });

  it('opens the Needs you inbox with Ctrl+Shift+N, also from a text field', () => {
    expect(appShortcut(key({ key: 'N', ctrlKey: true, shiftKey: true }))).toBe('needs-you');
    const field = { tagName: 'TEXTAREA', contentEditable: false };
    expect(appShortcut(key({ key: 'N', ctrlKey: true, shiftKey: true, target: field }))).toBe(
      'needs-you',
    );
    expect(appShortcut(key({ key: 'n', ctrlKey: true }))).toBeUndefined();
    expect(
      appShortcut(key({ key: 'N', ctrlKey: true, shiftKey: true, repeat: true })),
    ).toBeUndefined();
  });

  it('opens the shortcut sheet with ? outside text fields', () => {
    expect(appShortcut(key({ key: '?', shiftKey: true }))).toBe('shortcuts');
    const input = { tagName: 'INPUT', inputType: 'text', contentEditable: false };
    expect(appShortcut(key({ key: '?', shiftKey: true, target: input }))).toBeUndefined();
    expect(appShortcut(key({ key: '?', shiftKey: true, repeat: true }))).toBeUndefined();
  });

  it('opens the Production line with Ctrl+Shift+L, also from a text field', () => {
    expect(appShortcut(key({ key: 'L', ctrlKey: true, shiftKey: true }))).toBe('production-line');
    const field = { tagName: 'TEXTAREA', contentEditable: false };
    expect(appShortcut(key({ key: 'L', ctrlKey: true, shiftKey: true, target: field }))).toBe(
      'production-line',
    );
    // Shift+L alone locks a shot; Ctrl+L is nothing.
    expect(appShortcut(key({ key: 'L', shiftKey: true }))).toBeUndefined();
    expect(appShortcut(key({ key: 'l', ctrlKey: true }))).toBeUndefined();
  });

  it('stops Claude with Ctrl+., also from the message box; never with Escape', () => {
    expect(appShortcut(key({ key: '.', ctrlKey: true }))).toBe('stop-claude');
    const field = { tagName: 'TEXTAREA', contentEditable: false };
    expect(appShortcut(key({ key: '.', ctrlKey: true, target: field }))).toBe('stop-claude');
    expect(appShortcut(key({ key: '.' }))).toBeUndefined();
    expect(appShortcut(key({ key: '.', ctrlKey: true, altKey: true }))).toBeUndefined();
    expect(appShortcut(key({ key: 'Escape' }))).toBeUndefined();
    expect(appShortcut(key({ key: 'Escape', target: field }))).toBeUndefined();
  });

  it('labels the tooltips from the shortcut table', () => {
    expect([TOGGLE_CHAT_KEYS, NEEDS_YOU_KEYS, PRODUCTION_LINE_KEYS, STOP_CLAUDE_KEYS]).toEqual([
      'Ctrl+Shift+C',
      'Ctrl+Shift+N',
      'Ctrl+Shift+L',
      'Ctrl+.',
    ]);
  });
});
