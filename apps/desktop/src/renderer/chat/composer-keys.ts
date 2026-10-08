/**
 * Keys of the chat message box (layout/shortcut-table.ts "Claude"): Enter sends (or queues while
 * Claude works), Shift+Enter is a new line. Escape does nothing here: it never stops a running
 * turn (Ctrl+. does, window-wide). Pure.
 */

export interface ComposerKey {
  readonly key: string;
  readonly shiftKey: boolean;
  /** An IME composition is in progress: Enter confirms it, it does not send. */
  readonly isComposing: boolean;
}

export function composerKeyAction(event: ComposerKey): 'send' | undefined {
  return event.key === 'Enter' && !event.shiftKey && !event.isComposing ? 'send' : undefined;
}
