/**
 * Esc closes this dialog wherever the focus is, but only while it is the topmost one
 * (escape-layers.ts): a dialog opened over it closes first. An Esc already handled inside (a
 * popover, a confirm box, a text field that cancels an edit) is left alone.
 */
import { useEffect, useRef } from 'react';
import { EscapeLayers } from './escape-layers.js';

const layers = new EscapeLayers();

export function useEscapeToClose(onEscape: () => void): void {
  const handler = useRef(onEscape);
  handler.current = onEscape;
  useEffect(() => {
    const layer = layers.push();
    const onKey = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape' || event.defaultPrevented || !layers.isTop(layer)) return;
      event.preventDefault();
      handler.current();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      layers.remove(layer);
    };
  }, []);
}
