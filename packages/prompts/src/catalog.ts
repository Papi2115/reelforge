/**
 * The stage prompt catalogue: bundled prompt files (front matter + template) parsed once at load.
 * `renderPrompt` fills a template; `PROMPT_VERSIONS` keys caches so an edited prompt invalidates
 * whatever was produced with the old text.
 */
import { err, ok, type ModelAlias, type Result } from '@reelforge/claude-bridge';
import { parseFrontMatter } from './front-matter.js';
import { PROMPT_IDS, PROMPT_SOURCES, type PromptId } from './generated/prompt-sources.js';
import {
  parseTemplate,
  renderTemplate,
  type ParsedTemplate,
  type TemplateError,
  type TemplateVars,
} from './template.js';

export { PROMPT_IDS, type PromptId };

/** What a stage produces: files in the project, a JSON reply (critic), or a plain reply. */
export type PromptOutput =
  | { readonly kind: 'files'; readonly paths: readonly string[] }
  | { readonly kind: 'json-reply' }
  | { readonly kind: 'reply' };

export interface PromptDefinition {
  readonly id: PromptId;
  readonly version: number;
  readonly model: ModelAlias;
  /** Tools as declared in the prompt file (informational; the bridge enforces stage permissions). */
  readonly tools: readonly string[];
  readonly output: PromptOutput;
  /** Template body (without front matter). */
  readonly template: string;
}

export interface PromptVersion {
  readonly version: number;
  /** sha256 of the whole prompt file: changes with any edit, even without a version bump. */
  readonly sha256: string;
}

export interface PromptVariables {
  readonly required: readonly string[];
  readonly optional: readonly string[];
}

export type PromptError = TemplateError & { readonly promptId: PromptId };

/** Raised only for a corrupt bundle (unit tests parse every bundled prompt). */
export class PromptBundleError extends Error {
  override readonly name = 'PromptBundleError';
}

interface CompiledPrompt {
  readonly definition: PromptDefinition;
  readonly body: ParsedTemplate;
  /** Parsed output path templates (`kind: 'files'` only). */
  readonly outputs: readonly ParsedTemplate[];
}

function compileTemplate(id: PromptId, template: string): ParsedTemplate {
  const parsed = parseTemplate(template);
  if (parsed.ok) return parsed.value;
  const detail =
    parsed.error.kind === 'template-syntax'
      ? `${parsed.error.message} (line ${String(parsed.error.line)})`
      : parsed.error.kind;
  throw new PromptBundleError(`prompt ${id}: ${detail}`);
}

function toOutput(output: string | readonly string[] | undefined): PromptOutput {
  if (output === undefined) return { kind: 'reply' };
  if (output === 'json') return { kind: 'json-reply' };
  return { kind: 'files', paths: typeof output === 'string' ? [output] : output };
}

function compile(id: PromptId): CompiledPrompt {
  const split = parseFrontMatter(PROMPT_SOURCES[id].source);
  if (!split.ok) throw new PromptBundleError(`prompt ${id}: ${split.error}`);
  const { frontMatter, template } = split.value;
  if (frontMatter.id !== id) {
    throw new PromptBundleError(`prompt ${id}: front matter id is "${frontMatter.id}"`);
  }
  const output = toOutput(frontMatter.output);
  const definition: PromptDefinition = {
    id,
    version: frontMatter.version,
    model: frontMatter.model,
    tools: frontMatter.tools,
    output,
    template,
  };
  return {
    definition,
    body: compileTemplate(id, template),
    outputs: output.kind === 'files' ? output.paths.map((path) => compileTemplate(id, path)) : [],
  };
}

const COMPILED: Readonly<Record<PromptId, CompiledPrompt>> = Object.fromEntries(
  PROMPT_IDS.map((id) => [id, compile(id)]),
) as Record<PromptId, CompiledPrompt>;

/** Prompt version + content hash per stage, for cache keys and invalidation. */
export const PROMPT_VERSIONS: Readonly<Record<PromptId, PromptVersion>> = Object.fromEntries(
  PROMPT_IDS.map((id) => [
    id,
    { version: COMPILED[id].definition.version, sha256: PROMPT_SOURCES[id].sha256 },
  ]),
) as Record<PromptId, PromptVersion>;

export function isPromptId(value: string): value is PromptId {
  return (PROMPT_IDS as readonly string[]).includes(value);
}

export function loadPrompt(id: PromptId): PromptDefinition {
  return COMPILED[id].definition;
}

/** Variables the template uses (required = outside any `{{#section}}`). */
export function promptVariables(id: PromptId): PromptVariables {
  const { required, optional } = COMPILED[id].body;
  return { required, optional };
}

function withPrompt<T>(id: PromptId, result: Result<T, TemplateError>): Result<T, PromptError> {
  return result.ok ? result : err({ ...result.error, promptId: id });
}

export function renderPrompt(id: PromptId, vars: TemplateVars): Result<string, PromptError> {
  return withPrompt(id, renderTemplate(COMPILED[id].body, vars));
}

/** Project-relative output files of a `files` stage, with variables filled in. */
export function renderOutputPaths(
  id: PromptId,
  vars: TemplateVars,
): Result<readonly string[], PromptError> {
  const paths: string[] = [];
  for (const template of COMPILED[id].outputs) {
    const rendered = withPrompt(id, renderTemplate(template, vars));
    if (!rendered.ok) return rendered;
    paths.push(rendered.value);
  }
  return ok(paths);
}
