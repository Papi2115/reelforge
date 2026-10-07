/**
 * Video project folders (PLAN.md §3.1, #6.2): create/open with zod validation and atomic writes,
 * recent projects, and the git history behind "Saved locally · git history" (autocommit after
 * pipeline steps and Claude turns, history, non-destructive revert). Electron-free.
 */
export { writeAtomic, writeJsonAtomic } from './atomic.js';
export {
  AUTOCOMMIT_KINDS,
  COMMIT_KINDS,
  formatCommitMessage,
  KIND_TRAILER,
  REVERT_TRAILER,
  STEP_ID_PATTERN,
  STEP_TRAILER,
  type AutocommitKind,
  type CommitKind,
  type HistoryKind,
} from './commit-message.js';
export { createProject, type CreateProjectOptions } from './create.js';
export {
  WORLD_PROJECT_DEFAULTS,
  worldProjectDefaults,
  type WorldProjectDefaults,
} from './world-defaults.js';
export {
  countChanges,
  DEFAULT_HISTORY_LIMIT,
  diffSummary,
  history,
  parseLog,
  type ChangeCounts,
  type DiffFile,
  type DiffSummary,
  type FileChange,
  type FileChangeStatus,
  type HistoryEntry,
} from './git-history.js';
export {
  autocommit,
  ensureIdentity,
  FALLBACK_IDENTITY,
  hasRepository,
  initRepository,
  revertFile,
  revertTo,
  type AutocommitOptions,
  type CommitResult,
  type RevertResult,
} from './git-repo.js';
export {
  isParsableJson,
  MAX_RESTORE_CANDIDATES,
  restoreFileFromHistory,
  type RestoreFileOptions,
} from './git-restore.js';
export { gitEnv, runGit, type GitOptions, type GitOutput } from './git-runner.js';
export {
  DEFAULT_LEFTOVER_AGE_MS,
  isAtomicLeftover,
  LEFTOVER_FOLDERS,
  removeAtomicLeftovers,
  type LeftoverCleanup,
} from './leftovers.js';
export {
  clearIndexLock,
  DEFAULT_LOCK_WAIT_MS,
  DEFAULT_STALE_LOCK_MS,
  indexLockPath,
} from './index-lock.js';
export {
  migrateProjectJson,
  openProject,
  parseProjectFile,
  PROJECT_MIGRATIONS,
  type OpenedProject,
  type OpenProjectOptions,
  type ProjectMigration,
} from './open.js';
export {
  DEFAULT_STYLES_DIR,
  DEFAULT_TEMPLATE_DIR,
  KEEP_FILES,
  PROJECT_FOLDERS,
  PROJECT_JSON,
  PROJECT_STYLES_DIR,
  projectFolderName,
  STYLE_BIBLE,
  toProjectRelative,
} from './paths.js';
export {
  findRecentProject,
  forgetRecentProject,
  listRecentProjects,
  MAX_RECENT_PROJECTS,
  RECENT_PROJECTS_FILE,
  rememberRecentProject,
  type RecentProject,
} from './recent.js';
export { err, ok, type ProjectError, type ProjectErrorKind, type Result } from './result.js';
