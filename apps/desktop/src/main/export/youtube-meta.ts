/**
 * YouTube suggestions of an export (PLAN.md#9.2): `out/metadata.json` (3 title options, a
 * description with the chapters, tags) and the same as `out/youtube.md`. "Suggest with Claude"
 * runs one Sonnet turn (`youtube-meta` prompt, a fresh side session, JSON reply validated); when
 * Claude is not available or its reply stays invalid, the deterministic template is written
 * instead. After every export the template is (re)written unless Claude's suggestion exists.
 */
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  promptModel,
  renderPrompt,
  validateYoutubeMetaReply,
  withChapters,
} from '@reelforge/prompts';
import {
  projectFileSchema,
  tagsLength,
  YOUTUBE_TAGS_TOTAL_MAX,
  youtubeMetaFileSchema,
  type AppSettings,
  type YoutubeMeta,
  type YoutubeMetaFile,
} from '@reelforge/shared';
import { FILES, type ClaudeRunner } from '@reelforge/stages';
import type { YoutubeMetaResult } from '../../shared/youtube-contract.js';
import { describeError, type Logger } from '../logger.js';
import { readProjectJson } from '../project-files.js';
import { bridgeModelOptions } from '../settings-consumers.js';
import { writeTextAtomic } from '../timeline-edit-service.js';

export const META_FILES = { json: 'out/metadata.json', markdown: 'out/youtube.md' } as const;
const MAX_SCRIPT_CHARS = 40_000;
const STOPWORDS = new Set(
  (
    'about after again also because been before being both could does doing down during each ' +
    'from have here into just like more most much only other over same should some such than ' +
    'that their them then there these they this those through very what when where which while ' +
    'with would your you will it’s that’s jest które który która przez oraz tylko także ' +
    'może jego były było będzie ponieważ kiedy gdzie właśnie'
  ).split(' '),
);

function sentences(text: string, count: number): string {
  const found = text
    .replace(/\s+/g, ' ')
    .trim()
    .match(/[^.!?]+[.!?]+/g) ?? [text];
  return found
    .slice(0, count)
    .map((sentence) => sentence.trim())
    .join(' ');
}

