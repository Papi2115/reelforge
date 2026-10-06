/**
 * The side column's tab (Chat · History · Director, director-view.ts), remembered in localStorage,
 * and `openDirector(section?)`: shows the column and the Director tab, scrolled to `section`. Old
 * entry points (Scenes built, the direction bar's History) reach it through the context.
 */
import { createContext, useCallback, useContext, useState } from 'react';
import { usePref } from '../layout/ui-prefs.js';
import {
  DEFAULT_SIDE_TAB,
  SIDE_TAB_STORAGE_KEY,
  sideTabSchema,
  type DirectorSection,
  type SideTab,
} from './director-view.js';

export type OpenDirector = (section?: DirectorSection) => void;

/** Provided by the workspace; null outside it (the pointers then show text only). */
export const OpenDirectorContext = createContext<OpenDirector | null>(null);

export function useOpenDirector(): OpenDirector | null {
  return useContext(OpenDirectorContext);
}

/** The section to bring into view; `nonce` repeats a request for the same section. */
export interface DirectorFocus {
  readonly section: DirectorSection;
  readonly nonce: number;
}

export interface SideTabs {
  readonly tab: SideTab;
  readonly setTab: (tab: SideTab) => void;
  readonly focus: DirectorFocus | null;
  readonly openDirector: OpenDirector;
}

/** `showColumn` opens the side column when it is the slim rail. */
export function useSideTabs(showColumn: () => void): SideTabs {
  const [tab, setTab] = usePref(SIDE_TAB_STORAGE_KEY, sideTabSchema, DEFAULT_SIDE_TAB);
  const [focus, setFocus] = useState<DirectorFocus | null>(null);
  const openDirector = useCallback<OpenDirector>(
    (section) => {
      showColumn();
      setTab('director');
      if (section !== undefined) {
        setFocus((current) => ({ section, nonce: (current?.nonce ?? 0) + 1 }));
      }
    },
    [setTab, showColumn],
  );
  return { tab, setTab, focus, openDirector };
}
