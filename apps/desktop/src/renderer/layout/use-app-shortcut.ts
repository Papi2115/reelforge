/** Runs `onShortcut` when the window-wide `shortcut` (app-keys.ts) is pressed. */
import { useEffect, useRef } from 'react';
import { keyTargetOf } from '../preview/transport-keys.js';
import { appShortcut, type AppShortcut } from './app-keys.js';

export function useAppShortcut(shortcut: AppShortcut, onShortcut: () => void): void {
  const handler = useRef(onShortcut);
  handler.current = onShortcut;
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      const pressed = appShortcut({
        key: event.key,
        shiftKey: event.shiftKey,
        ctrlKey: event.ctrlKey,
        altKey: event.altKey,
        metaKey: event.metaKey,
        repeat: event.repeat,
        target: keyTargetOf(event.target),
      });
      if (pressed !== shortcut) return;
      event.preventDefault();
      handler.current();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [shortcut]);
}
