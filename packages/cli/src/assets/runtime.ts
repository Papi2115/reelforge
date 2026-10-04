/**
 * What the asset commands run with: the source registry, the transport options and a clock
 * (all injectable through the CLI context so tests use a local server and fixed time), plus the
 * project's research settings read from project.json.
 */
import { projectFileSchema, projectResearchMode } from '@reelforge/shared';
import { ProjectError } from '../errors.js';
import { checkJsonFile } from '../project/files.js';
import { PROJECT_PATHS } from '../project/paths.js';
import type { ResearchSettings } from './guard.js';
import { urlPolicy } from './guard.js';
import { getJson, type TransportOptions } from './http.js';
import {
  createSourceRegistry,
  type SourceAdapter,
  type SourceHttp,
  type SourceRegistry,
} from './sources/index.js';

export interface AssetRuntime {
  readonly sources: SourceRegistry;
  readonly transport: TransportOptions;
  readonly now: () => Date;
}

export function defaultAssetRuntime(): AssetRuntime {
  return { sources: createSourceRegistry(), transport: {}, now: () => new Date() };
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
