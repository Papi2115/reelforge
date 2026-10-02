/**
 * `.reelforge/mix-report.json`: the mix QA verdict the Sound panel shows. Built (pure) from the
 * mix report (loudness + `qa.ts` measurements) and the cues: integrated loudness at the target
 * ±1 LU, true peak, no clipping, music ducked >= 6 dB under speech, speech-band margin >= 15 dB
 * (SII-like intelligibility proxy), music energy below 120 Hz <= 12 %, SFX density (<= 24 sound
 * moments per minute).
 */
import { z } from 'zod';
import type { CuesFile } from './cues.js';
import type { MixReport } from './report.js';

export const MIX_QA_REPORT_VERSION = 1;

/** The bars of the checks. */
export const MIX_QA_LIMITS = {
  minDuckingDb: 6,
  minSpeechMarginDb: 15,
  maxMusicLowShare: 0.12,
  /** Sound moments (cues closer than 0.6 s join) per minute: about one per 2.5 s at most. */
  maxMomentsPerMinute: 24,
} as const;

export const MIX_QA_CHECK_IDS = [
  'loudness',
  'true-peak',
  'clipping',
  'ducking',
  'speech-clarity',
  'music-low-band',
  'sfx-density',
] as const;
export type MixQaCheckId = (typeof MIX_QA_CHECK_IDS)[number];

/** `fail` = a hard bar (the stage fails on loudness / true peak); `skip` = not applicable. */
export const MixQaStatusSchema = z.enum(['pass', 'warn', 'fail', 'skip']);
export type MixQaStatus = z.infer<typeof MixQaStatusSchema>;

export const MixQaCheckSchema = z.object({
  id: z.enum(MIX_QA_CHECK_IDS),
  label: z.string(),
  status: MixQaStatusSchema,
  /** Measured value, formatted (e.g. `-14.1 LUFS`), or `—`. */
  value: z.string(),
  /** The bar, e.g. `-14 ±1 LUFS`. */
  limit: z.string(),
});
export type MixQaCheck = z.infer<typeof MixQaCheckSchema>;

export const MixQaReportSchema = z.object({
  version: z.literal(MIX_QA_REPORT_VERSION),
  createdAt: z.iso.datetime(),
  durationS: z.number().positive(),
  checks: z.array(MixQaCheckSchema),
  sfx: z.object({
    count: z.int().nonnegative(),
    perMinute: z.number().nonnegative(),
    momentsPerMinute: z.number().nonnegative(),
  }),
  music: z.object({
    beds: z.int().nonnegative(),
    /** Act moods of generated beds (cues.json `moods`), empty otherwise. */
    moods: z.array(z.string()),
  }),
  /** One line per check that warns or fails. */
  warnings: z.array(z.string()),
});
export type MixQaReport = z.infer<typeof MixQaReportSchema>;

/** A designed series (counter ticks, list pops) is one moment. */
const MOMENT_JOIN_S = 0.6;
const DASH = '—';
const round1 = (value: number): number => Math.round(value * 10) / 10;
const fixed1 = (value: number): string => round1(value).toFixed(1);

/** Sound moments: cues closer than 0.6 s to the previous one join it (a series counts once). */
export function soundMoments(times: readonly number[]): number {
  const sorted = [...times].sort((a, b) => a - b);
  return sorted.filter((t, index) => index === 0 || t - (sorted[index - 1] ?? 0) >= MOMENT_JOIN_S)
    .length;
}

function measured(
  id: MixQaCheckId,
  label: string,
  value: number | null | undefined,
  format: (value: number) => string,
  limit: string,
  passes: (value: number) => boolean,
): MixQaCheck {
  if (value === null || value === undefined) {
    return { id, label, status: 'skip', value: DASH, limit };
  }
  return { id, label, status: passes(value) ? 'pass' : 'warn', value: format(value), limit };
}

export interface MixQaOptions {
  /** Allowed |loudness - target| (LU). */
  readonly toleranceLu: number;
  readonly createdAt: string;
}

export function buildMixQaReport(
  report: MixReport,
  cues: CuesFile,
  options: MixQaOptions,
): MixQaReport {
  const { after, targetLufs, truePeakMaxDbtp, qa } = report;
  const minutes = report.durationS / 60;
  const moments = soundMoments(cues.sfx.map((cue) => cue.t));
  const momentsPerMinute = round1(moments / minutes);
  const loudnessOk = Math.abs(after.integratedLufs - targetLufs) <= options.toleranceLu;
  const checks: MixQaCheck[] = [
    {
      id: 'loudness',
      label: 'Loudness',
      status: loudnessOk ? 'pass' : 'fail',
      value: `${fixed1(after.integratedLufs)} LUFS`,
      limit: `${String(targetLufs)} ±${String(options.toleranceLu)} LUFS`,
    },
    {
      id: 'true-peak',
      label: 'True peak',
      status: after.truePeakDbtp <= truePeakMaxDbtp ? 'pass' : 'fail',
      value: `${fixed1(after.truePeakDbtp)} dBTP`,
      limit: `≤ ${String(truePeakMaxDbtp)} dBTP`,
    },
    qa === undefined
      ? { id: 'clipping', label: 'Clipping', status: 'skip', value: DASH, limit: 'none' }
      : {
          id: 'clipping',
          label: 'Clipping',
          status: qa.clippedSamples === 0 ? 'pass' : 'fail',
          value: `${String(qa.clippedSamples)} samples`,
          limit: 'none',
        },
    measured(
      'ducking',
      'Music ducking under speech',
      qa?.duckingDepthDb,
      (db) => `${fixed1(db)} dB`,
      `≥ ${String(MIX_QA_LIMITS.minDuckingDb)} dB`,
      (db) => db >= MIX_QA_LIMITS.minDuckingDb,
    ),
    measured(
      'speech-clarity',
      'Voice over music (speech bands)',
      qa?.speechMarginDb,
      (db) => `${fixed1(db)} dB`,
      `≥ ${String(MIX_QA_LIMITS.minSpeechMarginDb)} dB`,
      (db) => db >= MIX_QA_LIMITS.minSpeechMarginDb,
    ),
    measured(
      'music-low-band',
      'Music below 120 Hz',
      qa?.musicLowShare,
      (share) => `${fixed1(share * 100)} %`,
      `≤ ${String(MIX_QA_LIMITS.maxMusicLowShare * 100)} %`,
      (share) => share <= MIX_QA_LIMITS.maxMusicLowShare,
    ),
    measured(
      'sfx-density',
      'Sound moments per minute',
      cues.sfx.length === 0 ? null : momentsPerMinute,
      (value) => fixed1(value),
      `≤ ${String(MIX_QA_LIMITS.maxMomentsPerMinute)}`,
      (value) => value <= MIX_QA_LIMITS.maxMomentsPerMinute,
    ),
  ];
  return {
    version: MIX_QA_REPORT_VERSION,
    createdAt: options.createdAt,
    durationS: report.durationS,
    checks,
    sfx: {
      count: cues.sfx.length,
      perMinute: round1(cues.sfx.length / minutes),
      momentsPerMinute,
    },
    music: { beds: cues.music.length, moods: [...(cues.moods ?? [])] },
    warnings: checks
      .filter((check) => check.status === 'warn' || check.status === 'fail')
      .map((check) => `${check.label}: ${check.value} (want ${check.limit})`),
  };
}
