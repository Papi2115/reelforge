/**
 * WhisperManager (PLAN 4.3): finds or installs whisper.cpp (binary + ggml model + Silero VAD,
 * downloaded on demand with hash checks) and runs chunked transcription -> words.raw.json.
 */
import { randomBytes } from 'node:crypto';
import { readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  DEFAULT_WHISPER_MODEL,
  SILERO_VAD_MODEL,
  WHISPER_BINARIES,
  WHISPER_MODELS,
  WHISPER_RELEASE_TAG,
  type AssetSpec,
  type BinaryBackend,
  type WhisperModelId,
} from './assets.js';
import { downloadVerified, type DownloadOptions } from './download.js';
import type { WhisperError } from './errors.js';
import {
  backendDir,
  defaultWhisperRoot,
  locateWhisper,
  type WhisperInstall,
  type WhisperLocateOptions,
} from './locate.js';
import {
  transcribeChunked,
  type AsrFfmpeg,
  type ProcessRunner,
  type TranscribeOptions,
} from './transcribe.js';
import { extractZip } from './unzip.js';
import { nodeFileSystem } from '../ffmpeg/locate.js';
import { runProcess } from '../ffmpeg/process.js';
import { err, ok, type Result } from '../result.js';
import type { WordsRaw } from '../schemas/words.js';

export interface WhisperManagerOptions extends WhisperLocateOptions {
  /** Where ggml models live (default `<root>/models`). */
  readonly modelsDir?: string;
  /** Injectable process runner (default: runProcess, kill-tree on abort). */
  readonly run?: ProcessRunner;
  /** Injectable `fetch` for downloads. */
  readonly fetch?: DownloadOptions['fetch'];
  /** Release zips per backend (default: the pinned b5130 builds); e.g. a mirror. */
  readonly binaryAssets?: Readonly<Record<BinaryBackend, AssetSpec>>;
}

export type InstallOptions = Omit<DownloadOptions, 'fetch'>;

export interface WhisperTranscribeOptions extends TranscribeOptions {
  readonly ffmpeg: AsrFfmpeg;
  readonly model?: WhisperModelId | undefined;
}

const INSTALLED_MARKER = '.installed';
const describe = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

export class WhisperManager {
  readonly root: string;
  readonly modelsDir: string;
  private readonly run: ProcessRunner;

  constructor(private readonly options: WhisperManagerOptions = {}) {
    this.root = options.root ?? defaultWhisperRoot(options.env ?? process.env);
    this.modelsDir = options.modelsDir ?? path.join(this.root, 'models');
    this.run = options.run ?? runProcess;
  }

  /** Usable installs, preferred first (configured/env, then app-data cuda > blas > cpu). */
  locate(): Result<WhisperInstall[], WhisperError> {
    return locateWhisper({ ...this.options, root: this.root });
  }

  modelPath(model: WhisperModelId): string {
    return path.join(this.modelsDir, WHISPER_MODELS[model].fileName);
  }

  vadModelPath(): string {
    return path.join(this.modelsDir, SILERO_VAD_MODEL.fileName);
  }

  hasModel(model: WhisperModelId): boolean {
    return (this.options.fs ?? nodeFileSystem).isFile(this.modelPath(model));
  }

  /** True when `nvidia-smi -L` lists a GPU (decides between the CUDA and the CPU build). */
  async hasNvidiaGpu(signal?: AbortSignal): Promise<boolean> {
    const result = await this.run('nvidia-smi', ['-L'], { signal, timeoutMs: 15_000 });
    return result.ok && /^GPU \d+:/m.test(result.value.stdout);
  }

  private download(options: InstallOptions): DownloadOptions {
    return { ...options, fetch: this.options.fetch };
  }

  installModel(
    model: WhisperModelId,
    options: InstallOptions = {},
  ): Promise<Result<string, WhisperError>> {
    return downloadVerified(WHISPER_MODELS[model], this.modelPath(model), this.download(options));
  }

