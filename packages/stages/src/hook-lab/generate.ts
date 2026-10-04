/**
 * "Hook lab" generation (PLAN.md#12.16, ADR-021): one Sonnet turn with read-only tools and no web
 * (`hooks` prompt, the critic's permissions) writes three alternative openings of the finished
 * script — cold open, question, shocking fact — as JSON. The reply is validated (word counts,
 * spoken form, distinct openings, numbers in research.md); an unusable reply gets one repair turn.
 * The set is stored as `.reelforge/hooks/<n>.json`; nothing tracked changes. Electron-free.
 */
import { err, ok, type ModelAlias, type Result } from '@reelforge/claude-bridge';
import {
  hooksPromptVars,
  permissionStageFor,
  renderPrompt,
  validateHooksReply,
  type HooksReplyOptions,
} from '@reelforge/prompts';
import {
  HOOK_LAB_VERSION,
  briefFileSchema,
  projectFileSchema,
  scriptOpening,
  textFingerprint,
  type HookSet,
  type VideoLanguage,
} from '@reelforge/shared';
import type { ClaudeRunner } from '../claude.js';
import { readProjectText, requireProjectJson } from '../files.js';
import { FILES } from '../paths.js';
import { hookSetNumbers, writeHookSet } from './store.js';

export interface GenerateHooksOptions {
  readonly projectDir: string;
  readonly claude: ClaudeRunner;
  /** Sonnet unless Economy says otherwise (`promptModel('hooks', { economy })`). */
  readonly model: ModelAlias;
  readonly now: () => Date;
  readonly signal?: AbortSignal | undefined;
}

async function videoLanguage(projectDir: string): Promise<VideoLanguage> {
  const brief = await requireProjectJson(projectDir, FILES.brief, briefFileSchema);
  if (brief.ok) return brief.value.language;
  const project = await requireProjectJson(projectDir, FILES.project, projectFileSchema);
  return project.ok ? project.value.language : 'en';
}

function repairPrompt(prompt: string, reply: string, problems: readonly string[]): string {
  const lines = problems.map((line) => `- ${line}`).join('\n');
  return `${prompt}\n\nA previous answer did not pass the app's checks:\n${lines}\nPrevious answer:\n${reply}\n\nReturn the corrected JSON only.`;
}

interface Attempt {
  readonly reply: string;
  /** Set when the reply passed every check. */
  readonly variants: HookSet['variants'] | undefined;
  readonly problems: readonly string[];
  readonly warnings: readonly string[];
}

async function attempt(
  options: GenerateHooksOptions,
  prompt: string,
  checks: HooksReplyOptions,
): Promise<Result<Attempt, string>> {
  const turn = await options.claude.run(
    {
      projectDir: options.projectDir,
      stage: permissionStageFor('hooks'),
      purpose: 'qa',
      prompt,
      model: options.model,
      newSession: true,
    },
    { signal: options.signal },
  );
  if (turn.status !== 'completed') return err(`Claude: ${turn.message}`);
  const checked = validateHooksReply(turn.reply, checks);
  const lines = (severity: 'error' | 'warning'): string[] =>
    checked.issues
      .filter((entry) => entry.severity === severity)
      .map((entry) => `${entry.path ?? 'reply'}: ${entry.message} (${entry.code})`);
  const problems = lines('error');
  return ok({
    reply: turn.reply,
    variants: problems.length === 0 ? checked.value : undefined,
    problems,
    warnings: lines('warning'),
  });
}

export async function generateHooks(
  options: GenerateHooksOptions,
): Promise<Result<HookSet, string>> {
  const { projectDir } = options;
  const [script, research] = await Promise.all([
    readProjectText(projectDir, FILES.script),
    readProjectText(projectDir, FILES.research),
  ]);
  if (!script.ok) return err(script.error.message);
  if (!research.ok) return err(research.error.message);
  const scriptText = script.value ?? '';
  const opening = scriptOpening(scriptText);
  const vars = hooksPromptVars({
    script: scriptText,
    research: research.value ?? '',
    language: await videoLanguage(projectDir),
  });
  if (vars === undefined || opening === undefined) {
    return err('There is no script yet: write the script first.');
  }
  const prompt = renderPrompt('hooks', vars);
  if (!prompt.ok) return err(`The hooks prompt could not be rendered (${prompt.error.kind}).`);
  const checks = { currentOpening: opening.text, research: research.value ?? '' };
  const first = await attempt(options, prompt.value, checks);
  if (!first.ok) return first;
  // One repair turn with the problems when the first answer is unusable.
  const final =
    first.value.variants === undefined
      ? await attempt(
          options,
          repairPrompt(prompt.value, first.value.reply, first.value.problems),
          checks,
        )
      : first;
  if (!final.ok) return final;
  if (final.value.variants === undefined) {
    const problems = final.value.problems.slice(0, 3).join('; ');
    return err(`Claude's openings did not pass the checks: ${problems}`);
  }
  const numbers = await hookSetNumbers(projectDir);
  if (!numbers.ok) return err(numbers.error.message);
  const written = await writeHookSet(projectDir, {
    version: HOOK_LAB_VERSION,
    number: (numbers.value.at(-1) ?? 0) + 1,
    createdAt: options.now().toISOString(),
    opening: opening.text,
    scriptFingerprint: textFingerprint(scriptText),
    variants: final.value.variants,
    warnings: [...final.value.warnings],
  });
  return written.ok ? ok(written.value) : err(written.error.message);
}
