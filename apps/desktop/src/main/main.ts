/**
 * Electron main process entry (bundled to out/main/main.mjs). Sets up the app data dir, the
 * single-instance lock, security policy, the app protocol, typed IPC and the main window, and
 * kills every child process tree on quit.
 */
import { availableParallelism } from 'node:os';
import path from 'node:path';
import { killTree, PipelineStateStore } from '@reelforge/claude-bridge';
import { ASSET_LIBRARY_ENV, defaultAssetRuntime } from '@reelforge/cli/assets';
import { writeCliShims } from '@reelforge/cli/shims';
import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  safeStorage,
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
  assetLibraryDir,
  channelSecretsFile,
  channelsFile,
  cliShimDir,
  defaultProjectsDir,
  logFile,
  recentProjectsFile,
  resolveUserDataDir,
  settingsFile,
  tasteFile,
  USER_DATA_SWITCH,
} from './app-paths.js';
import { registerAppSchemePrivileged, serveAppProtocol } from './app-protocol.js';
import { assetsHandlers, assetTestRuntime, OWN_ASSET_FILTERS } from './assets/assets-ipc.js';
import { publishHandlers } from './publish/publish-ipc.js';
import { hookLabHandlers } from './hook-lab/hook-lab-ipc.js';
import { ChannelSecretStore } from './channels/channel-secrets.js';
import { channelsHandlers } from './channels/channels-ipc.js';
import { tasteHandlers } from './taste/taste-ipc.js';
import { TasteService } from './taste/taste-service.js';
import { createChildProcessRegistry } from './child-processes.js';
import { chatHandlers } from './claude/chat-ipc.js';
import { claudeSetup, prepareShims, type ClaudeRuntimeOptions } from './claude/claude-runtime.js';
import { ClaudeService } from './claude/claude-service.js';
import { commitChatTurn } from './claude/turn-commit.js';
import { loadDemoManifest } from './demo-manifest.js';
import { registerIpc } from './ipc-router.js';
import { createLogger, describeError, fileAndStderrSink } from './logger.js';
import { MicPermissionGate } from './mic-permission.js';
import { serveMediaProtocol } from './media-protocol.js';
import { isAllowedNavigation, resolveRendererSource } from './navigation-policy.js';
import { madeCommit, manualCommitter } from './project-commits.js';
import { projectHandlers } from './project-ipc.js';
import { tensionHandlers } from './tension-ipc.js';
import { directionsHandlers } from './directions-ipc.js';
import { dramaturgyHandlers } from './dramaturgy-ipc.js';
import { editingHandlers } from './editing-ipc.js';
import { EXAMPLE_ID, installExampleProject } from './example-project.js';
import { onboardingHandlers } from './onboarding-ipc.js';
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
import {
  appRunnerFactory,
  settingsAudioTools,
  sharedClaudeRunner,
} from './stages/stage-runtime.js';
import { projectKey, StageService } from './stages/stage-service.js';
import { replacementDialogOptions, stagesHandlers, type ReplacePick } from './stages/stages-ipc.js';
import { variantsHandlers } from './stages/variants-ipc.js';
import { createExportBackend } from './export/export-backend.js';
import { createSoundBackend, settingsFfmpeg } from './sound/sound-backend.js';
import { elevenLabsTestUrl } from './voice/test-hooks.js';
import { voiceHandlers } from './voice/voice-ipc.js';
import { VoiceService } from './voice/voice-service.js';
import { soundPickerOptions } from './sound/sound-ipc.js';
import { createTimelineEdits, timelineHandlers } from './timeline-ipc.js';
import { whisperTestHooks } from './whisper/test-hooks.js';
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
  /** The local taste profile (PLAN.md#12.13): app data, never in a project or in git. */
  const taste = new TasteService({
    file: tasteFile(userDataDir),
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

  /** Native open dialog over the main window: the picked paths, undefined when cancelled. */
  const showOpen = async (options: OpenDialogOptions): Promise<string[] | undefined> => {
    const picked = await (mainWindow
      ? dialog.showOpenDialog(mainWindow, options)
      : dialog.showOpenDialog(options));
    return picked.canceled ? undefined : picked.filePaths;
  };
  const pickFolder = async (purpose: FolderPurpose): Promise<string | undefined> =>
    (
      await showOpen({
        title:
          purpose === 'open-project' ? 'Open a ReelForge project' : 'Where to create the project',
        buttonLabel: purpose === 'open-project' ? 'Open project' : 'Create here',
        properties: ['openDirectory', 'createDirectory'],
      })
    )?.[0];
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
  // Also in the packaged app: the packaged smoke test (pnpm test:packaged) reaches the render
  // service like Claude's children do. It only exposes, to code already running in main, the env
  // the app hands those children anyway.
  if (process.env[TEST_HOOKS_ENV] === '1') {
    installRenderTestHooks(renderBackend, () => projects.currentProject()?.dir);
  }
  const projects = new ProjectService({
    recentFile: recentProjectsFile(userDataDir),
    channelsFile: channelsFile(userDataDir),
    templateDir: layout.projectTemplateDir,
    stylesDir: layout.stylesDir,
    pickFolder,
    defaultStyle: () => settings.get().defaultStyle,
    experimentalWorlds: () => settings.get().experimental.worlds,
    newProjectDefaults: () => settings.get().newProjectDefaults,
    log: log.child('project'),
    onCurrentChanged: (dir) => {
      projectWatcher.follow(dir);
      void renderBackend.followProject(dir);
      void scriptDocuments.flush();
      void stages.follow(dir);
    },
    onOpenFailed: (failure) => {
      mainWindow?.webContents.send(IPC_PUSH.projectOpenFailed.name, failure);
    },
    installExample: () =>
      installExampleProject({
        exampleDir: path.join(layout.examplesDir, EXAMPLE_ID),
        projectsDir: defaultProjectsDir(app.getPath('documents'), process.env, app.isPackaged),
        templateDir: layout.projectTemplateDir,
        stylesDir: layout.stylesDir,
      }),
  });

  // Test hooks (unpackaged + REELFORGE_TEST_HOOKS=1): whisper install root / download mirror.
  const whisperHooksOn = !app.isPackaged && process.env[TEST_HOOKS_ENV] === '1';
  const whisperBase = whisperTestHooks(process.env, whisperHooksOn);
  if (whisperBase.root !== undefined) log.warn(`test hook: whisper root ${whisperBase.root}`);
  const claudeRuntime: ClaudeRuntimeOptions = {
    layout,
    shimDir: cliShimDir(userDataDir),
    env: process.env,
    execPath: process.execPath,
    isPackaged: app.isPackaged,
    platform: process.platform,
    connection: () => settingsBackend.claude.state(false),
    writeShims: writeCliShims,
    experimentalWorlds: () => settings.get().experimental.worlds,
    log: log.child('claude'),
  };
  const settingsBackend = createSettingsBackend({
    settings,
    settingsFile: settingsFile(userDataDir),
    cores: availableParallelism(),
    env: process.env,
    platform: process.platform,
    isPackaged: app.isPackaged,
    probeCwd: userDataDir,
    pickToolFile: async (tool) => (await showOpen(toolPickerOptions(tool, process.platform)))?.[0],
    pushWhisperProgress: (progress) => {
      mainWindow?.webContents.send(IPC_PUSH.whisperProgress.name, progress);
    },
    log: log.child('settings'),
    now: () => performance.now(),
    whisperBase,
    // Recorded transcriptions need no whisper.cpp unless a test installs one into its own root.
    whisperAssumeReady:
      whisperHooksOn &&
      (process.env[TEST_TRANSCRIPT_ENV] ?? '') !== '' &&
      whisperBase.root === undefined,
    // The CLI launchers carry the experimental worlds switch (PLAN.md#13.6): rewrite them.
    onUpdated: (before, after) => {
      if (before.experimental.worlds !== after.experimental.worlds)
        void prepareShims(claudeRuntime);
    },
  });

  const claude: ClaudeService = new ClaudeService({
    setup: claudeSetup(claudeRuntime),
    settings: () => settings.get(),
    currentProject: () => projects.currentProject()?.dir,
    renderEnv: (dir) => ({
      ...renderBackend.serviceEnv(dir),
      [ASSET_LIBRARY_ENV]: libraryDir,
    }),
    // Every change of the turn, minus the scenes a parallel scene build is still writing.
    commit: (dir, message) =>
      commitChatTurn(dir, message, { shotsInProgress: stages.shotsInProgress(dir) }),
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
  // App edits commit only the files they wrote (another writer may be mid-way, PLAN.md#13).
  const stagesCommit = manualCommitter(stagesLog);
  const appCommit = manualCommitter(log);
  const testHooks = !app.isPackaged && process.env[TEST_HOOKS_ENV] === '1';
  const recordedTranscript = testHooks ? process.env[TEST_TRANSCRIPT_ENV] : undefined;
  const settingsAudio = settingsAudioTools(() => settings.get(), undefined, whisperBase);
  const audioTools =
    recordedTranscript === undefined || recordedTranscript === ''
      ? settingsAudio
      : recordedTranscription(recordedTranscript)(settingsAudio);
  if (audioTools !== settingsAudio) stagesLog.warn('test hook: transcriptions are recorded');
  const assetTestHook = assetTestRuntime(process.env, testHooks);
  if (assetTestHook !== undefined) stagesLog.warn('test hook: asset sources on a local server');
  const assetRuntime = {
    ...(assetTestHook ?? defaultAssetRuntime({})),
    library: {
      dir: libraryDir,
      saveDownloaded: () => settings.get().assetLibrary.saveDownloaded,
    },
  };
  const exportBackend = createExportBackend({
    projects,
    settings,
    cores: availableParallelism(),
    controller: renderBackend.exports,
    claude: sharedClaudeRunner(() => claude.sessionManager()),
    ffmpeg: settingsFfmpeg(() => settings.get()),
    pickFolder: async () =>
      (
        await showOpen({
          title: 'Where to save exported videos',
          properties: ['openDirectory', 'createDirectory'],
        })
      )?.[0],
    openPath: (folder) => shell.openPath(folder),
    push: (state) => {
      mainWindow?.webContents.send(IPC_PUSH.exportQueueChanged.name, state);
    },
    log: log.child('export'),
  });
  const stages: StageService = new StageService({
    createRunner: appRunnerFactory({
      settings: () => settings.get(),
      sessions: () => claude.sessionManager(),
      guard: claude.guard,
      store: pipelineStore,
      frames: renderBackend.frames,
      audio: audioTools,
      assets: assetRuntime,
      taste: taste.learner(),
    }),
    exportRun: {
      start: (listener) => exportBackend.service.runForStage(listener),
      cancel: () => {
        exportBackend.service.cancelStage();
      },
    },
    store: pipelineStore,
    guard: claude.guard,
    push: (state) => {
      mainWindow?.webContents.send(IPC_PUSH.stagesChanged.name, state);
    },
    log: stagesLog,
    finalReview: () => settings.get().scenes.finalReview,
  });
  const scriptDocuments = new ScriptDocuments({
    store: pipelineStore,
    currentProject: () => projects.currentProject()?.dir,
    scriptBusy: (dir) => stages.isBusyWith(dir, 'script'),
    commit: async (dir, message, step, paths) => {
      await stagesCommit(dir, message, step, paths);
    },
    afterChange: () => {
      stages.refresh();
    },
    log: stagesLog,
  });
  const pickReplacement = async (kind: ReplacePick): Promise<string | undefined> =>
    (await showOpen(replacementDialogOptions(kind)))?.[0];
  /** ElevenLabs voice (PLAN.md#13.14): main only, with the project's channel key. */
  const voiceFfmpeg = settingsFfmpeg(() => settings.get());
  const voice = new VoiceService({
    channelsFile: channelsFile(userDataDir),
    secrets: channelSecrets,
    store: pipelineStore,
    baseUrl: elevenLabsTestUrl(process.env, testHooks),
    ffmpeg: async () => {
      const manager = await voiceFfmpeg();
      return manager.ok ? manager.value : null;
    },
    importVoiceover: (dir, file) =>
      projectKey(projects.currentProject()?.dir ?? '') === projectKey(dir)
        ? stages.enqueue([{ stage: 'voiceover', source: file }])
        : Promise.resolve({ status: 'error', message: 'the project was closed meanwhile' }),
    voiceoverBusy: (dir) => stages.isBusyWith(dir, 'voiceover'),
    commit: async (dir, message, paths) => {
      await stagesCommit(dir, message, 'voiceover', paths);
    },
    push: (progress) => {
      mainWindow?.webContents.send(IPC_PUSH.voiceProgress.name, progress);
    },
    log: log.child('voice'),
  });

  const timelineEdits = createTimelineEdits(projects, log.child('timeline'));
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
      ...projectHandlers(projects, log.child('project')),
      ...onboardingHandlers({
        projects,
        logsDir: path.dirname(logFile(userDataDir)),
        licensesFile: layout.licensesFile,
        openPath: (target) => shell.openPath(target),
        log: log.child('help'),
      }),
      ...timelineHandlers({
        projects,
        edits: timelineEdits,
        trackChild: (child) => {
          children.track(child);
        },
        log: log.child('timeline'),
      }),
      ...settingsBackend.handlers,
      ...exportBackend.handlers,
      ...chatHandlers(claude),
      ...createSoundBackend({
        projects,
        settings: () => settings.get(),
        edits: timelineEdits,
        enqueue: (requests) => stages.enqueue(requests),
        pickFiles: (kind) => showOpen(soundPickerOptions(kind)),
        log: log.child('sound'),
      }),
      ...stagesHandlers({
        service: stages,
        documents: scriptDocuments,
        currentProject: () => projects.currentProject()?.dir,
        pickFile: pickReplacement,
        openPath: (file) => shell.openPath(file),
        probe: ffmpegAudioProbe(() => settings.get()),
        hasWhisperModel: (model) => audioTools.hasWhisperModel(model),
        mic: micGate,
        taste: { recordShots: (dir, shotIds, kind) => taste.recordShots(dir, shotIds, kind) },
        commit: async (dir, message, paths) => {
          await stagesCommit(dir, message, 'locks', paths);
        },
        log: stagesLog,
      }),
      ...tensionHandlers({
        currentProject: () => projects.currentProject()?.dir,
        commit: async (dir, message, step, paths) =>
          madeCommit(await stagesCommit(dir, message, step, paths)),
        enqueue: (requests) => stages.enqueue(requests),
        log: log.child('tension'),
      }),
      ...dramaturgyHandlers({
        currentProject: () => projects.currentProject()?.dir,
        commit: async (dir, message, step, paths) =>
          madeCommit(await stagesCommit(dir, message, step, paths)),
        log: log.child('dramaturgy'),
      }),
      ...directionsHandlers({
        currentProject: () => projects.currentProject()?.dir,
        commit: async (dir, message, step, paths) =>
          madeCommit(await stagesCommit(dir, message, step, paths)),
        log: log.child('directions'),
      }),
      ...editingHandlers({
        currentProject: () => projects.currentProject()?.dir,
        commit: async (dir, message, step, paths) =>
          madeCommit(await stagesCommit(dir, message, step, paths)),
        enqueue: (requests) => stages.enqueue(requests),
        log: log.child('editing'),
      }),
      ...assetsHandlers({
        stages,
        currentProject: () => projects.currentProject()?.dir,
        libraryDir,
        saveOwnToLibrary: () => settings.get().assetLibrary.saveOwn,
        pickFiles: () =>
          showOpen({
            title: 'Add your images and videos',
            buttonLabel: 'Add to project',
            properties: ['openFile', 'multiSelections'],
            filters: OWN_ASSET_FILTERS,
          }),
        commit: async (dir, message, paths) => {
          await appCommit(dir, message, 'assets', paths);
        },
        log: log.child('assets'),
      }),
      ...publishHandlers({
        currentProject: () => projects.currentProject()?.dir,
        claude: sharedClaudeRunner(() => claude.sessionManager()),
        settings: () => settings.get(),
        commit: async (dir, message, step, paths) =>
          (await appCommit(dir, message, step, paths)).ok,
        openPath: (folder) => shell.openPath(folder),
        log: log.child('publish'),
      }),
      ...hookLabHandlers({
        currentProject: () => projects.currentProject()?.dir,
        claude: sharedClaudeRunner(() => claude.sessionManager()),
        settings: () => settings.get(),
        store: pipelineStore,
        scriptBusy: (dir) => stages.isBusyWith(dir, 'script'),
        flushScript: () => scriptDocuments.flush(),
        commit: async (dir, message, paths) => (await appCommit(dir, message, 'script', paths)).ok,
        afterChange: () => {
          stages.refresh();
        },
        now: () => new Date(),
        log: log.child('hook-lab'),
      }),
      ...tasteHandlers({
        taste,
        pickExportFile: async () => {
          const options = {
            title: 'Export the taste profile',
            defaultPath: 'reelforge-taste.json',
            filters: [{ name: 'JSON', extensions: ['json'] }],
          };
          const picked = await (mainWindow
            ? dialog.showSaveDialog(mainWindow, options)
            : dialog.showSaveDialog(options));
          return picked.canceled ? undefined : picked.filePath;
        },
        log: log.child('taste'),
      }),
      ...channelsHandlers({
        channelsFile: channelsFile(userDataDir),
        recentFile: recentProjectsFile(userDataDir),
        currentProject: () => projects.currentProject()?.dir,
        secrets: channelSecrets,
        log: log.child('channels'),
      }),
      ...voiceHandlers(voice, () => projects.currentProject()?.dir),
      ...variantsHandlers({
        service: stages,
        currentProject: () => projects.currentProject()?.dir,
        settings: () => settings.get(),
        claudeConcurrency: () => claude.guard.concurrency,
        frames: renderBackend.frames,
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
    // A settings change made just before quitting (e.g. Welcome → Skip) must reach the disk.
    const idle =
      children.size === 0 &&
      !claude.busy &&
      !stages.busy &&
      !scriptDocuments.dirty &&
      !settings.saving;
    // A voice job is stopped (its paid takes are already saved), never waited for.
    voice.cancel();
    if (childrenKilled || idle) return;
    event.preventDefault();
    childrenKilled = true;
    log.info(`killing ${String(children.size)} child process tree(s) and Claude before quitting`);
    void Promise.all([
      children.killAll(),
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
