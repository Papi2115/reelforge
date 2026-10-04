import { describe, expect, it } from 'vitest';
import {
  claudeOffer,
  directionSummary,
  EMPTY_SESSION,
  hintCommand,
  isCommandBarKey,
  lockedStatus,
  markUndone,
  MAX_HISTORY,
  pushEntry,
  redoTarget,
  statusText,
  undoTarget,
} from './direction-view.js';

const entry = (command: string, after: number) => ({
  command,
  shotId: 's01',
  confirmation: command,
  before: undefined,
  after: { dim: after },
});

describe('session history', () => {
  it('undoes newest first, redoes oldest undone first, and a new command drops the redo branch', () => {
    let session = pushEntry(
      pushEntry(EMPTY_SESSION, entry('darker', -0.25)),
      entry('darker', -0.5),
    );
    expect(session.entries.map((item) => item.id)).toEqual([1, 2]);
    expect(undoTarget(session)?.id).toBe(2);
    session = markUndone(session, 2, true);
    expect(undoTarget(session)?.id).toBe(1);
    session = markUndone(session, 1, true);
    expect(undoTarget(session)).toBeUndefined();
    expect(redoTarget(session)?.id).toBe(1);
    session = markUndone(session, 1, false);
    expect(redoTarget(session)?.id).toBe(2);
    session = pushEntry(session, entry('brighter', 0));
    expect(session.entries.map((item) => item.command)).toEqual(['darker', 'brighter']);
    expect(redoTarget(session)).toBeUndefined();
  });

  it('keeps at most MAX_HISTORY entries', () => {
    let session = EMPTY_SESSION;
    for (let index = 0; index < MAX_HISTORY + 5; index += 1) {
      session = pushEntry(session, entry(`c${String(index)}`, -0.25));
    }
    expect(session.entries).toHaveLength(MAX_HISTORY);
    expect(session.entries[0]?.command).toBe('c5');
  });
});

describe('bar texts', () => {
  it('fills the word chip from the playhead', () => {
    expect(hintCommand('arrow on the word …', { text: 'Light,', t: 1, tEnd: 1.2 })).toBe(
      'arrow on the word Light',
    );
    expect(hintCommand('arrow on the word …', undefined)).toBe('arrow on the word');
    expect(hintCommand('slower', undefined)).toBe('slower');
  });

  it('summarises directions for the indicator', () => {
    expect(directionSummary(undefined)).toBe('No directions');
    expect(
      directionSummary({
        rate: 0.8,
        dim: -0.25,
        zoom: 1.2,
        overlays: [{ id: 'arrow-1', kind: 'arrow', x: 0.5, y: 0.5, at: 1, until: 2 }],
      }),
    ).toBe('slower 0.8x · darker 0.25 · zoom 1.2x · 1 mark');
  });

  it('status lines: applied with latency, locked offer, Claude offer', () => {
    expect(statusText({ kind: 'applied', text: 'Darker: tone -0.25', ms: 42.4 })).toBe(
      'Darker: tone -0.25 (42 ms)',
    );
    expect(lockedStatus('s03')).toEqual({
      kind: 'locked',
      shotId: 's03',
      text: 's03 is locked: unlock this shot to direct it',
    });
    const offer = claudeOffer('s03', 'make it a terminal');
    expect(offer).toMatchObject({ kind: 'claude', shotId: 's03', request: 'make it a terminal' });
    expect(statusText(offer)).toContain('needs Claude');
    expect(statusText({ kind: 'idle' })).toBe('');
  });
});

describe('slash shortcut', () => {
  const key = (over: Partial<Parameters<typeof isCommandBarKey>[0]> = {}) => ({
    key: '/',
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    targetTag: 'DIV',
    targetEditable: false,
    ...over,
  });

  it('focuses the bar only when the user is not typing elsewhere', () => {
    expect(isCommandBarKey(key())).toBe(true);
    expect(isCommandBarKey(key({ targetTag: 'INPUT' }))).toBe(false);
    expect(isCommandBarKey(key({ targetTag: 'textarea' }))).toBe(false);
    expect(isCommandBarKey(key({ targetEditable: true }))).toBe(false);
    expect(isCommandBarKey(key({ ctrlKey: true }))).toBe(false);
    expect(isCommandBarKey(key({ key: '?' }))).toBe(false);
  });
});
