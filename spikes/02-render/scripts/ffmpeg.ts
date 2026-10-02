/**
 * Minimal ffmpeg helpers for the spike: raw RGBA stdin encoder with back-pressure,
 * ffprobe JSON, single-frame extraction. Windows: no shell, tree-kill via `taskkill /T`.
 */
import { spawn, spawnSync, type ChildProcessByStdio } from 'node:child_process';
import type { Readable, Writable } from 'node:stream';

/** Encoder profiles compared by the spike (libx264 = ffmpeg default preset "medium"). */
export type VideoEncoder = 'libx264' | 'libx264-veryfast' | 'h264_nvenc';

export interface EncodeOptions {
  readonly output: string;
  readonly encoder: VideoEncoder;
  readonly width: number;
  readonly height: number;
  readonly fps: number;
  /** Input path for raw RGBA; omit to read from stdin. */
  readonly inputFile?: string;
}

export interface RawEncoder {
  write(frame: Uint8Array): Promise<void>;
  finish(): Promise<void>;
  kill(): void;
}

const ENCODER_ARGS: Readonly<Record<VideoEncoder, readonly string[]>> = {
  libx264: ['-c:v', 'libx264'],
  'libx264-veryfast': ['-c:v', 'libx264', '-preset', 'veryfast'],
  h264_nvenc: ['-c:v', 'h264_nvenc', '-preset', 'p4'],
};

export function encodeArgs(options: EncodeOptions): string[] {
  return [
    '-hide_banner',
    '-loglevel',
    'error',
    '-y',
    '-f',
    'rawvideo',
    '-pix_fmt',
    'rgba',
    '-s',
    `${String(options.width)}x${String(options.height)}`,
    '-r',
    String(options.fps),
    '-i',
    options.inputFile ?? '-',
    '-vf',
    'scale=1920:1080:flags=neighbor',
    ...ENCODER_ARGS[options.encoder],
    '-pix_fmt',
    'yuv420p',
    options.output,
  ];
}

export function killTree(pid: number | undefined): void {
  if (pid === undefined) return;
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], { windowsHide: true });
  } else {
    process.kill(pid, 'SIGKILL');
  }
}

function waitForExit(
  child: ChildProcessByStdio<Writable | null, null, Readable>,
  label: string,
): Promise<void> {
  let stderr = '';
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (chunk: string) => {
    stderr = (stderr + chunk).slice(-4000);
  });
  return new Promise((resolve, reject) => {
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${label} exited with ${String(code)}: ${stderr.trim()}`));
    });
  });
}

export function startRawEncoder(options: EncodeOptions): RawEncoder {
  const child = spawn('ffmpeg', encodeArgs(options), {
    stdio: ['pipe', 'ignore', 'pipe'],
    windowsHide: true,
  });
  const exited = waitForExit(child, 'ffmpeg');
  return {
    write(frame: Uint8Array): Promise<void> {
      return new Promise((resolve, reject) => {
        const flushed = child.stdin.write(frame, (error) => {
          if (error) reject(error);
        });
        if (flushed) resolve();
        else child.stdin.once('drain', resolve);
      });
    },
    async finish(): Promise<void> {
      child.stdin.end();
      await exited;
    },
    kill(): void {
      killTree(child.pid);
    },
  };
}

export async function encodeFile(options: EncodeOptions): Promise<void> {
  const child = spawn('ffmpeg', encodeArgs(options), {
    stdio: ['ignore', 'ignore', 'pipe'],
    windowsHide: true,
  });
  await waitForExit(child, 'ffmpeg');
}

function runCapture(command: string, args: readonly string[]): Promise<Buffer> {
  const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  const chunks: Buffer[] = [];
  child.stdout.on('data', (chunk: Buffer) => chunks.push(chunk));
  let stderr = '';
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (chunk: string) => {
    stderr = (stderr + chunk).slice(-4000);
  });
  return new Promise((resolve, reject) => {
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve(Buffer.concat(chunks));
      else reject(new Error(`${command} exited with ${String(code)}: ${stderr.trim()}`));
    });
  });
}

export interface ProbeResult {
  readonly codec: string;
  readonly width: number;
  readonly height: number;
  readonly frameRate: string;
  readonly frames: number;
  readonly durationSeconds: number;
  readonly pixFmt: string;
}

interface ProbeJson {
  streams?: {
    codec_name?: string;
    width?: number;
    height?: number;
    r_frame_rate?: string;
    nb_read_frames?: string;
    pix_fmt?: string;
  }[];
  format?: { duration?: string };
}

export async function probeVideo(file: string): Promise<ProbeResult> {
  const output = await runCapture('ffprobe', [
    '-v',
    'error',
    '-count_frames',
    '-select_streams',
    'v:0',
    '-show_entries',
    'stream=codec_name,width,height,r_frame_rate,nb_read_frames,pix_fmt:format=duration',
    '-of',
    'json',
    file,
  ]);
  const json = JSON.parse(output.toString('utf8')) as ProbeJson;
  const stream = json.streams?.[0];
  if (!stream) throw new Error(`ffprobe found no video stream in ${file}`);
  return {
    codec: stream.codec_name ?? '?',
    width: stream.width ?? 0,
    height: stream.height ?? 0,
    frameRate: stream.r_frame_rate ?? '?',
    frames: Number(stream.nb_read_frames ?? 0),
    durationSeconds: Number(json.format?.duration ?? 0),
    pixFmt: stream.pix_fmt ?? '?',
  };
}

/** Decodes one frame at `seconds` as raw RGB24 (1920x1080 expected), and also writes a PNG. */
export async function extractFrame(
  file: string,
  seconds: number,
  pngPath: string,
): Promise<Buffer> {
  const at = seconds.toFixed(3);
  await runCapture('ffmpeg', [
    '-v',
    'error',
    '-y',
    '-ss',
    at,
    '-i',
    file,
    '-frames:v',
    '1',
    pngPath,
  ]);
  return runCapture('ffmpeg', [
    '-v',
    'error',
    '-ss',
    at,
    '-i',
    file,
    '-frames:v',
    '1',
    '-f',
    'rawvideo',
    '-pix_fmt',
    'rgb24',
    '-',
  ]);
}
