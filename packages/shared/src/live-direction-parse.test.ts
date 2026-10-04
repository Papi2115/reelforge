import { describe, expect, it } from 'vitest';
import type { ShotDirection } from './live-direction.js';
import {
  parseDirectionCommand,
  type DirectionCommandContext,
  type DirectionCommandResult,
} from './live-direction-parse.js';
import { findWord, foldText } from './live-direction-words.js';

const WORDS = [
  { text: 'Light', t: 0.2, tEnd: 0.5 },
  { text: 'bends', t: 0.6, tEnd: 0.9 },
  { text: 'in', t: 1.0, tEnd: 1.1 },
  { text: 'glass.', t: 1.2, tEnd: 1.6 },
  // s02 starts at 3
  { text: 'Szkło', t: 3.2, tEnd: 3.6 },
  { text: 'łamie', t: 3.7, tEnd: 4.0 },
  { text: 'światło,', t: 4.1, tEnd: 4.6 },
  { text: 'a', t: 4.7, tEnd: 4.75 },
  { text: 'światło', t: 6.0, tEnd: 6.5 },
  { text: 'right', t: 7.0, tEnd: 7.3 },
];

function context(over: Partial<DirectionCommandContext> = {}): DirectionCommandContext {
  return {
    shot: { id: 's02', t0: 3, t1: 9 },
    current: undefined,
    words: WORDS,
    playhead: 4,
    ...over,
  };
}

function next(result: DirectionCommandResult): ShotDirection | undefined {
  if (result.kind !== 'direction') throw new Error(`expected a direction, got ${result.kind}`);
  return result.next;
}

describe('parseDirectionCommand: tempo, tone, zoom (EN/PL)', () => {
  it.each([
    ['slower', { rate: 0.8 }],
    ['wolniej', { rate: 0.8 }],
    ['a bit slower please', { rate: 0.8 }],
    ['much slower', { rate: 0.6 }],
    ['faster', { rate: 1.2 }],
    ['Szybciej!', { rate: 1.2 }],
    ['darker', { dim: -0.25 }],
    ['ciemniej', { dim: -0.25 }],
    ['brighter', { dim: 0.25 }],
    ['Jaśniej', { dim: 0.25 }],
    ['zoom in', { zoom: 1.1 }],
    ['przybliż', { zoom: 1.1 }],
    ['make it darker', { dim: -0.25 }],
  ])('%s', (command, expected) => {
    expect(next(parseDirectionCommand(command, context()))).toEqual(expected);
  });

  it('steps from the current direction and stops at the limits', () => {
    const current = { rate: 0.8, dim: -0.75, zoom: 1.3 };
    expect(next(parseDirectionCommand('slower', context({ current })))).toEqual({
      rate: 0.6,
      dim: -0.75,
      zoom: 1.3,
    });
    expect(parseDirectionCommand('zoom in', context({ current })).kind).toBe('error');
    expect(next(parseDirectionCommand('darker', context({ current })))?.dim).toBe(-1);
    expect(
      next(parseDirectionCommand('faster', context({ current: { rate: 0.8 } }))),
    ).toBeUndefined();
    expect(parseDirectionCommand('zoom out', context()).kind).toBe('error');
  });

  it('undo, redo, clear', () => {
    expect(parseDirectionCommand('cofnij', context()).kind).toBe('undo');
    expect(parseDirectionCommand('Undo', context()).kind).toBe('undo');
    expect(parseDirectionCommand('ponów', context()).kind).toBe('redo');
    const cleared = parseDirectionCommand('wyczyść', context({ current: { dim: 1 } }));
    expect(cleared).toMatchObject({ kind: 'direction', next: undefined });
  });

  it('sends what it does not understand to Claude', () => {
    expect(parseDirectionCommand('make it a terminal', context())).toEqual({
      kind: 'needs-claude',
      shotId: 's02',
      request: 'make it a terminal',
    });
    expect(parseDirectionCommand('use the diorama look', context()).kind).toBe('needs-claude');
    expect(parseDirectionCommand('zrób to jako terminal', context()).kind).toBe('needs-claude');
  });
});

