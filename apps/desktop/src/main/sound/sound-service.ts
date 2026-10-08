/**
 * The Sound panel's main side (PLAN.md#8.2): its state (library, bus gains and ducking from
 * cues.json, a summary of the cues, the last mix render with its QA checks, stems), importing files, built-in previews, writing gains /
 * ducking into cues.json (raw JSON edited so unknown keys survive, validated with the pipeline's
 * CuesFileSchema, atomic, committed, in the timeline editor's write queue) and the stage runs
 * behind its buttons. Electron-free: the picker, the queue and the commit come in as options.
 */
import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import {
  CuesFileSchema,
  MixQaReportSchema,
  MixReportSchema,
  type CuesFile,
  type MixReport,
} from '@reelforge/pipeline';
import { FILES, REPORTS, type StageRequest } from '@reelforge/stages';
import {
  MIX_GAIN_KEYS,
  type CueSummary,
  type LibrarySound,
  type MixGainKey,
  type MixResult,
  type SoundAction,
  type SoundImportResult,
  type SoundKind,
  type SoundMixPatch,
  type SoundMixResult,
  type SoundPreviewResult,
  type SoundState,
} from '../../shared/sound-contract.js';
import { duckingPresetOf } from '../../shared/sound-library.js';
import type { StageCommandResult } from '../../shared/stages-contract.js';
import { describeError, type Logger } from '../logger.js';
import { describeIssues, readProjectJson, readProjectText } from '../project-files.js';
import { writeTextAtomic } from '../timeline-edit-service.js';
import { importSoundFiles, listLibrary, previewFile } from './sound-files.js';

/** PLAN.md#8.3: −14 LUFS ±1 LU. */
export const MIX_TOLERANCE_LU = 1;

export const GAIN_LABELS: Readonly<Record<MixGainKey, string>> = {
  voGainDb: 'voice-over',
  sfxGainDb: 'SFX bus',
  ambienceGainDb: 'ambience bus',
  musicGainDb: 'music bus',
};

export interface SoundServiceOptions {
  readonly currentProject: () => string | undefined;
  /** Native multi-file picker; undefined when cancelled. */
  readonly pickFiles: (kind: SoundKind) => Promise<readonly string[] | undefined>;
  /** Queues stage runs (StageService.enqueue). */
  readonly enqueue: (requests: readonly StageRequest[]) => Promise<StageCommandResult>;
  /** Runs a cues.json write in the timeline editor's queue. */
  readonly exclusive: <T>(task: () => Promise<T>) => Promise<T>;
  /** Commits `paths` of the project (`manual`); true when a commit was made. */
  readonly commit: (dir: string, message: string, paths: readonly string[]) => Promise<boolean>;
  readonly log: Logger;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function mtime(file: string): Promise<number | null> {
  try {
    return (await stat(file)).mtimeMs;
  } catch {
    return null; // missing: no time
  }
}

async function stemFiles(dir: string): Promise<string[]> {
  try {
    const names = await readdir(path.join(dir, ...FILES.stemsDir.split('/')));
    return names
      .filter((name) => name.toLowerCase().endsWith('.wav'))
      .sort()
      .map((name) => `${FILES.stemsDir}/${name}`);
  } catch {
    return []; // no stems rendered yet
  }
}

const round1 = (value: number): number => Math.round(value * 10) / 10;

/** Commit subject of a mix patch, e.g. `Sound: SFX bus −6 dB`. */
export function describeMixPatch(patch: SoundMixPatch): string {
  const parts: string[] = [];
  for (const key of MIX_GAIN_KEYS) {
    const value = patch.gains?.[key];
    if (value !== undefined) parts.push(`${GAIN_LABELS[key]} ${String(round1(value))} dB`);
  }
  if (patch.ducking !== undefined) parts.push(`music ducking ${duckingPresetOf(patch.ducking)}`);
  return `Sound: ${parts.join(', ')}`;
}

/** cues.json raw JSON with the patch applied (unknown keys kept); a string = why not. */
export function applyMixPatch(
  raw: unknown,
  patch: SoundMixPatch,
): Record<string, unknown> | string {
  if (!isRecord(raw)) return 'cues.json is not a JSON object';
  const next: Record<string, unknown> = { ...raw };
  if (patch.gains !== undefined) {
    const global = isRecord(raw['global']) ? { ...raw['global'] } : {};
    for (const key of MIX_GAIN_KEYS) {
      const value = patch.gains[key];
      if (value !== undefined) global[key] = round1(value);
    }
    next['global'] = global;
  }
  if (patch.ducking !== undefined) {
    const music = raw['music'];
    if (!Array.isArray(music) || music.length === 0) {
      return 'There is no music cue to duck: drop music on the timeline first.';
    }
    const ducking = patch.ducking;
    next['music'] = music.map((cue: unknown) => (isRecord(cue) ? { ...cue, ducking } : cue));
  }
  return next;
}

function mixResult(dirReport: MixReport): MixResult {
  return {
    integratedLufs: dirReport.after.integratedLufs,
    truePeakDbtp: dirReport.after.truePeakDbtp,
    targetLufs: dirReport.targetLufs,
    truePeakMaxDbtp: dirReport.truePeakMaxDbtp,
    toleranceLu: MIX_TOLERANCE_LU,
    durationS: dirReport.durationS,
    warnings: dirReport.warnings,
  };
}

/** cues.json at a glance: counts, the built-in SFX by use and the music moods. */
export function cueSummary(cues: CuesFile): CueSummary {
  const counts = new Map<string, number>();
  for (const cue of cues.sfx) {
    if (cue.name !== undefined) counts.set(cue.name, (counts.get(cue.name) ?? 0) + 1);
  }
  return {
    sfx: cues.sfx.length,
    ambience: cues.ambience.length,
    music: cues.music.length,
    sounds: [...counts]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
    moods: [...(cues.moods ?? [])],
  };
}

const EMPTY_STATE: SoundState = {
  projectDir: null,
  library: [],
  gains: { voGainDb: 0, sfxGainDb: 0, ambienceGainDb: 0, musicGainDb: 0 },
  ducking: null,
  musicCues: 0,
  cues: null,
  cuesError: null,
  mix: { exists: false, stale: false, result: null, qa: null },
  stems: [],
};

function gainsOf(cues: CuesFile | undefined): SoundState['gains'] {
  const global = cues?.global;
  return {
    voGainDb: global?.voGainDb ?? 0,
    sfxGainDb: global?.sfxGainDb ?? 0,
    ambienceGainDb: global?.ambienceGainDb ?? 0,
    musicGainDb: global?.musicGainDb ?? 0,
  };
}

export class SoundService {
  constructor(private readonly options: SoundServiceOptions) {}

