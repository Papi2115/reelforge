/**
 * "Tags and timestamps" of the publish kit (PLAN.md#13.17): one Sonnet turn with read-only tools
 * and no web (`publish-seo` prompt, the critic's permissions) writes the film's 15 SEO tags and
 * 5–8 chapters from its texts, its cuts and its channel's niche. The reply is validated; an
 * unusable one gets one repair turn (no questions). When Claude is unavailable or its answers stay
 * invalid, the deterministic fallback (script keywords + the channel's umbrella phrases, planned
 * chapters) is written instead, so publishing never waits. `publish/seo.json` is written
 * atomically; the app commits it. Electron-free.
 */
import { err, ok, type ModelAlias, type Result } from '@reelforge/claude-bridge';
import { fallbackPublishSeo, seoChapterCandidates, type SeoChannelInfo } from '@reelforge/pipeline';
import {
  permissionStageFor,
  publishSeoPromptVars,
  renderPrompt,
  validatePublishSeoReply,
  type PublishSeoReplyOptions,
} from '@reelforge/prompts';
import {
  findGenrePreset,
  projectFileSchema,
  PUBLISH_SEO_FILE,
  PUBLISH_SEO_VERSION,
  publishSeoFileSchema,
  storyboardFileSchema,
  wordsFileSchema,
  type PublishSeo,
  type PublishSeoFile,
} from '@reelforge/shared';
import type { ClaudeRunner } from '../claude.js';
import { readProjectText, requireProjectJson, writeProjectJson } from '../files.js';
import { FILES } from '../paths.js';

export interface GeneratePublishSeoOptions {
  readonly projectDir: string;
  /** null: Claude is not available (the fallback is written). */
  readonly claude: ClaudeRunner | null;
  /** Sonnet unless Economy says otherwise (`promptModel('publish-seo', { economy })`). */
  readonly model: ModelAlias;
  /** The project's channel (name, genre, default tags, notes); null: none known. */
  readonly channel: SeoChannelInfo | null;
  readonly now: () => Date;
  readonly signal?: AbortSignal | undefined;
}

export interface PublishSeoOutcome {
  readonly file: PublishSeoFile;
  /** Why Claude's answer was not used (null when it was). */
  readonly fallbackReason: string | null;
  readonly warnings: readonly string[];
}

/** publish/seo.json of the project; null when there is none or it does not validate. */
export async function readPublishSeo(projectDir: string): Promise<PublishSeoFile | null> {
  const read = await requireProjectJson(projectDir, PUBLISH_SEO_FILE, publishSeoFileSchema);
  return read.ok ? read.value : null;
}

interface SeoFilm {
  readonly title: string;
  readonly script: string;
  readonly beats: string;
  readonly research: string;
  readonly durationS: number;
  readonly shots: Parameters<typeof seoChapterCandidates>[0];
  readonly words: Parameters<typeof seoChapterCandidates>[1];
  readonly channel: SeoChannelInfo | null;
}

async function text(projectDir: string, file: string): Promise<string> {
  const read = await readProjectText(projectDir, file);
  return read.ok ? (read.value ?? '') : '';
}

/** The film's texts, cuts and words; the project's genre preset wins over the channel's. */
async function readFilm(options: GeneratePublishSeoOptions): Promise<Result<SeoFilm, string>> {
  const dir = options.projectDir;
  const storyboard = await requireProjectJson(dir, FILES.storyboard, storyboardFileSchema);
  if (!storyboard.ok) {
    return err('Tags and timestamps need a storyboard: run the Storyboard stage first.');
  }
  const [project, words, script, beats, research] = await Promise.all([
    requireProjectJson(dir, FILES.project, projectFileSchema),
    requireProjectJson(dir, FILES.words, wordsFileSchema),
    text(dir, FILES.script),
    text(dir, FILES.beats),
    text(dir, FILES.research),
  ]);
  const genre = (project.ok ? project.value.genrePreset : undefined) ?? options.channel?.genre;
  const preset = findGenrePreset(genre);
  const channel: SeoChannelInfo | null =
    options.channel === null && preset === undefined
      ? null
      : {
          ...options.channel,
          genre: genre ?? undefined,
          genreName: preset?.name ?? options.channel?.genreName,
        };
  const { shots } = storyboard.value;
  return ok({
    title: project.ok ? project.value.title : '',
    script,
    beats,
    research,
    durationS: shots.at(-1)?.t1 ?? 0,
    shots,
    words: words.ok ? words.value.words : [],
    channel,
  });
}

