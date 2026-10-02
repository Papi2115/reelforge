// @ts-check
// Recorded Claude Code 2.1.287 streams (tools/fake-claude/fixtures, from spikes/01-cli-bridge) and
// the rewriting that makes a replay look like a run of *this* invocation (session id, cwd, model).

import { readFileSync } from 'node:fs';
import path from 'node:path';

/** @typedef {Record<string, unknown>} StreamEvent */

export const FIXTURES_DIR = path.join(import.meta.dirname, '..', 'fixtures');

/** Model aliases accepted by `--model` and the ids the real CLI reported for them (spike §4). */
export const MODEL_IDS = /** @type {const} */ ({
  haiku: 'claude-haiku-4-5-20251001',
  sonnet: 'claude-sonnet-5-5',
  opus: 'claude-opus-5-5',
});

/**
 * @param {string} model alias or full id
 * @returns {'haiku' | 'sonnet' | 'opus'}
 */
export function modelFamily(model) {
  const lower = model.toLowerCase();
  if (lower.includes('haiku')) return 'haiku';
  if (lower.includes('opus')) return 'opus';
  return 'sonnet';
}

/**
 * @param {string} model alias or full id
 * @returns {string}
 */
export function resolveModelId(model) {
  if (model === 'haiku' || model === 'sonnet' || model === 'opus') return MODEL_IDS[model];
  return model;
}

/**
 * @param {string} name fixture file name without extension
 * @returns {StreamEvent[]}
 */
export function loadFixture(name) {
  return readFileSync(path.join(FIXTURES_DIR, `${name}.jsonl`), 'utf8')
    .split('\n')
    .filter((line) => line.trim() !== '')
    .map((line) => /** @type {StreamEvent} */ (JSON.parse(line)));
}

/**
 * @param {unknown} value
 * @returns {value is StreamEvent}
 */
export function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * @template T
 * @param {T} value
 * @returns {T}
 */
export function clone(value) {
  return structuredClone(value);
}

/**
 * @typedef {object} RunContext
 * @property {string} sessionId
 * @property {string} cwd
 * @property {string} modelId
 * @property {string} permissionMode
 * @property {string[] | undefined} tools
 * @property {string} apiKeySource
 */

/**
 * Rewrites a recorded event so it belongs to the current invocation.
 * @param {StreamEvent} event
 * @param {RunContext} context
 * @returns {StreamEvent}
 */
export function adaptEvent(event, context) {
  const copy = clone(event);
  if ('session_id' in copy) copy['session_id'] = context.sessionId;
  if (copy['type'] === 'system' && copy['subtype'] === 'init') {
    copy['cwd'] = context.cwd;
    copy['model'] = context.modelId;
    copy['permissionMode'] = context.permissionMode;
    copy['apiKeySource'] = context.apiKeySource;
    if (context.tools !== undefined) copy['tools'] = context.tools;
  }
  const message = copy['message'];
  if (copy['type'] === 'assistant' && isRecord(message) && message['model'] !== '<synthetic>') {
    message['model'] = context.modelId;
  }
  const modelUsage = copy['modelUsage'];
  if (copy['type'] === 'result' && isRecord(modelUsage)) {
    const entries = Object.values(modelUsage);
    copy['modelUsage'] = entries.length === 1 ? { [context.modelId]: entries[0] } : modelUsage;
  }
  return copy;
}

/**
 * Replaces the text of the last assistant text block and `result.result` (FAKE_CLAUDE_REPLY).
 * @param {StreamEvent[]} events
 * @param {string} reply
 * @returns {StreamEvent[]}
 */
export function overrideReply(events, reply) {
  const copy = events.map((event) => clone(event));
  const lastText = copy.findLast((event) => firstBlock(event)?.['type'] === 'text');
  const block = lastText === undefined ? undefined : firstBlock(lastText);
  if (block !== undefined) block['text'] = reply;
  const result = copy.find((event) => event['type'] === 'result');
  if (result !== undefined) result['result'] = reply;
  return copy;
}

/**
 * @param {StreamEvent} event
 * @returns {StreamEvent | undefined}
 */
export function firstBlock(event) {
  const message = event['message'];
  if (!isRecord(message)) return undefined;
  const content = message['content'];
  if (!Array.isArray(content)) return undefined;
  const block = /** @type {unknown} */ (content[0]);
  return isRecord(block) ? block : undefined;
}
