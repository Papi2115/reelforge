/**
 * Stage prompts (PLAN.md#5.8): versioned prompt files bundled at build time, a tiny safe template
 * renderer, prompt -> bridge stage/model mapping and validators for every stage's output.
 * Evals (`src/evals`, fake-claude in CI) are test support and not exported.
 */
export const packageName = '@reelforge/prompts';

export * from './catalog.js';
export * from './characters.js';
export * from './stages.js';
export {
  formatValue,
  parseTemplate,
  renderTemplate,
  type ParsedTemplate,
  type TemplateError,
  type TemplateNode,
  type TemplateVars,
} from './template.js';
export { frontMatterSchema, parseFrontMatter, type FrontMatter } from './front-matter.js';
export * from './validators/issues.js';
export * from './validators/annotations.js';
export * from './validators/asset-needs.js';
export * from './validators/storyboard.js';
export * from './validators/rhythm.js';
export * from './validators/tension.js';
export * from './validators/shot-range.js';
export * from './validators/wow.js';
export * from './validators/continuity.js';
export * from './validators/world-transitions.js';
export * from './validators/world-variety.js';
export * from './validators/embedded-json.js';
export * from './worlds/index.js';
export * from './shot-range-vars.js';
export * from './validators/dramaturgy.js';
export * from './validators/characters.js';
export * from './validators/mascot-words.js';
export * from './validators/roles.js';
export * from './validators/script.js';
export * from './validators/critic.js';
export * from './validators/cues.js';
export * from './validators/review.js';
export * from './validators/text-outputs.js';
export * from './validators/claims.js';
export * from './validators/hooks.js';
export * from './validators/youtube-meta.js';
