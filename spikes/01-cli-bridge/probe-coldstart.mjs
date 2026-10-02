// Probe: cold-start latency of `claude -p` (haiku, trivial prompt). Makes N real haiku calls (default 3).
// Usage: node spikes/01-cli-bridge/probe-coldstart.mjs [runs]

import { runClaude } from './demo.mjs';

/** @param {string} text */
const log = (text) => process.stdout.write(`${text}\n`);

async function measureOnce() {
  const started = performance.now();
  /** @type {Record<string, number>} */
  const marks = {};
  const run = runClaude({
    prompt: 'Reply with the single word ok',
    model: 'haiku',
    persistSession: false,
  });
  for await (const event of run) {
    const key =
      event['type'] === 'system' ? `system:${String(event['subtype'])}` : String(event['type']);
    if (marks[key] === undefined) marks[key] = Math.round(performance.now() - started);
    if (event['type'] === 'result') marks['api_ms'] = Number(event['duration_api_ms']);
  }
  await run.exit;
  marks['exit'] = Math.round(performance.now() - started);
  return marks;
}

async function main() {
  const runs = Number(process.argv[2] ?? '3');
  for (let index = 0; index < runs; index += 1) {
    const marks = await measureOnce();
    log(
      `run ${String(index + 1)}: init=${String(marks['system:init'])}ms firstAssistant=${String(marks['assistant'])}ms result=${String(marks['result'])}ms exit=${String(marks['exit'])}ms (api ${String(marks['api_ms'])}ms)`,
    );
  }
}

main().catch((error) => {
  process.stderr.write(`${String(error)}\n`);
  process.exitCode = 1;
});
