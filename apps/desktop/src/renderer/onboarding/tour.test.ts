import { describe, expect, it } from 'vitest';
import { placeTourCard, TOUR_STEPS } from './tour.js';

const VIEWPORT = { width: 1280, height: 720 };
const CARD = { width: 320, height: 180 };

describe('TOUR_STEPS', () => {
  it('walks pipeline, preview, shots, timeline, chat and export with unique ids', () => {
    expect(TOUR_STEPS.map((step) => step.id)).toEqual([
      'pipeline',
      'preview',
      'shots',
      'timeline',
      'chat',
      'export',
    ]);
    for (const step of TOUR_STEPS) {
      expect(step.body.length).toBeLessThan(200);
      expect(step.target).not.toBe('');
    }
  });
});

describe('placeTourCard', () => {
  it('puts the card to the right of a left-hand panel, aligned with its top', () => {
    const sidebar = { left: 0, top: 40, width: 280, height: 300 };
    expect(placeTourCard(sidebar, VIEWPORT, CARD)).toEqual({ left: 292, top: 40, side: 'right' });
  });

  it('uses the left side for a right-hand panel and keeps the card on screen', () => {
    const chat = { left: 960, top: 600, width: 320, height: 300 };
    expect(placeTourCard(chat, VIEWPORT, CARD)).toEqual({ left: 628, top: 532, side: 'left' });
  });

  it('goes above a full-width bottom panel and centres when nothing fits', () => {
    const timeline = { left: 0, top: 480, width: 1280, height: 240 };
    expect(placeTourCard(timeline, VIEWPORT, CARD)).toEqual({ left: 8, top: 288, side: 'above' });
    const everything = { left: 0, top: 0, width: 1280, height: 720 };
    expect(placeTourCard(everything, VIEWPORT, CARD)).toEqual({
      left: 480,
      top: 270,
      side: 'center',
    });
    expect(placeTourCard(null, VIEWPORT, CARD).side).toBe('center');
  });

  it('places below a wide top element', () => {
    const header = { left: 0, top: 0, width: 1280, height: 100 };
    expect(placeTourCard(header, VIEWPORT, CARD)).toEqual({ left: 8, top: 112, side: 'below' });
  });
});
