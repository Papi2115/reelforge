// @ts-check
// Scenario selection: sidecar script (FAKE_CLAUDE_SCRIPT) > FAKE_CLAUDE_SCENARIO > "ok".
// Per-scenario knobs come from FAKE_CLAUDE_* env vars, overridable per step in the sidecar.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';

/**
 * @typedef {object} StepOverrides
 * @property {string} [reply]
 * @property {number} [delayMs]
 * @property {number} [ticks]
 * @property {string} [limitShape]
 * @property {number} [resetsAt]
 * @property {number} [exitCode]
 * @property {FileWrite[]} [writes]   files written by the `tools-write` scenario (relative to cwd)
 * @property {ToolCall[]} [toolCalls]  extra tool calls `tools-write` announces before its writes
 */

/** @typedef {{ path: string, content: string }} FileWrite */

/**
 * A tool call replayed as tool_use + tool_result (nothing is executed). `{cwd}` in string inputs
 * and in the output is replaced by the process cwd.
 * @typedef {{ name: string, input: Record<string, unknown>, output: string, isError: boolean }} ToolCall
 */

/** @typedef {StepOverrides & { scenario: string }} Step */

/**
 * @param {unknown} value
 * @returns {Record<string, unknown> | undefined}
 */
function asRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? /** @type {Record<string, unknown>} */ (value)
    : undefined;
}

/**
 * @param {unknown} value
 * @param {string} where
 * @returns {FileWrite[]}
 */
function toWrites(value, where) {
  if (!Array.isArray(value)) throw new Error(`${where}: "writes" must be an array`);
  return /** @type {unknown[]} */ (value).map((entry) => {
    const record = asRecord(entry);
    const file = record?.['path'];
    const content = record?.['content'];
    if (typeof file !== 'string' || typeof content !== 'string') {
      throw new Error(`${where}: each write needs string "path" and "content"`);
    }
    return { path: file, content };
  });
}

/**
 * @param {unknown} value
 * @param {string} where
 * @returns {ToolCall[]}
 */
function toToolCalls(value, where) {
  if (!Array.isArray(value)) throw new Error(`${where}: "toolCalls" must be an array`);
  return /** @type {unknown[]} */ (value).map((entry) => {
    const record = asRecord(entry);
    const name = record?.['name'];
    const input = asRecord(record?.['input']);
    const output = record?.['output'];
    if (typeof name !== 'string' || input === undefined || typeof output !== 'string') {
      throw new Error(
        `${where}: each tool call needs string "name", object "input", string "output"`,
      );
    }
    return { name, input, output, isError: record?.['isError'] === true };
  });
}

/**
 * @param {unknown} value
 * @param {string} where
 * @returns {Step}
 */
function toStep(value, where) {
  if (typeof value === 'string') return { scenario: value };
  const record = asRecord(value);
  const scenario = record?.['scenario'];
  if (record === undefined || typeof scenario !== 'string') {
    throw new Error(`${where}: expected a scenario name or { "scenario": "..." }`);
  }
  /** @type {Step} */
  const step = { scenario };
  for (const key of /** @type {const} */ (['reply', 'limitShape'])) {
    const field = record[key];
    if (typeof field === 'string') step[key] = field;
  }
  for (const key of /** @type {const} */ (['delayMs', 'ticks', 'resetsAt', 'exitCode'])) {
    const field = record[key];
    if (typeof field === 'number') step[key] = field;
  }
  const writes = record['writes'];
  if (writes !== undefined) step.writes = toWrites(writes, where);
  const toolCalls = record['toolCalls'];
  if (toolCalls !== undefined) step.toolCalls = toToolCalls(toolCalls, where);
  return step;
}

/**
 * Sidecar: { "version": 1, "sequence"?: Step[], "rules"?: [{ "promptIncludes", ...Step }], "default"?: Step }.
 * `sequence` advances a counter stored next to the script (`<script>.state`): sequential use only.
 * @param {string} scriptPath
 * @param {string} prompt
 * @returns {Step}
 */
export function stepFromScript(scriptPath, prompt) {
  const script = asRecord(/** @type {unknown} */ (JSON.parse(readFileSync(scriptPath, 'utf8'))));
  if (script === undefined || script['version'] !== 1) {
    throw new Error(`${scriptPath}: expected { "version": 1, ... }`);
  }
  const sequence = script['sequence'];
  if (Array.isArray(sequence) && sequence.length > 0) {
    const statePath = `${scriptPath}.state`;
    const index = existsSync(statePath) ? Number(readFileSync(statePath, 'utf8')) : 0;
    writeFileSync(statePath, String(index + 1), 'utf8');
    const position = Math.min(Number.isFinite(index) ? index : 0, sequence.length - 1);
    return toStep(/** @type {unknown} */ (sequence[position]), `${scriptPath} sequence`);
  }
  const rules = script['rules'];
  if (Array.isArray(rules)) {
    for (const rule of /** @type {unknown[]} */ (rules)) {
      const needle = asRecord(rule)?.['promptIncludes'];
      if (typeof needle === 'string' && prompt.includes(needle)) {
        return toStep(rule, `${scriptPath} rule`);
      }
    }
  }
  const fallback = script['default'];
  return fallback === undefined ? { scenario: 'ok' } : toStep(fallback, `${scriptPath} default`);
}

/**
 * @param {string | undefined} value
 * @returns {number | undefined}
 */
function envNumber(value) {
  if (value === undefined || value.trim() === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/**
 * @param {NodeJS.ProcessEnv} env
 * @param {string} prompt
 * @returns {Step}
 */
export function selectStep(env, prompt) {
  const script = env['FAKE_CLAUDE_SCRIPT'];
  const fromScript = script === undefined ? undefined : stepFromScript(script, prompt);
  /** @type {Step} */
  const step = { scenario: env['FAKE_CLAUDE_SCENARIO'] ?? 'ok' };
  const reply = env['FAKE_CLAUDE_REPLY'];
  if (reply !== undefined) step.reply = reply;
  const limitShape = env['FAKE_CLAUDE_LIMIT_SHAPE'];
  if (limitShape !== undefined) step.limitShape = limitShape;
  const numbers = /** @type {const} */ ([
    ['delayMs', 'FAKE_CLAUDE_DELAY_MS'],
    ['ticks', 'FAKE_CLAUDE_SLOW_TICKS'],
    ['resetsAt', 'FAKE_CLAUDE_RESETS_AT'],
    ['exitCode', 'FAKE_CLAUDE_EXIT_CODE'],
  ]);
  for (const [key, name] of numbers) {
    const value = envNumber(env[name]);
    if (value !== undefined) step[key] = value;
  }
  return fromScript === undefined ? step : { ...step, ...fromScript };
}
