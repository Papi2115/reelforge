/**
 * When a voice slider shows the saved value (props) and when it keeps its own knob. Quick arrow
 * keys save one value per key; the answers come back while the next keys move the knob, so:
 * - a move not sent yet (key down, key up still to come) keeps the knob: its own save follows;
 * - an answer to an earlier save (a later value is on its way) keeps the knob;
 * - otherwise the saved value is shown (another field saved, a reset, a refused value).
 */
export interface SliderSync {
  /** The knob moved since the last commit (key up, pointer up, blur). */
  readonly moved: boolean;
  /** The value sent last whose answer has not come back yet. */
  readonly sent: number | undefined;
}

/** The value still on its way: none once the saved value is the one sent last (it was answered). */
export function pendingValue(sent: number | undefined, saved: number): number | undefined {
  return sent === saved ? undefined : sent;
}

export function showsSavedValue(sync: SliderSync, saved: number): boolean {
  return !sync.moved && pendingValue(sync.sent, saved) === undefined;
}

/** The value a commit sends: undefined when it is already saved or on its way. */
export function valueToSend(sync: SliderSync, value: number, saved: number): number | undefined {
  return value === (sync.sent ?? saved) ? undefined : value;
}
