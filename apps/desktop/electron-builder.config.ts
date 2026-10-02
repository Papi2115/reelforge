/**
 * electron-builder configuration of the Windows build (PLAN.md#9.3, docs/packaging.md), used by
 * scripts/packaging.ts (`pnpm package`, `pnpm dist`).
 *
 * - The packaged app is a staged folder (out/package/app: a dependency-free package.json and the
 *   built out/ files), so nothing from node_modules, sources, tests or spikes can slip in. All code
 *   is bundled by the build; there are no native modules (npmRebuild off).
 * - Files other processes run or the app copies out (bash guard hook, `reelforge` CLI bundle,
 *   project template, style bibles) are real files in resources/ (extraResources), never inside
 *   app.asar: Claude Code runs the hook and the CLI with the app binary as Node.
 * - No auto-update: no electron-updater, `publish: null`, no blockmaps.
 * - Unsigned unless CSC_LINK / CSC_KEY_PASSWORD (or Azure Trusted Signing options) are provided
 *   by whoever builds a release; see docs/packaging.md. Never commit certificates.
 */
import { rm } from 'node:fs/promises';
import path from 'node:path';
import type { AfterPackContext, Configuration } from 'electron-builder';

export const APP_ID = 'com.reelforge.app';
export const PRODUCT_NAME = 'ReelForge';
export const RELEASE_DIR = 'release';
export const BUILD_RESOURCES_DIR = 'build-resources';

/** Folders of apps/desktop/out copied next to app.asar (see AppLayout / EXTERNAL_RESOURCES). */
export const EXTRA_RESOURCE_DIRS = ['hooks', 'cli', 'template'] as const;

export interface BuilderInputs {
  /** Staged app folder (directories.app). */
  readonly stageDir: string;
  /** Unpacked Electron of node_modules/electron (no download). */
  readonly electronDist: string;
  readonly electronVersion: string;
}

export function builderConfig(inputs: BuilderInputs): Configuration {
  return {
    appId: APP_ID,
    productName: PRODUCT_NAME,
    copyright: 'Copyright © 2026 ReelForge contributors',
    electronVersion: inputs.electronVersion,
    electronDist: inputs.electronDist,
    directories: {
      app: inputs.stageDir,
      output: RELEASE_DIR,
      buildResources: BUILD_RESOURCES_DIR,
    },
    files: ['package.json', 'out/**/*', '!**/*.map'],
    asar: true,
    extraResources: EXTRA_RESOURCE_DIRS.map((dir) => ({ from: `out/${dir}`, to: dir })),
    // No native modules, nothing to install or rebuild. Resolving false tells electron-builder that
    // node_modules are handled outside it: no rebuild, and no collecting of node_modules (the staged
    // app has no dependencies; otherwise it falls back to apps/desktop's own and packs them).
    // `npmRebuild: false` is not used on purpose: it skips this hook, and the collection with it.
    beforeBuild: () => Promise.resolve(false),
    // The unpacked Electron of node_modules ships its default app; with app.asar it is never used.
    afterPack: (context: AfterPackContext) =>
      rm(path.join(context.appOutDir, 'resources', 'default_app.asar'), { force: true }),
    nodeGypRebuild: false,
    buildDependenciesFromSource: false,
    compression: 'normal',
    publish: null,
    // The UI is English (Polish videos are supported); other Chromium locales are dead weight.
    electronLanguages: ['en-US', 'pl'],
    artifactName: '${productName}-${version}-${arch}.${ext}',
    win: {
      target: [{ target: 'nsis', arch: ['x64'] }],
      icon: `${BUILD_RESOURCES_DIR}/icon.ico`,
      requestedExecutionLevel: 'asInvoker',
    },
    nsis: {
      oneClick: false,
      // Per-user install (no admin) into %LOCALAPPDATA%\Programs\ReelForge; the folder can change.
      perMachine: false,
      allowToChangeInstallationDirectory: true,
      createDesktopShortcut: true,
      createStartMenuShortcut: true,
      shortcutName: PRODUCT_NAME,
      installerIcon: `${BUILD_RESOURCES_DIR}/icon.ico`,
      uninstallerIcon: `${BUILD_RESOURCES_DIR}/icon.ico`,
      artifactName: '${productName}-Setup-${version}-${arch}.${ext}',
      // No updater: no blockmap, no elevate.exe helper.
      differentialPackage: false,
      packElevateHelper: false,
    },
  };
}
