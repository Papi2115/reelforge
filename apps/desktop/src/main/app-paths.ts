/** Filesystem locations of the app (pure; Electron supplies the base directories). */
import path from 'node:path';

export const APP_NAME = 'ReelForge';
/** Windows taskbar grouping / notifications identity. */
export const APP_USER_MODEL_ID = 'com.reelforge.desktop';
/** Overrides the user data dir in unpackaged runs (smoke tests use a temp dir). */
export const USER_DATA_ENV = 'REELFORGE_USER_DATA_DIR';

/** `%APPDATA%/ReelForge` on Windows (`~/.config/ReelForge`, `~/Library/Application Support/...`). */
export function resolveUserDataDir(
  appDataDir: string,
  env: NodeJS.ProcessEnv,
  isPackaged: boolean,
): string {
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
}

/** `appPath` is `app.getAppPath()`: the folder holding apps/desktop/package.json. */
export function appLayout(appPath: string): AppLayout {
  const out = path.join(appPath, 'out');
  return {
    rendererDir: path.join(out, 'renderer'),
    preloadFile: path.join(out, 'preload', 'preload.cjs'),
    demoDir: path.join(out, 'demo'),
    projectTemplateDir: path.join(out, 'template', 'project'),
  };
}

/** Recently opened projects (start screen). */
export function recentProjectsFile(userDataDir: string): string {
  return path.join(userDataDir, 'recent-projects.json');
}

export function logFile(userDataDir: string): string {
  return path.join(userDataDir, 'logs', 'main.log');
}
