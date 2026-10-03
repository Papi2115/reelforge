/** The chat column's open / collapsed state (chat-dock.ts), remembered, with Ctrl+Shift+C. */
import { useCallback, useEffect, useState } from 'react';
import {
  CHAT_DOCK_STORAGE_KEY,
  chatDockModeSchema,
  isChatOpen,
  toggledChatMode,
} from './chat-dock.js';
import { usePref } from './ui-prefs.js';
import { useAppShortcut } from './use-app-shortcut.js';

export interface ChatDock {
  readonly open: boolean;
  readonly toggle: () => void;
  /** Opens the chat (an action that needs it, e.g. "Fix with Claude…"). */
  readonly show: () => void;
}

function useWindowWidth(): number {
  const [width, setWidth] = useState(() => window.innerWidth);
  useEffect(() => {
    const onResize = (): void => {
      setWidth(window.innerWidth);
    };
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
    };
  }, []);
  return width;
}

export function useChatDock(): ChatDock {
  const [mode, setMode] = usePref(CHAT_DOCK_STORAGE_KEY, chatDockModeSchema, 'auto');
  const width = useWindowWidth();
  const open = isChatOpen(mode, width);
  const toggle = useCallback(() => {
    setMode(toggledChatMode(open));
  }, [open, setMode]);
  const show = useCallback(() => {
    if (!open) setMode('open');
  }, [open, setMode]);
  useAppShortcut('toggle-chat', toggle);
  return { open, toggle, show };
}
