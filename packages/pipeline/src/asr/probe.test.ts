import { describe, expect, it } from 'vitest';
import { cpuFallbackReason } from './gpu-plan.js';
import { parseWhisperProbe } from './probe.js';

/** `whisper-cli --version` of the b5130 CUDA build on a laptop whose dGPU is switched off. */
const CUDA_NO_DEVICE = [
  'ggml_cuda_init: failed to initialize CUDA: no CUDA-capable device is detected',
  'load_backend: loaded CUDA backend from C:\\x\\ggml-cuda.dll',
  'load_backend: loaded CPU backend from C:\\x\\ggml-cpu-cascadelake.dll',
  'whisper.cpp version: 1.9.4',
].join('\r\n');

describe('parseWhisperProbe', () => {
  it('reads the version and a CUDA init failure', () => {
    expect(parseWhisperProbe(CUDA_NO_DEVICE)).toEqual({
      version: '1.9.4',
      cuda: { state: 'unavailable', reason: 'no CUDA-capable device is detected' },
    });
  });

  it('counts CUDA devices', () => {
    const log =
      'ggml_cuda_init: found 1 CUDA devices:\n  Device 0: RTX\nwhisper.cpp version: 1.9.4';
    expect(parseWhisperProbe(log).cuda).toEqual({ state: 'available', devices: 1 });
    expect(parseWhisperProbe('ggml_cuda_init: found 0 CUDA devices').cuda.state).toBe(
      'unavailable',
    );
  });

  it('reports CPU/BLAS builds as without CUDA', () => {
    const log = 'load_backend: loaded BLAS backend from x\nwhisper.cpp version: 1.9.4';
    expect(parseWhisperProbe(log)).toEqual({ version: '1.9.4', cuda: { state: 'absent' } });
    expect(parseWhisperProbe('').version).toBeNull();
  });
});

describe('cpuFallbackReason', () => {
  it('is null on the GPU and on CPU-only installs', () => {
    expect(cpuFallbackReason({ backend: 'cuda', usedGpu: true, fallbacks: [] })).toBeNull();
    expect(cpuFallbackReason({ backend: 'blas', usedGpu: false, fallbacks: [] })).toBeNull();
  });

  it('names the reason when a GPU build was skipped or failed', () => {
    const fallbacks = [{ backend: 'cuda', gpu: true, message: 'CUDA unavailable: no device' }];
    expect(cpuFallbackReason({ backend: 'blas', usedGpu: false, fallbacks })).toBe(
      'CUDA unavailable: no device',
    );
    expect(cpuFallbackReason({ backend: 'cuda', usedGpu: false, fallbacks: [] })).toBe(
      'the CUDA build did not use the GPU',
    );
  });
});
