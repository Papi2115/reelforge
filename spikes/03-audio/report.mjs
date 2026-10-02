// Turns .cache/out/results.json + clean.json files into markdown tables (.cache/out/results.md).
//   node spikes/03-audio/report.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { OUT_DIR, SPIKE_DIR, ensureDir, log, writeJson } from './lib/common.mjs';
import { SAMPLES, samplePaths } from './lib/samples.mjs';

const { rows } = JSON.parse(readFileSync(path.join(OUT_DIR, 'results.json'), 'utf8'));
const MODELS = ['base', 'small', 'medium', 'turbo-q5'];
const TIMINGS = [
  ['vad', 'seg', 'VAD+seg'],
  ['dtw', 'dtw', 'DTW raw'],
  ['dtw', 'dtw-cal', 'DTW calibrated'],
  ['chunk', 'dtw', 'VAD chunks + DTW raw'],
  ['chunk', 'dtw-cal', 'VAD chunks + DTW calibrated'],
  ['dtw', 'seg', 'seg (no VAD)'],
];

const find = (q) => rows.find((r) => Object.entries(q).every(([k, v]) => r[k] === v));
const pct = (x) => (x === undefined || x === null ? '–' : `${(x * 100).toFixed(1)}%`);
const num = (x) => (x === undefined || x === null ? '–' : String(x));
const mean = (xs) => (xs.length === 0 ? null : xs.reduce((s, x) => s + x, 0) / xs.length);

function table(header, body) {
  return [
    `| ${header.join(' | ')} |`,
    `|${header.map(() => '---').join('|')}|`,
    ...body.map((r) => `| ${r.join(' | ')} |`),
  ].join('\n');
}

function cleanTable() {
  const body = [];
  for (const sample of SAMPLES) {
    const report = JSON.parse(
      readFileSync(path.join(samplePaths(sample).dir, 'clean.json'), 'utf8'),
    );
    const b = report.before;
    body.push([
      sample.id,
      'original',
      num(b.i),
      num(b.tp),
      num(b.lra),
      num(b.gapDb),
      num(b.speechToGapDb),
      num(b.paragraphDeltaDb),
      '–',
      '–',
    ]);
    for (const [name, v] of Object.entries(report.variants)) {
      body.push([
        sample.id,
        name,
        num(v.after.i),
        num(v.after.tp),
        num(v.after.lra),
        num(v.gapDb),
        num(v.speechToGapDb),
        num(v.paragraphDeltaDb),
        v.mode,
        num(v.ms),
      ]);
    }
  }
  return table(
    [
      'sample',
      'variant',
      'I LUFS',
      'TP dBTP',
      'LRA',
      'gap dBFS',
      'speech/gap dB',
      'para Δ dB',
      'loudness mode',
      'ms',
    ],
    body,
  );
}

const runSet = (q) => ({
  chunk: find({ ...q, mode: 'chunk', timing: 'dtw-cal' }),
  dtw: find({ ...q, mode: 'dtw', timing: 'dtw-cal' }),
  vad: find({ ...q, mode: 'vad', timing: 'seg' }),
});

const setCells = ({ chunk, dtw, vad }) => [
  pct(chunk?.wer),
  pct(chunk?.coverage),
  num(chunk?.missing),
  num(chunk?.error.start?.maeMs),
  num(chunk?.error.start?.p95Ms),
  pct(chunk?.error.start?.within150),
  pct(dtw?.wer),
  pct(dtw?.coverage),
  num(dtw?.error.start?.maeMs),
  pct(dtw?.error.start?.within150),
  pct(vad?.wer),
  num(vad?.error.start?.maeMs),
  pct(vad?.error.start?.within150),
];

const SET_HEADER = [
  'CHUNK WER',
  'CHUNK cov',
  'CHUNK miss',
  'CHUNK MAE ms',
  'CHUNK p95 ms',
  'CHUNK ≤150',
  'DTW WER',
  'DTW cov',
  'DTW MAE ms',
  'DTW ≤150',
  'VAD WER',
  'VAD MAE ms',
  'VAD ≤150',
];

function presetTable() {
  const inputs = [
    'reference',
    'original',
    'light',
    'standard',
    'standard-dyn',
    'standard+gl',
    'heavy',
  ];
  const body = [];
  for (const sample of SAMPLES) {
    for (const input of inputs) {
      const set = runSet({ sample: sample.id, input, model: 'small', backend: 'cuda' });
      body.push([sample.id, input, ...setCells(set)]);
    }
  }
  return table(['sample', 'input', ...SET_HEADER], body);
}

function modelTable(input) {
  const body = [];
  for (const sample of SAMPLES) {
    for (const model of MODELS) {
      const set = runSet({ sample: sample.id, input, model, backend: 'cuda' });
      if (!set.chunk) continue;
      body.push([sample.id, model, ...setCells(set), num(set.chunk.rtf)]);
    }
  }
  return table(['sample', 'model', ...SET_HEADER, 'RTF chunk'], body);
}

