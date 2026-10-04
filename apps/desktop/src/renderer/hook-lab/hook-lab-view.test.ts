import type { HookSet } from '@reelforge/shared';
import { describe, expect, it } from 'vitest';
import type { HookLabView } from '../../shared/hook-lab-contract.js';
import {
  durationLabel,
  labPhase,
  openingCards,
  pickConsequences,
  wordDiff,
} from './hook-lab-view.js';

const SET: HookSet = {
  version: 1,
  number: 3,
  createdAt: '2026-10-04T10:00:00.000Z',
  opening: 'Light hides colours.',
  scriptFingerprint: 'abcd1234',
  warnings: [],
  variants: [
    {
      index: 1,
      style: 'cold-open',
      text: 'A beam hits the glass.',
      firstVisual: 'Beam',
      claimsToSource: false,
      wordCount: 5,
    },
    {
      index: 2,
      style: 'question',
      text: 'Does light hide colours?',
      firstVisual: 'Question mark',
      claimsToSource: false,
      wordCount: 4,
    },
    {
      index: 3,
      style: 'shocking-fact',
      text: 'In 1672 light split.',
      firstVisual: '1672',
      claimsToSource: true,
      wordCount: 4,
    },
  ],
};

const VIEW: HookLabView = {
  opening: 'Light hides colours.',
  set: SET,
  history: 3,
  stale: false,
  voiceover: false,
  lockedShots: [],
  generating: false,
  scriptBusy: false,
};

describe('hook lab view', () => {
  it('diffs words and merges runs', () => {
    expect(wordDiff('the red glass of water', 'the blue glass of cold water')).toEqual([
      { kind: 'same', text: 'the' },
      { kind: 'added', text: 'blue' },
      { kind: 'removed', text: 'red' },
      { kind: 'same', text: 'glass of' },
      { kind: 'added', text: 'cold' },
      { kind: 'same', text: 'water' },
    ]);
    expect(wordDiff('', 'new words')).toEqual([{ kind: 'added', text: 'new words' }]);
    expect(wordDiff('old', '')).toEqual([{ kind: 'removed', text: 'old' }]);
  });

  it('lays out the current opening and the three variants', () => {
    const cards = openingCards(VIEW.opening ?? '', SET);
    expect(cards.map((card) => [card.index, card.title, card.words, card.needsSource])).toEqual([
      [0, 'Current opening', 3, false],
      [1, '1 · Cold open', 5, false],
      [2, '2 · Question', 4, false],
      [3, '3 · Shocking fact', 4, true],
    ]);
    expect(cards[0]?.diff).toEqual([]);
    expect(cards[2]?.diff).toEqual([
      { kind: 'added', text: 'Does light hide colours?' },
      { kind: 'removed', text: 'Light hides colours.' },
    ]);
    expect(durationLabel(50)).toBe('≈ 20 s');
  });

  it('picks the phase of the lab', () => {
    expect(labPhase(VIEW)).toEqual({ kind: 'compare', set: SET, opening: VIEW.opening });
    expect(labPhase({ ...VIEW, opening: null }).kind).toBe('no-script');
    expect(labPhase({ ...VIEW, generating: true }).kind).toBe('generating');
    expect(labPhase({ ...VIEW, scriptBusy: true }).kind).toBe('busy');
    expect(labPhase({ ...VIEW, set: null, history: 0 })).toEqual({ kind: 'empty', history: 0 });
    const decided = { ...SET, decision: { kind: 'discard' as const, at: SET.createdAt } };
    expect(labPhase({ ...VIEW, set: decided })).toEqual({ kind: 'empty', history: 3 });
    expect(labPhase({ ...VIEW, stale: true }).kind).toBe('stale');
  });

  it('says what a pick means: re-recording and the locked shots', () => {
    expect(pickConsequences(VIEW)).toHaveLength(2);
    const lines = pickConsequences({ ...VIEW, voiceover: true, lockedShots: ['s01', 's02'] });
    expect(lines).toContain(
      'You will need to re-record the opening: the voice-over no longer matches the script.',
    );
    expect(lines.at(-1)).toBe(
      'Locked shots stay exactly as they are and are never rebuilt automatically: s01, s02.',
    );
  });
});
