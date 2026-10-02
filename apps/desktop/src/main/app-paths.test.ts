import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  appLayout,
  logFile,
  recentProjectsFile,
  resolveUserDataDir,
  USER_DATA_ENV,
} from './app-paths.js';

const appData = path.join('C:', 'Users', 'Paweł Ząb', 'AppData', 'Roaming');

describe('resolveUserDataDir', () => {
  it('lives in %APPDATA%/ReelForge', () => {
    expect(resolveUserDataDir(appData, {}, false)).toBe(path.join(appData, 'ReelForge'));
  });

  it('honours the override only in unpackaged runs', () => {
    const env = { [USER_DATA_ENV]: path.join('tmp', 'smoke run') };
    expect(resolveUserDataDir(appData, env, false)).toBe(path.resolve('tmp', 'smoke run'));
    expect(resolveUserDataDir(appData, env, true)).toBe(path.join(appData, 'ReelForge'));
    expect(resolveUserDataDir(appData, { [USER_DATA_ENV]: '' }, false)).toBe(
      path.join(appData, 'ReelForge'),
    );
  });
});

describe('appLayout', () => {
  it('points into out/ next to package.json', () => {
    const appPath = path.join('C:', 'Creatorize Suite', 'apps', 'desktop');
    expect(appLayout(appPath)).toEqual({
      rendererDir: path.join(appPath, 'out', 'renderer'),
      preloadFile: path.join(appPath, 'out', 'preload', 'preload.cjs'),
      demoDir: path.join(appPath, 'out', 'demo'),
      projectTemplateDir: path.join(appPath, 'out', 'template', 'project'),
      bashGuardHook: path.join(appPath, 'out', 'resources', 'bash-guard.mjs'),
      cliBundle: path.join(appPath, 'out', 'cli', 'reelforge.mjs'),
    });
    expect(recentProjectsFile(path.join(appData, 'ReelForge'))).toBe(
      path.join(appData, 'ReelForge', 'recent-projects.json'),
    );
    expect(logFile(path.join(appData, 'ReelForge'))).toBe(
      path.join(appData, 'ReelForge', 'logs', 'main.log'),
    );
  });
});
