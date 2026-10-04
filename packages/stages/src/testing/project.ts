/**
 * Test support (not exported from the package index): real project folders with git history in
 * temp dirs (a space and Polish letters in the path), git isolated from the developer's config,
 * and the golden eval-case files of @reelforge/prompts as stage inputs/outputs.
 */
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createProject, history, type GitOptions, type HistoryEntry } from '@reelforge/project';

export const REPO_ROOT = path.resolve(import.meta.dirname, '..', '..', '..', '..');
export const EVAL_CASE_DIR = path.join(
  REPO_ROOT,
  'packages',
  'prompts',
  'evals',
  'cases',
  'en-short-prism',
  'project',
);
export const SPIKE_AUDIO_DIR = path.join(REPO_ROOT, 'spikes', '03-audio');

/** Golden file of the `en-short-prism` eval case (project-relative path). */
export function goldenFile(relative: string): string {
  return readFileSync(path.join(EVAL_CASE_DIR, ...relative.split('/')), 'utf8');
}

export const TEMPLATE_DIR = path.join(REPO_ROOT, 'templates', 'project');

export interface CreateTestProjectOptions {
  /**
   * Tension map of the new project (PLAN.md#12.22). Default `off`: the stage tests written before
   * 2.2 script their Claude turns without the tension turn; `auto` = the real template.
   */
  readonly tensionMap?: 'auto' | 'off';
}

export class TestProjects {
  readonly root: string;
  readonly git: GitOptions;
  /** The project template with the tension map off (see CreateTestProjectOptions). */
  private readonly templateWithoutTension: string;

  constructor() {
    this.root = mkdtempSync(path.join(os.tmpdir(), 'rf stages żółw '));
    const globalConfig = path.join(this.root, 'global.gitconfig');
    writeFileSync(globalConfig, '[user]\n\tname = Stage Test\n\temail = stages@test.local\n');
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      GIT_CONFIG_GLOBAL: globalConfig,
      GIT_CONFIG_NOSYSTEM: '1',
    };
    this.git = { env };
    this.templateWithoutTension = path.join(this.root, 'template');
    mkdirSync(this.templateWithoutTension);
    cpSync(TEMPLATE_DIR, this.templateWithoutTension, { recursive: true });
    const projectJson = path.join(this.templateWithoutTension, 'project.json');
    const template = JSON.parse(readFileSync(projectJson, 'utf8')) as Record<string, unknown>;
    // Dramaturgy switches (PLAN.md#12.25-12.27) off and the classic hero without a mascot
    // (PLAN.md#12.20) too: tests opt in by editing project.json.
    const off = {
      patternInterrupts: 'off',
      openLoops: 'off',
      revealMoments: 'off',
      characters: 'classic',
      mascot: 'none',
    };
    writeFileSync(
      projectJson,
      JSON.stringify(
        { ...template, tensionMap: 'off', beatSync: 'off', repetitionControl: 'off', ...off },
        null,
        2,
      ),
    );
  }

  /** A new project (template + git), language en, with the given golden files copied in. */
  async create(
    name: string,
    golden: readonly string[] = [],
    options: CreateTestProjectOptions = {},
  ): Promise<string> {
    const dir = path.join(this.root, name);
    const created = await createProject({
      dir,
      title: 'A rainbow in a glass of water',
      language: 'en',
      seed: 1672,
      git: this.git,
      templateDir: options.tensionMap === 'auto' ? TEMPLATE_DIR : this.templateWithoutTension,
    });
    if (!created.ok) throw new Error(`createProject: ${created.error.message}`);
    for (const relative of golden) {
      cpSync(
        path.join(EVAL_CASE_DIR, ...relative.split('/')),
        path.join(dir, ...relative.split('/')),
      );
    }
    return dir;
  }

  async history(dir: string): Promise<HistoryEntry[]> {
    const entries = await history(dir, { git: this.git, limit: 100 });
    if (!entries.ok) throw new Error(`history: ${entries.error.message}`);
    return entries.value;
  }

  dispose(): void {
    rmSync(this.root, { recursive: true, force: true, maxRetries: 5 });
  }
}

export function readProject(dir: string, relative: string): string {
  return readFileSync(path.join(dir, ...relative.split('/')), 'utf8');
}

export function writeProject(dir: string, relative: string, content: string): void {
  writeFileSync(path.join(dir, ...relative.split('/')), content);
}
