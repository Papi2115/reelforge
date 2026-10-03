/**
 * Stage prompts (PLAN.md#5.8): versioned prompt files bundled at build time, a tiny safe template
 * renderer, prompt -> bridge stage/model mapping and validators for every stage's output.
 * Evals (`src/evals`, fake-claude in CI) are test support and not exported.
 */
export const packageName = '@reelforge/prompts';

export * from './catalog.js';
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
export * from './validators/storyboard.js';
export * from './validators/script.js';
export * from './validators/critic.js';
export * from './validators/cues.js';
export * from './validators/review.js';
export * from './validators/text-outputs.js';
export * from './validators/youtube-meta.js';
