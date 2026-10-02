/**
 * Session and web-contents hardening (Electron security checklist): no permissions, no remote
 * requests, no new windows, no navigation away from the renderer origin, no <webview>.
 */
import { app, type Session } from 'electron';
import type { Logger } from './logger.js';
import { isAllowedNavigation, isAllowedRequest, type RendererSource } from './navigation-policy.js';

export function applySessionSecurity(session: Session, source: RendererSource, log: Logger): void {
  session.setPermissionRequestHandler((_contents, permission, callback) => {
    log.warn(`denied permission request "${permission}"`);
    callback(false);
  });
  session.setPermissionCheckHandler(() => false);
  session.setDevicePermissionHandler(() => false);
  session.webRequest.onBeforeRequest((details, callback) => {
    const allowed = isAllowedRequest(details.url, source);
    if (!allowed) log.warn(`blocked request to ${details.url}`);
    callback({ cancel: !allowed });
  });
}

/** Applies to every web contents the app ever creates (main window, future export windows). */
export function hardenAllWebContents(source: RendererSource, log: Logger): void {
  app.on('web-contents-created', (_event, contents) => {
    contents.setWindowOpenHandler(({ url }) => {
      log.warn(`blocked window.open(${url})`);
      return { action: 'deny' };
    });
    // Fires for the main frame and subframes (the engine iframe).
    contents.on('will-frame-navigate', (event) => {
      if (isAllowedNavigation(event.url, source)) return;
      log.warn(`blocked navigation to ${event.url}`);
      event.preventDefault();
    });
    contents.on('will-redirect', (event) => {
      if (isAllowedNavigation(event.url, source)) return;
      log.warn(`blocked redirect to ${event.url}`);
      event.preventDefault();
    });
    contents.on('will-attach-webview', (event) => {
      log.warn('blocked <webview>');
      event.preventDefault();
    });
  });
}
