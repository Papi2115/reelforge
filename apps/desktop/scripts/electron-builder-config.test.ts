import { describe, expect, it } from 'vitest';
import { APP_ID, builderConfig, EXTRA_RESOURCE_DIRS } from '../electron-builder.config.js';
import { APP_USER_MODEL_ID, EXTERNAL_RESOURCES } from '../src/main/app-paths.js';

const config = builderConfig({
  stageDir: 'stage',
  electronDist: 'dist',
  electronVersion: '44.4.5',
});

describe('electron-builder config', () => {
  it('uses the app user model id as appId (taskbar grouping of installed shortcuts)', () => {
    expect(config.appId).toBe(APP_ID);
    expect(APP_ID).toBe(APP_USER_MODEL_ID);
  });

  it('ships every external resource folder the packaged layout expects', () => {
    expect([...EXTRA_RESOURCE_DIRS].sort()).toEqual(Object.values(EXTERNAL_RESOURCES).sort());
  });

  it('builds a per-user assisted NSIS installer for x64 without auto-update', () => {
    expect(config.publish).toBeNull();
    expect(config.win?.target).toEqual([{ target: 'nsis', arch: ['x64'] }]);
    expect(config.nsis).toMatchObject({
      oneClick: false,
      perMachine: false,
      allowToChangeInstallationDirectory: true,
      differentialPackage: false,
    });
    expect(config.nsis?.artifactName).toContain('${version}');
    expect(config.asar).toBe(true);
  });
});
