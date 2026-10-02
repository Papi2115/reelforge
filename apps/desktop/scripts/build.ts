/** `pnpm build` (app part): renderer via Vite, main + preload via esbuild, into apps/desktop/out. */
import process from 'node:process';
import { build as esbuild } from 'esbuild';
import { build as viteBuild } from 'vite';
import {
  appPaths,
  copyClaudeResources,
  copyDemo,
  copyProjectTemplate,
  mainProcessBuilds,
  prepareEngineFrame,
  rendererViteConfig,
  type TaskContext,
} from './bundle.js';

export async function run(task: TaskContext): Promise<void> {
  await Promise.all([
    prepareEngineFrame(task),
    copyDemo(task),
    copyProjectTemplate(task),
    copyClaudeResources(task),
  ]);
  await viteBuild({ ...rendererViteConfig(task, 'production'), logLevel: 'warn' });
  await Promise.all(mainProcessBuilds(task).map((options) => esbuild(options)));
  process.stdout.write(`desktop app built -> ${appPaths(task).out}\n`);
}
