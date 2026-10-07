/**
 * The main process's typed IPC (main.ts registers it once): every handler group wired to the
 * app's services, the production line's gate on the app's own decisions, renderer logs and the
 * trusted-sender check.
 */
import path from 'node:path';
import { dialog, ipcMain, shell } from 'electron';
import { channelsFile, logFile, recentProjectsFile } from './app-paths.js';
import { assetsHandlers, OWN_ASSET_FILTERS } from './assets/assets-ipc.js';
import { publishHandlers } from './publish/publish-ipc.js';
import { hookLabHandlers } from './hook-lab/hook-lab-ipc.js';
import { channelsHandlers } from './channels/channels-ipc.js';
import { tasteHandlers } from './taste/taste-ipc.js';
import type { ChildProcessRegistry } from './child-processes.js';
import { chatHandlers } from './claude/chat-ipc.js';
import { loadDemoManifest } from './demo-manifest.js';
import { registerIpc } from './ipc-router.js';
import type { MicPermissionGate } from './mic-permission.js';
import { isAllowedNavigation } from './navigation-policy.js';
import { madeCommit } from './project-commits.js';
import { projectHandlers } from './project-ipc.js';
import { tensionHandlers } from './tension-ipc.js';
import { directionsHandlers } from './directions-ipc.js';
import { dramaturgyHandlers } from './dramaturgy-ipc.js';
import { editingHandlers } from './editing-ipc.js';
import { onboardingHandlers } from './onboarding-ipc.js';
import { ffmpegAudioProbe } from './stages/audio-probe.js';
import { sharedClaudeRunner } from './stages/stage-runtime.js';
import { stagesHandlers } from './stages/stages-ipc.js';
import { variantsHandlers } from './stages/variants-ipc.js';
import { createSoundBackend } from './sound/sound-backend.js';
import { LINE_GATE_CHANNELS } from './queue/queue-ipc.js';
import { voiceHandlers } from './voice/voice-ipc.js';
import { soundPickerOptions } from './sound/sound-ipc.js';
import { timelineHandlers } from './timeline-ipc.js';
import type { AppContext, AppServices } from './app-services.js';

/** Registers the handlers of every channel (see the module comment). */
export function registerAppIpc(
  context: AppContext,
  services: AppServices,
  main: { readonly children: ChildProcessRegistry; readonly micGate: MicPermissionGate },
): void {
  const { userDataDir, libraryDir, log, source, layout, settings, taste, channelSecrets, window } =
    context;
  const { children, micGate } = main;
  const { showOpen, renderBackend, projects, settingsBackend, claude, pipelineStore } = services;
  const { stagesLog, stagesCommit, appCommit, audioTools, exportBackend, stages } = services;
  const { scriptDocuments, pickReplacement, voice, queue, timelineEdits, appInfo } = services;
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
        currentProject: () => projects.currentProject()?.dir,
        pickExportFile: async () => {
          const options = {
            title: 'Export the taste profile',
            defaultPath: 'reelforge-taste.json',
            filters: [{ name: 'JSON', extensions: ['json'] }],
          };
          const mainWindow = window();
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
      ...queue.handlers,
      ...variantsHandlers({
        service: stages,
        currentProject: () => projects.currentProject()?.dir,
        settings: () => settings.get(),
        claudeConcurrency: () => claude.guard.concurrency,
        frames: renderBackend.frames,
        log: stagesLog,
      }),
    },
    // The app's own decisions that may open a waiting film's gate (PLAN.md#13.9).
    onHandled: (channel) => {
      if (LINE_GATE_CHANNELS.has(channel)) queue.service.outsideChange();
    },
    onRendererLog: (entry) => {
      log.child(`renderer:${entry.scope}`).log(entry.level, entry.message);
    },
    isTrustedSender: (url) => isAllowedNavigation(url, source),
    log: log.child('ipc'),
  });
}
