// ASR experiment matrix: presets x models x modes x backends -> alignment -> metrics.
//   node spikes/03-audio/matrix.mjs [--force]
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { alignScript } from './align.mjs';
import { transcribe, toWhisperWav } from './asr.mjs';
import { OUT_DIR, log, writeJson } from './lib/common.mjs';
import { dtwWords, timingErrors } from './lib/evaluate.mjs';
import { SAMPLES, samplePaths } from './lib/samples.mjs';

const FORCE = process.argv.includes('--force');
const INPUTS = [
  'reference',
  'original',
  'light',
  'standard',
  'standard-dyn',
  'standard+gl',
  'heavy',
];
const MODEL_INPUTS = ['original', 'standard+gl', 'heavy'];
const ALL_MODELS = ['base', 'small', 'medium', 'turbo-q5'];

/**
 * DTW token times lag the spoken word onset by a model-specific, very stable amount
 * (median over exact-matched words of all samples/inputs; spread about +-40 ms). In-sample fit on
 * synthetic voices - must be re-validated on real recordings.
 */
const DTW_LEAD_S = { base: 0.23, small: 0.2, medium: 0.33, 'turbo-q5': 0.21 };

function inputFile(paths, input) {
  if (input === 'reference') return paths.reference;
  if (input === 'original') return paths.original;
  return path.join(paths.dir, `clean.${input}.wav`);
}

function plan() {
  const jobs = [];
  const add = (job) => {
    const key = `${job.sample.id}|${job.input}|${job.model}|${job.mode}|${job.backend}`;
    if (!jobs.some((j) => j.key === key)) jobs.push({ ...job, key });
  };
  for (const sample of SAMPLES) {
    for (const mode of ['dtw', 'vad', 'chunk']) {
      for (const input of INPUTS) add({ sample, input, model: 'small', mode, backend: 'cuda' });
      for (const model of ALL_MODELS) {
        for (const input of MODEL_INPUTS) add({ sample, input, model, mode, backend: 'cuda' });
      }
    }
  }
  const rtfSample = SAMPLES[0];
  for (const backend of ['cpu', 'blas']) {
    for (const model of ALL_MODELS) {
      add({ sample: rtfSample, input: 'standard+gl', model, mode: 'vad', backend });
      add({ sample: rtfSample, input: 'standard+gl', model, mode: 'dtw', backend });
      add({ sample: rtfSample, input: 'standard+gl', model, mode: 'chunk', backend });
    }
  }
  return jobs;
}

async function runJob(job) {
  const paths = samplePaths(job.sample);
  const wav16 = path.join(paths.dir, 'asr', `${job.input}.16k.wav`);
  if (!existsSync(wav16)) await toWhisperWav(inputFile(paths, job.input), wav16);
  const outBase = path.join(
    paths.dir,
    'asr',
    `${job.input}.${job.model}.${job.mode}.${job.backend}`,
  );
  const raw =
    !FORCE && existsSync(`${outBase}.raw.json`)
      ? JSON.parse(readFileSync(`${outBase}.raw.json`, 'utf8'))
      : await transcribe({
          backend: job.backend,
          model: job.model,
          lang: job.sample.lang,
          mode: job.mode,
          input: wav16,
          outBase,
        });
  const script = readFileSync(paths.script, 'utf8');
  const truth = JSON.parse(readFileSync(paths.truth, 'utf8')).words;
  const timings = { seg: raw.words };
  if (job.mode === 'dtw' || job.mode === 'chunk') {
    timings.dtw = dtwWords(raw.words);
    timings['dtw-cal'] = dtwWords(raw.words, DTW_LEAD_S[job.model]);
  }
  const rows = [];
  for (const [timing, words] of Object.entries(timings)) {
    const aligned = alignScript(script, words, job.sample.lang);
    writeJson(`${outBase}.${timing}.words.json`, { version: 1, lang: job.sample.lang, ...aligned });
    rows.push({
      sample: job.sample.id,
      lang: job.sample.lang,
      input: job.input,
      model: job.model,
      mode: job.mode,
      backend: job.backend,
      timing,
      rtf: raw.rtf,
      wallMs: raw.wallMs,
      ...aligned.stats,
      error: timingErrors(aligned.words, truth),
    });
  }
  return rows;
}

const rows = [];
const jobs = plan();
for (const [index, job] of jobs.entries()) {
  const result = await runJob(job);
  rows.push(...result);
  const first = result[result.length - 1];
  log(
    `[${String(index + 1)}/${String(jobs.length)}] ${job.key}: WER ${String(first.wer)} cov ${String(first.coverage)}`,
    `rtf ${String(first.rtf)} start MAE ${String(first.error.start?.maeMs)} ms (${first.timing})`,
  );
}
writeJson(path.join(OUT_DIR, 'results.json'), { version: 1, rows });
