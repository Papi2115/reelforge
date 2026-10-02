# whisper.cpp in ReelForge (Words timed)

Words timed transcribes the voice-over with [whisper.cpp](https://github.com/ggml-org/whisper.cpp)
(MIT) to time every word (ADR-003, `docs/spikes/03-audio.md`). Nothing is bundled with the app:
the engine and its models are **downloaded on demand, once**, from the official sources and checked
against pinned SHA-256 hashes (`packages/pipeline/src/asr/assets.ts`).

## What gets downloaded

| Piece | Source | Size |
|---|---|---|
| whisper.cpp CPU build (OpenBLAS), release `b5130` / v1.9.4 | GitHub release `whisper-blas-bin-x64.zip` | 21 MB |
| whisper.cpp CUDA build (only when `nvidia-smi -L` lists a GPU) | GitHub release `whisper-cublas-11.8.0-bin-x64.zip` | 273 MB |
| Silero VAD model (always) | Hugging Face `ggml-org/whisper-vad` | 0.9 MB |
| Recommended model `large-v3-turbo-q5_0` | Hugging Face `ggerganov/whisper.cpp` | 574 MB |
| Other models (`small`, `medium`, `base`) | Hugging Face | 488 MB / 1.5 GB / 148 MB |

A first setup is ≈ 600 MB without an NVIDIA GPU (CPU build + VAD + recommended model) and
≈ 870 MB with one (plus the CUDA build). Everything goes to `%LOCALAPPDATA%\ReelForge\whisper`
(`bin\<cuda|blas|cpu>`, `models\`). Downloads stream to a `.part` file, are hashed while they
arrive and only then renamed into place; the release zips are unpacked into a staging folder and
swapped in atomically.

## Where the user installs it

- **Words timed** – when it is run (Run / Redo / a group that includes it) and whisper.cpp, the
  VAD model or the chosen model is missing, the pipeline sidebar holds the run and shows
  "Words timed needs the transcription engine (≈ 600 MB, one-time)" with **Download and continue**:
  progress (bytes, speed, time left, Cancel) in place, then the stage runs by itself. A failure
  shows what to do (below) with Show details, Try again and **Open Settings**. A run that failed
  for the same reason (e.g. started from the chat) shows the same notice.
- **Settings → Tools → Whisper engine** – Installed (builds, whisper.cpp version, CUDA state) or
  Not installed with **Install**; **Re-detect**; **Browse…** for a whisper-cli you already have;
  **Use existing installation found at …** for builds found through `REELFORGE_WHISPER`, `PATH` or
  common folders (`%USERPROFILE%\whisper.cpp\build\bin\Release`, unzipped release folders in
  Downloads, `C:\whisper.cpp`, …).
- **Settings → Tools → Whisper models** – **Install recommended model**, per-model Download /
  Cancel / Delete; sizes are shown up front and downloads above 200 MB ask first
  ("Download 574 MB?").
- **First run** – step 2 of the first-run dialog, "Prepare tools" (optional, skippable): ffmpeg
  found? whisper.cpp installed? with the same download button.

Only one whisper download runs at a time (the app's main process owns it; every view shows it).

## Errors and what the app tells the user

| Cause | Message |
|---|---|
| No connection (DNS, refused, reset, timeout, TLS) | Could not reach the download server … check the internet connection, proxy or firewall |
| HTTP error | The download server answered HTTP <code> … try again later |
| Hash mismatch | The download did not match its published checksum and was deleted … try again |
| Disk full (checked up front: download + ≈ 2.2× the zips for unpacking; `ENOSPC` later) | Not enough free disk space … in `<folder>` |
| `EPERM` / `EACCES` / `EBUSY`, or `whisper-cli.exe` gone right after unpacking | Windows or your antivirus software blocked whisper.cpp … allow `whisper-cli.exe` / add an exclusion, or use Browse… |

If a whisper-cli chosen in Settings stops working, installing the app's build switches back to it.

## GPU

The CUDA build is used when an NVIDIA GPU is present (turbo model: ≈ 0.09× real time vs ≈ 0.8× on
the CPU). Before every transcription the app runs `whisper-cli --version` (≈ 0.2 s, no model) and
reads ggml's `ggml_cuda_init:` line. If CUDA finds **no device**, the CUDA build is skipped — it
would silently decode on the CPU, slower than the OpenBLAS build — and the reason is recorded in
`timing/words.raw.json` (`fallbacks`) and `reports/words.json` (`engine.cpuReason`). The Words timed
panel then says "Transcription ran on the CPU (slow: … s for … s of audio) because …" with what to
check. Settings → Tools shows the same CUDA state for the installed CUDA build.

Investigation on the dev laptop (HP Victus 15-fb, Radeon 740M iGPU + RTX 4050 Laptop dGPU,
2026-10-02): the CUDA build printed `ggml_cuda_init: failed to initialize CUDA: no CUDA-capable
device is detected` for `--help`/`--version` and for a real transcription, from any working
directory; `nvidia-smi` failed too ("insufficient permissions") and `Get-PnpDevice -Class Display`
listed the RTX 4050 with status *Unknown* (= not present on the bus), the Radeon as OK. So the
dGPU was switched off at the system level (laptop GPU mode / power state), not hidden by our
invocation: no `CUDA_VISIBLE_DEVICES`, and the CUDA runtime DLLs (`cudart64_110.dll`, cuBLAS linked
into `ggml-cuda.dll`) sit next to the exe and load fine. Nothing to fix in the spawn; what helps:

- switch the laptop's GPU mode to Hybrid/Discrete (vendor app such as OMEN Gaming Hub, or the
  BIOS/MUX setting), not an Eco/iGPU-only mode, and keep the charger connected;
- Windows Settings → System → Display → Graphics → add `whisper-cli.exe`
  (`%LOCALAPPDATA%\ReelForge\whisper\bin\cuda\Release\`) and ReelForge → High performance
  (CUDA does not follow this setting, but on some hybrid laptops it keeps the dGPU awake);
- then Settings → Tools → Re-detect (the CUDA state should read available) and Redo Words timed.

## Known limitation

whisper.cpp b5130 opens model files with the ANSI file API on Windows: a models folder whose path
contains non-ASCII characters (e.g. a Windows user name with Polish letters) cannot be loaded
(`whisper_vad_init_from_file_with_params` fails). Audio and output paths are fine.

## Test hooks (unpackaged app + `REELFORGE_TEST_HOOKS=1` only)

- `REELFORGE_TEST_WHISPER_ROOT` – install into this folder instead of `%LOCALAPPDATA%`.
- `REELFORGE_TEST_WHISPER_MIRROR` – "download" from this folder (files named like the assets);
  an optional `hashes.json` there re-pins assets to small test files
  (`apps/desktop/src/main/whisper/testing/fake-mirror.ts`); without it the real hashes are checked,
  e.g. against a folder of really downloaded files.
- `REELFORGE_TEST_WHISPER_MIRROR_DELAY_MS` – pause per 64 KB chunk (progress / cancel in tests).

`apps/desktop/test/whisper.smoke.test.ts` drives the Settings install and the sidebar
"Download and continue" path with these hooks; no test downloads anything from the internet.
