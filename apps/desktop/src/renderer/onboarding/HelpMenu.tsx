/**
 * Help menu of the header (PLAN.md#10.3): the tour (when a project is open), keyboard shortcuts,
 * the logs folder, Report a problem and About (where the version and the Electron / Chrome
 * versions live). A menu button (layout/MenuButton.tsx).
 */
import type { JSX } from 'react';
import { MenuButton, type MenuItem } from '../layout/MenuButton.js';
import { appShortcutKeys } from '../layout/shortcut-table.js';
import { errorMessage, rendererLog } from '../log.js';
import type { HelpDialogKind } from './HelpDialogs.js';

const log = rendererLog('help');

export interface HelpMenuProps {
  /** Starts the tour; null while no project is open (the tour shows the workspace). */
  readonly onTour: (() => void) | null;
  readonly onDialog: (kind: HelpDialogKind) => void;
}

export function HelpMenu({ onTour, onDialog }: HelpMenuProps): JSX.Element {
  const items: MenuItem[] = [
    {
      label: 'Take the tour',
      run: () => onTour?.(),
      ...(onTour === null ? { disabled: 'Open a project first' } : {}),
    },
    {
      label: 'Keyboard shortcuts',
      keys: appShortcutKeys('shortcuts'),
      run: () => {
        onDialog('shortcuts');
      },
    },
    {
      label: 'Open logs folder',
      run: () => {
        window.reelforge.openHelpTarget('logs').catch((error: unknown) => {
          log.error(`open logs failed: ${errorMessage(error)}`);
        });
      },
    },
    {
      label: 'Report a problem…',
      run: () => {
        onDialog('report');
      },
    },
    {
      label: 'About ReelForge',
      run: () => {
        onDialog('about');
      },
    },
  ];
  return <MenuButton label="Help" menuLabel="Help" items={items} className="help-menu" />;
}
