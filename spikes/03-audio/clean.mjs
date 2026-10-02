// Audio clean chain: preset filters + loudness normalisation to -16 LUFS, with before/after report.
//   node spikes/03-audio/clean.mjs
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { MODELS_DIR, log, run, writeJson } from './lib/common.mjs';
import { ffmpeg, levels, loudnormStats } from './lib/ffmpeg.mjs';
import { SAMPLES, samplePaths } from './lib/samples.mjs';

const TARGET_I = -16;
const TARGET_TP = -1.5;
export const LOUDNORM = `I=${String(TARGET_I)}:TP=${String(TARGET_TP)}:LRA=11`;

/**
 * nf = measured noise floor (10th percentile of 50 ms RMS windows). afftdn with track_noise=1 or a
 * fixed nf far from the real floor removes only ~2 dB. arnndn must run BEFORE afftdn: after
 * highpass+afftdn it suppressed speech by ~30 dB in this spike. The arnndn model is referenced by
 * bare file name with cwd = MODELS_DIR (absolute "C:\..." paths need the colon escaped in graphs).
 */
export const PRESETS = {
  light: (nf) => ['highpass=f=70', `afftdn=nr=10:nf=${nf}`],
  standard: (nf) => ['highpass=f=80', `afftdn=nr=20:nf=${nf}`],
  'standard-dyn': (nf) => [
    'highpass=f=80',
    `afftdn=nr=20:nf=${nf}`,
    'dynaudnorm=f=400:g=31:p=0.9:m=6:t=0.0005',
  ],
  heavy: () => ['highpass=f=80', 'arnndn=m=sh.rnnn'],
};

const round1 = (value) => Math.round(value * 10) / 10;

/** Noise floor estimate: 10th percentile of 50 ms RMS windows after the highpass. */
export async function noiseFloorDb(file) {
  const graph =
    'highpass=f=80,asetnsamples=n=2400,astats=metadata=1:reset=1:measure_perchannel=none,' +
    'ametadata=print:key=lavfi.astats.Overall.RMS_level:file=-';
  const result = await run('ffmpeg', [
    '-hide_banner',
    '-nostdin',
    '-v',
    'error',
    '-i',
    file,
    '-af',
    graph,
    '-f',
    'null',
    '-',
  ]);
  const values = [...result.stdout.matchAll(/RMS_level=(-?[\d.]+)/g)]
    .map((m) => Number(m[1]))
    .sort((a, b) => a - b);
  if (values.length === 0) throw new Error(`noise floor: no astats frames for ${file}`);
  const p10 = values[Math.floor(0.1 * (values.length - 1))];
  return Math.min(-20, Math.max(-80, Math.round(p10)));
}

/** Speech-vs-gap level: RMS of each paragraph and of the long silence between them. */
async function gapReport(file, truth) {
  const paragraphs = [];
  for (const span of truth.spans) paragraphs.push((await levels(file, span.start, span.end)).rmsDb);
  const gapDb = (await levels(file, truth.gap.start, truth.gap.end)).rmsDb;
  const speechDb =
    10 * Math.log10(paragraphs.reduce((s, db) => s + 10 ** (db / 10), 0) / paragraphs.length);
  return {
    paragraphDeltaDb: round1(Math.abs(paragraphs[0] - paragraphs[1])),
    gapDb: round1(gapDb),
    speechToGapDb: round1(speechDb - gapDb),
  };
}

const pickLoudness = (stats) => ({
  i: Number(stats.input_i),
  tp: Number(stats.input_tp),
  lra: Number(stats.input_lra),
});
const encode = ['-ar', '48000', '-ac', '1', '-c:a', 'pcm_s16le'];

/** Two-pass loudnorm (falls back to its dynamic mode when linear gain would break the TP). */
async function loudnormTwoPass(input, output, filters) {
  const pass1 = await loudnormStats(input, filters, LOUDNORM, MODELS_DIR);
  const m = pass1.stats;
  const second = [
    ...filters,
    `loudnorm=${LOUDNORM}:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}` +
      `:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true:print_format=json`,
    'aresample=48000',
  ].join(',');
  const pass2 = await ffmpeg(['-i', input, '-af', second, ...encode, output], MODELS_DIR);
  const json = pass2.stderr.slice(pass2.stderr.lastIndexOf('{'), pass2.stderr.lastIndexOf('}') + 1);
  return {
    ms: pass1.ms + pass2.ms,
    mode: `loudnorm-${String(JSON.parse(json).normalization_type)}`,
  };
}

/** Linear gain + sample-peak limiter (-2 dBFS), one corrective pass if off by > 0.3 LU. */
async function gainLimit(input, output, filters) {
  const pass1 = await loudnormStats(input, filters, LOUDNORM, MODELS_DIR);
  let gain = TARGET_I - Number(pass1.stats.input_i);
  let ms = pass1.ms;
  for (let attempt = 0; attempt < 2; attempt++) {
    const chain = [
      ...filters,
      `volume=${gain.toFixed(2)}dB`,
      'alimiter=limit=0.794:attack=5:release=60:level=false',
    ];
    ms += (await ffmpeg(['-i', input, '-af', chain.join(','), ...encode, output], MODELS_DIR)).ms;
    const check = await loudnormStats(output, [], LOUDNORM);
    const error = TARGET_I - Number(check.stats.input_i);
    if (Math.abs(error) <= 0.3) break;
    gain += error;
  }
  return { ms, mode: 'gain-limit' };
}

async function cleanSample(sample) {
  const paths = samplePaths(sample);
  const truth = JSON.parse(readFileSync(paths.truth, 'utf8'));
  const nf = await noiseFloorDb(paths.original);
  const before = await loudnormStats(paths.original, [], LOUDNORM);
  const report = {
    id: sample.id,
    noiseFloorDb: nf,
    before: { ...pickLoudness(before.stats), ...(await gapReport(paths.original, truth)) },
    variants: {},
  };
  log(`${sample.id} before: ${JSON.stringify(report.before)} nf=${String(nf)}`);
  const jobs = [
    ...Object.keys(PRESETS).map((name) => ({ name, preset: name, normalize: loudnormTwoPass })),
    { name: 'standard+gl', preset: 'standard', normalize: gainLimit },
  ];
  for (const job of jobs) {
    const output = path.join(paths.dir, `clean.${job.name}.wav`);
    const result = await job.normalize(paths.original, output, PRESETS[job.preset](nf));
    const after = pickLoudness((await loudnormStats(output, [], LOUDNORM)).stats);
    const variant = {
      ...result,
      ms: Math.round(result.ms),
      after,
      ...(await gapReport(output, truth)),
    };
    report.variants[job.name] = variant;
    log(`${sample.id} ${job.name}: ${JSON.stringify(variant)}`);
  }
  writeJson(path.join(paths.dir, 'clean.json'), report);
}

for (const sample of SAMPLES) await cleanSample(sample);
