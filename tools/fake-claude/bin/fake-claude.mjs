#!/usr/bin/env node
// @ts-check
// fake-claude: stands in for the `claude` CLI in tests (PLAN.md#5.9). Never calls a model and
// never reads credentials. Replays recorded/synthetic stream-json per scenario; see ../README.md.
// Spawn as: node tools/fake-claude/bin/fake-claude.mjs <claude args>  (shell:false, no .cmd).

import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { resolveModelId } from '../lib/fixtures.mjs';
import { buildPlan, sessionNotFoundPlan } from '../lib/scenarios.mjs';
import { selectStep } from '../lib/select.mjs';

/** @typedef {import('../lib/scenarios.mjs').Plan} Plan */

const PERMISSION_MODES = ['acceptEdits', 'auto', 'bypassPermissions', 'manual', 'dontAsk', 'plan'];
const BILLING_ENV =
  /^(ANTHROPIC_|CLAUDE_CODE_|CLAUDE_AGENT_SDK_)|^(CLAUDECODE|CLAUDE_PID|CLAUDE_EFFORT)$/i;

/** Exit-code-bearing failure printed to stderr. */
class CliExit extends Error {
  /** @param {number} code @param {string} message */
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

/** @param {string} text @returns {Promise<void>} */
const writeOut = (text) => new Promise((resolve) => process.stdout.write(text, () => resolve()));
/** @param {number} ms @returns {Promise<void>} */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** @param {string[]} argv */
function parse(argv) {
  try {
    return parseArgs({
      args: argv,
      allowPositionals: true,
      strict: true,
      options: {
        print: { type: 'boolean', short: 'p' },
        version: { type: 'boolean', short: 'v' },
        'input-format': { type: 'string' },
        'output-format': { type: 'string' },
        verbose: { type: 'boolean' },
        model: { type: 'string' },
        resume: { type: 'string', short: 'r' },
        'session-id': { type: 'string' },
        'fork-session': { type: 'boolean' },
        tools: { type: 'string' },
        allowedTools: { type: 'string' },
        'allowed-tools': { type: 'string' },
        disallowedTools: { type: 'string' },
        'disallowed-tools': { type: 'string' },
        'permission-mode': { type: 'string' },
        'append-system-prompt': { type: 'string' },
        'add-dir': { type: 'string', multiple: true },
        'setting-sources': { type: 'string' },
        settings: { type: 'string' },
        'strict-mcp-config': { type: 'boolean' },
        'no-session-persistence': { type: 'boolean' },
        'include-partial-messages': { type: 'boolean' },
        bare: { type: 'boolean' },
        json: { type: 'boolean' },
        text: { type: 'boolean' },
      },
    });
  } catch (error) {
    throw new CliExit(1, `error: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/** @param {boolean} asText @returns {number} exit code */
function authStatus(asText) {
  const env = process.env;
  const loggedIn =
    (env['FAKE_CLAUDE_AUTH'] ??
      (env['FAKE_CLAUDE_SCENARIO'] === 'not-logged-in' ? 'logged-out' : 'logged-in')) ===
    'logged-in';
  const common = {
    apiProvider: 'firstParty',
    analyticsDisabled: false,
    projectsDirectory: '<fake-config>/projects',
    configDirectory: '<fake-config>',
  };
  const status = loggedIn
    ? {
        loggedIn: true,
        authMethod: 'claude.ai',
        ...common,
        email: 'fake.user@example.invalid',
        orgId: '00000000-0000-4000-8000-00000000f00d',
        orgName: "fake.user@example.invalid's Organization",
        subscriptionType: env['FAKE_CLAUDE_SUBSCRIPTION'] ?? 'max',
      }
    : { loggedIn: false, authMethod: 'none', ...common };
  const withKey =
    env['ANTHROPIC_API_KEY'] === undefined
      ? status
      : { ...status, apiKeySource: 'ANTHROPIC_API_KEY' };
  const text = loggedIn
    ? 'Logged in using Claude account (fake).'
    : 'Not logged in. Run claude auth login to authenticate.';
  process.stdout.write(asText ? `${text}\n` : `${JSON.stringify(withKey, null, 2)}\n`);
  return loggedIn ? 0 : 1;
}

/** @returns {Promise<string>} */
async function readStdin() {
  /** @type {Buffer[]} */
  const chunks = [];
  for await (const chunk of process.stdin)
    chunks.push(Buffer.from(/** @type {Uint8Array} */ (chunk)));
  return Buffer.concat(chunks).toString('utf8');
}

/**
 * Tracks sessions under FAKE_CLAUDE_STATE_DIR so an unknown `--resume` id fails like the real CLI
 * (verified on 2.1.287: one `result` line with `errors`, stderr message, exit 1, no model call).
 * @param {string | undefined} resume
 * @param {string | undefined} requested
 * @param {boolean} fork
 * @returns {{ sessionId: string, missing: boolean }}
 */
function resolveSession(resume, requested, fork) {
  const stateDir = process.env['FAKE_CLAUDE_STATE_DIR'];
  if (resume !== undefined && stateDir !== undefined) {
    if (!existsSync(path.join(stateDir, 'sessions', `${resume}.json`))) {
      return { sessionId: resume, missing: true };
    }
  }
  const sessionId = resume !== undefined && !fork ? resume : (requested ?? randomUUID());
  if (stateDir !== undefined) {
    mkdirSync(path.join(stateDir, 'sessions'), { recursive: true });
    writeFileSync(path.join(stateDir, 'sessions', `${sessionId}.json`), '{"fake":true}\n', 'utf8');
  }
  return { sessionId, missing: false };
}

/** Spawns a long-lived grandchild (kill-tree tests) and records its pid. */
function spawnGrandchild() {
  const pidFile = process.env['FAKE_CLAUDE_CHILD_PID_FILE'];
  if (pidFile === undefined) return undefined;
  const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], {
    stdio: 'ignore',
    windowsHide: true,
  });
  if (child.pid !== undefined) writeFileSync(pidFile, String(child.pid), 'utf8');
  return child;
}

/** @param {Plan} plan @returns {Promise<number>} */
async function play(plan) {
  for (const file of plan.files ?? []) {
    mkdirSync(path.dirname(file.path), { recursive: true });
    writeFileSync(file.path, file.content, 'utf8');
  }
  const grandchild = spawnGrandchild();
  for (const [index, line] of plan.lines.entries()) {
    if (index > 0 && plan.lineDelayMs > 0) await sleep(plan.lineDelayMs);
    await writeOut(`${typeof line === 'string' ? line : JSON.stringify(line)}\n`);
  }
  if (plan.hang === true) {
    setInterval(() => undefined, 60_000);
    return new Promise(() => undefined);
  }
  if (plan.truncatedTail !== undefined) await writeOut(plan.truncatedTail);
  if (plan.stderr !== undefined) process.stderr.write(plan.stderr);
  const exitDelay = Number(process.env['FAKE_CLAUDE_EXIT_DELAY_MS'] ?? '0');
  if (exitDelay > 0) await sleep(exitDelay);
  grandchild?.kill();
  return plan.exitCode;
}

/** @param {string[]} argv @returns {Promise<number>} */
async function main(argv) {
  const { values, positionals } = parse(argv);
  if (values.bare === true) {
    throw new CliExit(2, 'fake-claude: --bare is forbidden in ReelForge (disables OAuth, ADR-001)');
  }
  if (values.version === true) {
    await writeOut(`${process.env['FAKE_CLAUDE_VERSION'] ?? '2.1.287'} (Claude Code)\n`);
    return 0;
  }
  if (positionals[0] === 'auth') {
    if (positionals[1] === 'status') return authStatus(values.text === true);
    throw new CliExit(2, `fake-claude: "auth ${positionals[1] ?? ''}" is not simulated`);
  }
  if (values.print !== true)
    throw new CliExit(2, 'fake-claude: interactive mode is not simulated (use -p)');
  if (values['output-format'] !== 'stream-json') {
    throw new CliExit(2, 'fake-claude: only --output-format stream-json is simulated');
  }
  if (values.verbose !== true) {
    throw new CliExit(
      1,
      'Error: When using --print, --output-format=stream-json requires --verbose',
    );
  }
  if ((values['input-format'] ?? 'text') !== 'text') {
    throw new CliExit(2, 'fake-claude: only --input-format text is simulated');
  }
  const permissionMode = values['permission-mode'];
  if (permissionMode !== undefined && !PERMISSION_MODES.includes(permissionMode)) {
    throw new CliExit(
      1,
      `error: option '--permission-mode <mode>' argument '${permissionMode}' is invalid. Allowed choices are ${PERMISSION_MODES.join(', ')}.`,
    );
  }
  const stdin = await readStdin();
  const prompt = positionals.length > 0 ? positionals.join(' ') : stdin;
  const { sessionId, missing } = resolveSession(
    values.resume,
    values['session-id'],
    values['fork-session'] === true,
  );
  if (missing) return play(sessionNotFoundPlan(sessionId));
  const step = selectStep(process.env, prompt);
  const context = {
    sessionId,
    cwd: process.cwd(),
    modelId: resolveModelId(values.model ?? 'sonnet'),
    permissionMode: permissionMode ?? 'default',
    tools: values.tools?.split(',').filter((tool) => tool !== ''),
    apiKeySource: process.env['ANTHROPIC_API_KEY'] === undefined ? 'none' : 'ANTHROPIC_API_KEY',
  };
  const plan = buildPlan(step.scenario, context, {
    reply: step.reply,
    delayMs: step.delayMs,
    ticks: step.ticks,
    limitShape: step.limitShape,
    resetsAt: step.resetsAt,
    exitCode: step.exitCode,
    resumed: values.resume !== undefined,
    writes: step.writes,
  });
  if (process.env['FAKE_CLAUDE_PROBE'] === '1') {
    plan.lines.unshift({
      type: 'fake_probe',
      argv,
      stdin,
      cwd: process.cwd(),
      scenario: step.scenario,
      claudeEnvKeys: Object.keys(process.env).filter((key) => BILLING_ENV.test(key)),
    });
  }
  return play(plan);
}

main(process.argv.slice(2)).then(
  (code) => {
    process.exitCode = code;
  },
  (/** @type {unknown} */ error) => {
    const code = error instanceof CliExit ? error.code : 1;
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = code;
  },
);
