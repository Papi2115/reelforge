import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { IPC, IPC_EVENTS, type AppInfo, type RendererLogEntry } from '../shared/ipc-contract.js';
import { registerIpc, type IpcMainLike, type IpcSenderEvent } from './ipc-router.js';
import type { ProjectOpenResult } from '../shared/project-contract.js';
import { createLogger } from './logger.js';
import { defaultAppSettings } from '@reelforge/shared';
import type { ToolsStatus } from '../shared/settings-contract.js';
import type { SettingsHandlers } from './settings-ipc.js';

type Listener = (event: IpcSenderEvent, payload: unknown) => unknown;

class FakeIpcMain implements IpcMainLike {
  readonly handlers = new Map<string, Listener>();
  readonly listeners = new Map<string, Listener>();
  handle(channel: string, listener: Listener): void {
    this.handlers.set(channel, listener);
  }
  on(channel: string, listener: Listener): void {
    this.listeners.set(channel, listener);
  }
  invoke(channel: string, url: string, payload: unknown): unknown {
    const handler = this.handlers.get(channel);
    if (!handler) throw new Error(`no handler for ${channel}`);
    return handler({ senderFrame: { url } }, payload);
  }
}

const APP_URL = 'reelforge://app/index.html';
const appInfo: AppInfo = {
  name: 'ReelForge',
  version: '0.0.0',
  electron: '44.4.5',
  chrome: '152',
  platform: 'win32',
  userDataDir: 'C:\\Users\\x\\AppData\\Roaming\\ReelForge',
  dev: false,
};

const opened: ProjectOpenResult = {
  status: 'opened',
  project: {
    dir: path.join('C:', 'Filmy', 'Mój film'),
    title: 'Mój film',
    language: 'pl',
    style: 'voxel-pixel-crisp640',
    fps: 30,
  },
};

/** Settings channels (PLAN.md#6.7); their requests are checked in the test below. */
function settingsStubs(record: <T>(request: unknown, response: T) => Promise<T>): SettingsHandlers {
  const tools: ToolsStatus = {
    ffmpeg: { status: 'missing', message: 'not found', configured: false },
    whisper: { status: 'missing', message: 'not installed', configured: false },
  };
  return {
    settingsGet: (request) =>
      record(request, { settings: defaultAppSettings(), cores: 8, file: 'settings.json' }),
    settingsUpdate: (request) =>
      record(request, { status: 'ok', settings: defaultAppSettings() } as const),
    claudeStatus: (request) =>
      record(request, {
        state: 'not-installed',
        installCommand: 'npm install -g @anthropic-ai/claude-code',
        searchedDirs: 3,
      } as const),
    claudeOpenLogin: (request) => record(request, { status: 'error', message: 'n/a' } as const),
    toolsStatus: (request) => record(request, tools),
    toolsBrowse: (request) => record(request, { status: 'cancelled' } as const),
    toolsReset: (request) => record(request, tools),
    whisperModels: (request) =>
      record(request, { modelsDir: 'C:\\m', models: [], vadInstalled: false, downloading: null }),
    whisperDownload: (request) => record(request, { status: 'started' } as const),
    whisperCancel: (request) => record(request, null),
    whisperDelete: (request) => record(request, { status: 'deleted' } as const),
  };
}

