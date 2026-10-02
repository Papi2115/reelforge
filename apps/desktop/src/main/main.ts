/**
 * Electron main process entry (bundled to out/main/main.mjs). Sets up the app data dir, the
 * single-instance lock, security policy, the app protocol, typed IPC and the main window, and
 * kills every child process tree on quit.
 */
import { availableParallelism } from 'node:os';
import { killTree, PipelineStateStore } from '@reelforge/claude-bridge';
import { writeCliShims } from '@reelforge/cli/shims';
import { autocommit } from '@reelforge/project';
import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  session,
  shell,
  type OpenDialogOptions,
} from 'electron';
import { IPC_PUSH, type AppInfo } from '../shared/ipc-contract.js';
import type { StageCommandResult } from '../shared/stages-contract.js';
import {
  APP_NAME,
  APP_USER_MODEL_ID,
  appLayout,
  cliShimDir,
  logFile,
  recentProjectsFile,
  resolveUserDataDir,
  settingsFile,
} from './app-paths.js';
import { registerAppSchemePrivileged, serveAppProtocol } from './app-protocol.js';
import { createChildProcessRegistry } from './child-processes.js';
import { chatHandlers } from './claude/chat-ipc.js';
import { claudeSetup } from './claude/claude-runtime.js';
import { ClaudeService } from './claude/claude-service.js';
import { copyPngToClipboard } from './clipboard.js';
import { loadDemoManifest } from './demo-manifest.js';
import { saveFrameSnapshot } from './frame-snapshots.js';
import { registerIpc } from './ipc-router.js';
import { createLogger, describeError, fileAndStderrSink } from './logger.js';
import { MicPermissionGate } from './mic-permission.js';
import { serveMediaProtocol } from './media-protocol.js';
import { isAllowedNavigation, resolveRendererSource } from './navigation-policy.js';
import { ProjectService, type FolderPurpose } from './project-service.js';
import { ProjectWatchFollower, watchProject } from './project-watcher.js';
import {
  installRenderTestHooks,
  RenderBackend,
  TEST_FAKE_MEDIA_ENV,
  TEST_HOOKS_ENV,
} from './render/render-backend.js';
import { applySessionSecurity, hardenAllWebContents } from './security.js';
import { gpuSwitches } from './settings-consumers.js';
import { createSettingsBackend, toolPickerOptions } from './settings-ipc.js';
import { SettingsService } from './settings-service.js';
import { ScriptDocuments } from './stages/script-documents.js';
import {
  ffmpegAudioProbe,
  recordedTranscription,
  TEST_TRANSCRIPT_ENV,
} from './stages/audio-probe.js';
import { appRunnerFactory, settingsAudioTools } from './stages/stage-runtime.js';
import { StageService } from './stages/stage-service.js';
import { replacementDialogOptions, stagesHandlers, type ReplacePick } from './stages/stages-ipc.js';
import { timelineHandlers } from './timeline-ipc.js';
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
  const settings = SettingsService.load({
    file: settingsFile(userDataDir),
    log: log.child('settings'),
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
        stages.refresh();
      },
    }),
  );
  const renderBackend = new RenderBackend({
    source,
    layout,
    settings: () => settings.get(),
    cores: availableParallelism(),
    currentProject: () => projects.currentProject()?.dir,
    pushProgress: (event) => {
      mainWindow?.webContents.send(IPC_PUSH.exportProgress.name, event);
    },
    log: log.child('render'),
  });
  if (!app.isPackaged && process.env[TEST_HOOKS_ENV] === '1') {
    installRenderTestHooks(renderBackend, () => projects.currentProject()?.dir);
  }
  const projects = new ProjectService({
    recentFile: recentProjectsFile(userDataDir),
    templateDir: layout.projectTemplateDir,
    pickFolder,
    defaultStyle: () => settings.get().defaultStyle,
    log: log.child('project'),
    onCurrentChanged: (dir) => {
      projectWatcher.follow(dir);
      void renderBackend.followProject(dir);
      void scriptDocuments.flush();
      void stages.follow(dir);
    },
  });

  const settingsBackend = createSettingsBackend({
    settings,
    settingsFile: settingsFile(userDataDir),
    cores: availableParallelism(),
    env: process.env,
    platform: process.platform,
    isPackaged: app.isPackaged,
    probeCwd: userDataDir,
    pickToolFile: async (tool) => {
      const options = toolPickerOptions(tool, process.platform);
      const picked = await (mainWindow
        ? dialog.showOpenDialog(mainWindow, options)
        : dialog.showOpenDialog(options));
      return picked.canceled ? undefined : picked.filePaths[0];
    },
    pushWhisperProgress: (progress) => {
      mainWindow?.webContents.send(IPC_PUSH.whisperProgress.name, progress);
    },
    log: log.child('settings'),
    now: () => performance.now(),
  });

  const claude: ClaudeService = new ClaudeService({
    setup: claudeSetup({
      layout,
      shimDir: cliShimDir(userDataDir),
      env: process.env,
      execPath: process.execPath,
      isPackaged: app.isPackaged,
      platform: process.platform,
      connection: () => settingsBackend.claude.state(false),
      writeShims: writeCliShims,
      log: log.child('claude'),
    }),
    settings: () => settings.get(),
    currentProject: () => projects.currentProject()?.dir,
    renderEnv: (dir) => renderBackend.serviceEnv(dir),
    commit: (dir, message) => autocommit(dir, message, { kind: 'claude-turn' }),
    review: {
      run: (mode, observer): Promise<StageCommandResult> =>
        stages.enqueue([{ stage: 'scenes', action: mode }], observer),
      stop: (): boolean => stages.stop('scenes'),
    },
    push: (state) => {
      mainWindow?.webContents.send(IPC_PUSH.chatChanged.name, state);
    },
    log: log.child('chat'),
  });

  const pipelineStore = new PipelineStateStore();
  const stagesLog = log.child('stages');
  const testHooks = !app.isPackaged && process.env[TEST_HOOKS_ENV] === '1';
  const recordedTranscript = testHooks ? process.env[TEST_TRANSCRIPT_ENV] : undefined;
  const settingsAudio = settingsAudioTools(() => settings.get());
  const audioTools =
    recordedTranscript === undefined || recordedTranscript === ''
      ? settingsAudio
      : recordedTranscription(recordedTranscript)(settingsAudio);
  if (audioTools !== settingsAudio) stagesLog.warn('test hook: transcriptions are recorded');
  const stages: StageService = new StageService({
    createRunner: appRunnerFactory({
      settings: () => settings.get(),
      sessions: () => claude.sessionManager(),
      guard: claude.guard,
      store: pipelineStore,
      frames: renderBackend.frames,
      audio: audioTools,
      log: stagesLog,
    }),
    exportRun: {
      start: (listener) => renderBackend.exports.start({}, listener),
      cancel: () => {
        renderBackend.exports.cancel();
      },
    },
    store: pipelineStore,
    guard: claude.guard,
    push: (state) => {
      mainWindow?.webContents.send(IPC_PUSH.stagesChanged.name, state);
    },
    log: stagesLog,
  });
  const scriptDocuments = new ScriptDocuments({
    store: pipelineStore,
    currentProject: () => projects.currentProject()?.dir,
    scriptBusy: (dir) => stages.isBusyWith(dir, 'script'),
    commit: async (dir, message, step) => {
      const committed = await autocommit(dir, message, { kind: 'manual', step });
      if (!committed.ok)
        stagesLog.warn(`autocommit "${message}" failed: ${committed.error.message}`);
    },
    afterChange: () => {
      stages.refresh();
    },
    log: stagesLog,
  });
  const pickReplacement = async (kind: ReplacePick): Promise<string | undefined> => {
    const options = replacementDialogOptions(kind);
    const picked = await (mainWindow
      ? dialog.showOpenDialog(mainWindow, options)
      : dialog.showOpenDialog(options));
    return picked.canceled ? undefined : picked.filePaths[0];
  };

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
      ...timelineHandlers({
        projects,
        trackChild: (child) => {
          children.track(child);
        },
        log: log.child('timeline'),
      }),
      ...settingsBackend.handlers,
      exportStart: (request) => renderBackend.exports.start(request),
      exportCancel: () => Promise.resolve(renderBackend.exports.cancel()),
      ...chatHandlers(claude),
      ...stagesHandlers({
        service: stages,
        documents: scriptDocuments,
        currentProject: () => projects.currentProject()?.dir,
        pickFile: pickReplacement,
        openPath: (file) => shell.openPath(file),
        probe: ffmpegAudioProbe(() => settings.get()),
        hasWhisperModel: (model) => audioTools.hasWhisperModel(model),
        mic: micGate,
        log: stagesLog,
      }),
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
    const idle = children.size === 0 && !claude.busy && !stages.busy && !scriptDocuments.dirty;
    if (childrenKilled || idle) return;
    event.preventDefault();
    childrenKilled = true;
    log.info(`killing ${String(children.size)} child process tree(s) and Claude before quitting`);
    void Promise.all([
      children.killAll(),
      stages.dispose().then(() => claude.dispose()),
      scriptDocuments.flush(),
    ]).finally(() => {
      app.quit();
    });
  });
  app.on('will-quit', () => {
    projectWatcher.close();
    void scriptDocuments.flush();
    void stages.dispose();
    void claude.dispose();
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
