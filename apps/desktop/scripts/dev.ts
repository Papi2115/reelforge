/**
 * `pnpm dev`: Vite dev server for the renderer (HMR), esbuild watch for main + preload (Electron
 * restarts when they change), Electron pointed at the dev server. Closing the window ends the
 * session; Ctrl+C kills the Electron process tree.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { createRequire } from 'node:module';
import process from 'node:process';
import { killTree } from '@reelforge/claude-bridge';
import { context, type BuildContext, type Plugin } from 'esbuild';
import { createServer } from 'vite';
import { DEV_SERVER_ENV } from '../src/main/navigation-policy.js';
import {
  copyClaudeResources,
  copyDemo,
  copyProjectTemplate,
  mainProcessBuilds,
  prepareEngineFrame,
  rendererViteConfig,
  type TaskContext,
} from './bundle.js';

const RESTART_DEBOUNCE_MS = 150;

function say(message: string): void {
  process.stdout.write(`[dev] ${message}\n`);
}

function electronBinary(): string {
  const require = createRequire(import.meta.url);
  // In Node, the `electron` package exports the path of its binary (downloaded on first use).
  const binary: unknown = require('electron');
  if (typeof binary !== 'string')
    throw new Error('the electron package did not return a binary path');
  return binary;
}

function electronEnv(devServerUrl: string): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env, [DEV_SERVER_ENV]: devServerUrl };
  // Would make Electron behave as plain Node.
  delete env['ELECTRON_RUN_AS_NODE'];
  return env;
}

export async function run(task: TaskContext): Promise<void> {
  await Promise.all([
    prepareEngineFrame(task),
    copyDemo(task),
    copyProjectTemplate(task),
    copyClaudeResources(task),
  ]);
  const server = await createServer(rendererViteConfig(task, 'development'));
  await server.listen();
  const devServerUrl = server.resolvedUrls?.local[0];
  if (devServerUrl === undefined) throw new Error('vite dev server has no local URL');
  say(`renderer dev server ${devServerUrl}`);

  const binary = electronBinary();
  let electron: ChildProcess | undefined;
  let expectedExit = false;
  let shuttingDown = false;
  let restartTimer: ReturnType<typeof setTimeout> | undefined;
  const contexts: BuildContext[] = [];

  async function stopElectron(): Promise<void> {
    const child = electron;
    electron = undefined;
    if (child?.pid === undefined || child.exitCode !== null) return;
    expectedExit = true;
    const exited = new Promise<void>((resolve) =>
      child.once('exit', () => {
        resolve();
      }),
    );
    const killed = await killTree(child.pid);
    if (!killed.ok) say(`could not kill electron: ${killed.error}`);
    await exited;
    expectedExit = false;
  }

  async function shutdown(code: number): Promise<void> {
    if (shuttingDown) return;
    shuttingDown = true;
    if (restartTimer) clearTimeout(restartTimer);
    await stopElectron();
    await Promise.all(contexts.map((buildContext) => buildContext.dispose()));
    await server.close();
    process.exitCode = code;
  }

  function startElectron(): void {
    say('starting electron');
    const child = spawn(binary, [task.appRoot], {
      cwd: task.appRoot,
      env: electronEnv(devServerUrl ?? ''),
      stdio: 'inherit',
      shell: false,
    });
    child.once('exit', (code) => {
      if (expectedExit || shuttingDown) return;
      say(`electron exited (${String(code)})`);
      void shutdown(code ?? 0);
    });
    electron = child;
  }

  function scheduleRestart(): void {
    if (restartTimer) clearTimeout(restartTimer);
    restartTimer = setTimeout(() => {
      say('main/preload changed, restarting electron');
      void stopElectron().then(() => {
        if (!shuttingDown) startElectron();
      });
    }, RESTART_DEBOUNCE_MS);
  }

  const builds = mainProcessBuilds(task);
  // Electron starts once every bundle finished its first (watch) build; later builds restart it.
  let firstBuildsPending = builds.length;
  let firstBuildsFailed = false;
  const restartOnRebuild = (): Plugin => {
    let first = true;
    return {
      name: 'reelforge-restart-electron',
      setup(build) {
        build.onEnd((result) => {
          const failed = result.errors.length > 0;
          if (failed)
            say('main/preload build failed; electron (re)starts after the next good build');
          if (first) {
            first = false;
            firstBuildsPending -= 1;
            firstBuildsFailed ||= failed;
            if (firstBuildsPending === 0 && !firstBuildsFailed) startElectron();
            return;
          }
          if (!failed) scheduleRestart();
        });
      },
    };
  };
  for (const options of builds) {
    const buildContext = await context({ ...options, plugins: [restartOnRebuild()] });
    contexts.push(buildContext);
  }
  await Promise.all(contexts.map((buildContext) => buildContext.watch()));

  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.once(signal, () => {
      void shutdown(0);
    });
  }
}
