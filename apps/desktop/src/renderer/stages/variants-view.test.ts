import { describe, expect, it } from 'vitest';
import type { StageRunView } from '../../shared/stages-contract.js';
import type { VariantCard, VariantSetView } from '../../shared/variants-contract.js';
import type { TransportKey } from '../preview/transport-keys.js';
import {
  cardBadge,
  cardKeyAction,
  defaultVariantCount,
  isVariantsShortcut,
  pickable,
  shotsWithVariants,
  variantsProgressText,
  variantsRun,
} from './variants-view.js';

const card = (
  key: VariantCard['key'],
  status: VariantCard['status'],
  qa: VariantCard['qa'] = null,
) =>
  ({
    key,
    title: key,
    direction: key === 'current' ? null : 'Orbit',
    status,
    qa,
    notes: [],
    reason: null,
  }) satisfies VariantCard;

const cards = [
  card('current', 'current', 'ok'),
  card('v1', 'ready', 'ok'),
  card('v2', 'dropped'),
  card('v3', 'ready', 'warning'),
];

const key = (value: string, extra: Partial<TransportKey> = {}): TransportKey => ({
  key: value,
  shiftKey: false,
  ctrlKey: false,
  altKey: false,
  metaKey: false,
  repeat: false,
  target: undefined,
  ...extra,
});

const run = (action: string | null, targets: string[] | null): StageRunView => ({
  stage: 'scenes',
  label: 'Claude: scene-build s03 v2',
  percent: null,
  startedAt: 0,
  steps: [],
  paused: null,
  action,
  targets,
  shots: {},
});

describe('variants view', () => {
  it('defaults to 3 variants, 2 in Economy mode', () => {
    expect(defaultVariantCount(false)).toBe(3);
    expect(defaultVariantCount(true)).toBe(2);
  });

  it('recognizes the variants run of a shot', () => {
    expect(variantsRun(run('variants', ['s03']), 's03')).not.toBeNull();
    expect(variantsRun(run('variants', ['s04']), 's03')).toBeNull();
    expect(variantsRun(run(null, ['s03']), 's03')).toBeNull();
    expect(variantsRun(null, 's03')).toBeNull();
  });

  it('selects with 1/2/3 and arrows, picks with Enter only on a ready variant', () => {
    expect(cardKeyAction(key('2'), cards, 0)).toEqual({ kind: 'select', index: 2 });
    expect(cardKeyAction(key('ArrowRight'), cards, 3)).toEqual({ kind: 'select', index: 0 });
    expect(cardKeyAction(key('ArrowLeft'), cards, 0)).toEqual({ kind: 'select', index: 3 });
    expect(cardKeyAction(key('Enter'), cards, 1)).toEqual({ kind: 'pick' });
    expect(cardKeyAction(key('Enter'), cards, 2)).toBeUndefined();
    expect(cardKeyAction(key('Enter'), cards, 0)).toBeUndefined();
    expect(cardKeyAction(key('1', { ctrlKey: true }), cards, 0)).toBeUndefined();
    const input = { tagName: 'INPUT', inputType: 'text', contentEditable: false };
    expect(cardKeyAction(key('2', { target: input }), cards, 0)).toBeUndefined();
    expect(pickable(cards[3])).toBe(true);
    expect(pickable(cards[0])).toBe(false);
  });

  it('opens variants on V outside text fields', () => {
    expect(isVariantsShortcut(key('v'))).toBe(true);
    expect(isVariantsShortcut(key('V'))).toBe(true);
    expect(isVariantsShortcut(key('v', { ctrlKey: true }))).toBe(false);
    expect(isVariantsShortcut(key('v', { shiftKey: true }))).toBe(false);
    const area = { tagName: 'TEXTAREA', inputType: undefined, contentEditable: false };
    expect(isVariantsShortcut(key('v', { target: area }))).toBe(false);
  });

  it('describes progress and badges', () => {
    const set: VariantSetView = {
      shotId: 's03',
      note: null,
      cards: [
        cards[0] ?? card('current', 'current'),
        card('v1', 'ready', 'ok'),
        card('v2', 'building'),
      ],
    };
    expect(variantsProgressText(run('variants', ['s03']), set)).toBe(
      'Variants: 1/2 done · Claude: scene-build s03 v2',
    );
    expect(cardBadge(card('v1', 'building'))).toBe('Building…');
    expect(cardBadge(card('v1', 'dropped'))).toBe('Dropped');
    expect(cardBadge(card('v1', 'ready', 'warning'))).toBe('⚠');
    expect([...shotsWithVariants({ projectDir: 'x', sets: [set] })]).toEqual(['s03']);
  });
});
