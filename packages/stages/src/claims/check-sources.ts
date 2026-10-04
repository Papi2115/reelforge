/**
 * "Check sources" (PLAN.md#12.18, ADR-016): one Sonnet turn with read-only tools and no web
 * (`claims` prompt, the critic's permissions) lists the script's factual claims and pins the
 * research.md links that support them; the reply is validated, unusable claims and unknown source
 * ids are dropped (an unsupported claim stays unsourced) and the result is merged with the user's
 * own sources and decisions into `claims.json`. Electron-free; the app commits the file.
 */
import { err, ok, type ModelAlias, type Result } from '@reelforge/claude-bridge';
import {
  claimsFileFromReply,
  claimsPromptVars,
  permissionStageFor,
  renderPrompt,
  validateClaimsReply,
} from '@reelforge/prompts';
import {
  claimsFileSchema,
  CLAIMS_FILE,
  claimsReport,
  mergeClaims,
  researchClaimSources,
  researchSourceExcerpts,
  scriptSentences,
  textFingerprint,
  type ClaimsFile,
  type ClaimsReport,
} from '@reelforge/shared';
import type { ClaudeRunner } from '../claude.js';
import { readProjectText, requireProjectJson, writeProjectJson } from '../files.js';
import { FILES } from '../paths.js';

export interface CheckSourcesOptions {
  readonly projectDir: string;
  readonly claude: ClaudeRunner;
  /** Sonnet unless Economy says otherwise (`promptModel('claims', { economy })`). */
  readonly model: ModelAlias;
  readonly now: () => Date;
  readonly signal?: AbortSignal | undefined;
}

export interface CheckSourcesOutcome {
  readonly file: ClaimsFile;
  readonly report: ClaimsReport;
  /** Claims or source ids of the reply that were dropped, and why. */
  readonly warnings: readonly string[];
}

/** claims.json of the project; null when there is none or it does not validate. */
export async function readClaimsFile(projectDir: string): Promise<ClaimsFile | null> {
  const read = await requireProjectJson(projectDir, CLAIMS_FILE, claimsFileSchema);
  return read.ok ? read.value : null;
}

export async function writeClaimsFile(
  projectDir: string,
  file: ClaimsFile,
): Promise<Result<void, string>> {
  const written = await writeProjectJson(projectDir, CLAIMS_FILE, claimsFileSchema, file);
  return written.ok ? ok(undefined) : err(written.error.message);
}

async function readText(projectDir: string, file: string): Promise<Result<string, string>> {
  const read = await readProjectText(projectDir, file);
  if (!read.ok) return err(read.error.message);
  return ok(read.value ?? '');
}

export async function checkSources(
  options: CheckSourcesOptions,
): Promise<Result<CheckSourcesOutcome, string>> {
  const { projectDir } = options;
  const [script, research] = await Promise.all([
    readText(projectDir, FILES.script),
    readText(projectDir, FILES.research),
  ]);
  if (!script.ok) return script;
  if (!research.ok) return research;
  const sentences = scriptSentences(script.value);
  if (sentences.length === 0) return err('There is no script yet: write the script first.');
  const sources = researchClaimSources(research.value);
  const prompt = renderPrompt(
    'claims',
    claimsPromptVars(sentences, sources, researchSourceExcerpts(research.value)),
  );
  if (!prompt.ok) return err(`The claims prompt could not be rendered (${prompt.error.kind}).`);
  const turn = await options.claude.run(
    {
      projectDir,
      stage: permissionStageFor('claims'),
      purpose: 'qa',
      prompt: prompt.value,
      model: options.model,
      newSession: true,
    },
    { signal: options.signal },
  );
  if (turn.status !== 'completed') return err(`Claude: ${turn.message}`);
  const sourceIds = new Set(sources.map((source) => source.id));
  const checked = validateClaimsReply(turn.reply, { sentences, sourceIds });
  if (checked.value === undefined) {
    const first = checked.issues.find((entry) => entry.severity === 'error');
    return err(`Claude's reply was not usable (${first?.message ?? 'invalid'}).`);
  }
  const warnings = checked.issues
    .filter((entry) => entry.severity === 'error')
    .map((entry) => `${entry.path ?? 'reply'}: ${entry.message} (dropped or fixed)`);
  const fresh = claimsFileFromReply(checked.value, {
    sentences,
    sourceIds,
    sources,
    checkedAt: options.now().toISOString(),
    scriptFingerprint: textFingerprint(script.value),
  });
  const file = mergeClaims(await readClaimsFile(projectDir), fresh);
  const written = await writeClaimsFile(projectDir, file);
  if (!written.ok) return written;
  return ok({ file, report: claimsReport(file), warnings });
}
