// Builds the test voiceovers: SAPI TTS (clean, with word events) -> ground truth timings ->
// degraded "home recording" (uneven gain, pink/white noise at a target SNR, 50 Hz hum).
//   node spikes/03-audio/prepare.mjs
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { cleanWord, tokenizeScript } from './align.mjs';
import { SPIKE_DIR, ensureDir, log, runChecked, writeJson } from './lib/common.mjs';
import { durationSeconds, ffmpeg, levels } from './lib/ffmpeg.mjs';
import { SAMPLES, samplePaths } from './lib/samples.mjs';

const SR = 48000;
const LEAD_MS = 1500;
const TAIL_MS = 1000;

async function synthesize(sample, paths) {
  await runChecked('powershell.exe', [
    '-NoProfile',
    '-ExecutionPolicy',
    'Bypass',
    '-File',
    path.join(SPIKE_DIR, 'synth.ps1'),
    '-TextFile',
    paths.script,
    '-Voice',
    sample.voice,
    '-OutWav',
    paths.tts,
    '-OutEvents',
    paths.ttsEvents,
    '-LeadMs',
    String(LEAD_MS),
    '-ParagraphBreakMs',
    String(sample.breakMs),
    '-TailMs',
    String(TAIL_MS),
  ]);
}

/**
 * Maps SAPI SpeakProgress events onto script words. SAPI may report one event for a group of
 * words (e.g. "w 1969 roku"); only the first word of such a group gets a ground-truth start.
 * End = end of the last non-silence viseme before the next event.
 */
function buildTruth(scriptText, events, durationS) {
  const script = tokenizeScript(scriptText);
  const seen = new Set();
  const unique = events.words.filter((e) => !seen.has(e.charPos) && seen.add(e.charPos));
  const truth = script.map((w) => ({ text: w.text, paragraph: w.paragraph, t: null, tEnd: null }));
  let pointer = 0;
  unique.forEach((event, k) => {
    const parts = event.text.split(/\s+/).filter((p) => cleanWord(p).length > 0);
    if (parts.length === 0 || pointer >= script.length) return;
    let at = pointer;
    while (
      at < Math.min(script.length, pointer + 4) &&
      cleanWord(script[at].text) !== cleanWord(parts[0])
    )
      at++;
    if (at >= script.length || cleanWord(script[at].text) !== cleanWord(parts[0])) return;
    const startMs = event.ms;
    const nextMs = k + 1 < unique.length ? unique[k + 1].ms : durationS * 1000;
    truth[at].t = startMs / 1000;
    if (parts.length === 1) {
      const ends = events.visemes
        .filter((v) => v.viseme !== 0 && v.ms >= startMs && v.ms < nextMs)
        .map((v) => v.ms + v.durMs);
      truth[at].tEnd = ends.length > 0 ? Math.max(...ends) / 1000 : null;
    }
    pointer = at + parts.length;
  });
  return truth;
}

function paragraphSpans(truth) {
  const spans = [];
  for (const word of truth) {
    if (word.t === null) continue;
    const span = (spans[word.paragraph] ??= { start: word.t, end: word.t });
    span.end = Math.max(span.end, word.tEnd ?? word.t);
  }
  return spans;
}

const dbToGain = (db) => 10 ** (db / 20);
const powerOf = (db) => 10 ** (db / 10);

