/**
 * Dev entry (manual use, never run by tests): runs one stage on a project with the REAL `claude`
 * CLI (subscription, sanitized env, bash guard hook), ffmpeg and whisper.cpp; scenes render in
 * headless Chromium (Playwright, SwiftShader) instead of the app's render service.
 *   pnpm --filter @reelforge/stages run-stage <project> <stage> [--source <file>] [--economy] [--no-commit]
 *     scenes: [--action build|fix-what-looks-wrong|phone-legibility|sync-check] [--shots s01,s02]
 */
import os from 'node:os';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { writeCliShims } from '@reelforge/cli/shims';
import {
  LimitGuard,
  SessionManager,
  UsageLedger,
  resolveClaudeExecutable,
} from '@reelforge/claude-bridge';
import { createPipelineAudioTools } from '../audio-tools.js';
import { BridgeClaudeRunner } from '../claude.js';
import { isStageId } from '../ids.js';
import { StageRunner } from '../runner.js';
import { DEFAULT_STAGE_SETTINGS } from '../settings.js';
import { REVIEW_MODES, type SceneAction, type StageEvent, type StageRequest } from '../types.js';
import { PlaywrightFrameRenderer } from './playwright-renderer.js';

const USAGE =
  'usage: run-stage <project> <script|voiceover|clean|words|storyboard|scenes|sound-cues|mix> [--source <file>] [--action <build|review mode>] [--shots <ids>] [--economy] [--no-commit]\n';

function isSceneAction(value: string): value is SceneAction {
  return value === 'build' || (REVIEW_MODES as readonly string[]).includes(value);
}

/** `env` with `dir` first on PATH (whatever the case of the PATH variable on Windows). */
export function envWithPathFirst(
  env: NodeJS.ProcessEnv,
  dir: string,
  platform: NodeJS.Platform,
): NodeJS.ProcessEnv {
  const key = Object.keys(env).find((name) => name.toUpperCase() === 'PATH') ?? 'PATH';
  const current = env[key];
  const delimiter = platform === 'win32' ? ';' : ':';
  return {
    ...env,
    [key]: current === undefined || current === '' ? dir : `${dir}${delimiter}${current}`,
  };
}

function print(line: string): void {
  process.stdout.write(`${line}\n`);
}

function describeEvent(event: StageEvent): string | undefined {
  switch (event.type) {
    case 'claude':
      return event.event.kind === 'tool-use' ? `  tool: ${event.event.name}` : undefined;
    case 'step':
      return `  ${event.label}${event.percent === undefined ? '' : ` (${String(event.percent)} %)`}`;
    case 'paused':
      return `  paused: ${event.message} (until ${event.until ?? 'manual resume'})`;
    case 'warning':
      return `  warning: ${event.message}`;
    case 'committed':
      return `  commit ${event.hash.slice(0, 8)}`;
    case 'failed':
      return `failed (${event.error.kind}): ${event.error.message}`;
    case 'done':
      return `done: ${event.result.message}`;
    default:
      return event.type;
  }
}

export async function main(argv: readonly string[]): Promise<number> {
  const { values, positionals } = parseArgs({
    args: [...argv],
    allowPositionals: true,
    options: {
      source: { type: 'string' },
      action: { type: 'string' },
      shots: { type: 'string' },
      economy: { type: 'boolean', default: false },
      'no-commit': { type: 'boolean', default: false },
    },
  });
  const [projectDir, stage] = positionals;
  if (projectDir === undefined || stage === undefined || !isStageId(stage)) {
    process.stderr.write(USAGE);
    return 2;
  }
  let request: StageRequest;
  if (stage === 'voiceover') {
    if (values.source === undefined) {
      process.stderr.write('voiceover needs --source <recording>\n');
      return 2;
    }
    request = { stage, source: values.source };
  } else if (stage === 'scenes') {
    const action = values.action ?? 'build';
    if (!isSceneAction(action)) {
      process.stderr.write(`unknown --action ${action}
${USAGE}`);
      return 2;
    }
    const shots = values.shots?.split(',').map((id) => id.trim());
    request = { stage, action, ...(shots === undefined ? {} : { shots }) };
  } else request = { stage };
  const executable = resolveClaudeExecutable().executable;
  const concurrency = DEFAULT_STAGE_SETTINGS.scenes.concurrency;
  const guard = new LimitGuard({ maxConcurrency: concurrency });
  const frames = new PlaywrightFrameRenderer();
  // The storyboard/scene prompts run `reelforge ...`: put the CLI on the children's PATH like the app does.
  const shimDir = path.join(os.tmpdir(), 'reelforge-run-stage-bin');
  await writeCliShims({ dir: shimDir, runtime: process.execPath });
  const manager =
    executable === undefined
      ? undefined
      : new SessionManager({
          launcher: { command: executable, args: [] },
          env: envWithPathFirst(process.env, shimDir, process.platform),
          guard,
          concurrency,
          usage: new UsageLedger(),
          permissions: { hookRuntime: process.execPath },
        });
  const runner = new StageRunner({
    projectDir,
    claude: manager === undefined ? undefined : new BridgeClaudeRunner(manager),
    audio: createPipelineAudioTools(),
    scenes: { frames },
    guard,
    settings: { ...DEFAULT_STAGE_SETTINGS, economy: values.economy },
    autocommit: !values['no-commit'],
  });
  runner.on('event', (event) => {
    const line = describeEvent(event);
    if (line !== undefined) print(line);
  });
  process.once('SIGINT', () => {
    runner.cancel();
  });
  const result = await runner.run(request);
  guard.dispose();
  await frames.close();
  return result.ok ? 0 : 1;
}
