// Minimal fake `claude` for spike tests (seed for tools/fake-claude, PLAN 5.9). Never calls a model.
// FAKE_CLAUDE_FIXTURE=<path.jsonl> -> replays the recorded stream, exits FAKE_CLAUDE_EXIT_CODE (default 0).
// otherwise -> emits one `fake_probe` event describing argv, stdin and billing-relevant env.

import { readFileSync } from 'node:fs';

const stdinChunks = [];
for await (const chunk of process.stdin) stdinChunks.push(Buffer.from(chunk));

const fixture = process.env['FAKE_CLAUDE_FIXTURE'];
if (fixture !== undefined) {
  process.stdout.write(readFileSync(fixture, 'utf8'));
  process.exitCode = Number(process.env['FAKE_CLAUDE_EXIT_CODE'] ?? '0');
} else {
  const probe = {
    type: 'fake_probe',
    argv: process.argv.slice(2),
    stdin: Buffer.concat(stdinChunks).toString('utf8'),
    leakedEnv: Object.keys(process.env).filter((key) =>
      /^(ANTHROPIC_|CLAUDE_CODE_|CLAUDECODE$)/i.test(key),
    ),
  };
  process.stdout.write(`${JSON.stringify(probe)}\nnot json\n`);
}
