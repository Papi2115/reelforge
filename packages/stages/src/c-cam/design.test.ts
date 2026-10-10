/** The design list of a Grim Ink film from the storyboard's cast and place tags (PLAN.md#14.11). */
import type { StoryboardShot, WordsFile } from '@reelforge/shared';
import { describe, expect, it } from 'vitest';
import { designBrief, inkModuleDesigns, intentTags, narrationExcerpt } from './design.js';

const shot = (id: string, intent: string, t0 = 0): StoryboardShot => ({
  id,
  t0,
  t1: t0 + 2,
  treatment: 'metaphor-object',
  intent,
  scene: `scenes/${id}.js`,
});

describe('intentTags', () => {
  it('reads an introduced role, later ids, kebab-case places and the separators', () => {
    expect(
      intentTags(
        "cast: nightPorter (the hotel's night porter; axis: a long drooping face; loud prop: a ring of forty keys), guest | place: boiler-room. wide; ECU of the keys",
      ),
    ).toEqual({
      cast: [
        {
          id: 'nightPorter',
          description:
            "the hotel's night porter; axis: a long drooping face; loud prop: a ring of forty keys",
        },
        { id: 'guest', description: undefined },
      ],
      place: { id: 'boilerRoom', description: undefined },
    });
    expect(intentTags('`cast: porter` `place: lobby`; the bell rings')).toEqual({
      cast: [{ id: 'porter', description: undefined }],
      place: { id: 'lobby', description: undefined },
    });
  });

  it('reads nothing from a poster without people or from plain prose', () => {
    expect(intentTags('cast: none | place: none. The title thuds in.')).toEqual({
      cast: [],
      place: undefined,
    });
    expect(intentTags('A forecast: rain. The place is empty.')).toEqual({
      cast: [],
      place: undefined,
    });
  });
});

describe('inkModuleDesigns', () => {
  it('lists people then places once each, with the first description and every shot', () => {
    const shots = [
      shot('s01', 'cast: clerk (the toll clerk) | place: tollBooth. Coins.'),
      shot('s02', 'cast: clerk, driver | place: bridge. The queue.', 2),
      shot('s03', 'cast: driver (a lorry driver) | place: toll-booth. Payment.', 4),
    ];
    const { designs, dropped } = inkModuleDesigns(shots);
    expect(dropped).toEqual([]);
    expect(designs.map((design) => [design.kind, design.id, design.description])).toEqual([
      ['people', 'clerk', 'the toll clerk'],
      ['people', 'driver', 'a lorry driver'],
      ['places', 'tollBooth', undefined],
      ['places', 'bridge', undefined],
    ]);
    const booth = designs.find((design) => design.id === 'tollBooth');
    expect(booth?.shots.map((entry) => entry.id)).toEqual(['s01', 's03']);
    if (booth === undefined) throw new Error('tollBooth');
    expect(designBrief(booth)).toMatch(/^tollBooth: the setting the storyboard calls/);
    const words: WordsFile = {
      version: 1,
      words: [
        { text: 'Pay', t: 0.2, tEnd: 0.5 },
        { text: 'twice.', t: 4.4, tEnd: 4.8 },
      ],
    };
    expect(narrationExcerpt(booth, words)).toBe('s01: "Pay"\ns03: "twice."');
    expect(narrationExcerpt(booth, undefined)).toMatch(/^s01: \(no words timed yet\) cast: clerk/);
  });
});
