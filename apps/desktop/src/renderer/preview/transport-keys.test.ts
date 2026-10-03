import { describe, expect, it } from 'vitest';
import { transportAction, type KeyTarget, type TransportKey } from './transport-keys.js';

const BODY: KeyTarget = { tagName: 'BODY', contentEditable: false };

function key(name: string, options: Partial<TransportKey> = {}): TransportKey {
  return {
    key: name,
    shiftKey: false,
    ctrlKey: false,
    altKey: false,
    metaKey: false,
    repeat: false,
    target: BODY,
    ...options,
  };
}

describe('transportAction', () => {
  it('maps the player shortcuts', () => {
    expect(transportAction(key(' '))).toEqual({ kind: 'toggle' });
    expect(transportAction(key('ArrowLeft'))).toEqual({ kind: 'step', frames: -1 });
    expect(transportAction(key('ArrowRight'))).toEqual({ kind: 'step', frames: 1 });
    expect(transportAction(key('ArrowLeft', { shiftKey: true }))).toEqual({
      kind: 'jump',
      seconds: -1,
    });
    expect(transportAction(key('ArrowRight', { shiftKey: true }))).toEqual({
      kind: 'jump',
      seconds: 1,
    });
    expect(transportAction(key('Home'))).toEqual({ kind: 'start' });
    expect(transportAction(key('End'))).toEqual({ kind: 'end' });
    expect(transportAction(key('j'))).toEqual({ kind: 'slower' });
    expect(transportAction(key('K'))).toEqual({ kind: 'pause' });
    expect(transportAction(key('l'))).toEqual({ kind: 'faster' });
    expect(transportAction({ ...key('L'), shiftKey: true })).toBeUndefined();
    expect(transportAction(key('m'))).toEqual({ kind: 'mute' });
    expect(transportAction(key('x'))).toBeUndefined();
  });

  it('leaves modified keys and auto-repeated toggles alone', () => {
    expect(transportAction(key(' ', { ctrlKey: true }))).toBeUndefined();
    expect(transportAction(key('ArrowLeft', { altKey: true }))).toBeUndefined();
    expect(transportAction(key('l', { metaKey: true }))).toBeUndefined();
    expect(transportAction(key(' ', { repeat: true }))).toBeUndefined();
    expect(transportAction(key('m', { repeat: true }))).toBeUndefined();
    // Holding an arrow keeps stepping.
    expect(transportAction(key('ArrowRight', { repeat: true }))).toEqual({
      kind: 'step',
      frames: 1,
    });
  });

  it('never steals keys from text fields', () => {
    const fields: KeyTarget[] = [
      { tagName: 'TEXTAREA', contentEditable: false },
      { tagName: 'INPUT', inputType: 'text', contentEditable: false },
      { tagName: 'INPUT', inputType: 'search', contentEditable: false },
      { tagName: 'SELECT', contentEditable: false },
      { tagName: 'DIV', contentEditable: true },
    ];
    for (const target of fields) {
      expect(transportAction(key(' ', { target }))).toBeUndefined();
      expect(transportAction(key('ArrowLeft', { target }))).toBeUndefined();
      expect(transportAction(key('k', { target }))).toBeUndefined();
    }
  });

  it('lets a focused slider handle its own keys but still toggles on Space', () => {
    const slider: KeyTarget = { tagName: 'INPUT', inputType: 'range', contentEditable: false };
    for (const name of ['ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp']) {
      expect(transportAction(key(name, { target: slider }))).toBeUndefined();
    }
    expect(transportAction(key(' ', { target: slider }))).toEqual({ kind: 'toggle' });
    const button: KeyTarget = { tagName: 'BUTTON', contentEditable: false };
    expect(transportAction(key(' ', { target: button }))).toEqual({ kind: 'toggle' });
    expect(transportAction(key('ArrowLeft', { target: button }))).toEqual({
      kind: 'step',
      frames: -1,
    });
  });
});
