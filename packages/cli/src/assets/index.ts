/**
 * `@reelforge/cli/assets`: the asset layer of `reelforge fetch-asset` / `reelforge assets` for the
 * pipeline stages and the app (PLAN.md#12.10): the store (catalogue, proposal packages, the app-only
 * approval), the user's own files (12.12), the global asset library (12.19), the guarded fetch,
 * the credits text and the untrusted-text helpers. The research-mode guard runs inside every
 * network call, so callers cannot bypass it.
 */
export {
  approvedUnfetched,
  approveProposalItems,
  listProposals,
  pendingProposals,
  readCatalogue,
  removeFromCatalogue,
} from './store.js';
export {
  editAssetText,
  importOwnAsset,
  OWN_ASSET_EXTENSIONS,
  type AssetTextEdit,
  type OwnImportOutcome,
} from './own.js';
export * from './library/index.js';
export { fetchAsset } from './fetch.js';
export { parseCandidateKey } from './research.js';
export { creditsMarkdown, usedAssetIds } from './credits.js';
export {
  defaultAssetRuntime,
  libraryFromEnv,
  readResearchSettings,
  type AssetLibraryAccess,
  type AssetRuntime,
} from './runtime.js';
export {
  cleanAuthor,
  sanitizeText,
  sanitizeUrl,
  TEXT_LIMITS,
  untrustedBlock,
} from './untrusted.js';
export { catalogueLine, recordLines } from './format.js';
export { loopbackAssetRuntime } from './testing/loopback.js';
export { describeUnknown } from '../errors.js';