function setup(): {
  ipc: FakeIpcMain;
  logs: RendererLogEntry[];
  lines: string[];
  calls: unknown[];
} {
  const ipc = new FakeIpcMain();
  const logs: RendererLogEntry[] = [];
  const lines: string[] = [];
  const calls: unknown[] = [];
  const record = <T>(request: unknown, response: T): Promise<T> => {
    calls.push(request);
    return Promise.resolve(response);
  };
  registerIpc(ipc, {
    handlers: {
      appInfo: () => Promise.resolve(appInfo),
      demoManifest: () => Promise.reject(new Error('not in this test')),
      projectNew: (request) => record(request, opened),
      projectOpen: (request) => record(request, { status: 'cancelled' } as const),
      projectOpenRecent: (request) => record(request, opened),
      projectRecent: (request) => record(request, []),
      projectCurrent: (request) => record(request, null),
      projectClose: (request) => record(request, null),
      projectHistory: (request) => record(request, { status: 'ok', entries: [] } as const),
      projectRevert: (request) => record(request, { status: 'unchanged' } as const),
      projectSnapshot: (request) =>
        record(request, {
          status: 'error',
          error: { kind: 'invalid-argument', message: 'no project is open' },
        } as const),
      projectManifest: (request) => record(request, { status: 'no-storyboard' } as const),
      snapshotSave: (request) =>
        record(request, { status: 'error', message: 'no project is open' } as const),
      snapshotCopy: (request) => record(request, { status: 'copied' } as const),
      timelineEdit: (request) =>
        record(request, { status: 'error', message: 'no project is open' } as const),
      timelineWaveform: (request) =>
        record(request, { status: 'unavailable', reason: 'no project is open' } as const),
      ...settingsStubs(record),
      exportStart: (request) => record(request, { status: 'no-project' } as const),
      exportCancel: (request) => record(request, false),
      chatState: (request) =>
        record(request, {
          projectDir: null,
          turns: [],
          queue: [],
          running: null,
          pause: null,
          notice: null,
        }),
      chatSend: (request) => record(request, { status: 'queued', turnId: 't1' } as const),
      chatRemove: (request) => record(request, false),
      chatStop: (request) => record(request, false),
      chatResume: (request) => record(request, null),
      stagesState: (request) =>
        record(request, { projectDir: null, stages: [], running: null, queue: [], pause: null }),
      stagesRun: (request) => record(request, { status: 'queued', message: null } as const),
      stagesStop: (request) => record(request, false),
      stagesReplace: (request) => record(request, { status: 'cancelled', message: null } as const),
      stagesOpen: (request) => record(request, { status: 'ok', message: null } as const),
      briefGet: (request) => record(request, { brief: null, error: null }),
      briefSave: (request) => record(request, { status: 'ok', message: null } as const),
      scriptGet: (request) =>
        record(request, {
          script: null,
          research: null,
          beats: null,
          sources: [],
          targetMinutes: null,
          report: null,
        }),
      scriptSave: (request) => record(request, { status: 'ok', message: null } as const),
      scriptApprove: (request) => record(request, { status: 'ok', message: null } as const),
      voiceoverImport: (request) =>
        record(request, { status: 'cancelled', message: null } as const),
      voiceoverRecording: (request) =>
        record(request, { status: 'queued', message: null } as const),
      micArm: (request) => record(request, true),
      stagesReports: (request) =>
        record(request, {
          projectDir: null,
          voiceover: null,
          voReport: null,
          words: null,
          scenes: null,
          sync: null,
          missingProps: null,
        }),
      wordsRetry: (request) => record(request, { status: 'queued', message: null } as const),
      scenesRun: (request) => record(request, { status: 'queued', message: null } as const),
    },
    onRendererLog: (entry) => logs.push(entry),
    isTrustedSender: (url) => url.startsWith('reelforge://app/'),
    log: createLogger((line) => lines.push(line)),
  });
  return { ipc, logs, lines, calls };
}

