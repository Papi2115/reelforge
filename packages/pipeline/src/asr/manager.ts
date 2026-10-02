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
import { systemErrorCode, type WhisperError } from './errors.js';
import {
  backendDir,
  cliCandidates,
  defaultWhisperRoot,
  locateWhisper,
  type WhisperInstall,
  type WhisperLocateOptions,
} from './locate.js';
import { probeWhisperCli, type WhisperProbe } from './probe.js';
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
  /** Rewrites every asset before it is downloaded (mirrors, test hooks). */
  readonly assetOverride?: (asset: AssetSpec) => AssetSpec;
}

export type InstallOptions = Omit<DownloadOptions, 'fetch'>;

export interface WhisperTranscribeOptions extends TranscribeOptions {
  readonly ffmpeg: AsrFfmpeg;
  readonly model?: WhisperModelId | undefined;
}

/** One downloadable piece of a whisper install. */
export type InstallPart =
  | { readonly kind: 'engine'; readonly backend: BinaryBackend }
  | { readonly kind: 'vad' }
  | { readonly kind: 'model'; readonly model: WhisperModelId };

export interface InstallStep {
  readonly part: InstallPart;
  readonly asset: AssetSpec;
}

export interface InstallRequest {
  /** Install the app's whisper.cpp build(s) when not stamped yet. */
  readonly engine: boolean;
  readonly vad: boolean;
  readonly model: WhisperModelId | null;
  readonly backend?: BinaryBackend | 'auto';
}

const INSTALLED_MARKER = '.installed';
const describe = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

export class WhisperManager {
  readonly root: string;
  readonly modelsDir: string;
  private readonly run: ProcessRunner;
  private nvidia: Promise<boolean> | undefined;

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

  private isFile(file: string): boolean {
    return (this.options.fs ?? nodeFileSystem).isFile(file);
  }

  hasModel(model: WhisperModelId): boolean {
    return this.isFile(this.modelPath(model));
  }

  hasVadModel(): boolean {
    return this.isFile(this.vadModelPath());
  }

  /** True when `nvidia-smi -L` lists a GPU (decides between the CUDA and the CPU build). */
  async hasNvidiaGpu(signal?: AbortSignal): Promise<boolean> {
    const result = await this.run('nvidia-smi', ['-L'], { signal, timeoutMs: 15_000 });
    return result.ok && /^GPU \d+:/m.test(result.value.stdout);
  }

  /** The builds `install` fetches: CUDA + the OpenBLAS fallback with an NVIDIA GPU, else BLAS. */
  async engineBackends(requested: BinaryBackend | 'auto' = 'auto'): Promise<BinaryBackend[]> {
    if (requested !== 'auto') return requested === 'cuda' ? ['cuda', 'blas'] : [requested];
    // Not tied to `signal`: a cancelled first call must not cache "no GPU".
    this.nvidia ??= this.hasNvidiaGpu();
    return (await this.nvidia) ? ['cuda', 'blas'] : ['blas'];
  }

  /** Version and CUDA state of a whisper-cli (`--version`, ≈0.2 s). */
  probe(cliPath: string, signal?: AbortSignal): Promise<WhisperProbe> {
    return probeWhisperCli(this.run, cliPath, signal);
  }

  /** The asset of an install part, after `assetOverride`. */
  asset(part: InstallPart): AssetSpec {
    const base =
      part.kind === 'engine'
        ? (this.options.binaryAssets ?? WHISPER_BINARIES)[part.backend]
        : part.kind === 'vad'
          ? SILERO_VAD_MODEL
          : WHISPER_MODELS[part.model];
    return this.options.assetOverride?.(base) ?? base;
  }

  private binaryStamp(backend: BinaryBackend): string {
    return `${WHISPER_RELEASE_TAG}:${this.asset({ kind: 'engine', backend }).hash.value}`;
  }

  /** True when `<root>/bin/<backend>` holds the pinned build (stamped by `installBinary`). */
  async hasBinary(backend: BinaryBackend): Promise<boolean> {
    const marker = path.join(backendDir(this.root, backend), INSTALLED_MARKER);
    const current = await readFile(marker, 'utf8').then(
      (text) => text.trim(),
      () => '',
    );
    return current === this.binaryStamp(backend) && this.cliIn(backendDir(this.root, backend));
  }

