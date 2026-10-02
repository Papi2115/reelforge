/**
 * View model of the Voiceover and Words timed panels (PLAN.md#7.2): how well the recording fits
 * the script — its length against the word-count estimate (150 wpm) right after the import, then
 * the alignment coverage and the mismatch regions (script text vs what was heard, with times to
 * seek to) once Words timed ran — and the "Retry with a bigger model" choice. Pure.
 */
import type { SettingsWhisperModel, VoReport, WordsReport } from '@reelforge/shared';

export type FitTone = 'ok' | 'warn' | 'bad' | 'none';

export interface FitView {
  readonly tone: FitTone;
  readonly headline: string;
  readonly details: readonly string[];
}

/** `m:ss`. */
export function clock(seconds: number): string {
  const whole = Math.max(0, Math.round(seconds));
  return `${String(Math.floor(whole / 60))}:${String(whole % 60).padStart(2, '0')}`;
}

/** Duration vs the script's word-count estimate (the import-time report). */
export function voFit(report: VoReport | null): FitView {
  if (report === null) {
    return {
      tone: 'none',
      headline: 'No voice-over yet: import a file or record one.',
      details: [],
    };
  }
  const length = report.durationS === null ? 'unknown length' : clock(report.durationS);
  const details: string[] = [];
  if (report.scriptWords !== null && report.expectedDurationS !== null) {
    details.push(
      `Script: ${String(report.scriptWords)} words ≈ ${clock(report.expectedDurationS)} at 150 words per minute.`,
    );
  }
  if (report.wordsPerMinute !== null) {
    details.push(`You spoke about ${String(Math.round(report.wordsPerMinute))} words per minute.`);
  }
  details.push(...report.messages);
  switch (report.verdict) {
    case 'ok':
      return { tone: 'ok', headline: `Recording ${length}: fits the script.`, details };
    case 'too-short':
      return {
        tone: 'warn',
        headline: `Recording ${length}: shorter than the script needs.`,
        details,
      };
    case 'too-long':
      return {
        tone: 'warn',
        headline: `Recording ${length}: longer than the script needs.`,
        details,
      };
    case 'unknown':
      return { tone: 'none', headline: `Recording ${length}.`, details };
  }
}

export interface MismatchRow {
  readonly key: string;
  readonly t: number;
  readonly time: string;
  readonly script: string;
  readonly heard: string;
}

export interface AlignmentView {
  readonly tone: FitTone;
  readonly headline: string;
  /** e.g. `large-v3-turbo-q5_0, 2 attempts`. */
  readonly model: string | null;
  readonly mismatches: readonly MismatchRow[];
}

/** Good ≥ 95 % of the script found, fair ≥ 85 % (the words stage's retry bar). */
export function alignmentView(words: WordsReport | null): AlignmentView {
  if (words === null) {
    return {
      tone: 'none',
      headline: 'Run Words timed to check the recording against the script word by word.',
      model: null,
      mismatches: [],
    };
  }
  const percent = Math.round(words.coverage * 100);
  const tone: FitTone = words.coverage >= 0.95 ? 'ok' : words.coverage >= 0.85 ? 'warn' : 'bad';
  const quality = tone === 'ok' ? 'good' : tone === 'warn' ? 'fair' : 'poor';
  const chosen = words.attempts[words.chosen];
  const attempts = words.attempts.length;
  return {
    tone,
    headline: `Alignment ${quality}: ${String(percent)} % of the script was heard in the recording.`,
    model:
      chosen === undefined
        ? null
        : `${chosen.model}${attempts > 1 ? `, ${String(attempts)} attempts` : ''}`,
    mismatches: words.mismatches.map((region, index) => ({
      key: `${String(index)}:${String(region.t)}`,
      t: region.t,
      time: clock(region.t),
      script: region.script === '' ? '—' : region.script,
      heard: region.heard === '' ? '—' : region.heard,
    })),
  };
}

/** Whisper models from smallest to largest (settings ids). */
export const WHISPER_SIZE_ORDER: readonly SettingsWhisperModel[] = [
  'base',
  'small',
  'medium',
  'large-v3-turbo-q5_0',
];

/** The next larger model, or null on the largest. */
export function biggerWhisperModel(current: string | null): SettingsWhisperModel | null {
  const index = WHISPER_SIZE_ORDER.findIndex((model) => model === current);
  if (index === -1) return null;
  return WHISPER_SIZE_ORDER[index + 1] ?? null;
}

/**
 * Words timed ran on the CPU although a GPU build of whisper.cpp was tried: why, and what to do
 * (docs/whisper.md "GPU"). Null when it used the GPU or only a CPU build is installed.
 */
export function cpuTranscriptionHint(report: WordsReport | null): string | null {
  const engine = report?.engine;
  if (engine === undefined || engine.cpuReason === null) return null;
  const seconds = Math.round(engine.wallMs / 1000);
  return `Transcription ran on the CPU (slow: ${String(seconds)} s for ${String(Math.round(engine.audioS))} s of audio) because ${engine.cpuReason}. On a laptop, make sure the NVIDIA GPU is switched on (GPU mode Hybrid/Discrete, not Eco/Integrated; charger connected) and set Windows Settings → System → Display → Graphics → whisper-cli.exe (ReelForge) to High performance, then Redo Words timed.`;
}
