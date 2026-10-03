/**
 * Which whisper-cli runs a transcription tries, in order. GPU-capable builds (the app's CUDA build,
 * a user's own build) are probed first (`--version`, see probe.ts): when CUDA finds no device the
 * GPU run is not attempted — the CUDA build would silently decode on the CPU, slower than the
 * OpenBLAS build — and the reason is recorded as a fallback so the app can tell the user why the
 * transcription was slow. Otherwise a failing GPU run is retried with `-ng`, then the next install.
 */
import type { WhisperAttemptFailure } from './errors.js';
import type { WhisperInstall } from './locate.js';
import { probeWhisperCli } from './probe.js';
import type { ProcessRunner } from './transcribe.js';
import type { WordsRaw } from '../schemas/words.js';

export interface Attempt {
  readonly install: WhisperInstall;
  readonly noGpu: boolean;
}

export interface GpuAwarePlan {
  readonly attempts: readonly Attempt[];
  /** GPU runs left out because CUDA found no device (recorded in `words.raw.json` fallbacks). */
  readonly skipped: readonly WhisperAttemptFailure[];
}

const gpuCapable = (install: WhisperInstall): boolean =>
  install.backend === 'cuda' || install.backend === 'custom';

export async function gpuAwarePlan(
  installs: readonly WhisperInstall[],
  run: ProcessRunner,
  signal: AbortSignal | undefined,
): Promise<GpuAwarePlan> {
  const attempts: Attempt[] = [];
  const skipped: WhisperAttemptFailure[] = [];
  for (const [index, install] of installs.entries()) {
    if (!gpuCapable(install)) {
      attempts.push({ install, noGpu: false });
      continue;
    }
    const { cuda } = await probeWhisperCli(run, install.cliPath, signal);
    if (cuda.state === 'available' || cuda.state === 'unknown') {
      attempts.push({ install, noGpu: false }, { install, noGpu: true });
    } else if (cuda.state === 'absent') {
      attempts.push({ install, noGpu: false });
    } else {
      skipped.push({
        backend: install.backend,
        gpu: true,
        message: `CUDA unavailable: ${cuda.reason}`,
      });
      // The app's CUDA build on the CPU is slower than the OpenBLAS build that follows it.
      const lastResort = index === installs.length - 1;
      if (install.backend === 'custom' || lastResort) attempts.push({ install, noGpu: true });
    }
  }
  return { attempts, skipped };
}

/**
 * Why a finished transcription ran on the CPU although a GPU-capable build was tried (CUDA found
 * no device, the GPU run crashed, the CUDA build silently used the CPU); null when it ran on the
 * GPU or only CPU builds are installed (nothing to fix then).
 */
export function cpuFallbackReason(
  raw: Pick<WordsRaw, 'backend' | 'usedGpu' | 'fallbacks'>,
): string | null {
  if (raw.usedGpu) return null;
  const gpuFailure = raw.fallbacks.find(
    (failure) => failure.gpu && (failure.backend === 'cuda' || failure.backend === 'custom'),
  );
  if (gpuFailure !== undefined) return gpuFailure.message;
  return raw.backend === 'cuda' ? 'the CUDA build did not use the GPU' : null;
}