describe('parseDirectionCommand: marks on words', () => {
  it('arrow on the word X (English), timed on the word', () => {
    const result = parseDirectionCommand('arrow on the word łamie', context());
    const overlay = next(result)?.overlays?.[0];
    expect(overlay).toMatchObject({ kind: 'arrow', at: 3.7, region: 'center', word: { index: 5 } });
    expect(overlay?.until).toBeCloseTo(5.7);
    expect(result.kind === 'direction' && result.confirmation).toContain('"łamie"');
  });

  it('strzałka na słowie X (Polish, diacritics-insensitive)', () => {
    const overlay = next(parseDirectionCommand('strzałka na słowie szklo', context()))
      ?.overlays?.[0];
    expect(overlay).toMatchObject({ kind: 'arrow', word: { index: 4, text: 'Szkło' } });
  });

  it('podkreśl / zakreśl / highlight this / callout', () => {
    expect(next(parseDirectionCommand('podkreśl łamie', context()))?.overlays?.[0]?.kind).toBe(
      'underline',
    );
    expect(next(parseDirectionCommand('zakreśl szkło', context()))?.overlays?.[0]?.kind).toBe(
      'ring',
    );
    const here = next(parseDirectionCommand('highlight this', context({ playhead: 3.8 })))
      ?.overlays?.[0];
    expect(here).toMatchObject({ kind: 'highlight', word: { index: 5 } });
    const pl = next(parseDirectionCommand('zaznacz to', context({ playhead: 3.8 })))?.overlays?.[0];
    expect(pl).toMatchObject({ kind: 'highlight', word: { index: 5 } });
    const callout = next(parseDirectionCommand('callout on szkło', context()))?.overlays?.[0];
    expect(callout).toMatchObject({ kind: 'callout', text: 'SZKŁO' });
  });

  it('picks the occurrence nearest to the playhead and says so', () => {
    const early = parseDirectionCommand('ring on światło', context({ playhead: 4 }));
    expect(next(early)?.overlays?.[0]?.word?.index).toBe(6);
    expect(early.kind === 'direction' && early.confirmation).toContain('nearest of 2');
    const late = parseDirectionCommand('ring on swiatlo', context({ playhead: 6.2 }));
    expect(next(late)?.overlays?.[0]?.word?.index).toBe(8);
  });

  it('accepts one typo, rejects words outside the shot', () => {
    expect(
      next(parseDirectionCommand('arrow on swiatla', context()))?.overlays?.[0]?.word?.index,
    ).toBe(6);
    const other = parseDirectionCommand('arrow on the word glass', context());
    expect(other).toMatchObject({ kind: 'error' });
    expect(other.kind === 'error' && other.message).toContain('another shot');
    expect(parseDirectionCommand('arrow on banana', context()).kind).toBe('error');
  });

  it('named regions and clicked points', () => {
    const left = next(parseDirectionCommand('arrow on szkło at the top left', context()))
      ?.overlays?.[0];
    expect(left).toMatchObject({ region: 'top-left', x: 0.28, y: 0.3 });
    const pl = next(parseDirectionCommand('strzałka na szkło po prawej', context()))?.overlays?.[0];
    expect(pl).toMatchObject({ region: 'right' });
    const clicked = next(
      parseDirectionCommand('arrow on szkło', context({ point: { x: 0.99, y: 0.4 } })),
    )?.overlays?.[0];
    expect(clicked).toMatchObject({ x: 0.9, y: 0.4 });
    expect(clicked?.region).toBeUndefined();
    const word = next(parseDirectionCommand('arrow on the word right', context()))?.overlays?.[0];
    expect(word).toMatchObject({ word: { text: 'right' }, region: 'center' });
  });

  it('removes marks (EN/PL) and numbers ids uniquely', () => {
    let current = next(parseDirectionCommand('arrow on szkło', context()));
    current = next(parseDirectionCommand('ring on łamie', context({ current })));
    current = next(parseDirectionCommand('arrow on łamie', context({ current })));
    expect(current?.overlays?.map((overlay) => overlay.id)).toEqual([
      'arrow-1',
      'ring-1',
      'arrow-2',
    ]);
    const removed = next(parseDirectionCommand('usuń strzałkę', context({ current })));
    expect(removed?.overlays?.map((overlay) => overlay.id)).toEqual(['arrow-1', 'ring-1']);
    const english = next(parseDirectionCommand('remove the ring', context({ current: removed })));
    expect(english?.overlays?.map((overlay) => overlay.id)).toEqual(['arrow-1']);
    expect(next(parseDirectionCommand('remove all marks', context({ current })))).toBeUndefined();
    expect(parseDirectionCommand('remove the badge', context({ current })).kind).toBe('error');
    expect(parseDirectionCommand('usuń strzałkę', context()).kind).toBe('error');
  });

  it('is deterministic', () => {
    const first = parseDirectionCommand('arrow on szkło', context());
    expect(parseDirectionCommand('arrow on szkło', context())).toEqual(first);
  });
});

describe('word folding', () => {
  it('folds case, diacritics and punctuation', () => {
    expect(foldText('Światło,')).toBe('swiatlo');
    expect(foldText('ŁAMIE')).toBe('lamie');
  });

  it('matches phrases', () => {
    const match = findWord(WORDS, 'bends in', { from: 0, to: 4 }, 0);
    expect(match).toMatchObject({ index: 1, length: 2, t: 0.6, tEnd: 1.1, text: 'bends in' });
  });
});
