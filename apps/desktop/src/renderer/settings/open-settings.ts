/**
 * Opening Settings from deep inside the workspace (e.g. the Voiceover panel's "Open Channels",
 * PLAN.md#13.14) without threading a callback through every layer: App provides the opener, a
 * panel asks for a tab and, on the Channels tab, the channel to select first.
 */
import { createContext, useContext } from 'react';
import type { SettingsTab } from './SettingsDialog.js';

export interface SettingsRequest {
  readonly tab: SettingsTab;
  /** Channels tab: the channel selected first. */
  readonly channelId?: string | undefined;
}

export type OpenSettings = (request: SettingsRequest) => void;

export const OpenSettingsContext = createContext<OpenSettings | null>(null);

/** Null outside App (then the caller names the place in words instead of a button). */
export function useOpenSettings(): OpenSettings | null {
  return useContext(OpenSettingsContext);
}
