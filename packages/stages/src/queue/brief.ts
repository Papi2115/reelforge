/**
 * The production line's `brief` step (PLAN.md#13.9): topic → brief.json. The user's own brief is
 * written as it is; otherwise one Sonnet turn (`brief` prompt, read-only tools, no web) turns the
 * topic into a brief with a hook, key facts to check, tone and audience. An unusable reply gets
 * one repair turn. The target length is the user's (item or queue), never Claude's.
 */
import type { ModelAlias } from '@reelforge/claude-bridge';
import { parseEmbeddedJsonText, permissionStageFor, renderPrompt } from '@reelforge/prompts';
import {
  BRIEF_FILE_VERSION,
  briefFileSchema,
  type BriefFile,
  type QueueItem,
} from '@reelforge/shared';
import { z } from 'zod';
import type { ClaudeRunner, ClaudeTurnResult } from '../claude.js';
import { writeProjectJson } from '../files.js';
import { FILES } from '../paths.js';
import type { QueueStepOutcome } from './types.js';

export const briefReplySchema = z.object({
  topic: z.string().trim().min(20).max(1_500),
  hook: z.string().trim().min(1).max(400),
  keyFacts: z.array(z.string().trim().min(1).max(400)).min(1).max(8),
  tone: z.string().trim().min(1).max(120),
  audience: z.string().trim().min(1).max(300),
});
export type BriefReply = z.infer<typeof briefReplySchema>;

export interface QueueBriefOptions {
  readonly projectDir: string;
  readonly item: QueueItem;
  readonly targetMinutes: number;
  /** Undefined = Claude is not connected (only a user-written brief can be written). */
  readonly claude: ClaudeRunner | undefined;
  /** Sonnet unless Economy says otherwise (`promptModel('brief', { economy })`). */
  readonly model: ModelAlias;
  readonly signal: AbortSignal;
}

/** The reply's brief, or the problems that make it unusable. */
export function parseBriefReply(reply: string): { brief?: BriefReply; problems: string[] } {
  const parsed = parseEmbeddedJsonText(reply);
  if (!parsed.parsed) return { problems: ['the reply is not JSON'] };
  const checked = briefReplySchema.safeParse(parsed.value);
  if (checked.success) return { brief: checked.data, problems: [] };
  return {
    problems: checked.error.issues.map(
      (issue) => `${issue.path.map(String).join('.') || 'reply'}: ${issue.message}`,
    ),
  };
}

export function briefFromReply(
  reply: BriefReply,
  item: Pick<QueueItem, 'language'>,
  targetMinutes: number,
): BriefFile {
  const facts = reply.keyFacts.map((fact) => `- ${fact}`).join('\n');
  return {
    version: BRIEF_FILE_VERSION,
    topic: reply.topic,
    language: item.language,
    targetMinutes,
    tone: reply.tone,
    audience: reply.audience,
    notes: `Hook idea: ${reply.hook}\nKey facts to check:\n${facts}`,
  };
}

/** The user's own brief: their topic, their text as notes. */
export function briefFromUser(item: QueueItem, targetMinutes: number): BriefFile {
  return {
    version: BRIEF_FILE_VERSION,
    topic: item.topic,
    language: item.language,
    targetMinutes,
    ...(item.brief === undefined ? {} : { notes: item.brief }),
  };
}

function turnOutcome(turn: ClaudeTurnResult): QueueStepOutcome | undefined {
  switch (turn.status) {
    case 'completed':
      return undefined;
    case 'limit': {
      const resetsAt = turn.limit?.resetsAt;
      return {
        kind: 'limit',
        message: turn.message,
        until: resetsAt === undefined ? undefined : resetsAt * 1000,
      };
    }
    case 'cancelled':
      return { kind: 'cancelled' };
    case 'blocked':
      return { kind: 'blocked', message: turn.message };
    case 'failed':
      return { kind: 'failed', message: `Claude: ${turn.message}` };
  }
}

async function ask(
  options: QueueBriefOptions,
  claude: ClaudeRunner,
  prompt: string,
): Promise<{ outcome?: QueueStepOutcome; reply?: string }> {
  const turn = await claude.run(
    {
      projectDir: options.projectDir,
      stage: permissionStageFor('brief'),
      purpose: 'qa',
      prompt,
      model: options.model,
      newSession: true,
    },
    { signal: options.signal },
  );
  const outcome = turnOutcome(turn);
  return outcome === undefined ? { reply: turn.reply } : { outcome };
}

async function write(
  options: QueueBriefOptions,
  brief: BriefFile,
  message: string,
): Promise<QueueStepOutcome> {
  const written = await writeProjectJson(options.projectDir, FILES.brief, briefFileSchema, brief);
  return written.ok
    ? { kind: 'done', message }
    : { kind: 'failed', message: written.error.message };
}

export async function writeQueueBrief(options: QueueBriefOptions): Promise<QueueStepOutcome> {
  const { item, targetMinutes, claude } = options;
  if (item.brief !== undefined) {
    return write(options, briefFromUser(item, targetMinutes), 'brief from the queue');
  }
  if (claude === undefined) return { kind: 'blocked', message: 'Claude is not connected' };
  const prompt = renderPrompt('brief', {
    topic: item.topic,
    language: item.language,
    targetMinutes,
  });
  if (!prompt.ok) return { kind: 'failed', message: `the brief prompt: ${prompt.error.kind}` };
  const first = await ask(options, claude, prompt.value);
  if (first.reply === undefined) return first.outcome ?? { kind: 'failed', message: 'no reply' };
  let parsed = parseBriefReply(first.reply);
  if (parsed.brief === undefined) {
    const lines = parsed.problems.map((line) => `- ${line}`).join('\n');
    const repair = `${prompt.value}\n\nA previous answer did not pass the app's checks:\n${lines}\nPrevious answer:\n${first.reply}\n\nReturn the corrected JSON only.`;
    const second = await ask(options, claude, repair);
    if (second.reply === undefined)
      return second.outcome ?? { kind: 'failed', message: 'no reply' };
    parsed = parseBriefReply(second.reply);
  }
  if (parsed.brief === undefined) {
    return {
      kind: 'failed',
      message: `the brief did not pass the checks: ${parsed.problems.slice(0, 3).join('; ')}`,
    };
  }
  return write(options, briefFromReply(parsed.brief, item, targetMinutes), 'brief written');
}