function repairPrompt(prompt: string, reply: string, problems: readonly string[]): string {
  const lines = problems.map((line) => `- ${line}`).join('\n');
  return `${prompt}\n\nA previous answer did not pass the app's checks:\n${lines}\nPrevious answer:\n${reply}\n\nFix every problem without asking questions and return the corrected JSON only.`;
}

type Attempt =
  | { readonly kind: 'valid'; readonly seo: PublishSeo; readonly warnings: readonly string[] }
  | { readonly kind: 'invalid'; readonly reply: string; readonly problems: readonly string[] }
  | { readonly kind: 'unavailable'; readonly message: string };

async function attempt(
  options: GeneratePublishSeoOptions,
  claude: ClaudeRunner,
  prompt: string,
  checks: PublishSeoReplyOptions,
): Promise<Attempt> {
  const turn = await claude.run(
    {
      projectDir: options.projectDir,
      stage: permissionStageFor('publish-seo'),
      purpose: 'qa',
      prompt,
      model: options.model,
      newSession: true,
    },
    { signal: options.signal },
  );
  if (turn.status !== 'completed')
    return { kind: 'unavailable', message: `Claude: ${turn.message}` };
  const checked = validatePublishSeoReply(turn.reply, checks);
  const lines = (severity: 'error' | 'warning'): string[] =>
    checked.issues
      .filter((entry) => entry.severity === severity)
      .map((entry) => `${entry.path ?? 'reply'}: ${entry.message} (${entry.code})`);
  return checked.valid && checked.value !== undefined
    ? { kind: 'valid', seo: checked.value, warnings: lines('warning') }
    : { kind: 'invalid', reply: turn.reply, problems: lines('error') };
}

/** Claude's tags in the file's form: lower case, single spaces. */
function tidy(seo: PublishSeo): PublishSeo {
  const clean = (tags: readonly string[]): string[] =>
    tags.map((tag) => tag.replace(/\s+/g, ' ').trim().toLowerCase());
  return {
    ...seo,
    tags: {
      oneWord: clean(seo.tags.oneWord),
      twoWord: clean(seo.tags.twoWord),
      threeWord: clean(seo.tags.threeWord),
    },
  };
}

/** Claude's tags and chapters (one repair turn), or why there are none. */
async function fromClaude(
  options: GeneratePublishSeoOptions,
  film: SeoFilm,
): Promise<{ seo: PublishSeo; warnings: readonly string[] } | { reason: string }> {
  if (options.claude === null) return { reason: 'Claude is not available.' };
  const candidates = seoChapterCandidates(film.shots, film.words, film.durationS);
  const vars = publishSeoPromptVars({ ...film, candidates });
  const prompt = renderPrompt('publish-seo', vars);
  if (!prompt.ok) return { reason: `The prompt could not be rendered (${prompt.error.kind}).` };
  const checks = { durationS: film.durationS, candidates: candidates.map((entry) => entry.t) };
  let result = await attempt(options, options.claude, prompt.value, checks);
  if (result.kind === 'invalid') {
    result = await attempt(
      options,
      options.claude,
      repairPrompt(prompt.value, result.reply, result.problems),
      checks,
    );
  }
  if (result.kind === 'valid') return { seo: tidy(result.seo), warnings: result.warnings };
  if (result.kind === 'unavailable') return { reason: result.message };
  return {
    reason: `Claude's answer did not pass the checks: ${result.problems.slice(0, 3).join('; ')}`,
  };
}

export async function generatePublishSeo(
  options: GeneratePublishSeoOptions,
): Promise<Result<PublishSeoOutcome, string>> {
  const film = await readFilm(options);
  if (!film.ok) return film;
  const claude = await fromClaude(options, film.value);
  const usedClaude = 'seo' in claude;
  const seo = usedClaude ? claude.seo : fallbackPublishSeo(film.value);
  const file: PublishSeoFile = {
    version: PUBLISH_SEO_VERSION,
    source: usedClaude ? 'claude' : 'fallback',
    generatedAt: options.now().toISOString(),
    ...(usedClaude ? { model: options.model } : {}),
    ...seo,
  };
  const written = await writeProjectJson(
    options.projectDir,
    PUBLISH_SEO_FILE,
    publishSeoFileSchema,
    file,
  );
  if (!written.ok) return err(written.error.message);
  return ok({
    file: written.value,
    fallbackReason: usedClaude ? null : claude.reason,
    warnings: usedClaude ? claude.warnings : [],
  });
}
