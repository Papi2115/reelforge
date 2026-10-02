/**
 * Session and web-contents hardening (Electron security checklist): no permissions (but the
 * microphone of the main window right after a Record click, mic-permission.ts), no remote
 * requests, no new windows, no navigation away from the renderer origin, no <webview>.
 */
import { app, type Session, type WebContents } from 'electron';
import type { Logger } from './logger.js';
import type { MicPermissionGate } from './mic-permission.js';
import { isAllowedNavigation, isAllowedRequest, type RendererSource } from './navigation-policy.js';

export interface MicAccess {
  readonly gate: MicPermissionGate;
  /** Only the main window may record (never the hidden render windows). */
  readonly isMainWindow: (contents: WebContents | null) => boolean;
}

export function applySessionSecurity(
  session: Session,
  source: RendererSource,
  log: Logger,
  mic?: MicAccess,
): void {
  session.setPermissionRequestHandler((contents, permission, callback, details) => {
    const mediaTypes = 'mediaTypes' in details ? details.mediaTypes : undefined;
    const allowed =
      mic !== undefined &&
      mic.isMainWindow(contents) &&
      mic.gate.request({
        permission,
        mediaTypes,
        requestingUrl: details.requestingUrl,
        isMainFrame: details.isMainFrame,
      });
    if (allowed) log.info('granted microphone access (Record clicked)');
    else log.warn(`denied permission request "${permission}"`);
    callback(allowed);
  });
  session.setPermissionCheckHandler((contents, permission, requestingOrigin, details) => {
    if (mic === undefined || !mic.isMainWindow(contents)) return false;
    return mic.gate.check({ permission, mediaType: details.mediaType, requestingOrigin });
  });
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
