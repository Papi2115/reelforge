/**
 * Electron main process entry (bundled to out/main/main.mjs). Sets up the app data dir, the
 * single-instance lock, security policy, the app protocol, typed IPC and the main window, and
 * kills every child process tree on quit.
 */
import { killTree } from '@reelforge/claude-bridge';
import { app, BrowserWindow, Menu, safeStorage, session } from 'electron';
import {
  APP_NAME,
  APP_USER_MODEL_ID,
  appLayout,
  assetLibraryDir,
  channelSecretsFile,
  channelsFile,
  logFile,
  resolveUserDataDir,
  settingsFile,
  USER_DATA_SWITCH,
} from './app-paths.js';
import { registerAppSchemePrivileged, serveAppProtocol } from './app-protocol.js';
import { ChannelSecretStore } from './channels/channel-secrets.js';
import { TasteService } from './taste/taste-service.js';
import { createChildProcessRegistry } from './child-processes.js';
import { createAppServices, type AppContext } from './app-services.js';
import { registerAppIpc } from './main-ipc.js';
import { createLogger, describeError, fileAndStderrSink } from './logger.js';
import { MicPermissionGate } from './mic-permission.js';
import { serveMediaProtocol } from './media-protocol.js';
import { resolveRendererSource } from './navigation-policy.js';
import { TEST_FAKE_MEDIA_ENV, TEST_HOOKS_ENV } from './render/render-backend.js';
import { applySessionSecurity, hardenAllWebContents } from './security.js';
import { gpuSwitches } from './settings-consumers.js';
import { SettingsService } from './settings-service.js';
import { createMainWindow } from './window.js';

function main(): void {
  app.setName(APP_NAME);
  // Before anything reads userData: the single-instance lock lives there too.
  app.setPath(
    'userData',
    resolveUserDataDir(
      app.getPath('appData'),
      process.env,
      app.isPackaged,
      app.commandLine.getSwitchValue(USER_DATA_SWITCH),
    ),
  );
  const userDataDir = app.getPath('userData');
  /** The global asset library (PLAN.md#12.19): outside every project and outside git. */
  const libraryDir = assetLibraryDir(userDataDir);
  const sink = fileAndStderrSink(logFile(userDataDir));
  const log = createLogger(sink.write);

  if (!app.requestSingleInstanceLock()) {
    log.info('another instance is running; handing over to it');
    sink.close();
    app.quit();
    return;
  }

  const sourceResult = resolveRendererSource(process.env, app.isPackaged);
  if (!sourceResult.ok) {
    log.error(sourceResult.error);
    sink.close();
    app.exit(1);
    return;
  }
  const source = sourceResult.value;
  const layout = appLayout({
    appPath: app.getAppPath(),
    resourcesPath: process.resourcesPath,
    isPackaged: app.isPackaged,
  });
  const children = createChildProcessRegistry(killTree, log.child('children'));
  const settings = SettingsService.load({
    file: settingsFile(userDataDir),
    log: log.child('settings'),
  });
  /** Local taste profiles, one per channel (PLAN.md#12.13, #13.13): app data, never in git. */
  const taste = new TasteService({
    dir: userDataDir,
    channelsFile: channelsFile(userDataDir),
    settings: () => settings.get(),
    log: log.child('taste'),
  });
  /** Channel API keys (PLAN.md#13.13): safeStorage ciphertext in app data, never in a project. */
  const channelSecrets = new ChannelSecretStore({
    file: channelSecretsFile(userDataDir),
    safeStorage,
    platform: process.platform,
    log: log.child('channel-secrets'),
  });
  // Chromium switches only work before `ready`: a changed GPU preference applies after a restart.
  for (const name of gpuSwitches(settings.get().performance.gpu))
    app.commandLine.appendSwitch(name);

  const micGate = new MicPermissionGate(source.origin);
  // Test hook (unpackaged + REELFORGE_TEST_HOOKS=1): a fake microphone for the recording tests.
  if (
    !app.isPackaged &&
    process.env[TEST_HOOKS_ENV] === '1' &&
    process.env[TEST_FAKE_MEDIA_ENV] === '1'
  ) {
    app.commandLine.appendSwitch('use-fake-device-for-media-stream');
    app.commandLine.appendSwitch('use-fake-ui-for-media-stream');
  }
  app.enableSandbox();
  registerAppSchemePrivileged();
  if (process.platform === 'win32') app.setAppUserModelId(APP_USER_MODEL_ID);
  hardenAllWebContents(source, log.child('security'));
  process.on('uncaughtException', (error) => {
    log.error(`uncaught exception: ${describeError(error)}`);
  });
  process.on('unhandledRejection', (reason) => {
    log.error(`unhandled rejection: ${describeError(reason)}`);
  });

  let mainWindow: BrowserWindow | undefined;
  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });

  const context: AppContext = {
    userDataDir,
    libraryDir,
    log,
    source,
    layout,
    settings,
    taste,
    channelSecrets,
    window: () => mainWindow,
  };
  const services = createAppServices(context);
  const { projectWatcher, renderBackend, projects, settingsBackend, claude } = services;
  const { exportBackend, stages, scriptDocuments, voice, queue } = services;
  registerAppIpc(context, services, { children, micGate });

  app.on('window-all-closed', () => {
    app.quit();
  });
  let childrenKilled = false;
  app.on('before-quit', (event) => {
    // A settings change made just before quitting (e.g. Welcome → Skip) must reach the disk.
    const idle =
      children.size === 0 &&
      !claude.busy &&
      !stages.busy &&
      !scriptDocuments.dirty &&
      !queue.service.busy &&
      !settings.saving;
    // A voice job is stopped (its paid takes are already saved), never waited for.
    voice.cancel();
    if (childrenKilled || idle) return;
    event.preventDefault();
    childrenKilled = true;
    log.info(`killing ${String(children.size)} child process tree(s) and Claude before quitting`);
    void Promise.all([
      children.killAll(),
      queue.dispose(),
      stages.dispose().then(() => claude.dispose()),
      scriptDocuments.flush(),
      settings.whenSaved(),
      taste.whenSaved(),
      channelSecrets.whenSaved(),
    ]).finally(() => {
      app.quit();
    });
  });
  app.on('will-quit', () => {
    projectWatcher.close();
    void scriptDocuments.flush();
    void stages.dispose();
    void claude.dispose();
    exportBackend.service.queue.dispose();
    void queue.dispose();
    void renderBackend.dispose();
    settingsBackend.dispose();
    log.info('quit');
    sink.close();
  });

  app
    .whenReady()
    .then(() => {
      applySessionSecurity(session.defaultSession, source, log.child('security'), {
        gate: micGate,
        isMainWindow: (contents) =>
          contents !== null &&
          mainWindow !== undefined &&
          contents.id === mainWindow.webContents.id,
      });
      serveMediaProtocol(
        session.defaultSession,
        () => projects.currentProject()?.dir,
        log.child('media'),
        libraryDir,
      );
      if (!source.dev) {
        serveAppProtocol(session.defaultSession, layout.rendererDir, log.child('protocol'));
        Menu.setApplicationMenu(null);
      }
      log.info(
        `ReelForge ${app.getVersion()} (electron ${process.versions.electron}), userData ${userDataDir}`,
      );
      const window = createMainWindow(layout, source, log.child('window'));
      window.on('closed', () => {
        mainWindow = undefined;
        // Hidden render windows would keep 'window-all-closed' from firing.
        app.quit();
      });
      mainWindow = window;
    })
    .catch((error: unknown) => {
      log.error(`startup failed: ${describeError(error)}`);
      app.exit(1);
    });
}

main();
