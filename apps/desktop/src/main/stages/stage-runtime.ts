/**
 * How the desktop app builds a StageRunner (PLAN.md#6.8): Claude turns go through the app's one
 * SessionManager (the ClaudeService's: sanitized env, permissions, render-service env, limit guard
 * and usage ledger are configured there; set up on first use), ffmpeg / whisper.cpp are located
 * from the current settings (rebuilt when a tool path changes), the stage settings are read from
 * the app settings at the start of every run, and pipeline.json goes through the shared store.
 */
import {
  type LimitGuard,
  type PipelineStateStore,
  type Result,
  type SessionManager,
} from '@reelforge/claude-bridge';
import type { AppSettings } from '@reelforge/shared';
import {
  BridgeClaudeRunner,
  createPipelineAudioTools,
  stageSettingsFromApp,
  StageRunner,
  type AudioTools,
  type ClaudeRunner,
  type ClaudeTurnResult,
  type PipelineAudioToolsOptions,
} from '@reelforge/stages';
import type { ChatError } from '../../shared/chat-contract.js';
import { whisperManagerOptions } from '../settings-consumers.js';

/** A turn that cannot start because Claude is not set up (not installed / not logged in). */
export function blockedTurn(message: string): ClaudeTurnResult {
  return {
    status: 'blocked',
    reply: '',
    sessionId: undefined,
    message,
    usage: undefined,
    limit: undefined,
  };
}

/** ClaudeRunner over the app's shared SessionManager (created by the ClaudeService). */
export function sharedClaudeRunner(
  sessions: () => Promise<Result<SessionManager, ChatError>>,
): ClaudeRunner {
  return {
    async run(spec, options) {
      const manager = await sessions();
      if (!manager.ok) return blockedTurn(manager.error.message);
      return new BridgeClaudeRunner(manager.value).run(spec, options);
    },
  };
}

/** Audio tools of the current settings; rebuilt when the ffmpeg / whisper path changes. */
export function settingsAudioTools(
  settings: () => AppSettings,
  create: (options: PipelineAudioToolsOptions) => AudioTools = createPipelineAudioTools,
): AudioTools {
  let cached: { readonly key: string; readonly tools: AudioTools } | undefined;
  const current = (): AudioTools => {
    const app = settings();
    const key = JSON.stringify([app.tools.ffmpegPath, app.tools.whisperPath]);
    if (cached?.key !== key) {
      cached = {
        key,
        tools: create({ ffmpegPath: app.tools.ffmpegPath, whisper: whisperManagerOptions(app) }),
      };
    }
    return cached.tools;
  };
  return {
    durationS: (file, signal) => current().durationS(file, signal),
    clean: (request) => current().clean(request),
    transcribe: (request) => current().transcribe(request),
    hasWhisperModel: (model) => current().hasWhisperModel(model),
    mix: (cues, request) => current().mix(cues, request),
  };
}

export interface AppRunnerOptions {
  readonly settings: () => AppSettings;
  readonly sessions: () => Promise<Result<SessionManager, ChatError>>;
  readonly guard: LimitGuard;
  readonly store: PipelineStateStore;
}

/** `StageServiceOptions.createRunner` of the desktop app. */
export function appRunnerFactory(options: AppRunnerOptions): (projectDir: string) => StageRunner {
  const claude = sharedClaudeRunner(options.sessions);
  const audio = settingsAudioTools(options.settings);
  return (projectDir) =>
    new StageRunner({
      projectDir,
      claude,
      audio,
      settings: () => stageSettingsFromApp(options.settings()),
      guard: options.guard,
      store: options.store,
    });
}
