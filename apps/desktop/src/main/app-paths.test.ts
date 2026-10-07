import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  appLayout,
  assetLibraryDir,
  channelSecretsFile,
  channelsFile,
  defaultProjectsDir,
  logFile,
  recentProjectsFile,
  resolveUserDataDir,
  tasteFile,
  TEST_PROJECTS_DIR_ENV,
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
      examplesDir: path.join(out, 'template', 'examples'),
      licensesFile: path.join(out, 'template', 'licenses.md'),
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
      examplesDir: path.join(resourcesPath, 'template', 'examples'),
      licensesFile: path.join(resourcesPath, 'template', 'licenses.md'),
      bashGuardHook: path.join(resourcesPath, 'hooks', 'bash-guard.mjs'),
      cliBundle: path.join(resourcesPath, 'cli', 'reelforge.mjs'),
    });
  });
});

describe('assetLibraryDir', () => {
  it('lives in the app data folder, outside every project (PLAN.md#12.19)', () => {
    const userData = path.join(appData, 'ReelForge');
    expect(assetLibraryDir(userData)).toBe(path.join(appData, 'ReelForge', 'library'));
  });
});

describe('tasteFile', () => {
  it('lives in the app data folder, outside every project (PLAN.md#12.13)', () => {
    const userData = path.join(appData, 'ReelForge');
    expect(tasteFile(userData)).toBe(path.join(appData, 'ReelForge', 'taste.json'));
  });
});

describe('channel files', () => {
  it('live in the app data folder, outside every project (PLAN.md#13.13)', () => {
    const userData = path.join(appData, 'ReelForge');
    expect(channelsFile(userData)).toBe(path.join(userData, 'channels.json'));
    expect(channelSecretsFile(userData)).toBe(path.join(userData, 'channel-secrets.bin.json'));
  });
});

describe('defaultProjectsDir', () => {
  it('is Documents/ReelForge Projects; the test override works only unpackaged', () => {
    const documents = path.join('C:', 'Users', 'Paweł Ząb', 'Documents');
    const expected = path.join(documents, 'ReelForge Projects');
    expect(defaultProjectsDir(documents, {}, true)).toBe(expected);
    const env = { [TEST_PROJECTS_DIR_ENV]: path.join('tmp', 'example run') };
    expect(defaultProjectsDir(documents, env, false)).toBe(path.resolve('tmp', 'example run'));
    expect(defaultProjectsDir(documents, env, true)).toBe(expected);
  });
});