describe('registerIpc', () => {
  it('registers every invoke channel of the registry', () => {
    const { ipc } = setup();
    expect([...ipc.handlers.keys()].sort()).toEqual(
      Object.values(IPC)
        .map((c) => c.name)
        .sort(),
    );
  });

  it('answers trusted, valid requests', async () => {
    const { ipc } = setup();
    await expect(ipc.invoke(IPC.appInfo.name, APP_URL, null)).resolves.toEqual(appInfo);
  });

  it('rejects untrusted senders and invalid payloads', async () => {
    const { ipc, lines } = setup();
    await expect(ipc.invoke(IPC.appInfo.name, 'https://evil.example/', null)).rejects.toThrow(
      'untrusted sender',
    );
    await expect(ipc.invoke(IPC.appInfo.name, APP_URL, { extra: 1 })).rejects.toThrow(
      'invalid request',
    );
    expect(lines.join('')).toContain('refused app:info from untrusted frame https://evil.example/');
  });

  it('validates project requests before they reach the handlers', async () => {
    const { ipc, calls } = setup();
    const hash = 'a'.repeat(40);
    await expect(ipc.invoke(IPC.projectRevert.name, APP_URL, { hash })).resolves.toEqual({
      status: 'unchanged',
    });
    for (const bad of [{ hash: 'abc1234' }, { hash: '--output=x' }, { hash, extra: 1 }]) {
      await expect(ipc.invoke(IPC.projectRevert.name, APP_URL, bad)).rejects.toThrow(
        'invalid request',
      );
    }
    await expect(
      ipc.invoke(IPC.projectNew.name, APP_URL, { title: '   ', language: 'pl' }),
    ).rejects.toThrow('invalid request');
    await expect(
      ipc.invoke(IPC.projectNew.name, APP_URL, { title: ' Mój film ', language: 'pl' }),
    ).resolves.toEqual(opened);
    await expect(ipc.invoke(IPC.projectHistory.name, APP_URL, { limit: 0 })).rejects.toThrow(
      'invalid request',
    );
    await expect(
      ipc.invoke(IPC.projectHistory.name, 'https://evil.example/', { limit: 10 }),
    ).rejects.toThrow('untrusted sender');
    expect(calls).toEqual([{ hash }, { title: 'Mój film', language: 'pl' }]);
  });

  it('validates snapshot requests (PNG bytes, time, shot id) before they reach main', async () => {
    const { ipc, calls } = setup();
    const png = new Uint8Array([137, 80, 78, 71]);
    await expect(
      ipc.invoke(IPC.snapshotSave.name, APP_URL, { png, t: 2.2, shotId: 's02' }),
    ).resolves.toEqual({ status: 'error', message: 'no project is open' });
    for (const bad of [
      { png: 'iVBORw0KGgo=', t: 1 },
      { png, t: -1 },
      { png, t: Number.NaN },
      { png, t: 1, shotId: '../../evil' },
      { png: new Uint8Array(0), t: 1 },
      { png, t: 1, path: 'C:\\Windows\\x.png' },
    ]) {
      await expect(ipc.invoke(IPC.snapshotSave.name, APP_URL, bad)).rejects.toThrow(
        'invalid request',
      );
    }
    await expect(ipc.invoke(IPC.snapshotCopy.name, APP_URL, { png })).resolves.toEqual({
      status: 'copied',
    });
    await expect(ipc.invoke(IPC.snapshotCopy.name, APP_URL, { png: [1, 2] })).rejects.toThrow(
      'invalid request',
    );
    expect(calls).toEqual([{ png, t: 2.2, shotId: 's02' }, { png }]);
  });

  it('validates settings requests: no tool paths or unknown keys from the renderer', async () => {
    const { ipc, calls } = setup();
    const patch = { language: 'pl', economy: true, models: { critic: 'sonnet' } };
    await expect(ipc.invoke(IPC.settingsUpdate.name, APP_URL, patch)).resolves.toMatchObject({
      status: 'ok',
    });
    for (const bad of [
      { tools: { ffmpegPath: 'C:\\evil.exe' } },
      { language: 'de' },
      { performance: { exportWorkers: -1 } },
      { theme: 'light' },
    ]) {
      await expect(ipc.invoke(IPC.settingsUpdate.name, APP_URL, bad)).rejects.toThrow(
        'invalid request',
      );
    }
    await expect(ipc.invoke(IPC.toolsBrowse.name, APP_URL, { tool: 'git' })).rejects.toThrow(
      'invalid request',
    );
    await expect(
      ipc.invoke(IPC.whisperDownload.name, APP_URL, { model: '../../evil' }),
    ).rejects.toThrow('invalid request');
    await expect(
      ipc.invoke(IPC.claudeOpenLogin.name, APP_URL, { command: 'calc' }),
    ).rejects.toThrow('invalid request');
    await expect(
      ipc.invoke(IPC.claudeStatus.name, APP_URL, { refresh: true }),
    ).resolves.toMatchObject({ state: 'not-installed' });
    expect(calls).toEqual([patch, { refresh: true }]);
  });

  it('validates stage requests: stage and artifact names only, never paths', async () => {
    const { ipc, calls } = setup();
    await expect(
      ipc.invoke(IPC.stagesRun.name, APP_URL, { stages: ['sound-cues', 'mix'] }),
    ).resolves.toEqual({ status: 'queued', message: null });
    await expect(
      ipc.invoke(IPC.stagesOpen.name, APP_URL, { artifact: 'video' }),
    ).resolves.toMatchObject({ status: 'ok' });
    const bad: [string, unknown][] = [
      [IPC.stagesRun.name, { stages: [] }],
      [IPC.stagesRun.name, { stages: ['render'] }],
      [IPC.stagesRun.name, { stages: ['script'], source: 'C:\\evil.wav' }],
      [IPC.stagesOpen.name, { artifact: 'C:\\Windows\\calc.exe' }],
      [IPC.stagesReplace.name, { stage: 'words' }],
      [
        IPC.briefSave.name,
        { topic: ' ', language: 'en', targetMinutes: 1, tone: '', audience: '', notes: '' },
      ],
      [
        IPC.briefSave.name,
        { topic: 'x', language: 'de', targetMinutes: 1, tone: '', audience: '', notes: '' },
      ],
      [IPC.scriptSave.name, { text: 'x', file: 'other.txt' }],
    ];
    for (const [channel, payload] of bad) {
      await expect(ipc.invoke(channel, APP_URL, payload), channel).rejects.toThrow(
        'invalid request',
      );
    }
    expect(calls).toEqual([{ stages: ['sound-cues', 'mix'] }, { artifact: 'video' }]);
  });

  it('forwards valid renderer log entries only', () => {
    const { ipc, logs } = setup();
    const listener = ipc.listeners.get(IPC_EVENTS.log.name);
    const entry: RendererLogEntry = { level: 'info', scope: 'preview', message: 'first frame' };
    listener?.({ senderFrame: { url: APP_URL } }, entry);
    listener?.({ senderFrame: { url: APP_URL } }, { level: 'shout', scope: 'x', message: 'y' });
    listener?.({ senderFrame: null }, entry);
    expect(logs).toEqual([entry]);
  });
});
