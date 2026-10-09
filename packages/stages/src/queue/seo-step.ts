/**
 * The production line's "Tags and timestamps" step (PLAN.md#13.17, after the export, before the
 * publish kit so the kit's tags and chapters come from it): `generatePublishSeo` writes
 * `publish/seo.json` with one Sonnet turn, or the deterministic fallback when Claude is not
 * connected, stopped with an error, hit the usage limit or kept answering wrongly. It never fails
 * or holds a film: a fallback or a missing file is a ⚠ of the film's report. A usage limit hit
 * here pauses the bridge's guard, so the line pauses before its next step as anywhere else.
 * Shorts (`kind: 'short'`) have no tags or timestamps: the step is skipped.
 */
import type { ModelAlias } from '@reelforge/claude-bridge';
import type { SeoChannelInfo } from '@reelforge/pipeline';
import { promptModel } from '@reelforge/prompts';
import { projectFileSchema, PUBLISH_SEO_FILE, seoTagList } from '@reelforge/shared';
import type { ClaudeRunner } from '../claude.js';
import { requireProjectJson } from '../files.js';
import { FILES } from '../paths.js';
import { generatePublishSeo } from '../publish/seo.js';
import type { QueueStepContext, QueueStepOutcome } from './types.js';

/** What the app adds to the step (all optional: model by prompt, no channel, no commit). */
export interface QueueSeoSetup {
  /** Sonnet unless Economy says otherwise (`promptModel('publish-seo', { economy })`). */
  readonly model?: (() => ModelAlias) | undefined;
  /** The film's channel as the SEO turn sees it (name, genre, default tags, notes). */
  readonly channel?:
    ((projectDir: string, channelId: string) => Promise<SeoChannelInfo | null>) | undefined;
  /** Commits publish/seo.json (the app's autocommit); false when it failed. */
  readonly commit?:
    | ((projectDir: string, message: string, paths: readonly string[]) => Promise<boolean>)
    | undefined;
}

export interface QueueSeoOptions extends QueueSeoSetup {
  /** Undefined: Claude is not connected (the fallback is written). */
  readonly claude: ClaudeRunner | undefined;
  readonly now: () => Date;
}

export type QueueSeoContext = Pick<
  QueueStepContext,
  'projectDir' | 'channelId' | 'signal' | 'progress'
>;

export const SEO_SHORT_SKIPPED = 'shorts have no tags or timestamps';
export const SEO_PROGRESS = 'Writing the tags and timestamps';
const REGENERATE = 'Regenerate them in the export dialog (YouTube texts).';

async function isShortProject(projectDir: string): Promise<boolean> {
  const project = await requireProjectJson(projectDir, FILES.project, projectFileSchema);
  return project.ok && project.value.kind === 'short';
}

/** Read through a call: an await in between may have stopped the line. */
function stopped(signal: AbortSignal): boolean {
  return signal.aborted;
}

function plural(count: number, word: string): string {
  return `${String(count)} ${word}${count === 1 ? '' : 's'}`;
}

export async function runQueueSeo(
  options: QueueSeoOptions,
  ctx: QueueSeoContext,
): Promise<QueueStepOutcome> {
  const { projectDir, signal } = ctx;
  if (signal.aborted) return { kind: 'cancelled' };
  if (await isShortProject(projectDir)) return { kind: 'skipped', message: SEO_SHORT_SKIPPED };
  ctx.progress(SEO_PROGRESS);
  const generated = await generatePublishSeo({
    projectDir,
    claude: options.claude ?? null,
    model: options.model?.() ?? promptModel('publish-seo'),
    channel: (await options.channel?.(projectDir, ctx.channelId)) ?? null,
    now: options.now,
    signal,
  });
  if (stopped(signal)) return { kind: 'cancelled' };
  if (!generated.ok) {
    return {
      kind: 'done',
      message: 'tags and timestamps not written',
      warnings: [`Tags and timestamps not written: ${generated.error}`],
    };
  }
  const { file, fallbackReason, warnings } = generated.value;
  const committed =
    (await options.commit?.(projectDir, 'Write the tags and timestamps', [PUBLISH_SEO_FILE])) ??
    true;
  const counts = `${plural(seoTagList(file.tags).length, 'tag')}, ${plural(file.chapters.length, 'chapter')}`;
  return {
    kind: 'done',
    message:
      fallbackReason === null
        ? `Tags and timestamps written (${counts})`
        : `Tags and timestamps written without Claude (${counts})`,
    warnings: [
      ...(fallbackReason === null
        ? []
        : [`Tags and timestamps made without Claude (${fallbackReason}). ${REGENERATE}`]),
      ...warnings.map((line) => `Tags and timestamps: ${line}`),
      ...(committed ? [] : ['Tags and timestamps were not committed to the project history.']),
    ],
  };
}
