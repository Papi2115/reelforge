/**
 * The main process's services (main.ts builds them once, after the single-instance lock): open
 * dialogs, the project watcher and service, the render backend, settings, Claude, the stages and
 * their documents, export, voice and the production line. Their pushes go to the main window.
 */
import { availableParallelism } from 'node:os';
import path from 'node:path';
import { PipelineStateStore } from '@reelforge/claude-bridge';
import { ASSET_LIBRARY_ENV, defaultAssetRuntime } from '@reelforge/cli/assets';
import { writeCliShims } from '@reelforge/cli/shims';
import { app, dialog, shell, type BrowserWindow, type OpenDialogOptions } from 'electron';
import { IPC_PUSH, type AppInfo } from '../shared/ipc-contract.js';
import type { StageCommandResult } from '../shared/stages-contract.js';
import {
  APP_NAME,
  channelsFile,
  cliShimDir,
  defaultProjectsDir,
  recentProjectsFile,
  settingsFile,
  type AppLayout,
} from './app-paths.js';
import { assetTestRuntime } from './assets/assets-ipc.js';
import type { ChannelSecretStore } from './channels/channel-secrets.js';
import type { TasteService } from './taste/taste-service.js';
import { claudeSetup, prepareShims, type ClaudeRuntimeOptions } from './claude/claude-runtime.js';
import { ClaudeService } from './claude/claude-service.js';
import { commitChatTurn } from './claude/turn-commit.js';
import type { Logger } from './logger.js';
import type { RendererSource } from './navigation-policy.js';
import { manualCommitter } from './project-commits.js';
import { EXAMPLE_ID, installExampleProject } from './example-project.js';
import { ProjectService, type FolderPurpose } from './project-service.js';
import { ProjectWatchFollower, watchProject } from './project-watcher.js';
import { installRenderTestHooks, RenderBackend, TEST_HOOKS_ENV } from './render/render-backend.js';
import { createSettingsBackend, toolPickerOptions } from './settings-ipc.js';
import type { SettingsService } from './settings-service.js';
import { ScriptDocuments } from './stages/script-documents.js';
import { recordedTranscription, TEST_TRANSCRIPT_ENV } from './stages/audio-probe.js';
import {
  appRunnerFactory,
  settingsAudioTools,
  sharedClaudeRunner,
} from './stages/stage-runtime.js';
import { projectKey, StageService } from './stages/stage-service.js';
import { replacementDialogOptions, type ReplacePick } from './stages/stages-ipc.js';
import { createExportBackend } from './export/export-backend.js';
import { settingsFfmpeg } from './sound/sound-backend.js';
import { elevenLabsTestUrl } from './voice/test-hooks.js';
import { createQueueBackend } from './queue/queue-backend.js';
import { showLineNotice } from './queue/line-notification.js';
import { VoiceService } from './voice/voice-service.js';
import { createTimelineEdits } from './timeline-ipc.js';
import { whisperTestHooks } from './whisper/test-hooks.js';

/** What the services are built from (main.ts sets these up before them). */
export interface AppContext {
  readonly userDataDir: string;
  /** The global asset library (PLAN.md#12.19): outside every project and outside git. */
  readonly libraryDir: string;
  readonly log: Logger;
  readonly source: RendererSource;
  readonly layout: AppLayout;
  readonly settings: SettingsService;
  readonly taste: TasteService;
  readonly channelSecrets: ChannelSecretStore;
  /** The main window, once it exists (undefined before ready and after it closed). */
  readonly window: () => BrowserWindow | undefined;
}

/** Builds the services (see the module comment); they reach each other lazily. */
export function createAppServices(context: AppContext) {
  const { userDataDir, libraryDir, log, source, layout, settings, taste, channelSecrets, window } =
    context;
  /** Native open dialog over the main window: the picked paths, undefined when cancelled. */
  const showOpen = async (options: OpenDialogOptions): Promise<string[] | undefined> => {
    const mainWindow = window();
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
        window()?.webContents.send(IPC_PUSH.projectChanged.name, event);
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
      window()?.webContents.send(IPC_PUSH.exportProgress.name, event);
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
      window()?.webContents.send(IPC_PUSH.projectOpenFailed.name, failure);
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
      window()?.webContents.send(IPC_PUSH.whisperProgress.name, progress);
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
      // A film of the production line gets the line's render service (PLAN.md#13.9).
      ...(renderBackend.serviceEnv(dir) ?? queue.render.serviceEnv(dir)),
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
      window()?.webContents.send(IPC_PUSH.chatChanged.name, state);
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
      window()?.webContents.send(IPC_PUSH.exportQueueChanged.name, state);
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
      taste: (projectDir) => taste.learner(projectDir),
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
      window()?.webContents.send(IPC_PUSH.stagesChanged.name, state);
      // An approval or a voiceover in a film of the production line opens its gate.
      if (state.projectDir !== null) queue.service.outsideChange(state.projectDir);
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
      window()?.webContents.send(IPC_PUSH.voiceProgress.name, progress);
    },
    log: log.child('voice'),
  });

  /** The production line (PLAN.md#13.9): per-channel queues of topics, built one film at a time. */
  const lineLog = log.child('line');
  const queue = createQueueBackend({
    userDataDir,
    channelsFile: channelsFile(userDataDir),
    source,
    layout,
    cores: availableParallelism(),
    settings,
    projects,
    stages,
    pipelineStore,
    claude: sharedClaudeRunner(() => claude.sessionManager()),
    guard: claude.guard,
    secrets: channelSecrets,
    elevenLabsUrl: elevenLabsTestUrl(process.env, testHooks),
    voiceFfmpeg: async () => {
      const manager = await voiceFfmpeg();
      return manager.ok ? manager.value : null;
    },
    stagesCommit,
    appCommit,
    defaultProjectsDir: () =>
      defaultProjectsDir(app.getPath('documents'), process.env, app.isPackaged),
    openPath: (target) => shell.openPath(target),
    push: (state) => {
      window()?.webContents.send(IPC_PUSH.queueChanged.name, state);
    },
    notify: (notice) => {
      showLineNotice(notice, window, lineLog, testHooks);
    },
    log: lineLog,
  });
  void queue.service.init();

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
  return {
    showOpen,
    projectWatcher,
    renderBackend,
    projects,
    settingsBackend,
    claude,
    pipelineStore,
    stagesLog,
    stagesCommit,
    appCommit,
    audioTools,
    exportBackend,
    stages,
    scriptDocuments,
    pickReplacement,
    voice,
    queue,
    timelineEdits,
    appInfo,
  };
}

export type AppServices = ReturnType<typeof createAppServices>;
