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

  it('honours --user-data-dir in every build (before the env override)', () => {
    const env = { [USER_DATA_ENV]: path.join('tmp', 'env run') };
    const profile = path.join('tmp', 'packaged smoke ż');
    expect(resolveUserDataDir(appData, env, true, profile)).toBe(path.resolve(profile));
    expect(resolveUserDataDir(appData, env, false, profile)).toBe(path.resolve(profile));
    expect(resolveUserDataDir(appData, {}, true, '')).toBe(path.join(appData, 'ReelForge'));
  });
});

describe('appLayout', () => {
  it('points into out/ next to package.json', () => {
    const appPath = path.join('C:', 'Creatorize Suite', 'apps', 'desktop');
    const out = path.join(appPath, 'out');
    expect(appLayout({ appPath, resourcesPath: 'unused', isPackaged: false })).toEqual({
      rendererDir: path.join(out, 'renderer'),
      preloadFile: path.join(out, 'preload', 'preload.cjs'),
      demoDir: path.join(out, 'demo'),
      projectTemplateDir: path.join(out, 'template', 'project'),
      stylesDir: path.join(out, 'template', 'styles'),
      bashGuardHook: path.join(out, 'hooks', 'bash-guard.mjs'),
      cliBundle: path.join(out, 'cli', 'reelforge.mjs'),
    });
    expect(recentProjectsFile(path.join(appData, 'ReelForge'))).toBe(
      path.join(appData, 'ReelForge', 'recent-projects.json'),
    );
    expect(logFile(path.join(appData, 'ReelForge'))).toBe(
      path.join(appData, 'ReelForge', 'logs', 'main.log'),
    );
  });

  it('packaged: app files from app.asar, files run or copied out from resources/', () => {
    const resourcesPath = path.join(
      'C:',
      'Users',
      'Paweł Ząb',
      'Programs',
      'ReelForge',
      'resources',
    );
    const asar = path.join(resourcesPath, 'app.asar');
    expect(appLayout({ appPath: asar, resourcesPath, isPackaged: true })).toEqual({
      rendererDir: path.join(asar, 'out', 'renderer'),
      preloadFile: path.join(asar, 'out', 'preload', 'preload.cjs'),
      demoDir: path.join(asar, 'out', 'demo'),
      projectTemplateDir: path.join(resourcesPath, 'template', 'project'),
      stylesDir: path.join(resourcesPath, 'template', 'styles'),
      bashGuardHook: path.join(resourcesPath, 'hooks', 'bash-guard.mjs'),
      cliBundle: path.join(resourcesPath, 'cli', 'reelforge.mjs'),
    });
  });
});
