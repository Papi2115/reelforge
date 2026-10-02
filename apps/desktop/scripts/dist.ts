/** `pnpm dist`: builds the app and the NSIS installer (release/ReelForge-Setup-<version>-x64.exe). */
import type { TaskContext } from './bundle.js';
import { packageApp } from './packaging.js';

export function run(task: TaskContext): Promise<void> {
  return packageApp(task, 'nsis');
}