  installVadModel(options: InstallOptions = {}): Promise<Result<string, WhisperError>> {
    return downloadVerified(SILERO_VAD_MODEL, this.vadModelPath(), this.download(options));
  }

  /** Downloads + extracts a release build into `<root>/bin/<backend>` (skipped when present). */
  async installBinary(
    backend: BinaryBackend,
    options: InstallOptions = {},
  ): Promise<Result<string, WhisperError>> {
    const asset = (this.options.binaryAssets ?? WHISPER_BINARIES)[backend];
    const target = backendDir(this.root, backend);
    const stamp = `${WHISPER_RELEASE_TAG}:${asset.hash.value}`;
    const marker = path.join(target, INSTALLED_MARKER);
    const current = await readFile(marker, 'utf8').then(
      (text) => text.trim(),
      () => '',
    );
    if (current === stamp) return ok(target);
    const zip = path.join(this.root, 'downloads', asset.fileName);
    const downloaded = await downloadVerified(asset, zip, this.download(options));
    if (!downloaded.ok) return downloaded;
    const staging = `${target}.${randomBytes(4).toString('hex')}.partial`;
    const extracted = await extractZip(zip, staging);
    if (!extracted.ok) {
      await rm(staging, { recursive: true, force: true });
      return extracted;
    }
    try {
      await writeFile(path.join(staging, INSTALLED_MARKER), `${stamp}\n`, 'utf8');
      await rm(target, { recursive: true, force: true });
      await rename(staging, target);
      await rm(zip, { force: true });
      await rm(`${zip}.verified`, { force: true });
      return ok(target);
    } catch (error) {
      await rm(staging, { recursive: true, force: true });
      return err({
        kind: 'io',
        message: `cannot install ${asset.name}: ${describe(error)}`,
        path: target,
      });
    }
  }

  /**
   * Installs everything a transcription needs: the GPU build when an NVIDIA GPU is present plus
   * the OpenBLAS CPU build as fallback (CPU-only machines get just the latter), the model and
   * the VAD model.
   */
  async install(
    options: InstallOptions & {
      readonly model?: WhisperModelId;
      readonly backend?: BinaryBackend | 'auto';
    } = {},
  ): Promise<
    Result<{ readonly backends: BinaryBackend[]; readonly modelPath: string }, WhisperError>
  > {
    const requested = options.backend ?? 'auto';
    const primary: BinaryBackend =
      requested === 'auto'
        ? (await this.hasNvidiaGpu(options.signal))
          ? 'cuda'
          : 'blas'
        : requested;
    const backends: BinaryBackend[] = primary === 'cuda' ? ['cuda', 'blas'] : [primary];
    for (const backend of backends) {
      const installed = await this.installBinary(backend, options);
      if (!installed.ok) return installed;
    }
    const vad = await this.installVadModel(options);
    if (!vad.ok) return vad;
    const model = await this.installModel(options.model ?? DEFAULT_WHISPER_MODEL, options);
    if (!model.ok) return model;
    return ok({ backends, modelPath: model.value });
  }

  /** Transcribes `options.input` (models must be installed; see `install`). */
  async transcribe(options: WhisperTranscribeOptions): Promise<Result<WordsRaw, WhisperError>> {
    const located = this.locate();
    if (!located.ok) return located;
    const model = WHISPER_MODELS[options.model ?? DEFAULT_WHISPER_MODEL];
    const fs = this.options.fs ?? nodeFileSystem;
    for (const required of [this.modelPath(model.id), this.vadModelPath()]) {
      if (!fs.isFile(required)) {
        return err({
          kind: 'model-missing',
          message: `model file missing: ${required} (install it first)`,
          path: required,
        });
      }
    }
    return transcribeChunked(
      {
        installs: located.value,
        model,
        modelPath: this.modelPath(model.id),
        vadModelPath: this.vadModelPath(),
        ffmpeg: options.ffmpeg,
        run: this.run,
      },
      options,
    );
  }
}
