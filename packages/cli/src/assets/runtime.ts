/**
 * What the asset commands run with: the source registry, the transport options and a clock
 * (all injectable through the CLI context so tests use a local server and fixed time), plus the
 * project's research settings read from project.json.
 */
import path from 'node:path';
import { projectFileSchema, projectResearchMode } from '@reelforge/shared';
import { ProjectError } from '../errors.js';
import { checkJsonFile } from '../project/files.js';
import { PROJECT_PATHS } from '../project/paths.js';
import type { ResearchSettings } from './guard.js';
import { urlPolicy } from './guard.js';
import { getJson, type TransportOptions } from './http.js';
import { ASSET_LIBRARY_ENV } from './library/store.js';
import {
  createSourceRegistry,
  type SourceAdapter,
  type SourceHttp,
  type SourceRegistry,
} from './sources/index.js';

/** The global asset library (PLAN.md#12.19) as the asset layer may use it. */
export interface AssetLibraryAccess {
  /** Library folder (`<app data>/library`). */
  readonly dir: string;
  /** Save downloaded, approved / verified assets into it automatically (app setting; stages). */
  readonly saveDownloaded: () => boolean;
}

export interface AssetRuntime {
  readonly sources: SourceRegistry;
  readonly transport: TransportOptions;
  readonly now: () => Date;
  /** Absent: no library (outside the app, unless REELFORGE_ASSET_LIBRARY names one). */
  readonly library?: AssetLibraryAccess | undefined;
}

/** The library the app named for Claude's processes (an absolute folder), else undefined. */
export function libraryFromEnv(env: NodeJS.ProcessEnv): AssetLibraryAccess | undefined {
  const dir = env[ASSET_LIBRARY_ENV] ?? '';
  return dir !== '' && path.isAbsolute(dir) ? { dir, saveDownloaded: () => false } : undefined;
}

export function defaultAssetRuntime(env: NodeJS.ProcessEnv = process.env): AssetRuntime {
  return {
    sources: createSourceRegistry(),
    transport: {},
    now: () => new Date(),
    library: libraryFromEnv(env),
  };
}

/**
 * The research settings of the project in `root`. No project.json = `off` (zero network); an
 * invalid one is a project error (`reelforge validate` explains it).
 */
export async function readResearchSettings(root: string): Promise<ResearchSettings> {
  const project = await checkJsonFile(root, PROJECT_PATHS.project, projectFileSchema);
  if (project.status === 'missing') return { mode: 'off', sources: [] };
  if (project.status === 'invalid') {
    throw new ProjectError(
      'project.json is invalid, so the research mode is unknown',
      'run `reelforge validate` and ask the user to fix project.json',
    );
  }
  return {
    mode: projectResearchMode(project.data),
    sources: project.data.researchSources ?? [],
  };
}

/** JSON access of one source under the research settings. */
export function sourceHttp(
  settings: ResearchSettings,
  adapter: SourceAdapter,
  transport: TransportOptions,
): SourceHttp {
  const policy = urlPolicy(settings, adapter);
  return { json: (url) => getJson(url, policy, transport) };
}
