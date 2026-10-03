/**
 * `whisper-cli --version` probe (≈0.2 s, no model): the whisper.cpp version and whether the build's
 * CUDA backend found a device. ggml prints `ggml_cuda_init: found N CUDA devices` or
 * `ggml_cuda_init: failed to initialize CUDA: <reason>` while loading the backend, before the
 * version line; CPU/BLAS builds print no `ggml_cuda_init` line at all. A CUDA build whose GPU is
 * not available (hybrid laptop with the dGPU switched off, no driver) still runs — on the CPU,
 * slower than the OpenBLAS build — so transcription skips it instead (see gpu-plan.ts).
 */
import type { ProcessRunner } from './transcribe.js';

export type CudaState =
  /** At least one CUDA device was found. */
  | { readonly state: 'available'; readonly devices: number }
  /** CUDA build, but no usable device (`reason` as printed by ggml). */
  | { readonly state: 'unavailable'; readonly reason: string }
  /** No CUDA backend in this build. */
  | { readonly state: 'absent' }
  /** The probe itself failed (the build may still work). */
  | { readonly state: 'unknown'; readonly reason: string };

export interface WhisperProbe {
  /** `1.9.4`, or null when the build does not print it. */
  readonly version: string | null;
  readonly cuda: CudaState;
}

const PROBE_TIMEOUT_MS = 30_000;

/** Parses the combined stdout+stderr of `whisper-cli --version`. */
export function parseWhisperProbe(log: string): WhisperProbe {
  const version = /whisper\.cpp version:\s*(\S+)/.exec(log)?.[1] ?? null;
  const found = /ggml_cuda_init: found (\d+) CUDA devices?/.exec(log);
  if (found !== null) {
    const devices = Number(found[1]);
    return {
      version,
      cuda:
        devices > 0
          ? { state: 'available', devices }
          : { state: 'unavailable', reason: 'no CUDA devices found' },
    };
  }
  const failed = /ggml_cuda_init: failed to initialize CUDA: ([^\r\n]+)/.exec(log);
  if (failed !== null)
    return { version, cuda: { state: 'unavailable', reason: (failed[1] ?? '').trim() } };
  return { version, cuda: { state: 'absent' } };
}

export async function probeWhisperCli(
  run: ProcessRunner,
  cliPath: string,
  signal?: AbortSignal,
): Promise<WhisperProbe> {
  const result = await run(cliPath, ['--version'], { signal, timeoutMs: PROBE_TIMEOUT_MS });
  if (!result.ok) {
    return { version: null, cuda: { state: 'unknown', reason: result.error.message } };
  }
  return parseWhisperProbe(`${result.value.stdout}\n${result.value.stderr}`);
}
