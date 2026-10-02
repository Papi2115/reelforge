// Spike 1.1: minimal bridge to the locally installed `claude` CLI (headless, subscription auth).
// Node built-ins only. The app never touches credentials: it spawns the real CLI and parses stdout.
//
// Usage (CLI):
//   node spikes/01-cli-bridge/demo.mjs --model haiku "Reply with the single word ok"
//   node spikes/01-cli-bridge/demo.mjs --model haiku --resume <session_id> "What word did I ask you to remember?"
//   node spikes/01-cli-bridge/demo.mjs --cwd "<project dir>" --tools Read --allowed-tools Read "Describe swatch.png"
//   add --record <file.jsonl> to save the (redacted) raw stream.

import { spawn } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createInterface } from 'node:readline';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

/** Env vars that could silently switch billing from the subscription to an API/provider account. */
export const BILLING_ENV_EXACT = [
  'ANTHROPIC_API_KEY',
  'ANTHROPIC_AUTH_TOKEN',
  'ANTHROPIC_BASE_URL',
  'CLAUDE_CODE_USE_BEDROCK',
  'CLAUDE_CODE_USE_VERTEX',
  'CLAUDE_CODE_USE_FOUNDRY',
  'CLAUDE_CODE_USE_GATEWAY',
  'CLAUDE_CODE_USE_MANTLE',
  'CLAUDE_CODE_USE_ANTHROPIC_AWS',
  'CLAUDE_CODE_USE_ANTHROPIC_GOOGLE_CLOUD',
  'CLAUDE_CODE_OAUTH_TOKEN',
];

/** Prefixes stripped entirely: every ANTHROPIC_* var, plus markers leaked by a parent Claude Code session. */
export const STRIPPED_ENV_PREFIXES = ['ANTHROPIC_', 'CLAUDE_CODE_', 'CLAUDE_AGENT_SDK_'];
export const STRIPPED_ENV_MARKERS = ['CLAUDECODE', 'CLAUDE_PID', 'CLAUDE_EFFORT'];

/** User-level settings that are safe and useful to forward (e.g. Git Bash location on Windows). */
export const FORWARDED_ENV_ALLOWLIST = [
  'CLAUDE_CODE_GIT_BASH_PATH',
  'CLAUDE_CONFIG_DIR',
  'CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC',
];

/**
 * Returns a copy of `env` safe to hand to a child `claude` process.
 * Windows env keys are case-insensitive, so comparisons are upper-cased.
 * @param {NodeJS.ProcessEnv} env
 * @returns {Record<string, string>}
 */
export function sanitizeEnv(env) {
  /** @type {Record<string, string>} */
  const clean = {};
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) continue;
    const upper = key.toUpperCase();
    const allowed = FORWARDED_ENV_ALLOWLIST.includes(upper);
    const billing = BILLING_ENV_EXACT.includes(upper);
    const prefixed = STRIPPED_ENV_PREFIXES.some((prefix) => upper.startsWith(prefix));
    const marker = STRIPPED_ENV_MARKERS.includes(upper);
    if (billing || (!allowed && (prefixed || marker))) continue;
    clean[key] = value;
  }
  return clean;
}

/**
 * Finds the native `claude` executable. On Windows the npm `claude.cmd` is only a shim around
 * `node_modules/@anthropic-ai/claude-code/bin/claude.exe`; we resolve the .exe so we can spawn
 * with shell:false (Node >= 18.20 refuses .cmd with shell:false: EINVAL, CVE-2024-27980).
 * @param {{ env?: NodeJS.ProcessEnv, platform?: NodeJS.Platform }} [options]
 * @returns {string | undefined}
 */
export function resolveClaudeExecutable(options = {}) {
  const env = options.env ?? process.env;
  const platform = options.platform ?? process.platform;
  const pathKey = Object.keys(env).find((key) => key.toUpperCase() === 'PATH') ?? 'PATH';
  const dirs = (env[pathKey] ?? '').split(path.delimiter).filter(Boolean);
  if (platform !== 'win32') {
    return dirs.map((dir) => path.join(dir, 'claude')).find((file) => existsSync(file));
  }
  const home = env['USERPROFILE'] ?? os.homedir();
  const candidates = [...dirs, path.join(home, '.local', 'bin')];
  for (const dir of candidates) {
    const exe = path.join(dir, 'claude.exe');
    if (existsSync(exe)) return exe;
    const shim = path.join(dir, 'claude.cmd');
    if (existsSync(shim)) {
      const target = exeFromCmdShim(shim);
      if (target !== undefined) return target;
    }
  }
  return undefined;
}

/**
 * Extracts the target exe from an npm cmd-shim line like: "%dp0%\node_modules\...\claude.exe" %*
 * @param {string} shimPath
 * @returns {string | undefined}
 */
export function exeFromCmdShim(shimPath) {
  const match = /"%dp0%\\([^"]+\.exe)"/i.exec(readFileSync(shimPath, 'utf8'));
  if (match?.[1] === undefined) return undefined;
  const exe = path.join(path.dirname(shimPath), match[1]);
  return existsSync(exe) ? exe : undefined;
}

