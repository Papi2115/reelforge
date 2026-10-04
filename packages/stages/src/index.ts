/**
 * Pipeline stage orchestration (PLAN.md §3, #7.1-7.7, #8.1, #8.3), Electron-free: the StageRunner
 * (gating, progress, limits, autocommit, invalidation) and the Script, Voiceover, Audio cleaned,
 * Words timed, Storyboard, Scenes built (QA loop, frame critics, whole-video review, sync report),
 * Sound cues and Mix stages.
 */
export const packageName = '@reelforge/stages';

export * from './assets-gate.js';
export * from './audio-tools.js';
export * from './claude.js';
export * from './gating.js';
export * from './ids.js';
export * from './invalidate.js';
export * from './paths.js';
export * from './runner.js';
export * from './settings.js';
export * from './snapshot.js';
export * from './types.js';
export { BUILT_IN_STAGES, type StageRegistry } from './stages/registry.js';
export { assetNeedLine, assetsPromptVars } from './stages/assets.js';
export {
  generateDefaultCues,
  shotGroups,
  type DefaultCuesInput,
  type GeneratedMusic,
} from './stages/default-cues.js';
export { CATEGORY_GAIN_DB, CUE_RULES, DENSITY, type CueEventKind } from './sound/cue-rules.js';
export { STYLE_MOODS, detectActs, actMoods, type FilmAct } from './sound/acts.js';
export { designSound, type SoundDesign, type SoundDesignInput } from './sound/design.js';
export { SCENE_STUB_MARKER, sceneStubSource } from './stages/scene-stub.js';
export { buildVoReport, MAX_PLAUSIBLE_WPM, MIN_PLAUSIBLE_WPM } from './stages/vo-report.js';
export { findRepetitionLoop, RETRY_DECODING } from './stages/words-quality.js';
export { loudnessProblems } from './stages/mix.js';
export * from './scenes/tools.js';
export {
  BLANK_CONTENT_SHARE,
  BLANK_DOMINANT_SHARE,
  BLANK_MAX_COLORS,
  blankFrameFindings,
  cardFindings,
  consoleFindings,
  formatFinding,
  lintFindings,
} from './scenes/checks.js';
export { contentShare } from './scenes/frame-content.js';
export {
  critiqueFrames,
  programmaticCritique,
  type Critique,
  type CritiqueInput,
  type TurnRunner,
} from './scenes/critic.js';
export { qaRound, qaSheetFile, smokeTimes, type QaResult } from './scenes/qa.js';
export { loadSceneJob, type SceneJob } from './scenes/job.js';
export {
  buildShot,
  refineShot,
  type RefineOptions,
  type ShotVariantBrief,
} from './scenes/shot-job.js';
export { readScenesReport } from './scenes/report.js';
export {
  parsePropEntry,
  PROP_BUILD_ATTEMPTS,
  projectPropNames,
  PropBuilder,
  type PropOutcome,
  type PropRequest,
} from './props/builder.js';
export { propQaRound, type PropQaResult } from './props/qa.js';
export { readPropsReport } from './props/report.js';
export {
  REVIEW_REQUESTS,
  reviewTimes,
  reviewVideo,
  type ReviewOutcome,
  type ReviewSuspect,
} from './scenes/review.js';
export {
  SYNC_NEAR_S,
  SYNC_TOLERANCE_S,
  describeSyncEvent,
  shotSync,
  shotSyncEvents,
  syncFindings,
  type ShotSyncInput,
} from './scenes/sync.js';
export { syncReport, type SyncReportOptions } from './scenes/sync-report.js';
export {
  findTextCalls,
  legibilityFindings,
  unknownKitCalls,
  unknownKitNames,
  type KitCall,
  type LegibilityRules,
  type TextCall,
} from './scenes/source-checks.js';
export {
  lockedFiles,
  propCalls,
  readLockedShots,
  readShotLocks,
  setShotsLocked,
  type LockedFile,
} from './locks.js';
export {
  discardLockedChanges,
  guardLockedFiles,
  lockViolationMessage,
  snapshotLockedFiles,
  type LockSnapshot,
} from './lock-guard.js';
export {
  VARIANT_DIRECTIONS,
  directionById,
  pickDirections,
  type VariantDirection,
} from './variants/directions.js';
export {
  readVariantSets,
  settleInterruptedVariants,
  type VariantSets,
} from './variants/current.js';
export { VARIANT_WORK_DIR, variantWorkFile } from './variants/store.js';
export { readTasteLog } from './variants/taste.js';
export {
  averageTurnSeconds,
  estimateVariants,
  type EstimateInput,
  type VariantEstimate,
} from './variants/estimate.js';
export {
  FINAL_REVIEW_QUEUE,
  finalReview,
  finalReviewWarnings,
  type FinalReviewOutcome,
} from './scenes/final-review.js';
