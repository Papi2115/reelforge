/**
 * The chat column's open / collapsed state (PLAN.md#11.2). Until the user chooses, the chat is open
 * on windows at least CHAT_AUTO_OPEN_WIDTH wide and a slim rail below that (the preview needs the
 * room at 1280x720); a toggle stores the explicit choice. Pure.
 */
import { z } from 'zod';

export type ChatDockMode = 'auto' | 'open' | 'collapsed';

export const chatDockModeSchema = z.enum(['auto', 'open', 'collapsed']);

export const CHAT_DOCK_STORAGE_KEY = 'reelforge.layout.chat.v1';

/** Window width (CSS px) from which the chat starts open. */
export const CHAT_AUTO_OPEN_WIDTH = 1400;

/** Width of the collapsed chat rail (CSS px). */
export const CHAT_RAIL_WIDTH = 44;

export function isChatOpen(mode: ChatDockMode, windowWidth: number): boolean {
  if (mode === 'auto') return windowWidth >= CHAT_AUTO_OPEN_WIDTH;
  return mode === 'open';
}

/** The explicit mode a toggle stores, from what is shown now. */
export function toggledChatMode(open: boolean): ChatDockMode {
  return open ? 'collapsed' : 'open';
}

/** Finished turns the user has not seen (the chat was collapsed when they finished). */
export function unreadTurns(finished: number, seen: number | null): number {
  return seen === null ? 0 : Math.max(0, finished - seen);
}