/** The most frequent long words of the script (deterministic order). */
export function scriptKeywords(script: string, count: number): string[] {
  const counts = new Map<string, number>();
  for (const word of script.toLowerCase().match(/\p{L}[\p{L}\p{N}'’-]{4,}/gu) ?? []) {
    if (!STOPWORDS.has(word)) counts.set(word, (counts.get(word) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, count)
    .map(([word]) => word);
}

export interface TemplateInput {
  readonly title: string;
  readonly script: string;
  readonly chapters: string | null;
}

/** Suggestions without Claude: the title, the script's opening and its keywords. */
export function templateMeta(input: TemplateInput): YoutubeMeta {
  const title = input.title.trim() || 'Untitled video';
  const keywords = scriptKeywords(input.script, 12);
  const lead = sentences(input.script, 2);
  const titles = [
    title,
    `${title}: explained`,
    keywords[0] === undefined ? `${title} in a few minutes` : `${title} (${keywords[0]})`,
  ].map((option) => option.slice(0, 100));
  const description = [lead === '' ? title : lead, input.chapters?.trim() ?? '']
    .filter((part) => part !== '')
    .join('\n\n')
    .slice(0, 5000);
  const tags = [title.toLowerCase(), ...keywords].filter(
    (tag, index, all) => all.indexOf(tag) === index,
  );
  while (tags.length > 1 && tagsLength(tags) > YOUTUBE_TAGS_TOTAL_MAX) tags.pop();
  return { titles, description, tags };
}

/** `out/youtube.md`: what to paste into YouTube Studio. */
export function youtubeMarkdown(meta: YoutubeMetaFile): string {
  const source = meta.source === 'claude' ? 'Suggested by Claude' : 'Template (no Claude)';
  return [
    '# YouTube upload text',
    '',
    `_${source}, ${meta.generatedAt}_`,
    '',
    '## Title options',
    '',
    ...meta.titles.map((title, index) => `${String(index + 1)}. ${title}`),
    '',
    '## Description',
    '',
    meta.description,
    '',
    '## Tags',
    '',
    meta.tags.join(', '),
    '',
  ].join('\n');
}

export interface YoutubeMetaServiceOptions {
  readonly currentProject: () => string | undefined;
  readonly claude: ClaudeRunner;
  readonly settings: () => AppSettings;
  readonly now: () => Date;
  readonly log: Logger;
}

async function readText(file: string): Promise<string> {
  try {
    return await readFile(file, 'utf8');
  } catch {
    return ''; // no script / chapters yet
  }
}

export class YoutubeMetaService {
  private running: AbortController | null = null;

  constructor(private readonly options: YoutubeMetaServiceOptions) {}

  async get(): Promise<YoutubeMetaFile | null> {
    const dir = this.options.currentProject();
    if (dir === undefined) return null;
    const read = await readProjectJson(dir, META_FILES.json, youtubeMetaFileSchema);
    return read.status === 'ok' ? read.data : null;
  }

  /** After an export: the template, unless Claude's suggestion is already there. */
  async ensureTemplate(dir: string): Promise<string[]> {
    const existing = await readProjectJson(dir, META_FILES.json, youtubeMetaFileSchema);
    if (existing.status === 'ok' && existing.data.source === 'claude') return [];
    await this.write(dir, 'template', templateMeta(await this.input(dir)));
    return [META_FILES.json, META_FILES.markdown];
  }

  /** One Claude turn; the template when Claude cannot help (`fallback` says why). */
  async generate(): Promise<YoutubeMetaResult> {
    const dir = this.options.currentProject();
    if (dir === undefined) return { status: 'error', message: 'No project is open.' };
    if (this.running !== null) return { status: 'error', message: 'Already writing suggestions.' };
    const controller = new AbortController();
    this.running = controller;
    try {
      const input = await this.input(dir);
      const reason = await this.fromClaude(dir, input, controller.signal);
      if (typeof reason !== 'string') return { status: 'ok', meta: reason, fallback: null };
      this.options.log.warn(`youtube-meta fallback: ${reason}`);
      const meta = await this.write(dir, 'template', templateMeta(input));
      return { status: 'ok', meta, fallback: reason };
    } catch (error) {
      return { status: 'error', message: describeError(error) };
    } finally {
      this.running = null;
    }
  }

  private async input(dir: string): Promise<TemplateInput> {
    const project = await readProjectJson(dir, FILES.project, projectFileSchema);
    const chapters = (await readText(path.join(dir, 'out', 'chapters.txt'))).trim();
    return {
      title: project.status === 'ok' ? project.data.title : path.basename(dir),
      script: (await readText(path.join(dir, FILES.script))).slice(0, MAX_SCRIPT_CHARS),
      chapters: chapters === '' ? null : chapters,
    };
  }

  /** Claude's validated suggestion (written), or why not. */
  private async fromClaude(
    dir: string,
    input: TemplateInput,
    signal: AbortSignal,
  ): Promise<YoutubeMetaFile | string> {
    const project = await readProjectJson(dir, FILES.project, projectFileSchema);
    const prompt = renderPrompt('youtube-meta', {
      title: input.title,
      language: project.status === 'ok' ? project.data.language : 'en',
      script: input.script === '' ? input.title : input.script,
      chapters: input.chapters ?? undefined,
    });
    if (!prompt.ok) return `the prompt could not be rendered (${prompt.error.kind})`;
    const turn = await this.options.claude.run(
      {
        projectDir: dir,
        stage: 'storyboard',
        purpose: 'qa',
        prompt: prompt.value,
        model: promptModel('youtube-meta', bridgeModelOptions(this.options.settings())),
        newSession: true,
      },
      { signal },
    );
    if (turn.status !== 'completed') return `Claude: ${turn.message}`;
    const checked = validateYoutubeMetaReply(turn.reply, { chapters: input.chapters });
    if (!checked.valid || checked.value === undefined) {
      const first = checked.issues.find((entry) => entry.severity === 'error');
      return `Claude's reply was not usable (${first?.message ?? 'invalid'})`;
    }
    const meta = checked.value;
    return this.write(dir, 'claude', {
      ...meta,
      description: withChapters(meta.description, input.chapters),
    });
  }

  private async write(
    dir: string,
    source: YoutubeMetaFile['source'],
    meta: YoutubeMeta,
  ): Promise<YoutubeMetaFile> {
    const file = youtubeMetaFileSchema.parse({
      version: 1,
      source,
      generatedAt: this.options.now().toISOString(),
      ...meta,
    });
    await mkdir(path.join(dir, 'out'), { recursive: true });
    await writeTextAtomic(
      path.join(dir, ...META_FILES.json.split('/')),
      `${JSON.stringify(file, null, 2)}\n`,
    );
    await writeTextAtomic(path.join(dir, ...META_FILES.markdown.split('/')), youtubeMarkdown(file));
    return file;
  }
}
