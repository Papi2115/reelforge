// ffmpeg helpers: measurement (astats, loudnorm JSON) and plain runs. Expects ffmpeg/ffprobe on PATH.
import { run, runChecked } from './common.mjs';

const FFMPEG = process.env.FFMPEG ?? 'ffmpeg';
const FFPROBE = process.env.FFPROBE ?? 'ffprobe';

export function ffmpeg(args, cwd) {
  return runChecked(FFMPEG, ['-hide_banner', '-nostdin', '-y', ...args], { cwd });
}

export async function durationSeconds(file) {
  const result = await runChecked(FFPROBE, [
    '-v',
    'error',
    '-show_entries',
    'format=duration',
    '-of',
    'csv=p=0',
    file,
  ]);
  return Number(result.stdout.trim());
}

/** Overall RMS / peak (dBFS) of [start, end) seconds of a file. */
export async function levels(file, start, end) {
  const trim = start === undefined ? '' : `atrim=start=${String(start)}:end=${String(end)},`;
  const result = await runChecked(FFMPEG, [
    '-hide_banner',
    '-nostdin',
    '-i',
    file,
    '-af',
    `${trim}astats=measure_perchannel=none`,
    '-f',
    'null',
    '-',
  ]);
  const pick = (label) => {
    const match = new RegExp(`${label}:\\s*(-?[\\d.]+|-inf)`).exec(
      result.stderr.split('Overall').pop() ?? '',
    );
    if (!match) throw new Error(`astats: ${label} not found`);
    return match[1] === '-inf' ? -Infinity : Number(match[1]);
  };
  return { rmsDb: pick('RMS level dB'), peakDb: pick('Peak level dB') };
}

/** Runs loudnorm in analysis mode after an optional filter chain; returns the parsed JSON stats. */
export async function loudnormStats(file, prefixFilters, loudnormArgs, cwd) {
  const chain = [...prefixFilters, `loudnorm=${loudnormArgs}:print_format=json`].join(',');
  const args = ['-hide_banner', '-nostdin', '-i', file, '-af', chain, '-f', 'null', '-'];
  const result = await run(FFMPEG, args, { cwd });
  if (result.code !== 0) throw new Error(`loudnorm analysis failed: ${result.stderr.slice(-800)}`);
  const start = result.stderr.lastIndexOf('{');
  const end = result.stderr.lastIndexOf('}');
  if (start < 0 || end < start) throw new Error('loudnorm: no JSON block in stderr');
  const parsed = JSON.parse(result.stderr.slice(start, end + 1));
  return { stats: parsed, ms: result.ms };
}
