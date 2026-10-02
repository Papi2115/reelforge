import { describe, expect, it } from 'vitest';
import type { CueEdit, RawCue } from './timeline-contract.js';
import {
  applyBoundaryEdits,
  applyCueEdits,
  contiguityBreaks,
  cueLabel,
  roundTime,
  type CueAdapter,
} from './timeline-edits.js';

const shots = [
  { id: 's01', t0: 0, t1: 2.2, extra: 'kept' },
  { id: 's02', t0: 2.2, t1: 7.5 },
  { id: 's03', t0: 7.5, t1: 9 },
];

type Sfx = RawCue & { t: number };
type Range = RawCue & { from: number; to: number };

const adapter: CueAdapter<Sfx, Range> = {
  sfxFromRaw: (raw) => (typeof raw['t'] === 'number' ? { ...raw, t: raw['t'] } : undefined),
  rangeFromRaw: (raw) =>
    typeof raw['from'] === 'number' && typeof raw['to'] === 'number'
      ? { ...raw, from: raw['from'], to: raw['to'] }
      : undefined,
  toRaw: (item) => item,
};

const cues = {
  sfx: [
    { t: 1, name: 'hit' },
    { t: 3, name: 'pop', gainDb: -3 },
  ],
  ambience: [{ from: 0, to: 5, name: 'hum' }],
  music: [],
};

describe('applyBoundaryEdits', () => {
  it('moves a boundary, keeps other fields and returns the inverse', () => {
    const edit = { kind: 'move-boundary', left: 's01', right: 's02', from: 2.2, to: 2.5 } as const;
    const applied = applyBoundaryEdits(shots, [edit], 'strict');
    expect(applied.ok && applied.value.shots.slice(0, 2)).toEqual([
      { id: 's01', t0: 0, t1: 2.5, extra: 'kept' },
      { id: 's02', t0: 2.5, t1: 7.5 },
    ]);
    if (!applied.ok) throw new Error(applied.error);
    expect(applied.value.inverse).toEqual([{ ...edit, from: 2.5, to: 2.2 }]);
    const undone = applyBoundaryEdits(applied.value.shots, applied.value.inverse, 'strict');
    expect(undone.ok && undone.value.shots).toEqual(shots);
  });

  it('refuses stale, non-adjacent and too-short edits in strict mode', () => {
    const move = (left: string, right: string, from: number, to: number) =>
      applyBoundaryEdits(shots, [{ kind: 'move-boundary', left, right, from, to }], 'strict');
    expect(move('s01', 's02', 2.0, 2.5)).toMatchObject({ ok: false, error: /no longer at/ });
    expect(move('s01', 's03', 2.2, 2.5)).toMatchObject({ ok: false, error: /not adjacent/ });
    expect(move('s01', 's02', 2.2, 0.5)).toMatchObject({ ok: false, error: /at least 1 s/ });
    expect(move('s02', 's03', 7.5, 8.5)).toMatchObject({ ok: false, error: /at least 1 s/ });
    expect(move('s02', 's03', 7.5, 7.9)).toMatchObject({ ok: true });
  });

  it('skips edits that no longer fit in lenient mode', () => {
    const applied = applyBoundaryEdits(
      shots,
      [
        { kind: 'move-boundary', left: 's01', right: 's02', from: 9, to: 2.4 },
        { kind: 'move-boundary', left: 'nope', right: 's02', from: 2.2, to: 2.4 },
      ],
      'lenient',
    );
    expect(applied.ok && applied.value.shots).toEqual(shots);
  });
});

describe('applyCueEdits', () => {
  it('round-trips every edit kind through its inverse', () => {
    const edits: CueEdit[] = [
      { kind: 'move-sfx', index: 0, from: 1, to: 1.5 },
      { kind: 'set-gain', track: 'sfx', index: 1, from: -3, to: 2 },
      {
        kind: 'set-range',
        track: 'ambience',
        index: 0,
        from: { from: 0, to: 5 },
        to: { from: 1, to: 6 },
      },
      { kind: 'insert-cue', track: 'music', index: 0, cue: { from: 2, to: 4, file: 'm.wav' } },
      { kind: 'delete-cue', track: 'sfx', index: 1, at: 3 },
    ];
    const applied = applyCueEdits(cues, edits, adapter, 'strict');
    if (!applied.ok) throw new Error(applied.error);
    expect(applied.value.cues).toEqual({
      sfx: [{ t: 1.5, name: 'hit' }],
      ambience: [{ from: 1, to: 6, name: 'hum' }],
      music: [{ from: 2, to: 4, file: 'm.wav' }],
    });
    expect(applied.value.inverse[0]).toEqual({
      kind: 'insert-cue',
      track: 'sfx',
      index: 1,
      cue: { t: 3, name: 'pop', gainDb: 2 },
    });
    const undone = applyCueEdits(applied.value.cues, applied.value.inverse, adapter, 'strict');
    expect(undone.ok && undone.value.cues).toEqual(cues);
  });

  it('treats a missing gain as 0 dB', () => {
    const applied = applyCueEdits(
      cues,
      [{ kind: 'set-gain', track: 'sfx', index: 0, from: 0, to: -6 }],
      adapter,
      'strict',
    );
    expect(applied.ok && applied.value.cues.sfx[0]).toEqual({ t: 1, name: 'hit', gainDb: -6 });
  });

  it('rejects stale or missing cues in strict mode', () => {
    const apply = (edit: CueEdit) => applyCueEdits(cues, [edit], adapter, 'strict');
    expect(apply({ kind: 'move-sfx', index: 0, from: 2, to: 3 })).toMatchObject({
      ok: false,
      error: 'sfx cue 1 changed on disk',
    });
    expect(apply({ kind: 'delete-cue', track: 'music', index: 0, at: 0 })).toMatchObject({
      ok: false,
      error: 'music cue 1 does not exist',
    });
    expect(
      apply({ kind: 'insert-cue', track: 'sfx', index: 0, cue: { name: 'hit' } }),
    ).toMatchObject({ ok: false });
    expect(
      applyCueEdits(cues, [{ kind: 'move-sfx', index: 0, from: 2, to: 3 }], adapter, 'lenient'),
    ).toMatchObject({ ok: true, value: { inverse: [] } });
  });
});

describe('helpers', () => {
  it('counts gaps and overlaps between neighbouring shots', () => {
    expect(contiguityBreaks(shots)).toBe(0);
    expect(
      contiguityBreaks([
        { id: 'a', t0: 0, t1: 1 },
        { id: 'b', t0: 1.5, t1: 2 },
        { id: 'c', t0: 1.9, t1: 3 },
      ]),
    ).toBe(2);
  });

  it('labels cues by id, recipe, then file name', () => {
    expect(cueLabel({ id: 'boom', name: 'hit' }, 'sfx')).toBe('boom');
    expect(cueLabel({ name: 'hit' }, 'sfx')).toBe('hit');
    expect(cueLabel({ file: 'audio/sfx/door.wav' }, 'sfx')).toBe('door.wav');
    expect(cueLabel({ file: 'C:\\sfx\\door.wav' }, 'sfx')).toBe('door.wav');
    expect(cueLabel({}, 'sfx')).toBe('sfx');
  });

  it('rounds times to milliseconds', () => {
    expect(roundTime(12.34567)).toBe(12.346);
  });
});
