/**
 * `@reelforge/cli/assets`: the asset layer of `reelforge fetch-asset` / `reelforge assets` for the
 * pipeline stages and the app (PLAN.md#12.10): the store (catalogue, proposal packages, the app-only
 * approval), the guarded fetch, the credits text and the untrusted-text helpers. The research-mode
 * guard runs inside every network call, so callers cannot bypass it.
 */
export {
  approvedUnfetched,
  approveProposalItems,
  listProposals,
  pendingProposals,
  readCatalogue,
} from './store.js';
export { fetchAsset } from './fetch.js';
export { parseCandidateKey } from './research.js';
export { creditsMarkdown, usedAssetIds } from './credits.js';
export { defaultAssetRuntime, readResearchSettings, type AssetRuntime } from './runtime.js';
export { sanitizeText, sanitizeUrl, TEXT_LIMITS, untrustedBlock } from './untrusted.js';
export { recordLines } from './format.js';
export { loopbackAssetRuntime } from './testing/loopback.js';
export { describeUnknown } from '../errors.js';
