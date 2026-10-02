/**
 * Keyboard shortcuts of the player (PLAN.md#6.4): Space play/pause, ←/→ one frame, Shift+←/→ one
 * second, Home/End, J/K/L (slower / pause / play-faster), M mute. Text fields keep their keys, and
 * a focused scrub slider keeps its own arrow/Home/End handling. Pure: maps a key event to an action.
 */

export type TransportAction =
  | { readonly kind: 'toggle' }
  | { readonly kind: 'step'; readonly frames: number }
  | { readonly kind: 'jump'; readonly seconds: number }
  | { readonly kind: 'start' }
  | { readonly kind: 'end' }
  | { readonly kind: 'slower' }
  | { readonly kind: 'pause' }
  | { readonly kind: 'faster' }
  | { readonly kind: 'mute' };

/** What the event's target is, as far as shortcuts care. */
export interface KeyTarget {
  readonly tagName: string;
  /** `type` of an <input>. */
  readonly inputType?: string | undefined;
  readonly contentEditable: boolean;
}

export interface TransportKey {
  readonly key: string;
  readonly shiftKey: boolean;
  readonly ctrlKey: boolean;
  readonly altKey: boolean;
  readonly metaKey: boolean;
  readonly repeat: boolean;
  readonly target: KeyTarget | undefined;
}

/** Inputs that are buttons/toggles rather than text fields. */
const NON_TEXT_INPUTS = new Set(['range', 'checkbox', 'radio', 'button', 'submit', 'reset']);
/** Keys a focused range input handles itself. */
const SLIDER_KEYS = new Set([
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'ArrowDown',
  'Home',
  'End',
  'PageUp',
  'PageDown',
]);

function isTextEntry(target: KeyTarget): boolean {
  if (target.contentEditable) return true;
  const tag = target.tagName.toUpperCase();
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
  return tag === 'INPUT' && !NON_TEXT_INPUTS.has((target.inputType ?? 'text').toLowerCase());
}

export function transportAction(event: TransportKey): TransportAction | undefined {
  if (event.ctrlKey || event.altKey || event.metaKey) return undefined;
  const target = event.target;
  if (target && isTextEntry(target)) return undefined;
  const slider = target?.tagName.toUpperCase() === 'INPUT' && target.inputType === 'range';
  if (slider && SLIDER_KEYS.has(event.key)) return undefined;
  switch (event.key) {
    case ' ':
      return event.repeat ? undefined : { kind: 'toggle' };
    case 'ArrowLeft':
      return event.shiftKey ? { kind: 'jump', seconds: -1 } : { kind: 'step', frames: -1 };
    case 'ArrowRight':
      return event.shiftKey ? { kind: 'jump', seconds: 1 } : { kind: 'step', frames: 1 };
    case 'Home':
      return { kind: 'start' };
    case 'End':
      return { kind: 'end' };
    default:
      break;
  }
  if (event.repeat) return undefined;
  switch (event.key.toLowerCase()) {
    case 'j':
      return { kind: 'slower' };
    case 'k':
      return { kind: 'pause' };
    case 'l':
      return { kind: 'faster' };
    case 'm':
      return { kind: 'mute' };
    default:
      return undefined;
  }
}

/** Reads the shortcut-relevant facts of a DOM event target. */
export function keyTargetOf(target: EventTarget | null): KeyTarget | undefined {
  if (!(target instanceof HTMLElement)) return undefined;
  return {
    tagName: target.tagName,
    inputType: target instanceof HTMLInputElement ? target.type : undefined,
    contentEditable: target.isContentEditable,
  };
}