  private cliIn(dir: string): boolean {
    const platform = this.options.platform ?? process.platform;
    return cliCandidates(dir, platform).some((candidate) => this.isFile(candidate));
  }

  /** What `request` still has to download, in install order (engine, VAD, model). */
  async planInstall(request: InstallRequest): Promise<InstallStep[]> {
    const parts: InstallPart[] = [];
    if (request.engine) {
      for (const backend of await this.engineBackends(request.backend)) {
        if (!(await this.hasBinary(backend))) parts.push({ kind: 'engine', backend });
      }
    }
    if (request.vad && !this.hasVadModel()) parts.push({ kind: 'vad' });
    if (request.model !== null && !this.hasModel(request.model))
      parts.push({ kind: 'model', model: request.model });
    return parts.map((part) => ({ part, asset: this.asset(part) }));
  }

  private download(options: InstallOptions): DownloadOptions {
    return { ...options, fetch: this.options.fetch };
  }

  installStep(
    step: InstallStep,
    options: InstallOptions = {},
  ): Promise<Result<string, WhisperError>> {
    const { part } = step;
    if (part.kind === 'engine') return this.installBinary(part.backend, options);
    return part.kind === 'vad'
      ? this.installVadModel(options)
      : this.installModel(part.model, options);
  }

  installModel(
    model: WhisperModelId,
    options: InstallOptions = {},
  ): Promise<Result<string, WhisperError>> {
    return downloadVerified(
      this.asset({ kind: 'model', model }),
      this.modelPath(model),
      this.download(options),
    );
  }

  installVadModel(options: InstallOptions = {}): Promise<Result<string, WhisperError>> {
    return downloadVerified(
      this.asset({ kind: 'vad' }),
      this.vadModelPath(),
      this.download(options),
    );
  }

  /** Downloads + extracts a release build into `<root>/bin/<backend>` (skipped when present). */
  async installBinary(
    backend: BinaryBackend,
    options: InstallOptions = {},
  ): Promise<Result<string, WhisperError>> {
    const asset = this.asset({ kind: 'engine', backend });
    const target = backendDir(this.root, backend);
    if (await this.hasBinary(backend)) return ok(target);
    const zip = path.join(this.root, 'downloads', asset.fileName);
    const downloaded = await downloadVerified(asset, zip, this.download(options));
    if (!downloaded.ok) return downloaded;
    if (options.signal?.aborted === true) {
      return err({ kind: 'cancelled', message: `install of ${asset.name} cancelled` });
    }
    const staging = `${target}.${randomBytes(4).toString('hex')}.partial`;
    const extracted = await extractZip(zip, staging);
    if (!extracted.ok) {
      await rm(staging, { recursive: true, force: true });
      return extracted;
    }
    // Antivirus software may quarantine the exe as soon as it is written.
    if (!this.cliIn(staging)) {
      await rm(staging, { recursive: true, force: true });
      return err(cliMissing(asset, staging));
    }
    try {
      await writeFile(
        path.join(staging, INSTALLED_MARKER),
        `${this.binaryStamp(backend)}\n`,
        'utf8',
      );
      await rm(target, { recursive: true, force: true });
      await rename(staging, target);
    } catch (error) {
      await rm(staging, { recursive: true, force: true });
      return err({
        kind: 'io',
        message: `cannot install ${asset.name}: ${describe(error)}`,
        path: target,
        code: systemErrorCode(error),
      });
    }
    if (!this.cliIn(target)) return err(cliMissing(asset, target));
    await rm(zip, { force: true });
    await rm(`${zip}.verified`, { force: true });
    return ok(target);
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
    const backends = await this.engineBackends(options.backend ?? 'auto');
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
    for (const required of [this.modelPath(model.id), this.vadModelPath()]) {
      if (!this.isFile(required)) {
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

function cliMissing(asset: AssetSpec, dir: string): WhisperError {
  return {
    kind: 'extract-failed',
    message: `whisper-cli is missing after extracting ${asset.fileName} into ${dir} (removed by antivirus software?)`,
    path: dir,
    code: 'CLI_MISSING',
  };
}
