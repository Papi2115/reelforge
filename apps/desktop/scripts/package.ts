/** `pnpm package`: builds the app and the unpacked Windows app (release/win-unpacked). */
import type { TaskContext } from './bundle.js';
import { packageApp } from './packaging.js';

export function run(task: TaskContext): Promise<void> {
  return packageApp(task, 'dir');
}
