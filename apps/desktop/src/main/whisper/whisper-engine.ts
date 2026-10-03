/**
 * What the whisper setup UI shows about the engine: the usable installs (with `--version` probe:
 * version and CUDA state, cached per binary until Re-detect / an install), what Install would
 * download on this machine, builds found elsewhere, and whether Words timed can run.
 */
import type {
  DiscoveredWhisper,
  InstallStep,
  WhisperManager,
  WhisperModelId,
  WhisperProbe,
} from '@reelforge/pipeline';
import type {
  WhisperEngine,
  WhisperInstallInfo,
  WhisperPart,
  WhisperReadiness,
} from '../../shared/whisper-contract.js';

export const totalBytes = (steps: readonly InstallStep[]): number =>
  steps.reduce((sum, step) => sum + step.asset.bytes, 0);

/** `--version` probes per binary path (a CUDA build loads a 0.5 GB DLL: once is enough). */
export class WhisperProbeCache {
  private readonly probes = new Map<string, Promise<WhisperProbe>>();

  get(manager: WhisperManager, cliPath: string): Promise<WhisperProbe> {
    const key = cliPath.toLowerCase();
    let probe = this.probes.get(key);
    if (probe === undefined) {
      probe = manager.probe(cliPath);
      this.probes.set(key, probe);
    }
    return probe;
  }

  clear(): void {
    this.probes.clear();
  }
}

function installInfo(
  install: { cliPath: string; backend: string; source: WhisperInstallInfo['source'] },
  probe: WhisperProbe,
): WhisperInstallInfo {
  const { cuda } = probe;
  return {
    path: install.cliPath,
    backend: install.backend,
    source: install.source,
    version: probe.version,
    cuda: cuda.state,
    cudaReason: cuda.state === 'unavailable' || cuda.state === 'unknown' ? cuda.reason : null,
  };
}

export interface EngineStatusInput {
  readonly manager: WhisperManager;
  readonly configured: boolean;
  readonly discovered: readonly DiscoveredWhisper[];
  readonly probes: WhisperProbeCache;
}

export async function engineStatus(input: EngineStatusInput): Promise<WhisperEngine> {
  const { manager } = input;
  const located = manager.locate();
  const installs = located.ok
    ? await Promise.all(
        located.value.map(async (install) =>
          installInfo(install, await input.probes.get(manager, install.cliPath)),
        ),
      )
    : [];
  const known = new Set(installs.map((install) => install.path.toLowerCase()));
  const plan = await manager.planInstall({ engine: true, vad: false, model: null });
  return {
    installs,
    problem: located.ok ? null : located.error.message,
    configured: input.configured,
    installBackends: await manager.engineBackends(),
    installBytes: totalBytes(plan),
    existing: input.discovered
      .filter((found) => !known.has(found.cliPath.toLowerCase()))
      .map((found) => ({ path: found.cliPath, source: found.source })),
    root: manager.root,
  };
}

/** What Words timed still needs with `model` (engine only when nothing usable is found). */
export async function wordsReadiness(
  manager: WhisperManager,
  model: WhisperModelId,
): Promise<WhisperReadiness> {
  const engineFound = manager.locate().ok;
  const missing: WhisperPart[] = [];
  if (!engineFound) missing.push('engine');
  if (!manager.hasVadModel()) missing.push('vad');
  if (!manager.hasModel(model)) missing.push('model');
  const plan = await manager.planInstall({ engine: !engineFound, vad: true, model });
  return { ready: missing.length === 0, model, missing, bytes: totalBytes(plan) };
}
