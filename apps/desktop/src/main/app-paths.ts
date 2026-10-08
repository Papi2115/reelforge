/** Filesystem locations of the app (pure; Electron supplies the base directories). */
import path from 'node:path';
import { CHANNEL_SECRETS_FILE, CHANNELS_FILE } from '@reelforge/shared';

export const APP_NAME = 'ReelForge';
/**
 * Windows taskbar grouping / notifications identity. The installer's shortcuts carry the same id
 * (electron-builder appId), so a pinned shortcut and the running window group together.
 */
export const APP_USER_MODEL_ID = 'com.reelforge.app';
/** Overrides the user data dir in unpackaged runs (smoke tests use a temp dir). */
export const USER_DATA_ENV = 'REELFORGE_USER_DATA_DIR';
/**
 * Chromium's `--user-data-dir=<dir>` switch: honoured in every build (a separate profile, e.g. the
 * packaged-app smoke test, which must never touch the real %APPDATA%/ReelForge).
 */
export const USER_DATA_SWITCH = 'user-data-dir';

/** `%APPDATA%/ReelForge` on Windows (`~/.config/ReelForge`, `~/Library/Application Support/...`). */
export function resolveUserDataDir(
  appDataDir: string,
  env: NodeJS.ProcessEnv,
  isPackaged: boolean,
  userDataSwitch = '',
): string {
  if (userDataSwitch !== '') return path.resolve(userDataSwitch);
  const override = env[USER_DATA_ENV];
  if (!isPackaged && override !== undefined && override !== '') return path.resolve(override);
  return path.join(appDataDir, APP_NAME);
}

export interface AppLayout {
  /** Built renderer (Vite output), served as `reelforge://app/`. */
  readonly rendererDir: string;
  readonly preloadFile: string;
  /** Example scene + words for the demo preview (copied by the build scripts). */
  readonly demoDir: string;
  /** Copy of templates/project (new video projects; made by the build scripts). */
  readonly projectTemplateDir: string;
  /** Copy of the repo's styles/ with the `<id>/STYLE.md` bibles new projects get. */
  readonly stylesDir: string;
  /** Copy of templates/examples/ (the first-run example project, PLAN.md#10.3). */
  readonly examplesDir: string;
  /** Copy of docs/licenses.md (Help → About ReelForge). */
  readonly licensesFile: string;
  /** Copy of the claude-bridge's PreToolUse bash guard (passed as `permissions.hookScriptPath`). */
  readonly bashGuardHook: string;
  /** The bundled `reelforge` CLI Claude runs (behind the PATH shims, PLAN.md#5.6). */
  readonly cliBundle: string;
}

/**
 * Files other processes run or the app copies out (bash guard, CLI bundle, project template,
 * style bibles), relative to their root: `out/` in a dev build, the `resources/` folder next to
 * app.asar in the packaged app (electron-builder `extraResources`: real files, not in the asar).
 */
export const EXTERNAL_RESOURCES = {
  hooks: 'hooks',
  cli: 'cli',
  template: 'template',
} as const;

export interface AppLocation {
  /** `app.getAppPath()`: apps/desktop (dev) or `<install>/resources/app.asar` (packaged). */
  readonly appPath: string;
  /** `process.resourcesPath`; only used when packaged. */
  readonly resourcesPath: string;
  readonly isPackaged: boolean;
}

export function appLayout(location: AppLocation): AppLayout {
  const out = path.join(location.appPath, 'out');
  const external = location.isPackaged ? location.resourcesPath : out;
  const template = path.join(external, EXTERNAL_RESOURCES.template);
  return {
    rendererDir: path.join(out, 'renderer'),
    preloadFile: path.join(out, 'preload', 'preload.cjs'),
    demoDir: path.join(out, 'demo'),
    projectTemplateDir: path.join(template, 'project'),
    stylesDir: path.join(template, 'styles'),
    examplesDir: path.join(template, 'examples'),
    licensesFile: path.join(template, 'licenses.md'),
    bashGuardHook: path.join(external, EXTERNAL_RESOURCES.hooks, 'bash-guard.mjs'),
    cliBundle: path.join(external, EXTERNAL_RESOURCES.cli, 'reelforge.mjs'),
  };
}

/** Recently opened projects (start screen). */
export function recentProjectsFile(userDataDir: string): string {
  return path.join(userDataDir, 'recent-projects.json');
}

/**
 * The global asset library (PLAN.md#12.19, ADR-015): `library.json` + `files/`, shared by every
 * project, outside every project folder and outside git.
 */
export function assetLibraryDir(userDataDir: string): string {
  return path.join(userDataDir, 'library');
}

/** The channel list (PLAN.md#13.13); app data, never in a project or in git. */
export function channelsFile(userDataDir: string): string {
  return path.join(userDataDir, CHANNELS_FILE);
}

/** Encrypted channel secrets (PLAN.md#13.13): app data only, never in a project or in git. */
export function channelSecretsFile(userDataDir: string): string {
  return path.join(userDataDir, CHANNEL_SECRETS_FILE);
}

/** App settings (PLAN.md#6.7). */
export function settingsFile(userDataDir: string): string {
  return path.join(userDataDir, 'settings.json');
}

/**
 * Test hook (unpackaged runs only): the only folder searched for `claude` (instead of PATH and the
 * usual install dirs), so smoke tests can show the "not installed" wizard on any machine.
 */
export const CLAUDE_SEARCH_DIR_ENV = 'REELFORGE_TEST_CLAUDE_DIR';

/** Folder of the `reelforge` launchers put on the PATH of Claude's processes. */
export function cliShimDir(userDataDir: string): string {
  return path.join(userDataDir, 'bin');
}

/**
 * Test hook (unpackaged runs only): JSON `{ "command": "...", "args": [...] }` used as the claude
 * launcher of chat turns (smoke tests point it at tools/fake-claude; never a real model call).
 */
export const TEST_CLAUDE_LAUNCHER_ENV = 'REELFORGE_TEST_CLAUDE_LAUNCHER';

/**
 * Test hook (unpackaged runs + REELFORGE_TEST_HOOKS=1): `http://127.0.0.1:<port>` of a local asset
 * source server (`@reelforge/cli/assets-testing`) the Assets step downloads from.
 */
export const TEST_ASSET_SERVER_ENV = 'REELFORGE_TEST_ASSET_SERVER';

export function logFile(userDataDir: string): string {
  return path.join(userDataDir, 'logs', 'main.log');
}

/**
 * Test hook (unpackaged runs only): the folder the example project is copied into instead of
 * `Documents/ReelForge Projects`.
 */
export const TEST_PROJECTS_DIR_ENV = 'REELFORGE_TEST_PROJECTS_DIR';

/** `<Documents>/ReelForge Projects`: where "Open the example project" puts its copy. */
export function defaultProjectsDir(
  documentsDir: string,
  env: NodeJS.ProcessEnv,
  isPackaged: boolean,
): string {
  const override = env[TEST_PROJECTS_DIR_ENV];
  if (!isPackaged && override !== undefined && override !== '') return path.resolve(override);
  return path.join(documentsDir, `${APP_NAME} Projects`);
}