/**
 * @typedef {object} RunOptions
 * @property {string} prompt              Sent on stdin (no argv quoting issues).
 * @property {string} [model]             Alias (haiku|sonnet|opus) or full model id.
 * @property {string} [cwd]               Project folder; CLAUDE.md there is auto-discovered.
 * @property {string} [resume]            Session id to continue.
 * @property {string} [sessionId]         Force a new session id (UUID).
 * @property {string[]} [tools]           Built-in tools that exist at all (`--tools`).
 * @property {string[]} [allowedTools]    Tools allowed without a prompt (`--allowedTools`).
 * @property {string[]} [disallowedTools]
 * @property {string} [permissionMode]    acceptEdits|auto|bypassPermissions|manual|dontAsk|plan
 * @property {string} [appendSystemPrompt]
 * @property {string[]} [addDirs]
 * @property {string} [settingSources]    e.g. "project,local" (skip user settings/hooks)
 * @property {boolean} [strictMcp]        `--strict-mcp-config` with no servers (default true)
 * @property {boolean} [persistSession]   false -> `--no-session-persistence`
 * @property {boolean} [partialMessages]  `--include-partial-messages`
 * @property {number} [timeoutMs]
 * @property {string} [claudePath]       Override executable (tests: process.execPath).
 * @property {string[]} [executableArgs] Args placed before the CLI flags (tests: fake script path).
 * @property {NodeJS.ProcessEnv} [env]
 */

/**
 * @param {RunOptions} options
 * @returns {string[]}
 */
export function buildArgs(options) {
  const args = ['-p', '--input-format', 'text', '--output-format', 'stream-json', '--verbose'];
  if (options.model !== undefined) args.push('--model', options.model);
  if (options.resume !== undefined) args.push('--resume', options.resume);
  if (options.sessionId !== undefined) args.push('--session-id', options.sessionId);
  if (options.tools !== undefined) args.push('--tools', options.tools.join(','));
  if (options.allowedTools !== undefined)
    args.push('--allowedTools', options.allowedTools.join(','));
  if (options.disallowedTools !== undefined) {
    args.push('--disallowedTools', options.disallowedTools.join(','));
  }
  if (options.permissionMode !== undefined) args.push('--permission-mode', options.permissionMode);
  if (options.appendSystemPrompt !== undefined) {
    args.push('--append-system-prompt', options.appendSystemPrompt);
  }
  for (const dir of options.addDirs ?? []) args.push('--add-dir', dir);
  if (options.settingSources !== undefined) args.push('--setting-sources', options.settingSources);
  if (options.strictMcp !== false) args.push('--strict-mcp-config');
  if (options.persistSession === false) args.push('--no-session-persistence');
  if (options.partialMessages === true) args.push('--include-partial-messages');
  return args;
}

/**
 * Kills a process and all of its descendants. Windows: `taskkill /PID <pid> /T /F`.
 * @param {number} pid
 * @returns {Promise<number | null>} exit code of taskkill (Windows) or 0
 */
export function killTree(pid) {
  if (process.platform !== 'win32') {
    process.kill(-pid, 'SIGKILL');
    return Promise.resolve(0);
  }
  return new Promise((resolve, reject) => {
    const killer = spawn('taskkill', ['/PID', String(pid), '/T', '/F'], {
      windowsHide: true,
      stdio: 'ignore',
    });
    killer.once('error', reject);
    killer.once('close', resolve);
  });
}

/**
 * Spawns `claude -p` and returns an async-iterable run: iterate it for parsed stream-json events.
 * Non-JSON stdout lines yield `{ type: 'bridge_parse_error', line }`; a non-zero exit yields
 * `{ type: 'bridge_exit', code, signal, stderr }` as the last event.
 * @param {RunOptions} options
 */
export function runClaude(options) {
  const executable = options.claudePath ?? resolveClaudeExecutable();
  if (executable === undefined) throw new Error('claude CLI not found on PATH');
  const child = spawn(executable, [...(options.executableArgs ?? []), ...buildArgs(options)], {
    cwd: options.cwd ?? process.cwd(),
    env: sanitizeEnv(options.env ?? process.env),
    shell: false,
    windowsHide: true,
    detached: process.platform !== 'win32',
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  /** @type {string[]} */
  const stderrChunks = [];
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (chunk) => stderrChunks.push(String(chunk)));
  /** @type {Promise<{ code: number | null, signal: NodeJS.Signals | null }>} */
  const exit = new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', (code, signal) => resolve({ code, signal }));
  });
  child.stdin.end(options.prompt, 'utf8');
  const timer =
    options.timeoutMs === undefined || child.pid === undefined
      ? undefined
      : setTimeout(() => void killTree(/** @type {number} */ (child.pid)), options.timeoutMs);

  async function* events() {
    const lines = createInterface({ input: child.stdout, crlfDelay: Infinity });
    try {
      for await (const line of lines) {
        if (line.trim() === '') continue;
        yield parseLine(line);
      }
      const { code, signal } = await exit;
      if (code !== 0) yield { type: 'bridge_exit', code, signal, stderr: stderrChunks.join('') };
    } finally {
      if (timer !== undefined) clearTimeout(timer);
    }
  }

  return {
    pid: child.pid,
    exit,
    stderr: () => stderrChunks.join(''),
    kill: () => (child.pid === undefined ? Promise.resolve(null) : killTree(child.pid)),
    [Symbol.asyncIterator]: events,
  };
}

