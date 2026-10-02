/**
 * REAL Claude Code check of the stage permissions (PLAN.md#5.7). Spends ONE tiny haiku turn on the
 * user's subscription, so it only runs with REELFORGE_REAL_CLAUDE=1 (never in CI/default runs):
 *   REELFORGE_REAL_CLAUDE=1 pnpm --filter @reelforge/claude-bridge test permissions.real
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { buildTurnArgs } from './args.js';
import { resolveClaudeExecutable } from './executable.js';
import { auditToolUses, permissionsForStage } from './permissions.js';
import { TempDirs } from './testing/fake-claude.js';
import { startTurn } from './turn.js';
import type { StreamEvent } from './events.js';

const REAL = process.env['REELFORGE_REAL_CLAUDE'] === '1';
const temps = new TempDirs();
afterAll(() => {
  temps.cleanup();
});

describe.skipIf(!REAL)('real claude: stage permissions under dontAsk', () => {
  it('confines edits to the project and Bash to reelforge (allowlist + deny rules + hook)', async () => {
    const root = temps.make('rf real perms ');
    const projectDir = path.join(root, 'my project');
    const kitDir = path.join(root, 'kit docs');
    const outsideDir = path.join(root, 'outside');
    for (const dir of [projectDir, kitDir, outsideDir]) mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(kitDir, 'readme.txt'), 'KIT-CODE-77\n');
    const executable = resolveClaudeExecutable().executable;
    if (executable === undefined) throw new Error('claude.exe not found');
    const permissions = permissionsForStage('scene-build', projectDir, {
      kitDocsDir: kitDir,
      hookRuntime: process.execPath,
    });
    const steps = [
      `Write the file ${path.join(outsideDir, 'outside.txt')} with content X.`,
      `Write the file ${path.join(kitDir, 'kit.txt')} with content X.`,
      `Write the file ${path.join(projectDir, '.reelforge', 'inner.txt')} with content X.`,
      `Write the file ${path.join(projectDir, 'scenes', 'inside.txt')} with content X.`,
      'Run the bash command: echo pwned',
      'Run the bash command: reelforge status && echo chained',
      'Run the bash command: reelforge status',
      `Read the file ${path.join(kitDir, 'readme.txt')} and tell me its content.`,
    ];
    const prompt = `This is a permissions test. Do each step with exactly one tool call, in order, even if a previous one was denied. Never ask questions, never retry, never use another tool or path.\n${steps.map((step, index) => `${String(index + 1)}. ${step}`).join('\n')}\nFinally answer with one short line per step: the step number and ALLOWED or DENIED.`;
    const events: StreamEvent[] = [];
    const turn = startTurn({
      launcher: { command: executable, args: [] },
      args: buildTurnArgs({ model: 'haiku', ...permissions }),
      prompt,
      cwd: projectDir,
      env: process.env,
      timeoutMs: 180_000,
      onEvent: (event) => events.push(event),
    });
    const outcome = await turn.outcome;
    await turn.exited;
    const report = {
      status: outcome.status,
      text: outcome.view.text,
      denials: outcome.result?.permissionDenials.map((denial) => denial.toolName),
      toolUses: events.flatMap((event) =>
        event.kind === 'tool-use' ? [`${event.name} ${JSON.stringify(event.input)}`] : [],
      ),
      deniedEvents: events.flatMap((event) =>
        event.kind === 'permission-denied' ? [`${event.toolName}: ${event.message}`] : [],
      ),
      toolResults: events.flatMap((event) =>
        event.kind === 'tool-result'
          ? [`${String(event.isError)} ${event.text.slice(0, 160)}`]
          : [],
      ),
      files: {
        outside: existsSync(path.join(outsideDir, 'outside.txt')),
        kit: existsSync(path.join(kitDir, 'kit.txt')),
        reelforge: existsSync(path.join(projectDir, '.reelforge', 'inner.txt')),
        inside: existsSync(path.join(projectDir, 'scenes', 'inside.txt')),
      },
      unblockedViolations: auditToolUses(permissions.policy, events).filter(
        (violation) => !violation.blockedByCli,
      ),
    };
    const reportFile = process.env['REELFORGE_REAL_REPORT'];
    if (reportFile !== undefined) writeFileSync(reportFile, JSON.stringify(report, null, 2));
    expect(outcome.status).toBe('completed');
    expect(report.files).toEqual({ outside: false, kit: false, reelforge: false, inside: true });
    expect(readFileSync(path.join(projectDir, 'scenes', 'inside.txt'), 'utf8')).toContain('X');
    expect(report.unblockedViolations).toEqual([]);
    expect(report.toolResults.some((line) => /^false (pwned|chained)/m.test(line))).toBe(false);
  }, 200_000);
});
