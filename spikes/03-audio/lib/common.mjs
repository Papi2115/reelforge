// Shared helpers for the audio spike: paths, logging, process spawning.
// Node built-ins only (spike must not add npm dependencies).
import { spawn } from 'node:child_process';
import { mkdirSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const SPIKE_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const CACHE_DIR = path.join(SPIKE_DIR, '.cache');
export const SAMPLES_DIR = path.join(SPIKE_DIR, 'samples');
export const OUT_DIR = path.join(CACHE_DIR, 'out');
export const BIN_DIR = path.join(CACHE_DIR, 'bin');
export const MODELS_DIR = path.join(CACHE_DIR, 'models');

export function log(...parts) {
  process.stdout.write(`${parts.map(String).join(' ')}\n`);
}

export function ensureDir(dir) {
  mkdirSync(dir, { recursive: true });
  return dir;
}

/** Atomic JSON write (tmp + rename), UTF-8. */
export function writeJson(file, value) {
  ensureDir(path.dirname(file));
  const tmp = `${file}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  renameSync(tmp, file);
}

/**
 * Spawn a binary without a shell (args passed verbatim, so paths with spaces are safe).
 * Resolves with exit code, captured output and wall time; rejects only on spawn failure.
 */
export function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const started = process.hrtime.bigint();
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env ?? process.env,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const out = [];
    const err = [];
    child.stdout.on('data', (chunk) => out.push(chunk));
    child.stderr.on('data', (chunk) => err.push(chunk));
    child.on('error', reject);
    child.on('close', (code) => {
      const ms = Number(process.hrtime.bigint() - started) / 1e6;
      resolve({
        code: code ?? -1,
        stdout: Buffer.concat(out).toString('utf8'),
        stderr: Buffer.concat(err).toString('utf8'),
        ms,
      });
    });
  });
}

/** Like run() but throws with the stderr tail when the exit code is non-zero. */
export async function runChecked(command, args, options = {}) {
  const result = await run(command, args, options);
  if (result.code !== 0) {
    const tail = result.stderr.split('\n').slice(-15).join('\n');
    throw new Error(`${path.basename(command)} exited ${String(result.code)}:\n${tail}`);
  }
  return result;
}