/** Mean over the 3 samples x 3 inputs (original, standard+gl, heavy) per model and mode. */
function modelSummaryTable() {
  const body = [];
  for (const model of MODELS) {
    for (const [mode, timing] of [
      ['chunk', 'dtw-cal'],
      ['dtw', 'dtw-cal'],
      ['vad', 'seg'],
    ]) {
      for (const lang of ['en', 'pl']) {
        const subset = rows.filter(
          (r) =>
            r.backend === 'cuda' &&
            r.model === model &&
            r.mode === mode &&
            r.timing === timing &&
            r.lang === lang &&
            ['original', 'standard+gl', 'heavy'].includes(r.input),
        );
        if (subset.length === 0) continue;
        const m = (f) => mean(subset.map(f).filter((x) => x !== null && x !== undefined));
        body.push([
          model,
          mode,
          lang,
          num(subset.length),
          pct(m((r) => r.wer)),
          pct(m((r) => r.coverage)),
          num(Math.round(m((r) => r.error.start?.maeMs))),
          num(Math.round(m((r) => r.error.start?.p95Ms))),
          pct(m((r) => r.error.start?.within150)),
          num(Math.max(...subset.map((r) => r.wer))),
        ]);
      }
    }
  }
  return table(
    [
      'model',
      'mode',
      'lang',
      'runs',
      'mean WER',
      'mean coverage',
      'mean MAE ms',
      'mean p95 ms',
      'mean ≤150',
      'worst WER',
    ],
    body,
  );
}

function timingMethodTable() {
  const body = TIMINGS.map(([mode, timing, label]) => {
    const subset = rows.filter(
      (r) => r.backend === 'cuda' && r.mode === mode && r.timing === timing && r.error.start,
    );
    const pick = (f) =>
      mean(subset.map((r) => f(r.error)).filter((x) => x !== null && x !== undefined));
    return [
      label,
      num(subset.length),
      num(Math.round(pick((e) => e.start.maeMs))),
      num(Math.round(pick((e) => e.start.medianMs))),
      num(Math.round(pick((e) => e.start.biasMs))),
      pct(pick((e) => e.start.within150)),
      num(Math.round(pick((e) => e.end?.maeMs))),
    ];
  });
  return table(
    [
      'timing source',
      'runs',
      'mean start MAE ms',
      'mean median ms',
      'mean bias ms',
      'mean ≤150 ms',
      'mean end MAE ms',
    ],
    body,
  );
}

function rtfTable() {
  const sample = SAMPLES[0].id;
  const body = [];
  for (const model of MODELS) {
    const cells = [];
    for (const backend of ['cuda', 'blas', 'cpu']) {
      for (const mode of ['vad', 'dtw', 'chunk'])
        cells.push(
          num(find({ sample, input: 'standard+gl', model, mode, backend, timing: 'seg' })?.rtf),
        );
    }
    body.push([model, ...cells]);
  }
  return table(
    [
      'model',
      'CUDA vad',
      'CUDA dtw',
      'CUDA chunk',
      'BLAS vad',
      'BLAS dtw',
      'BLAS chunk',
      'CPU vad',
      'CPU dtw',
      'CPU chunk',
    ],
    body,
  );
}

const md = [
  '## Clean chain (two-pass loudnorm -16 LUFS / TP -1.5; gain+limiter variant "standard+gl")',
  cleanTable(),
  '## Presets vs ASR (model small, CUDA)',
  presetTable(),
  '## Model summary (CUDA; mean over inputs original/standard+gl/heavy)',
  modelSummaryTable(),
  '## Timing source comparison (all CUDA runs)',
  timingMethodTable(),
  ...['original', 'standard+gl', 'heavy'].flatMap((input) => [
    `## Models on "${input}" (CUDA)`,
    modelTable(input),
  ]),
  `## Real-time factor (wall time incl. model load / audio duration), ${SAMPLES[0].id} standard+gl`,
  rtfTable(),
].join('\n\n');
writeFileSync(path.join(OUT_DIR, 'results.md'), `${md}\n`, 'utf8');
log(md);

/**
 * Small committed fixtures for PLAN 4.3/4.4 tests: whisper words (turbo-q5 + small, VAD chunks,
 * DTW calibrated input data) and SAPI ground truth per sample.
 */
function exportFixtures() {
  const dir = ensureDir(path.join(SPIKE_DIR, 'fixtures'));
  for (const sample of SAMPLES) {
    const paths = samplePaths(sample);
    const truth = JSON.parse(readFileSync(paths.truth, 'utf8'));
    writeJson(path.join(dir, `${sample.id}.truth.json`), {
      version: 1,
      source: 'Windows SAPI SpeakProgress events (word starts) + visemes (word ends)',
      ...truth,
    });
    for (const model of ['turbo-q5', 'small']) {
      const file = path.join(paths.dir, 'asr', `original.${model}.chunk.cuda.raw.json`);
      const raw = JSON.parse(readFileSync(file, 'utf8'));
      writeJson(path.join(dir, `${sample.id}.${model}.words.raw.json`), {
        version: raw.version,
        engine: raw.engine,
        model: raw.model,
        lang: raw.lang,
        mode: raw.mode,
        audioS: raw.audioS,
        words: raw.words,
      });
    }
  }
}

exportFixtures();
