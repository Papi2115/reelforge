// Downloads whisper.cpp Windows binaries, ggml models and an rnnoise model into .cache/,
// verifying every file against its published hash before it is used.
//   node spikes/03-audio/fetch.mjs [--only=<name,...>]
import { createHash } from 'node:crypto';
import {
  createWriteStream,
  existsSync,
  readFileSync,
  renameSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { BIN_DIR, CACHE_DIR, MODELS_DIR, ensureDir, log, runChecked } from './lib/common.mjs';

const WHISPER_TAG = 'b5130'; // nightly build of the v1.9.4 commit (927cfce); v1.9.4 itself ships no assets
const GH = `https://github.com/ggml-org/whisper.cpp/releases/download/${WHISPER_TAG}`;
const HF = 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main';
const RNN = 'https://raw.githubusercontent.com/GregorR/rnnoise-models/master';

/** sha256 values from the GitHub release API / Hugging Face LFS pointers; gitsha1 = git blob SHA-1. */
export const ASSETS = [
  {
    name: 'whisper-cpu',
    url: `${GH}/whisper-bin-x64.zip`,
    sha256: 'f9ec6c52a2e949b62ab51fa21d0d497958f9e41c3010c157c4e42932d5316f3c',
    unzipTo: path.join(BIN_DIR, 'cpu'),
  },
  {
    name: 'whisper-blas',
    url: `${GH}/whisper-blas-bin-x64.zip`,
    sha256: '55c06d09e8b9b6cfb2b0b47ddedc71803054f0e48be1f41848b3141c06c703a9',
    unzipTo: path.join(BIN_DIR, 'blas'),
  },
  {
    name: 'whisper-cuda',
    url: `${GH}/whisper-cublas-11.8.0-bin-x64.zip`,
    sha256: '0b29b2175bb17ec26da29677cbc7c467c57d103245144d62a49a703f6bc3fdae',
    unzipTo: path.join(BIN_DIR, 'cuda'),
  },
  {
    name: 'base',
    url: `${HF}/ggml-base.bin`,
    sha256: '60ed5bc3dd14eea856493d334349b405782ddcaf0028d4b5df4088345fba2efe',
  },
  {
    name: 'small',
    url: `${HF}/ggml-small.bin`,
    sha256: '1be3a9b2063867b937e64e2ec7483364a79917e157fa98c5d94b5c1fffea987b',
  },
  {
    name: 'medium',
    url: `${HF}/ggml-medium.bin`,
    sha256: '6c14d5adee5f86394037b4e4e8b59f1673b6cee10e3cf0b11bbdbee79c156208',
  },
  {
    name: 'large-v3-turbo-q5_0',
    url: `${HF}/ggml-large-v3-turbo-q5_0.bin`,
    sha256: '394221709cd5ad1f40c46e6031ca61bce88931e6e088c188294c6d5a55ffa7e2',
  },
  {
    name: 'silero-vad',
    url: 'https://huggingface.co/ggml-org/whisper-vad/resolve/main/ggml-silero-v6.2.0.bin',
    sha256: '2aa269b785eeb53a82983a20501ddf7c1d9c48e33ab63a41391ac6c9f7fb6987',
  },
  {
    name: 'rnnoise-sh',
    url: `${RNN}/somnolent-hogwash-2018-09-01/sh.rnnn`,
    gitsha1: 'f86e9efd3d78ec91b2d18cfd2262fe991fcb1d35',
  },
];

function targetFile(asset) {
  const fileName = path.basename(new URL(asset.url).pathname);
  return asset.unzipTo ? path.join(CACHE_DIR, 'dl', fileName) : path.join(MODELS_DIR, fileName);
}

function verify(asset, file) {
  const data = readFileSync(file);
  if (asset.sha256) {
    const actual = createHash('sha256').update(data).digest('hex');
    return { ok: actual === asset.sha256, algo: 'sha256', actual };
  }
  const header = Buffer.from(`blob ${String(data.length)}\0`);
  const actual = createHash('sha1').update(header).update(data).digest('hex');
  return { ok: actual === asset.gitsha1, algo: 'git-sha1', actual };
}

async function download(asset, file) {
  const response = await fetch(asset.url, { redirect: 'follow' });
  if (!response.ok || !response.body) {
    throw new Error(`GET ${asset.url} -> HTTP ${String(response.status)}`);
  }
  const tmp = `${file}.part`;
  await pipeline(Readable.fromWeb(response.body), createWriteStream(tmp));
  renameSync(tmp, file);
}

/** Windows ships bsdtar (System32\tar.exe) which can extract .zip; Git Bash's GNU tar cannot. */
async function unzip(zipFile, destination) {
  ensureDir(destination);
  const systemRoot = process.env.SystemRoot ?? 'C:\\Windows';
  const tar = path.join(systemRoot, 'System32', 'tar.exe');
  await runChecked(tar, ['-xf', zipFile, '-C', destination]);
}

async function fetchAsset(asset) {
  const file = targetFile(asset);
  ensureDir(path.dirname(file));
  if (!existsSync(file)) {
    log(`downloading ${asset.name} <- ${asset.url}`);
    const t0 = Date.now();
    await download(asset, file);
    const mb = statSync(file).size / 1e6;
    log(`  ${mb.toFixed(1)} MB in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  }
  const check = verify(asset, file);
  if (!check.ok) {
    throw new Error(`${asset.name}: ${check.algo} mismatch (got ${check.actual})`);
  }
  log(`ok ${asset.name} (${check.algo} verified)`);
  if (asset.unzipTo && !existsSync(path.join(asset.unzipTo, '.done'))) {
    await unzip(file, asset.unzipTo);
    writeFileSync(path.join(asset.unzipTo, '.done'), '');
  }
}

const onlyArg = process.argv.find((arg) => arg.startsWith('--only='));
const only = onlyArg ? onlyArg.slice('--only='.length).split(',') : null;
for (const asset of ASSETS) {
  if (only && !only.includes(asset.name)) continue;
  await fetchAsset(asset);
}
