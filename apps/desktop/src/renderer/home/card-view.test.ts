import { describe, expect, it } from 'vitest';
import {
  cardSentence,
  cardState,
  formatDuration,
  nextStep,
  relativeTime,
  styleBadge,
  styleTint,
  stepTitle,
  titleInitials,
} from './card-view.js';
import { card, NOW, steps } from './home-test-cards.js';

const ago = (ms: number): string => new Date(NOW - ms).toISOString();
const MINUTE = 60_000;

describe('cardState', () => {
  it('puts what waits for the user first, then work in progress', () => {
    expect(cardState(card('Gone', { exists: false }))).toBe('missing');
    expect(cardState(card('New'))).toBe('new');
    expect(cardState(card('A', { steps: steps({ script: 'done' }) }))).toBe('in-progress');
    expect(cardState(card('B', { steps: steps({ script: 'done', voice: 'busy' }) }))).toBe(
      'working',
    );
    expect(cardState(card('C', { steps: steps({ script: 'needs-you', voice: 'busy' }) }))).toBe(
      'needs-you',
    );
    expect(cardState(card('D', { steps: steps({ scenes: 'problem' }) }))).toBe('needs-you');
    expect(cardState(card('E', { steps: steps({ export: 'done' }) }))).toBe('done');
  });
});

describe('card sentences', () => {
  it('says the next thing in plain words', () => {
    expect(cardSentence(card('New', { steps: steps({ script: 'needs-you' }) }))).toBe(
      'New: describe the video, then write the script.',
    );
    expect(cardSentence(card('A', { steps: steps({ script: 'done', voice: 'needs-you' }) }))).toBe(
      'Voice needs you.',
    );
    expect(cardSentence(card('B', { steps: steps({ script: 'done', voice: 'done' }) }))).toBe(
      '2 of 8 steps done · next: Clean',
    );
    expect(cardSentence(card('C', { steps: steps({ scenes: 'busy' }) }))).toBe(
      'Working on scenes…',
    );
    expect(cardSentence(card('D', { steps: steps({ sound: 'problem' }) }))).toBe(
      'Sound stopped with a problem.',
    );
    const all = steps(
      Object.fromEntries(
        ['script', 'voice', 'clean', 'words', 'storyboard', 'scenes', 'sound', 'export'].map(
          (step) => [step, 'done'],
        ),
      ),
    );
    expect(cardSentence(card('E', { steps: all }))).toBe('Video exported ✓');
    expect(nextStep(all)).toBeNull();
    expect(cardSentence(card('F', { exists: false }))).toBe(
      'The folder is gone (moved or deleted).',
    );
    expect(cardSentence(card('G', { problem: 'bad json' }))).toContain('damaged');
  });

  it('names each dot', () => {
    expect(stepTitle({ step: 'voice', state: 'needs-you' })).toBe('Voice: needs you');
  });
});

describe('relativeTime', () => {
  it('reads like a person', () => {
    expect(relativeTime(null, NOW)).toBeNull();
    expect(relativeTime('not a date', NOW)).toBeNull();
    expect(relativeTime(ago(10_000), NOW)).toBe('just now');
    expect(relativeTime(ago(5 * MINUTE), NOW)).toBe('5 min ago');
    expect(relativeTime(ago(3 * 60 * MINUTE), NOW)).toBe('3 h ago');
    expect(relativeTime(ago(30 * 60 * MINUTE), NOW)).toBe('yesterday');
    expect(relativeTime(ago(4 * 24 * 60 * MINUTE), NOW)).toBe('4 days ago');
    expect(relativeTime('2026-09-12T12:00:00.000Z', NOW)).toBe('12 Sep');
    expect(relativeTime('2025-09-12T12:00:00.000Z', NOW)).toBe('12 Sep 2025');
  });
});

describe('small facts', () => {
  it('formats lengths', () => {
    expect(formatDuration(null)).toBeNull();
    expect(formatDuration(42.4)).toBe('0:42');
    expect(formatDuration(485)).toBe('8:05');
    expect(formatDuration(3723)).toBe('1:02:03');
  });

  it('makes initials of the meaningful words', () => {
    expect(titleInitials('How a calculator runs Doom')).toBe('HC');
    expect(titleInitials('Doom')).toBe('D');
    expect(titleInitials('  ')).toBe('?');
    expect(titleInitials('żółw w wodzie')).toBe('ŻW');
  });

  it('colours placeholders by style', () => {
    expect(styleTint('sketchbook').back).toBe('#efe6d2');
    expect(styleTint('unknown-style')).toEqual(styleTint(null));
    expect(styleBadge('noir-voxel')).toBe('Noir Voxel');
    expect(styleBadge(null)).toBeNull();
  });
});
