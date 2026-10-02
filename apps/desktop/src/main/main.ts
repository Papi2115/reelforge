/**
 * Electron main process entry (bundled to out/main/main.mjs). Sets up the app data dir, the
 * single-instance lock, security policy, the app protocol, typed IPC and the main window, and
 * kills every child process tree on quit.
 */
import { killTree } from '@reelforge/claude-bridge';
import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  session,
  type OpenDialogOptions,
} from 'electron';
import { IPC_PUSH, type AppInfo } from '../shared/ipc-contract.js';
import {
  APP_NAME,
  APP_USER_MODEL_ID,
  appLayout,
  logFile,
  recentProjectsFile,
  resolveUserDataDir,
} from './app-paths.js';
import { registerAppSchemePrivileged, serveAppProtocol } from './app-protocol.js';
import { createChildProcessRegistry } from './child-processes.js';
import { copyPngToClipboard } from './clipboard.js';
import { loadDemoManifest } from './demo-manifest.js';
import { saveFrameSnapshot } from './frame-snapshots.js';
import { registerIpc } from './ipc-router.js';
import { createLogger, describeError, fileAndStderrSink } from './logger.js';
import { serveMediaProtocol } from './media-protocol.js';
import { isAllowedNavigation, resolveRendererSource } from './navigation-policy.js';
import { ProjectService, type FolderPurpose } from './project-service.js';
import { ProjectWatchFollower, watchProject } from './project-watcher.js';
import { applySessionSecurity, hardenAllWebContents } from './security.js';
import { createMainWindow } from './window.js';

function main(): void {
  app.setName(APP_NAME);
  // Before anything reads userData: the single-instance lock lives there too.
  app.setPath('userData', resolveUserDataDir(app.getPath('appData'), process.env, app.isPackaged));
  const userDataDir = app.getPath('userData');
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
  const layout = appLayout(app.getAppPath());
  const children = createChildProcessRegistry(killTree, log.child('children'));

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

  const pickFolder = async (purpose: FolderPurpose): Promise<string | undefined> => {
    const options: OpenDialogOptions = {
      title:
        purpose === 'open-project' ? 'Open a ReelForge project' : 'Where to create the project',
      buttonLabel: purpose === 'open-project' ? 'Open project' : 'Create here',
      properties: ['openDirectory', 'createDirectory'],
    };
    const picked = await (mainWindow
      ? dialog.showOpenDialog(mainWindow, options)
      : dialog.showOpenDialog(options));
    return picked.canceled ? undefined : picked.filePaths[0];
  };
  const watchLog = log.child('watch');
  const projectWatcher = new ProjectWatchFollower((dir) =>
    watchProject({
      dir,
      log: watchLog,
      onChange: (event) => {
        mainWindow?.webContents.send(IPC_PUSH.projectChanged.name, event);
      },
    }),
  );
  const projects = new ProjectService({
    recentFile: recentProjectsFile(userDataDir),
    templateDir: layout.projectTemplateDir,
    pickFolder,
    log: log.child('project'),
    onCurrentChanged: (dir) => {
      projectWatcher.follow(dir);
    },
  });

  const appInfo = (): AppInfo => ({
    name: APP_NAME,
    version: app.getVersion(),
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    platform: process.platform,
    userDataDir,
    dev: source.dev,
  });
  registerIpc(ipcMain, {
    handlers: {
      appInfo: () => Promise.resolve(appInfo()),
      demoManifest: async () => {
        const manifest = await loadDemoManifest(layout.demoDir);
        if (!manifest.ok) throw new Error(manifest.error);
        return manifest.value;
      },
      projectNew: (request) => projects.newProject(request),
      projectOpen: () => projects.openWithPicker(),
      projectOpenRecent: (request) => projects.openRecent(request.dir),
      projectRecent: () => projects.recent(),
      projectCurrent: () => Promise.resolve(projects.currentProject()),
      projectClose: () => Promise.resolve(projects.close()),
      projectHistory: (request) => projects.history(request.limit),
      projectRevert: (request) => projects.revert(request.hash),
      projectSnapshot: () => projects.snapshot(),
      projectManifest: () => projects.manifest(),
      snapshotSave: (request) =>
        saveFrameSnapshot(projects.currentProject()?.dir, request, log.child('snapshot')),
      snapshotCopy: (request) => copyPngToClipboard(request.png),
    },
    onRendererLog: (entry) => {
      log.child(`renderer:${entry.scope}`).log(entry.level, entry.message);
    },
    isTrustedSender: (url) => isAllowedNavigation(url, source),
    log: log.child('ipc'),
  });

  app.on('window-all-closed', () => {
    app.quit();
  });
  let childrenKilled = false;
  app.on('before-quit', (event) => {
    if (childrenKilled || children.size === 0) return;
    event.preventDefault();
    childrenKilled = true;
    log.info(`killing ${String(children.size)} child process tree(s) before quitting`);
    void children.killAll().finally(() => {
      app.quit();
    });
  });
  app.on('will-quit', () => {
    projectWatcher.close();
    log.info('quit');
    sink.close();
  });

  app
    .whenReady()
    .then(() => {
      applySessionSecurity(session.defaultSession, source, log.child('security'));
      serveMediaProtocol(
        session.defaultSession,
        () => projects.currentProject()?.dir,
        log.child('media'),
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
      });
      mainWindow = window;
    })
    .catch((error: unknown) => {
      log.error(`startup failed: ${describeError(error)}`);
      app.exit(1);
    });
}

main();
