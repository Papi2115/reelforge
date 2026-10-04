import { describe, expect, it } from 'vitest';
import type { SceneContext } from '../contract.js';
import type { TextCard } from '../text/types.js';
import { chipName, placeSourceChip } from './draw-source-chip.js';
import { deskCamera, deskShot, HEIGHT, inkColors, paletteColors, WIDTH } from './testing.js';

const AREA = { x: 32, y: 18, w: 576, h: 324 };

function chipCard(cards: readonly TextCard[]): TextCard {
  const card = cards.find((candidate) => candidate.annotation?.type === 'sourceChip');
  if (card === undefined) throw new Error('no chip card');
  return card;
}

function render(draw: (ctx: SceneContext) => void, t = 2): ReturnType<typeof deskShot> {
  const shot = deskShot((_t, _s, ctx) => {
    deskCamera(ctx);
    draw(ctx);
  });
  shot.update(t);
  return shot;
}

const inside = (box: TextCard['box']): boolean =>
  box.x >= 0 && box.y >= 0 && box.x + box.w <= WIDTH && box.y + box.h <= HEIGHT;

function overlap(first: TextCard['box'], second: TextCard['box']): boolean {
  return (
    first.x < second.x + second.w &&
    second.x < first.x + first.w &&
    first.y < second.y + second.h &&
    second.y < first.y + first.h
  );
}

describe('chipName', () => {
  it('shows hosts instead of URLs and cuts long names at a word', () => {
    expect(chipName('https://www.NASA.gov/history/apollo', 24)).toBe('nasa.gov');
    expect(chipName('see  https://doomwiki.org/x  ', 24)).toBe('see doomwiki.org');
    expect(chipName('Library of Congress Prints and Photographs', 24)).toBe(
      'Library of Congress...',
    );
    expect(chipName('Supercalifragilisticexpialidocious', 12)).toBe('Supercali...');
  });
});

describe('placeSourceChip', () => {
  it('takes the preferred corner, else the first free one, else the least covered', () => {
    expect(placeSourceChip(AREA, [], 'auto', 100, 20)).toEqual({ x: 507, y: 321, w: 100, h: 20 });
    expect(placeSourceChip(AREA, [], 'top-left', 100, 20)).toEqual({ x: 33, y: 19, w: 100, h: 20 });
    const bottomRight = { x: 450, y: 300, w: 160, h: 50 };
    expect(placeSourceChip(AREA, [bottomRight], 'auto', 100, 20)).toMatchObject({ x: 33, y: 321 });
    const everywhere = [
      bottomRight,
      { x: 0, y: 300, w: 160, h: 50 },
      { x: 450, y: 0, w: 160, h: 30 },
      { x: 0, y: 0, w: 60, h: 25 },
    ];
    expect(placeSourceChip(AREA, everywhere, 'auto', 100, 20)).toMatchObject({ x: 33, y: 19 });
  });
});

describe('ctx.annotate.sourceChip', () => {
  it('draws a palette-only chip in the bottom-right corner of the safe area, deterministically', () => {
    const shot = render((ctx) => ctx.annotate.sourceChip({ name: 'Doom Wiki', index: 1, at: 1 }));
    const card = chipCard(shot.cards());
    expect(card).toMatchObject({ id: 'sourceChip:Doom Wiki', visible: true, text: 'Doom Wiki' });
    expect(inside(card.box)).toBe(true);
    expect(card.box.x + card.box.w).toBeGreaterThan(WIDTH * 0.8);
    expect(card.box.y).toBeGreaterThan(HEIGHT * 0.8);
    for (const color of inkColors(shot)) expect(paletteColors().has(color)).toBe(true);
    const pixels = [...shot.overlay.pixels];
    shot.update(0.5);
    shot.update(2);
    expect([...shot.overlay.pixels]).toEqual(pixels);
  });

  it('never covers a callout or a lower third, whatever the call order', () => {
    const shot = render((ctx) => {
      ctx.annotate.sourceChip({ name: 'nasa.gov', corner: 'bottom-right' });
      ctx.annotate.callout({ text: 'Fact here', pos: [0.82, 0.85], tail: false });
      ctx.text.lowerThird('Narrator', undefined, { id: 'name' });
    });
    const cards = shot.cards();
    const chip = chipCard(cards);
    for (const other of cards.filter((card) => card !== chip && card.visible)) {
      expect(overlap(chip.box, other.box), other.id).toBe(false);
    }
  });

  it('wipes in from the left and is gone after until', () => {
    const shot = deskShot((_t, _s, ctx) => {
      ctx.annotate.sourceChip({ name: 'nasa.gov', at: 1, until: 3 });
    });
    const widths = [1.05, 1.15, 1.6].map((t) => {
      shot.update(t);
      let right = -1;
      const { pixels } = shot.overlay;
      for (let offset = 3; offset < pixels.length; offset += 4) {
        if (pixels[offset] === 255) right = Math.max(right, ((offset - 3) / 4) % WIDTH);
      }
      return right;
    });
    expect(widths).toEqual([...widths].sort((a, b) => a - b));
    expect(widths[0]).toBeLessThan(widths[2] ?? 0);
    shot.update(3.5);
    expect(chipCard(shot.cards()).visible).toBe(false);
  });
});