  async state(): Promise<SoundState> {
    const dir = this.options.currentProject();
    if (dir === undefined) return EMPTY_STATE;
    const [library, cues, report, qa, mixTime, cuesTime, stems] = await Promise.all([
      listLibrary(dir),
      readProjectJson(dir, FILES.cues, CuesFileSchema),
      readProjectJson(dir, REPORTS.mix, MixReportSchema),
      readProjectJson(dir, FILES.mixQaReport, MixQaReportSchema),
      mtime(path.join(dir, ...FILES.mix.split('/'))),
      mtime(path.join(dir, FILES.cues)),
      stemFiles(dir),
    ]);
    const data = cues.status === 'ok' ? cues.data : undefined;
    const ducking = data?.music[0]?.ducking;
    return {
      projectDir: dir,
      library,
      gains: gainsOf(data),
      ducking: ducking === undefined ? null : { ...ducking },
      musicCues: data?.music.length ?? 0,
      cues: data === undefined ? null : cueSummary(data),
      cuesError: cues.status === 'error' ? cues.error.message : null,
      mix: {
        exists: mixTime !== null,
        stale: mixTime !== null && cuesTime !== null && cuesTime > mixTime,
        result: mixTime !== null && report.status === 'ok' ? mixResult(report.data) : null,
        qa:
          mixTime !== null && qa.status === 'ok'
            ? qa.data.checks.map((check) => ({ ...check }))
            : null,
      },
      stems,
    };
  }

  async importFiles(kind: SoundKind): Promise<SoundImportResult> {
    const dir = this.options.currentProject();
    if (dir === undefined) return { status: 'error', message: 'No project is open.', files: [] };
    const picked = await this.options.pickFiles(kind);
    if (picked === undefined || picked.length === 0) {
      return { status: 'cancelled', message: null, files: [] };
    }
    try {
      const { files, skipped } = await importSoundFiles(dir, kind, picked);
      this.options.log.info(`imported ${String(files.length)} ${kind} file(s)`);
      const note = skipped.length > 0 ? `Not audio, skipped: ${skipped.join(', ')}` : null;
      return { status: 'ok', message: note, files };
    } catch (error) {
      this.options.log.warn(`sound import failed: ${describeError(error)}`);
      return { status: 'error', message: `Import failed: ${describeError(error)}`, files: [] };
    }
  }

  async preview(sound: LibrarySound): Promise<SoundPreviewResult> {
    const dir = this.options.currentProject();
    if (dir === undefined) return { status: 'error', message: 'No project is open.' };
    try {
      const file = await previewFile(dir, sound);
      return file.ok
        ? { status: 'ok', file: file.file }
        : { status: 'error', message: file.message };
    } catch (error) {
      return { status: 'error', message: describeError(error) };
    }
  }

  setMix(patch: SoundMixPatch): Promise<SoundMixResult> {
    return this.options.exclusive(() => this.writeMix(patch));
  }

  run(action: SoundAction): Promise<StageCommandResult> {
    switch (action) {
      case 'generate-cues':
        return this.options.enqueue([{ stage: 'sound-cues' }]);
      case 'default-cues':
        return this.options.enqueue([{ stage: 'sound-cues', mode: 'default' }]);
      case 'mix':
        return this.options.enqueue([{ stage: 'mix' }]);
      case 'mix-stems':
        return this.options.enqueue([{ stage: 'mix', stems: true }]);
    }
  }

  private async writeMix(patch: SoundMixPatch): Promise<SoundMixResult> {
    const dir = this.options.currentProject();
    if (dir === undefined) return { status: 'error', message: 'No project is open.' };
    const text = await readProjectText(dir, FILES.cues);
    let raw: unknown = { version: 1 };
    if (text.status === 'ok') {
      try {
        raw = JSON.parse(text.data);
      } catch (error) {
        return {
          status: 'rejected',
          message: `cues.json is not valid JSON: ${describeError(error)}`,
        };
      }
    } else if (text.status === 'error') {
      return { status: 'rejected', message: text.error.message };
    }
    const next = applyMixPatch(raw, patch);
    if (typeof next === 'string') return { status: 'rejected', message: next };
    const valid = CuesFileSchema.safeParse(next);
    if (!valid.success) {
      return { status: 'rejected', message: `cues.json: ${describeIssues(valid.error)}` };
    }
    const message = describeMixPatch(patch);
    try {
      await writeTextAtomic(path.join(dir, FILES.cues), `${JSON.stringify(next, null, 2)}\n`);
    } catch (error) {
      return { status: 'error', message: `cannot write cues.json: ${describeError(error)}` };
    }
    const committed = await this.options.commit(dir, message, [FILES.cues]);
    this.options.log.info(`${message}${committed ? '' : ' (not committed)'}`);
    return { status: 'ok', message, committed };
  }
}
