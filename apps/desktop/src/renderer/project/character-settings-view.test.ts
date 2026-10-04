import { describe, expect, it } from 'vitest';
import {
  CHARACTER_CHOICES,
  isMascotChoice,
  MASCOT_SHEET_SIZE,
  mascotCards,
  mascotOptionLabel,
} from './character-settings-view.js';
import { groupBySection, type SectionRow } from './project-settings-view.js';

describe('character settings view (PLAN.md#12.20)', () => {
  it('offers the pack first and the classic hero second', () => {
    expect(CHARACTER_CHOICES.map((choice) => [choice.value, choice.title])).toEqual([
      ['pack', 'Pack style (new)'],
      ['classic', 'Classic (hoodie guy)'],
    ]);
  });

  it('lists None and the four mascots with a crop inside the preview sheet', () => {
    const cards = mascotCards({ characters: 'pack', mascot: 'fox' });
    expect(cards.map((card) => [card.value, card.title, card.checked, card.disabled])).toEqual([
      ['none', 'No mascot', false, false],
      ['bulb', 'Bulb', false, false],
      ['screen', 'Screen', false, false],
      ['fox', 'Fox', true, false],
      ['bean', 'Bean', false, false],
    ]);
    expect(cards[0]?.crop).toBeUndefined();
    for (const card of cards.slice(1)) {
      const crop = card.crop;
      if (crop === undefined) throw new Error(`${card.value} has no crop`);
      expect(crop.x + crop.width).toBeLessThanOrEqual(MASCOT_SHEET_SIZE.width);
      expect(crop.y + crop.height).toBeLessThanOrEqual(MASCOT_SHEET_SIZE.height);
      expect(card.blurb.length).toBeGreaterThan(20);
    }
    // The crops do not overlap: each card shows one mascot.
    const lefts = cards.slice(1).map((card) => card.crop?.x ?? 0);
    lefts.slice(1).forEach((left, index) => {
      expect(left).toBeGreaterThanOrEqual((lefts[index] ?? 0) + (cards[1]?.crop?.width ?? 0));
    });
  });

  it('disables every mascot card with the classic hero, keeping the stored choice', () => {
    const cards = mascotCards({ characters: 'classic', mascot: 'bean' });
    expect(cards.every((card) => card.disabled)).toBe(true);
    expect(cards.find((card) => card.checked)?.value).toBe('bean');
  });

  it('names the mascot options of Settings → Projects', () => {
    expect(mascotOptionLabel('none')).toBe('No mascot');
    expect(mascotOptionLabel('screen')).toBe('Screen');
    expect(isMascotChoice('bulb')).toBe(true);
    expect(isMascotChoice('cat')).toBe(false);
  });

  it('places the Characters and Mascot sections after Visuals', () => {
    const rows: SectionRow[] = [
      { id: 'research-assets', section: 'research' },
      { id: 'mascot', section: 'mascot' },
      { id: 'characters', section: 'characters' },
      { id: 'look-mode', section: 'visuals' },
    ];
    expect(groupBySection(rows).map((section) => section.title)).toEqual([
      'Visuals',
      'Characters',
      'Mascot',
      'Research',
    ]);
  });
});