/**
 * @param {string} line
 * @returns {Record<string, unknown>}
 */
export function parseLine(line) {
  try {
    const value = /** @type {unknown} */ (JSON.parse(line));
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      return /** @type {Record<string, unknown>} */ (value);
    }
    return { type: 'bridge_parse_error', line };
  } catch (error) {
    return { type: 'bridge_parse_error', line, error: String(error) };
  }
}

/**
 * Deep-redacts strings for fixtures: e-mail addresses, the home directory and the OS user name
 * (Claude Code encodes paths into names like `C--Users-<user>-...`).
 * @param {unknown} value
 * @param {{ home?: string, user?: string }} [identity]
 * @returns {unknown}
 */
export function redact(value, identity = {}) {
  const home = identity.home ?? os.homedir();
  const user = identity.user ?? path.basename(home);
  if (typeof value === 'string') {
    const homes = [home, home.replaceAll('\\', '/'), home.replaceAll('\\', '/').toLowerCase()];
    let out = value.replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '<redacted-email>');
    for (const h of homes) out = out.split(h).join('<HOME>');
    if (user.length >= 3) out = out.split(user).join('<USER>');
    return out;
  }
  if (Array.isArray(value)) return value.map((item) => redact(item, { home, user }));
  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, redact(item, { home, user })]),
    );
  }
  return value;
}

/**
 * One-line human summary of an event (for the demo CLI and probes).
 * @param {Record<string, unknown>} event
 * @returns {string}
 */
export function summarize(event) {
  const type = String(event['type']);
  const subtype = event['subtype'] === undefined ? '' : `:${String(event['subtype'])}`;
  if (type === 'system' && event['subtype'] === 'init') {
    return `[system:init] model=${String(event['model'])} session=${String(event['session_id'])}`;
  }
  if (type === 'assistant' || type === 'user') {
    const message = /** @type {{ content?: unknown }} */ (event['message'] ?? {});
    const blocks = Array.isArray(message.content) ? message.content : [];
    return blocks
      .map((/** @type {Record<string, unknown>} */ block) => {
        const kind = String(block['type']);
        if (kind === 'text') return `[${type}:text] ${String(block['text'])}`;
        if (kind === 'tool_use')
          return `[${type}:tool_use] ${String(block['name'])} ${JSON.stringify(block['input'])}`;
        if (kind === 'tool_result')
          return `[${type}:tool_result] ${JSON.stringify(block['content']).slice(0, 160)}`;
        return `[${type}:${kind}]`;
      })
      .join('\n');
  }
  if (type === 'result') {
    return `[result${subtype}] is_error=${String(event['is_error'])} turns=${String(event['num_turns'])} duration_ms=${String(event['duration_ms'])} cost_usd=${String(event['total_cost_usd'])} result=${JSON.stringify(event['result'])}`;
  }
  return `[${type}${subtype}] ${JSON.stringify(event).slice(0, 200)}`;
}

/** @param {string | undefined} list */
const splitList = (list) => (list === undefined ? undefined : list.split(',').filter(Boolean));

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      model: { type: 'string' },
      cwd: { type: 'string' },
      resume: { type: 'string' },
      tools: { type: 'string' },
      'allowed-tools': { type: 'string' },
      'permission-mode': { type: 'string' },
      'append-system-prompt': { type: 'string' },
      'setting-sources': { type: 'string' },
      record: { type: 'string' },
    },
  });
  const prompt = positionals.join(' ');
  if (prompt === '') throw new Error('usage: node demo.mjs [--model haiku] [...] "<prompt>"');
  /** @type {RunOptions} */
  const options = { prompt };
  if (values.model !== undefined) options.model = values.model;
  if (values.cwd !== undefined) options.cwd = values.cwd;
  if (values.resume !== undefined) options.resume = values.resume;
  const tools = splitList(values.tools);
  if (tools !== undefined) options.tools = tools;
  const allowed = splitList(values['allowed-tools']);
  if (allowed !== undefined) options.allowedTools = allowed;
  if (values['permission-mode'] !== undefined) options.permissionMode = values['permission-mode'];
  if (values['append-system-prompt'] !== undefined) {
    options.appendSystemPrompt = values['append-system-prompt'];
  }
  if (values['setting-sources'] !== undefined) options.settingSources = values['setting-sources'];
  const started = Date.now();
  /** @type {string[]} */
  const recorded = [];
  for await (const event of runClaude(options)) {
    recorded.push(JSON.stringify(redact(event)));
    process.stdout.write(`+${String(Date.now() - started).padStart(6)}ms ${summarize(event)}\n`);
  }
  if (values.record !== undefined) writeFileSync(values.record, `${recorded.join('\n')}\n`, 'utf8');
}

const invokedDirectly =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  main().catch((error) => {
    process.stderr.write(`${String(error)}\n`);
    process.exitCode = 1;
  });
}
