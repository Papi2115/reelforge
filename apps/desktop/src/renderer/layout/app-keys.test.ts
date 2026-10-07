import { describe, expect, it } from 'vitest';
import type { TransportKey } from '../preview/transport-keys.js';
import { appShortcut } from './app-keys.js';

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
});
