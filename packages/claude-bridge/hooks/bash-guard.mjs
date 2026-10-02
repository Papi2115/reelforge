#!/usr/bin/env node
// @ts-check
// Claude Code PreToolUse hook (PLAN.md#5.7): the Bash tool may only run allowlisted commands
// (argv: allowed command names, e.g. `reelforge`). Claude Code auto-approves "read-only" shell
// commands such as `echo`/`cat` even under `--permission-mode dontAsk` with a narrow allowlist
// (verified on 2.1.287), so the allowlist alone does not confine Bash; this hook does.
// Protocol: JSON on stdin; exit 0 = no objection, exit 2 = block (stderr goes to the model).
// Keep in sync with `checkBash` in src/permissions.ts.

const SHELL_METACHARACTERS = /[;&|`<>\n\r]|\$\(/;

/** @returns {Promise<string>} */
async function readStdin() {
  /** @type {Buffer[]} */
  const chunks = [];
  for await (const chunk of process.stdin)
    chunks.push(Buffer.from(/** @type {Uint8Array} */ (chunk)));
  return Buffer.concat(chunks).toString('utf8');
}

/**
 * @param {unknown} payload
 * @param {readonly string[]} allowed
 * @returns {string | undefined} block reason
 */
function bashBlockReason(payload, allowed) {
  if (typeof payload !== 'object' || payload === null)
    return 'ReelForge bash guard: unreadable hook input';
  const record = /** @type {Record<string, unknown>} */ (payload);
  if (record['tool_name'] !== 'Bash') return undefined;
  const input = record['tool_input'];
  const command =
    typeof input === 'object' && input !== null
      ? /** @type {Record<string, unknown>} */ (input)['command']
      : undefined;
  if (typeof command !== 'string') return 'ReelForge bash guard: Bash call without a command';
  const trimmed = command.trim();
  if (SHELL_METACHARACTERS.test(trimmed)) {
    return `ReelForge bash guard: shell operators are blocked (; & | > < \` $( newline). Run one plain command: ${allowed.join(', ')} <args>.`;
  }
  const name = trimmed.split(/\s+/)[0] ?? '';
  return allowed.includes(name)
    ? undefined
    : `ReelForge bash guard: only these commands are allowed in Bash: ${allowed.join(', ')}. "${name}" is blocked.`;
}

async function main() {
  const allowed = process.argv.slice(2);
  /** @type {unknown} */
  let payload;
  try {
    payload = JSON.parse(await readStdin());
  } catch (error) {
    process.stderr.write(`ReelForge bash guard: invalid hook input (${String(error)})\n`);
    return 2;
  }
  const reason = bashBlockReason(payload, allowed);
  if (reason === undefined) return 0;
  process.stderr.write(`${reason}\n`);
  return 2;
}

main().then(
  (code) => {
    process.exitCode = code;
  },
  (/** @type {unknown} */ error) => {
    process.stderr.write(`ReelForge bash guard failed: ${String(error)}\n`);
    process.exitCode = 2;
  },
);
