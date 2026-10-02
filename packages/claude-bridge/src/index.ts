/**
 * Bridge to the locally installed Claude Code CLI (ADR-001): the app only spawns the real `claude`
 * binary on the user's subscription. No API keys, no credential handling, sanitized child env.
 */
export const packageName = '@reelforge/claude-bridge';

export * from './args.js';
export * from './clock.js';
export * from './debug-dump.js';
export * from './detect.js';
export * from './env.js';
export * from './events.js';
export * from './executable.js';
export * from './json-file.js';
export * from './limit-guard.js';
export * from './limits.js';
export * from './path-guard.js';
export * from './permissions.js';
export * from './pipeline-state-store.js';
export * from './process.js';
export * from './reset-time.js';
export * from './result.js';
export * from './session-manager.js';
export * from './session-types.js';
export * from './session-store.js';
export * from './steps.js';
export * from './turn.js';
export * from './turn-request.js';
export * from './usage-ledger.js';
export * from './work-queue.js';
export { AsyncChannel } from './channel.js';