async function degrade(sample, paths, spans, durationS) {
  const { degrade: recipe } = sample;
  const split = (spans[0].end + spans[1].start) / 2;
  const [g1, g2] = recipe.gainsDb.map(dbToGain);
  const gained = path.join(paths.dir, 'voice.gained.wav');
  await ffmpeg([
    '-i',
    paths.tts,
    '-af',
    `aresample=${String(SR)},volume='if(lt(t,${split.toFixed(3)}),${g1.toFixed(5)},${g2.toFixed(5)})':eval=frame`,
    '-c:a',
    'pcm_f32le',
    gained,
  ]);
  // Active speech power: duration-weighted mean over the paragraphs (excludes long gaps).
  let energy = 0;
  let seconds = 0;
  for (const span of spans) {
    const { rmsDb } = await levels(gained, span.start, span.end);
    energy += powerOf(rmsDb) * (span.end - span.start);
    seconds += span.end - span.start;
  }
  const speechDb = 10 * Math.log10(energy / seconds);
  const noiseDb = speechDb - recipe.snrDb;
  const colorDb = noiseDb - 10 * Math.log10(recipe.noiseColors.length);
  const noiseInputs = [];
  for (const [index, color] of recipe.noiseColors.entries()) {
    const file = path.join(paths.dir, `noise.${color}.wav`);
    await ffmpeg([
      '-f',
      'lavfi',
      '-i',
      `anoisesrc=color=${color}:amplitude=0.5:seed=${String(42 + index)}:sample_rate=${String(SR)}:duration=${durationS.toFixed(3)}`,
      '-c:a',
      'pcm_f32le',
      file,
    ]);
    const { rmsDb } = await levels(file);
    noiseInputs.push({ file, gain: dbToGain(colorDb - rmsDb) });
  }
  const humAmp = dbToGain(recipe.humDb) / Math.sqrt((1 + 0.25 + 0.09) / 2);
  const hum = `aevalsrc='${humAmp.toFixed(6)}*(sin(2*PI*50*t)+0.5*sin(2*PI*100*t)+0.3*sin(2*PI*150*t))':s=${String(SR)}:d=${durationS.toFixed(3)}`;
  const inputs = [
    '-i',
    gained,
    ...noiseInputs.flatMap((n) => ['-i', n.file]),
    '-f',
    'lavfi',
    '-i',
    hum,
  ];
  const scaled = noiseInputs.map(
    (n, k) => `[${String(k + 1)}:a]volume=${n.gain.toFixed(6)}[n${String(k)}]`,
  );
  const mixIn = [
    '[0:a]',
    ...noiseInputs.map((_, k) => `[n${String(k)}]`),
    `[${String(noiseInputs.length + 1)}:a]`,
  ];
  const graph = [
    ...scaled,
    `${mixIn.join('')}amix=inputs=${String(mixIn.length)}:duration=first:normalize=0`,
  ].join(';');
  await ffmpeg([
    ...inputs,
    '-filter_complex',
    graph,
    '-ac',
    '1',
    '-c:a',
    'pcm_s16le',
    paths.original,
  ]);
  const out = await levels(paths.original);
  return {
    speechDb,
    noiseDb,
    humDb: recipe.humDb,
    snrDb: recipe.snrDb,
    peakDb: out.peakDb,
    splitS: split,
  };
}

async function prepare(sample) {
  const paths = samplePaths(sample);
  ensureDir(paths.dir);
  await synthesize(sample, paths);
  const durationS = await durationSeconds(paths.tts);
  const events = JSON.parse(readFileSync(paths.ttsEvents, 'utf8'));
  const truth = buildTruth(readFileSync(paths.script, 'utf8'), events, durationS);
  const spans = paragraphSpans(truth);
  const gap = { start: spans[0].end + 0.3, end: spans[1].start - 0.3 };
  writeJson(paths.truth, { durationS, spans, gap, words: truth });
  await ffmpeg([
    '-i',
    paths.tts,
    '-af',
    `aresample=${String(SR)}`,
    '-c:a',
    'pcm_s16le',
    paths.reference,
  ]);
  const report = await degrade(sample, paths, spans, durationS);
  writeJson(paths.degradeReport, report);
  const timed = truth.filter((w) => w.t !== null).length;
  log(
    `${sample.id}: ${durationS.toFixed(1)} s, ${String(truth.length)} words (${String(timed)} with truth),`,
    `speech ${report.speechDb.toFixed(1)} dBFS, noise ${report.noiseDb.toFixed(1)} dBFS, peak ${report.peakDb.toFixed(1)} dBFS`,
  );
}

for (const sample of SAMPLES) await prepare(sample);
