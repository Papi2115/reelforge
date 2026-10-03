/**
 * Downloadable whisper.cpp assets (ADR-003, hashes verified in spikes/03-audio/fetch.mjs):
 * release b5130 Windows binaries (GitHub release `digest`), ggml models and Silero VAD (Hugging
 * Face LFS sha256), rnnoise `sh.rnnn` (git blob SHA-1).
 */

/** Nightly build of the v1.9.4 commit (927cfce); the v1.9.4 release itself ships no assets. */
export const WHISPER_RELEASE_TAG = 'b5130';

const GITHUB_RELEASE = `https://github.com/ggml-org/whisper.cpp/releases/download/${WHISPER_RELEASE_TAG}`;
const HF_MODELS = 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main';

export type AssetHash =
  | { readonly algo: 'sha256'; readonly value: string }
  /** Git blob SHA-1: sha1("blob <size>\0" + content). */
  | { readonly algo: 'git-sha1'; readonly value: string };

export interface AssetSpec {
  readonly name: string;
  readonly url: string;
  readonly fileName: string;
  readonly hash: AssetHash;
  /** Exact download size (shown before downloading; progress total without Content-Length). */
  readonly bytes: number;
}

export type BinaryBackend = 'cuda' | 'blas' | 'cpu';

/** Windows x64 zips. `cuda` = cuBLAS 11.8 (works with current drivers), `blas` = OpenBLAS CPU. */
export const WHISPER_BINARIES: Readonly<Record<BinaryBackend, AssetSpec>> = {
  cuda: {
    name: 'whisper-cuda',
    url: `${GITHUB_RELEASE}/whisper-cublas-11.8.0-bin-x64.zip`,
    fileName: 'whisper-cublas-11.8.0-bin-x64.zip',
    bytes: 272_982_859,
    hash: {
      algo: 'sha256',
      value: '0b29b2175bb17ec26da29677cbc7c467c57d103245144d62a49a703f6bc3fdae',
    },
  },
  blas: {
    name: 'whisper-blas',
    url: `${GITHUB_RELEASE}/whisper-blas-bin-x64.zip`,
    fileName: 'whisper-blas-bin-x64.zip',
    bytes: 21_360_234,
    hash: {
      algo: 'sha256',
      value: '55c06d09e8b9b6cfb2b0b47ddedc71803054f0e48be1f41848b3141c06c703a9',
    },
  },
  cpu: {
    name: 'whisper-cpu',
    url: `${GITHUB_RELEASE}/whisper-bin-x64.zip`,
    fileName: 'whisper-bin-x64.zip',
    bytes: 8_573_270,
    hash: {
      algo: 'sha256',
      value: 'f9ec6c52a2e949b62ab51fa21d0d497958f9e41c3010c157c4e42932d5316f3c',
    },
  },
};

export const WHISPER_MODEL_IDS = ['large-v3-turbo-q5_0', 'small', 'medium', 'base'] as const;
export type WhisperModelId = (typeof WHISPER_MODEL_IDS)[number];

/** Default for EN and PL (spike: WER 4–6 %, start MAE 61–101 ms). `small` is the CPU fallback. */
export const DEFAULT_WHISPER_MODEL: WhisperModelId = 'large-v3-turbo-q5_0';

export interface WhisperModelSpec extends AssetSpec {
  readonly id: WhisperModelId;
  /** `-dtw` alignment-heads preset. */
  readonly dtwPreset: string;
  /**
   * How much DTW token times lag the spoken onset (spike §5, SAPI voices; re-measure on a real
   * voice and override via `TranscribeOptions.dtwLeadS`).
   */
  readonly dtwLeadS: number;
}

function hfModel(
  id: WhisperModelId,
  sha256: string,
  bytes: number,
  dtwPreset: string,
  dtwLeadS: number,
): WhisperModelSpec {
  const fileName = `ggml-${id}.bin`;
  return {
    id,
    name: id,
    url: `${HF_MODELS}/${fileName}`,
    fileName,
    hash: { algo: 'sha256', value: sha256 },
    bytes,
    dtwPreset,
    dtwLeadS,
  };
}

export const WHISPER_MODELS: Readonly<Record<WhisperModelId, WhisperModelSpec>> = {
  'large-v3-turbo-q5_0': hfModel(
    'large-v3-turbo-q5_0',
    '394221709cd5ad1f40c46e6031ca61bce88931e6e088c188294c6d5a55ffa7e2',
    574_041_195,
    'large.v3.turbo',
    0.21,
  ),
  small: hfModel(
    'small',
    '1be3a9b2063867b937e64e2ec7483364a79917e157fa98c5d94b5c1fffea987b',
    487_601_967,
    'small',
    0.2,
  ),
  medium: hfModel(
    'medium',
    '6c14d5adee5f86394037b4e4e8b59f1673b6cee10e3cf0b11bbdbee79c156208',
    1_533_763_059,
    'medium',
    0.33,
  ),
  base: hfModel(
    'base',
    '60ed5bc3dd14eea856493d334349b405782ddcaf0028d4b5df4088345fba2efe',
    147_951_465,
    'base',
    0.23,
  ),
};

export const SILERO_VAD_MODEL: AssetSpec = {
  name: 'silero-vad',
  url: 'https://huggingface.co/ggml-org/whisper-vad/resolve/main/ggml-silero-v6.2.0.bin',
  fileName: 'ggml-silero-v6.2.0.bin',
  hash: {
    algo: 'sha256',
    value: '2aa269b785eeb53a82983a20501ddf7c1d9c48e33ab63a41391ac6c9f7fb6987',
  },
  bytes: 885_098,
};

/** rnnoise model for the heavy clean preset (PLAN 4.2). */
export const RNNOISE_SH_MODEL: AssetSpec = {
  name: 'rnnoise-sh',
  url: 'https://raw.githubusercontent.com/GregorR/rnnoise-models/master/somnolent-hogwash-2018-09-01/sh.rnnn',
  fileName: 'sh.rnnn',
  hash: { algo: 'git-sha1', value: 'f86e9efd3d78ec91b2d18cfd2262fe991fcb1d35' },
  bytes: 297_646,
};
