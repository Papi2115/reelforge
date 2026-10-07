import { describe, expect, it } from 'vitest';
import { pendingValue, showsSavedValue, valueToSend } from './slider-sync.js';

describe('voice slider sync', () => {
  it('shows the saved value when nothing is moving or on its way', () => {
    expect(showsSavedValue({ moved: false, sent: undefined }, 1)).toBe(true);
    // The answer to the value sent last.
    expect(showsSavedValue({ moved: false, sent: 1.01 }, 1.01)).toBe(true);
  });

  it('keeps the knob for an answer to an earlier save', () => {
    expect(showsSavedValue({ moved: false, sent: 1.02 }, 1.01)).toBe(false);
  });

  it('keeps an unsent move even when the answer to the value sent last comes in', () => {
    // Key down moved the knob to 1.02; the answer for 1.01 lands before the key up.
    expect(showsSavedValue({ moved: true, sent: 1.01 }, 1.01)).toBe(false);
    expect(showsSavedValue({ moved: true, sent: undefined }, 1)).toBe(false);
  });

  it('sends a value only when it is neither saved nor on its way', () => {
    expect(valueToSend({ moved: true, sent: undefined }, 1.01, 1)).toBe(1.01);
    expect(valueToSend({ moved: false, sent: undefined }, 1, 1)).toBeUndefined();
    expect(valueToSend({ moved: true, sent: 1.02 }, 1.02, 1.01)).toBeUndefined();
    expect(valueToSend({ moved: true, sent: 1.01 }, 1.02, 1.01)).toBe(1.02);
  });

  it('forgets the value sent last once it is the saved one', () => {
    expect(pendingValue(1.01, 1.01)).toBeUndefined();
    expect(pendingValue(1.02, 1.01)).toBe(1.02);
    expect(pendingValue(undefined, 1)).toBeUndefined();
  });

  it('five quick arrow keys end at the fifth value whatever the answers interleave', () => {
    // Model of VoiceSliderRow: each key moves (key down), the answer to the previous save may land
    // before the key up, then the key up commits.
    let position = 1;
    let saved = 1;
    let sent: number | undefined;
    let moved = false;
    const answer = (value: number): void => {
      saved = value;
      if (!showsSavedValue({ moved, sent }, saved)) return;
      sent = undefined;
      position = saved;
    };
    for (let key = 1; key <= 5; key += 1) {
      position = Math.round((position + 0.01) * 100) / 100;
      moved = true;
      if (sent !== undefined) answer(sent);
      sent = pendingValue(sent, saved);
      const sync = { moved, sent };
      moved = false;
      const value = valueToSend(sync, position, saved);
      if (value !== undefined) sent = value;
    }
    if (sent !== undefined) answer(sent);
    expect(position).toBe(1.05);
    expect(saved).toBe(1.05);
  });
});
