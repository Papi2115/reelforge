import { describe, expect, it } from 'vitest';
import { isChatOpen, toggledChatMode, unreadTurns } from './chat-dock.js';

describe('chat dock', () => {
  it('opens on wide windows until the user chooses', () => {
    expect(isChatOpen('auto', 1280)).toBe(false);
    expect(isChatOpen('auto', 1399)).toBe(false);
    expect(isChatOpen('auto', 1400)).toBe(true);
    expect(isChatOpen('auto', 1920)).toBe(true);
  });

  it('keeps an explicit choice at every width', () => {
    expect(isChatOpen('open', 1024)).toBe(true);
    expect(isChatOpen('collapsed', 2560)).toBe(false);
    expect(toggledChatMode(true)).toBe('collapsed');
    expect(toggledChatMode(false)).toBe('open');
  });

  it('counts the turns that finished while the chat was hidden', () => {
    expect(unreadTurns(5, null)).toBe(0);
    expect(unreadTurns(5, 3)).toBe(2);
    expect(unreadTurns(2, 3)).toBe(0);
  });
});
