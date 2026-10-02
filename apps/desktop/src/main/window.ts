/** The main application window: sandboxed, context-isolated renderer with the typed preload. */
import { BrowserWindow } from 'electron';
import type { AppLayout } from './app-paths.js';
import { describeError, type Logger } from './logger.js';
import type { RendererSource } from './navigation-policy.js';

const BACKGROUND = '#0f1014';

export function createMainWindow(
  layout: AppLayout,
  source: RendererSource,
  log: Logger,
): BrowserWindow {
  const window = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    show: false,
    title: 'ReelForge',
    backgroundColor: BACKGROUND,
    autoHideMenuBar: true,
    webPreferences: {
      preload: layout.preloadFile,
      contextIsolation: true,
      nodeIntegration: false,
      nodeIntegrationInWorker: false,
      nodeIntegrationInSubFrames: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      webviewTag: false,
      navigateOnDragDrop: false,
      spellcheck: false,
    },
  });
  window.once('ready-to-show', () => {
    window.show();
  });
  window.webContents.on('render-process-gone', (_event, details) => {
    log.error(`renderer process gone: ${details.reason} (exit code ${String(details.exitCode)})`);
  });
  window.webContents.on('did-fail-load', (_event, code, description, url) => {
    log.error(`failed to load ${url}: ${description} (${String(code)})`);
  });
  window.loadURL(source.url).then(
    () => {
      log.info(`loaded ${source.url}`);
    },
    (error: unknown) => {
      log.error(`loadURL(${source.url}) failed: ${describeError(error)}`);
    },
  );
  return window;
}
