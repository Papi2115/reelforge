/**
 * Publish kit of the open project (PLAN.md#12.17, ADR-016): reads the final storyboard, the
 * script, the YouTube suggestions (`out/metadata.json`) and the credits of the assets the scenes
 * use (`reelforge assets credits` logic) and the SEO tags and chapters (`publish/seo.json`,
 * PLAN.md#13.17, when written), builds the four paste-ready texts with the pipeline's
 * `buildPublishKit`, and on demand saves them under `publish/` (tracked) with a commit. Nothing is
 * uploaded anywhere. Electron-free.
 */
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  creditsMarkdown,
  describeUnknown,
  readCatalogue,
  sanitizeText,
  TEXT_LIMITS,
  usedAssetIds,
} from '@reelforge/cli/assets';
import {
  buildPublishKit,
  PUBLISH_DIR,
  PUBLISH_FILES,
  type PublishCredits,
  type PublishKit,
} from '@reelforge/pipeline';
import {
  projectFileSchema,
  PUBLISH_SEO_FILE,
  publishSeoFileSchema,
  storyboardFileSchema,
  wordsFileSchema,
  youtubeMetaFileSchema,
  type AssetRecord,
} from '@reelforge/shared';
import { FILES } from '@reelforge/stages';
import type {
  PublishKitResult,
  PublishKitView,
  PublishOpenResult,
  PublishSaveResult,
} from '../../shared/publish-contract.js';
import { META_FILES, templateMeta } from '../export/youtube-meta.js';
import type { Logger } from '../logger.js';
import { readProjectJson } from '../project-files.js';
import { writeTextAtomic } from '../timeline-edit-service.js';

export interface PublishServiceOptions {
  readonly currentProject: () => string | undefined;
  /** Commits the saved files (project autocommit, step `publish`); false when it failed. */
  readonly commit: (dir: string, message: string, paths: readonly string[]) => Promise<boolean>;
  readonly openPath: (folder: string) => Promise<string>;
  readonly log: Logger;
}

async function readText(file: string): Promise<string> {
  try {
    return await readFile(file, 'utf8');
  } catch {
    return ''; // no script yet: the kit falls back to the title
  }
}

/** Credits of the external assets the scenes or the storyboard use (none used: no credits). */
export async function usedCredits(dir: string): Promise<PublishCredits> {
  const records: readonly AssetRecord[] = (await readCatalogue(dir)).assets;
  const used = await usedAssetIds(
    dir,
    records.map((record) => record.id),
  );
  // The user's own files (PLAN.md#12.12) need no credit.
  const listed = records.filter((record) => used.has(record.id) && record.source !== 'own');
  return {
    markdown: creditsMarkdown(listed),
    count: listed.length,
    unverified: listed
      .filter((record) => !record.licence.verified)
      .map((record) => sanitizeText(record.title, TEXT_LIMITS.title) || record.id),
  };
}

export class PublishService {
  constructor(private readonly options: PublishServiceOptions) {}

  async kit(): Promise<PublishKitResult> {
    const dir = this.options.currentProject();
    if (dir === undefined) return { status: 'error', message: 'No project is open.' };
    try {
      const built = await this.build(dir);
      if ('message' in built) return { status: 'error', message: built.message };
      return { status: 'ok', kit: built.view };
    } catch (error) {
      return { status: 'error', message: describeUnknown(error) };
    }
  }

  async save(): Promise<PublishSaveResult> {
    const dir = this.options.currentProject();
    if (dir === undefined) return { status: 'error', message: 'No project is open.' };
    try {
      const built = await this.build(dir);
      if ('message' in built) return { status: 'error', message: built.message };
      await mkdir(path.join(dir, PUBLISH_DIR), { recursive: true });
      const files: string[] = [];
      for (const name of PUBLISH_FILES) {
        await writeTextAtomic(path.join(dir, PUBLISH_DIR, name), built.kit.files[name]);
        files.push(`${PUBLISH_DIR}/${name}`);
      }
      const committed = await this.options.commit(dir, 'Save the publish kit', files);
      this.options.log.info(`publish kit saved (${String(files.length)} files)`);
      return { status: 'saved', files, committed };
    } catch (error) {
      return { status: 'error', message: describeUnknown(error) };
    }
  }

  async openFolder(): Promise<PublishOpenResult> {
    const dir = this.options.currentProject();
    if (dir === undefined) return { status: 'error', message: 'No project is open.' };
    const folder = path.join(dir, PUBLISH_DIR);
    try {
      await mkdir(folder, { recursive: true });
    } catch (error) {
      return { status: 'error', message: describeUnknown(error) };
    }
    const problem = await this.options.openPath(folder);
    return problem === '' ? { status: 'opened' } : { status: 'error', message: problem };
  }

  private async build(
    dir: string,
  ): Promise<{ kit: PublishKit; view: PublishKitView } | { message: string }> {
    const storyboard = await readProjectJson(dir, FILES.storyboard, storyboardFileSchema);
    if (storyboard.status !== 'ok') {
      return { message: 'The publish kit needs a storyboard: run the Storyboard stage first.' };
    }
    const [project, meta, script, credits, words, seo] = await Promise.all([
      readProjectJson(dir, FILES.project, projectFileSchema),
      readProjectJson(dir, META_FILES.json, youtubeMetaFileSchema),
      readText(path.join(dir, FILES.script)),
      usedCredits(dir),
      readProjectJson(dir, FILES.words, wordsFileSchema),
      readProjectJson(dir, PUBLISH_SEO_FILE, publishSeoFileSchema),
    ]);
    const { shots } = storyboard.data;
    const title = project.status === 'ok' ? project.data.title : path.basename(dir);
    const metaFile = meta.status === 'ok' ? meta.data : null;
    const kit = buildPublishKit({
      title,
      script,
      shots,
      durationS: shots.at(-1)?.t1 ?? 0,
      meta: metaFile,
      fallbackTags: templateMeta({ title, script, chapters: null }).tags,
      credits,
      // Chapter titles from the narration at each chapter start (none yet: from shot intents).
      ...(words.status === 'ok' ? { words: words.data.words } : {}),
      seo: seo.status === 'ok' ? seo.data : null,
    });
    const view: PublishKitView = {
      files: PUBLISH_FILES.map((name) => ({ name, text: kit.files[name] })),
      chapterCount: kit.chapters.length,
      chapterProblem: kit.chapterProblem,
      unverified: [...kit.unverified],
      warnings: [...kit.warnings],
      metaSource: metaFile?.source ?? 'none',
      creditedAssets: credits.count,
    };
    return { kit, view };
  }
}
