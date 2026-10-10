/**
 * A Grim Ink module in Node for the step's checks (PLAN.md#14.11): loaded in a `node:vm` context,
 * read through the kit's contract and (people) run through the validators. The implementation
 * lives in the CLI (`@reelforge/cli/service`, ink/check-module.ts) so `reelforge people-preview`
 * and this step's QA report exactly the same findings (PLAN.md#14.18).
 */
export { INK_CHECK_TIMEOUT_MS, checkInkModule, type InkModuleCheck } from '@reelforge/cli/service';
