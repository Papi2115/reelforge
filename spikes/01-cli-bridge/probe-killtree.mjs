// Probe (Windows): start a haiku turn that runs a long Bash command, kill the whole tree, verify no orphans.
// Usage: node spikes/01-cli-bridge/probe-killtree.mjs "<project dir>" [--plain-kill]   (ONE real haiku call)
// --plain-kill uses ChildProcess.kill() on the root only, to show what leaks without taskkill /T.

import { execFileSync } from 'node:child_process';
import { killTree, runClaude, summarize } from './demo.mjs';

/** @typedef {{ ProcessId: number, ParentProcessId: number, Name: string }} ProcessRow */

/** @returns {ProcessRow[]} */
function listProcesses() {
  const json = execFileSync(
    'powershell.exe',
    [
      '-NoProfile',
      '-Command',
      'Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId,Name | ConvertTo-Json -Compress',
    ],
    { encoding: 'utf8', windowsHide: true, maxBuffer: 16 * 1024 * 1024 },
  );
  return /** @type {ProcessRow[]} */ (JSON.parse(json));
}

/**
 * @param {number} rootPid
 * @returns {ProcessRow[]}
 */
function descendantsOf(rootPid) {
  const all = listProcesses();
  /** @type {ProcessRow[]} */
  const found = [];
  const queue = [rootPid];
  while (queue.length > 0) {
    const parent = queue.shift();
    for (const row of all) {
      if (row.ParentProcessId === parent && row.ProcessId !== parent) {
        found.push(row);
        queue.push(row.ProcessId);
      }
    }
  }
  return found;
}

/** @param {string} text */
const log = (text) => process.stdout.write(`${text}\n`);

/** @param {number} ms */
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  const cwd = process.argv[2];
  if (cwd === undefined) throw new Error('usage: node probe-killtree.mjs "<project dir>"');
  const run = runClaude({
    prompt: 'Run exactly this command with the Bash tool and wait for it: ping -n 60 127.0.0.1',
    model: 'haiku',
    cwd,
    tools: ['Bash'],
    allowedTools: ['Bash(ping *)'],
    permissionMode: 'dontAsk',
    persistSession: false,
  });
  if (run.pid === undefined) throw new Error('spawn failed');
  const rootPid = run.pid;
  log(`claude pid=${String(rootPid)}`);
  for await (const event of run) {
    log(summarize(event).slice(0, 200));
    const message = /** @type {{ content?: Array<{ type?: string }> }} */ (event['message'] ?? {});
    const usesTool = (message.content ?? []).some((block) => block.type === 'tool_use');
    if (event['type'] === 'assistant' && usesTool) {
      await delay(3000);
      const before = descendantsOf(rootPid);
      log(`descendants before kill: ${JSON.stringify(before.map((row) => row.Name))}`);
      const started = Date.now();
      const plain = process.argv.includes('--plain-kill');
      const taskkillCode = plain ? process.kill(rootPid) : await killTree(rootPid);
      const { code, signal } = await run.exit;
      log(
        `taskkill exit=${String(taskkillCode)} claude exit=${String(code)}/${String(signal)} in ${String(Date.now() - started)}ms`,
      );
      await delay(500);
      const alivePids = new Set(listProcesses().map((row) => row.ProcessId));
      const orphans = before.filter((row) => alivePids.has(row.ProcessId));
      log(`root alive=${String(alivePids.has(rootPid))} orphans=${JSON.stringify(orphans)}`);
      if (plain) for (const row of orphans) await killTree(row.ProcessId);
      break;
    }
  }
}

main().catch((error) => {
  process.stderr.write(`${String(error)}\n`);
  process.exitCode = 1;
});
