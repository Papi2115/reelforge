/**
 * Test support: temp folders with a space and Polish letters in the path, and git isolated from
 * the developer's global/system config (so identity fallback and CRLF settings are reproducible).
 */
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { GitOptions } from '../git-runner.js';

export interface GitSandbox {
  /** Parent folder for test projects. */
  readonly root: string;
  readonly git: GitOptions;
  dispose(): Promise<void>;
}

export async function createGitSandbox(
  options: { readonly identity?: { readonly name: string; readonly email: string } } = {},
): Promise<GitSandbox> {
  const root = await mkdtemp(path.join(tmpdir(), 'reelforge projekt żółw-'));
  const globalConfig = path.join(root, 'global.gitconfig');
  const identity = options.identity;
  await writeFile(
    globalConfig,
    identity === undefined
      ? ''
      : `[user]\n\tname = ${identity.name}\n\temail = ${identity.email}\n`,
  );
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    GIT_CONFIG_GLOBAL: globalConfig,
    GIT_CONFIG_NOSYSTEM: '1',
  };
  // A developer's environment must not leak an identity into the "no identity" case.
  for (const name of [
    'GIT_AUTHOR_NAME',
    'GIT_AUTHOR_EMAIL',
    'GIT_COMMITTER_NAME',
    'GIT_COMMITTER_EMAIL',
    'EMAIL',
  ]) {
    Reflect.deleteProperty(env, name);
  }
  return {
    root,
    git: { env },
    dispose: () => rm(root, { recursive: true, force: true, maxRetries: 5 }),
  };
}
