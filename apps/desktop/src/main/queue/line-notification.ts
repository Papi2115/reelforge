/**
 * Shows a production line notice as a system notification (Electron `Notification`); a click
 * brings the app forward and shows the film in the Production line dialog. Every notice is also
 * logged; with the test hooks on, only logged (an e2e run must not pop notifications on the
 * desktop of the machine running it).
 */
import { Notification, type BrowserWindow } from 'electron';
import { IPC_PUSH } from '../../shared/ipc-contract.js';
import type { Logger } from '../logger.js';
import type { LineNotice } from './line-notices.js';

export function showLineNotice(
  notice: LineNotice,
  window: () => BrowserWindow | undefined,
  log: Logger,
  logOnly: boolean,
): void {
  log.info(`notification: ${notice.title}: ${notice.body}`);
  if (logOnly || !Notification.isSupported()) return;
  const shown = new Notification({ title: notice.title, body: notice.body });
  shown.on('click', () => {
    const target = window();
    if (target === undefined) return;
    if (target.isMinimized()) target.restore();
    target.focus();
    if (notice.ref !== undefined) target.webContents.send(IPC_PUSH.queueShowItem.name, notice.ref);
  });
  shown.show();
}
