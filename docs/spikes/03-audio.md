# Spike 03 — Voiceover audio pipeline (ffmpeg clean, whisper.cpp words, script alignment)

**Date:** 2026-10-02 · **Task:** PLAN.md 1.3 · **Code:** `spikes/03-audio/` · **Verdict:** **GO for D6 and D7** (with the conditions in §8)

Machine: Windows 11, RTX 4050 Laptop 6 GB (driver 592.82), 6C/12T, 15 GB RAM, Node 24, ffmpeg 8.1.1 (gyan.dev full/GPL build).
whisper.cpp: release **b5130** (= v1.9.4 commit `927cfce`; the `v1.9.4` release itself has no assets).

## 1. TL;DR

| Decision | Recommendation |
|---|---|
| Default ASR model (EN + PL) | **`ggml-large-v3-turbo-q5_0.bin`** (574 MB). EN WER 4.7–6 %, PL 4.2 % (only "4 KB"/"1 MHz" formatting), start-time MAE 61–101 ms. |
| Fallback / CPU-only / "fast" | **`ggml-small.bin`** (488 MB). PL WER 0–1.4 %, EN 14–26 % on robotic SAPI voices, but timing as good as turbo after alignment (MAE 55–99 ms). |
| Not worth shipping | `base` (EN WER 30–50 %), `medium` (1.5 GB, slower, worse timing, no WER gain over turbo). |
| Word timing method | **Silero-VAD chunks → one whisper-cli call with `-dtw <preset> -nfa` → DTW token times minus a per-model lead (turbo 210 ms, small 200 ms) → Needleman–Wunsch alignment to the script.** Mean start MAE 94 ms, 88 % of words within ±150 ms (all CUDA runs). |
| Backend | CUDA build (`whisper-cublas-11.8.0-bin-x64.zip`, 273 MB) when an NVIDIA GPU exists: turbo RTF 0.087. CPU: BLAS build (21 MB) RTF 0.77 turbo / 0.24 small. |
| ASR input | **The original recording** (just → 16 kHz mono). Denoising never improved ASR; rnnoise ("heavy") made turbo worse on the noisy sample (WER 6 % → 19 %). |
| Clean preset default | **standard** = `highpass=f=80, afftdn=nr=20:nf=<measured floor>` + **linear gain + limiter** to −16 LUFS (not loudnorm). |
| Loudness | two-pass `loudnorm` always fell back to *dynamic* mode on VO (peak-to-loudness too high) → I off by up to 0.8 LU and pauses pumped up. Gain + `alimiter` hit −16.1 LUFS ±0.1 with TP ≤ −1.9 dBTP. |

## 2. Method

1. **Samples** (no recordings exist; no paid TTS): Windows SAPI `System.Speech` voices — David (en-US), Paulina (pl-PL), Zira (en-US); all installed. Scripts written for the spike: `spikes/03-audio/samples/*.txt` (71–86 words, numbers, punctuation, Polish diacritics). 1.5 s lead silence, 2.5/3/4 s paragraph pause, 1 s tail → 38–43 s per sample.
2. **Ground truth**: SAPI `SpeakProgress` (word start) + `VisemeReached` (last non-silent viseme → word end). Spot-checked against the waveform: RMS jumps from −56 to −19 dBFS exactly at the reported onsets. 239 of 241 script words have a truth start (SAPI reports "w 1969 roku" as one event → only its first word is timed).
3. **Degradation** (`prepare.mjs`): per-paragraph gain step (−8/−14, −10/−4, −6/−12 dB → uneven takes), seeded `anoisesrc` (pink; white+pink for the noisy one) at active-speech SNR **20 / 15 / 6 dB**, 50 Hz hum + 100/150 Hz harmonics at −50/−45/−38 dBFS, 48 kHz mono s16.
4. **Clean** (`clean.mjs`): presets × loudness method, measured with `loudnorm print_format=json` (I/TP/LRA) and `astats` (paragraph levels, the long pause = noise floor).
5. **ASR** (`asr.mjs`, `matrix.mjs`): 4 models × 3 modes (`dtw` = whole file + DTW, `vad` = whisper `--vad`, `chunk` = VAD chunks + DTW) × inputs × backends = 168 runs. Every run → `align.mjs` → WER, coverage, timing error vs truth.
6. **Alignment** (`align.mjs`): Needleman–Wunsch on normalised sub-tokens (lowercase, punctuation stripped, hyphens split, integers spelled out EN/PL so "1969" ≡ "tysiąc dziewięćset…"), Polish diacritic folding (incl. `ł`), fuzzy Levenshtein matches, **merge/split moves up to 3:1 / 1:3** ("asmolteam" ≡ "a small team", "can not" ≡ "cannot"). Output per script word: `t`, `tEnd`, `confidence`, `status` (exact | folded | fuzzy | missing→interpolated), plus mismatch regions and ASR insertions. Unit tests: `node --test spikes/03-audio/` (10 tests).

Reproduce: `node spikes/03-audio/run.mjs` (fetch ≈ 3 GB once → prepare → clean → matrix → report; ≈ 25 min, cached afterwards). Full tables: `spikes/03-audio/.cache/out/results.md`.

**Caveat:** synthetic voices. David in particular is robotic (whisper hears "Asmolteam Intexas" even on the clean file), so EN WER is pessimistic; Paulina is clean. The DTW lead values are fitted in-sample (see §5) and must be re-validated on a real recording.

## 3. Clean chain — loudness and noise

| sample | variant | I LUFS | TP dBTP | LRA | pause dBFS | speech/pause dB | para Δ dB | method |
|---|---|---|---|---|---|---|---|---|
| en-doom | original | −30.9 | −10.0 | 8.7 | −47.2 | 16.7 | 5.3 | – |
| en-doom | standard | −16.3 | −1.5 | 6.0 | −36.0 | 20.0 | 3.7 | loudnorm (dynamic) |
| en-doom | standard+gl | **−16.1** | −2.0 | 7.9 | −38.0 | 22.1 | 4.6 | gain + limiter |
| en-doom | heavy | −16.3 | −1.5 | 6.3 | −47.5 | 31.5 | 3.9 | loudnorm (dynamic) |
| pl-apollo | original | −26.0 | −5.4 | 7.3 | −39.2 | 13.7 | 5.2 | – |
| pl-apollo | standard | −15.8 | −1.5 | 6.0 | −30.0 | 14.7 | 1.9 | loudnorm (dynamic) |
| pl-apollo | standard-dyn | −16.5 | −1.5 | 11.8 | −31.4 | 15.4 | **0.4** | + dynaudnorm |
| pl-apollo | standard+gl | **−16.1** | −2.0 | 6.9 | −35.0 | 19.1 | 4.7 | gain + limiter |
| pl-apollo | heavy | −15.7 | −1.5 | 5.9 | −47.7 | 32.4 | 1.9 | loudnorm (dynamic) |
| en-prism-noisy | original | −28.5 | −8.4 | 5.8 | −33.0 | 6.0 | 4.2 | – |
| en-prism-noisy | light | −16.8 | −1.4 | 5.4 | −22.2 | 7.2 | 3.2 | loudnorm (dynamic) |
| en-prism-noisy | standard | −16.7 | −1.5 | 6.6 | −25.0 | 9.8 | 3.7 | loudnorm (dynamic) |
| en-prism-noisy | standard+gl | **−16.1** | −1.9 | 8.5 | −27.6 | 12.3 | 4.9 | gain + limiter |
| en-prism-noisy | heavy | −16.5 | −1.5 | 7.2 | −43.9 | 28.2 | 4.3 | loudnorm (dynamic) |

Presets (as tested): light = `highpass=f=70,afftdn=nr=10:nf=NF`; standard = `highpass=f=80,afftdn=nr=20:nf=NF`; heavy = `highpass=f=80,arnndn=m=sh.rnnn`; NF = 10th percentile of 50 ms RMS windows (−51/−42/−35 dBFS, matches the injected noise within 1 dB). Processing: 0.75–1.6 s per 40 s file.

Findings:
- **loudnorm two-pass went dynamic on 12/12 runs**: VO has a high peak-to-loudness ratio, so the linear gain would break TP −1.5. Dynamic mode = AGC: integrated loudness off by up to 0.83 LU and pauses raised. Linear gain + `alimiter=limit=0.794` (−2 dBFS sample peak; true peak measured −1.9…−2.0 dBTP) + one corrective pass: always within 0.13 LU.
- **afftdn needs a measured noise floor.** With `tn=1` (track noise) or a fixed `nf` far from the real floor it removes only ~2 dB regardless of `nr`; with `nf` = measured floor it removes ~6 dB more in the pause (noisy sample: −34.9 → −41.2 dBFS after the high-pass).
- **arnndn (rnnoise `sh.rnnn`, from GregorR/rnnoise-models)** is by far the strongest denoiser (+15–22 dB speech/pause), but (a) it must run *before* afftdn — `highpass,afftdn,arnndn` suppressed the *speech* by ~30 dB (reproducible, root cause not investigated), (b) it hurts ASR (§4). Use only for the listening stem in a "heavy" preset.
- Uneven takes (para Δ 4–5 dB) survive every preset; only `dynaudnorm` levelled them (PL 5.2 → 0.4 dB) at the cost of LRA 6 → 12 and slightly louder pauses. Offer as an optional "level takes" toggle, not default.
- 50 Hz hum: the 80 Hz high-pass removes the fundamental; harmonics are left to afftdn. Not measured separately.

## 4. ASR — models, modes, backends

Mean over inputs original / standard+gl / heavy (CUDA). MAE/p95 = |aligned word start − truth| over all script words (interpolated ones included).

| model | mode | lang | mean WER | coverage | start MAE ms | p95 ms | ≤150 ms | worst WER |
|---|---|---|---|---|---|---|---|---|
| base | chunk | en | 40.4 % | 65 % | 160 | 579 | 73 % | 43 % |
| small | chunk | en | 20.3 % | 84 % | **87** | 212 | **92 %** | 26 % |
| small | chunk | pl | **0.5 %** | 99.5 % | **64** | 153 | **96 %** | 1.4 % |
| medium | chunk | en | 12.4 % | 90 % | 115 | 327 | 83 % | 18 % |
| medium | chunk | pl | 4.2 % | 96 % | 90 | 233 | 87 % | 5.6 % |
| turbo-q5 | chunk | en | **7.9 %** | 93 % | 95 | 206 | 88 % | 19 % (heavy input) |
| turbo-q5 | chunk | pl | 4.2 % | 96 % | 66 | 132 | 96 % | 4.2 % |
| turbo-q5 | dtw (whole file) | en | 6.9 % | 95 % | 92 | 200 | 88 % | 18 % |
| turbo-q5 | vad (`--vad`) | en | 9.1 % | 92 % | 255 | 746 | 51 % | 23 % |

Turbo, chunk mode, on the **original** (uncleaned) file: en-doom WER 4.7 % / MAE 93 ms, pl-apollo 4.2 % / 70 ms, en-prism-noisy (6 dB SNR) 6.0 % / 91 ms.

Timing source comparison (48 CUDA runs each):

| timing source | start MAE ms | median ms | bias ms | ≤150 ms | end MAE ms |
|---|---|---|---|---|---|
| segment offsets, no VAD (`-ml 1 -sow`) | 696 | 484 | −370 | 25 % | 696 |
| `--vad` segment offsets | 239 | 127 | −40 | 60 % | 233 |
| DTW raw (`-dtw`) | 334 | 240 | +208 | 18 % | 437 |
| DTW calibrated | 170 | 69 | −22 | 85 % | 261 |
| **VAD chunks + DTW calibrated** | **94** | **62** | +24 | **88 %** | 190 |

Why chunk mode: whole-file decoding failed catastrophically 3 times (small on the *clean* noisy-script reference dropped the whole first paragraph: WER 51 %; medium on "heavy" looped one sentence 3×; small on "standard" hallucinated "the leaves are made of the same color as the rainbow"). `-mc 0` did not help. Cutting at silences ≥ 1.5 s (Silero VAD via `whisper-vad-speech-segments.exe`), merging up to 28 s, padding 0.25 s, and passing all chunk files to **one** `whisper-cli` call (model loads once; each chunk gets `<chunk>.wav.json`) removed those failures. Splitting at every ≥ 0.8 s pause was worse (short chunks lose context → WER up in noise) — chunks must stay long.

Real-time factor (wall time incl. model load ÷ audio duration, 43 s file):

| model | CUDA chunk | BLAS chunk | CPU chunk | CUDA dtw | CUDA vad |
|---|---|---|---|---|---|
| base | 0.064 | 0.097 | 0.109 | 0.070 | 0.056 |
| small | 0.083 | 0.237 | 0.280 | 0.073 | 0.065 |
| medium | 0.133 | 0.646 | 0.790 | 0.121 | 0.106 |
| turbo-q5 | 0.087 | 0.768 | 0.927 | 0.082 | 0.064 |

Numbers include the fixed model-load time, so long files scale better than linear. Upper bounds for a 10-min VO: turbo on CUDA < 1 min, on CPU ≈ 8–9 min; small on CPU ≈ 3 min. Transcripts differ slightly between CPU/BLAS/CUDA (float differences), WER within ±1–4 pp except base.

## 5. Timing calibration (DTW lead)

whisper.cpp DTW token times lag the spoken onset by a stable, model-specific amount (median signed error over exact-matched words, per sample × input):

| model | en-doom | pl-apollo | en-prism-noisy | used lead |
|---|---|---|---|---|
| base | 245–265 | 190–215 | 215–245 | 230 ms |
| small | 205–235 | 150–185 | 185–215 | 200 ms |
| medium | 345–380 | 285–305 | 330–355 | 330 ms |
| turbo-q5 | 215–240 | 165–195 | 210–240 | 210 ms |

Spread ±40 ms across voices/languages/noise → a constant per model is enough. Values are in-sample on SAPI voices: re-measure once on a real recording (Papi's voice) in 4.3 and keep them as config, not code.

## 6. Alignment

- Coverage (words matched exact/diacritic-folded) with turbo chunk: 93–96 %; remaining words are fuzzy (merged/misspelt, timed from the matched ASR word, split by letter count) or missing (interpolated between neighbours, `confidence: 0`). `monotonic` was violated only in 14 of 392 (run × timing) rows, all DTW timings of broken transcripts (base model, medium repetition loop): DTW times themselves go backwards there → the aligner must clamp `t` to be non-decreasing and flag it.
- Typical mismatches the app must show as "check this": unit/number formatting ("4 kilobajty" → "4 KB", "jednego megaherca" → "1 MHz"), homophones ("prism" → "prison"), merged words.
- **Performance is the open problem:** the full-matrix DP with merge moves costs 47 ms for 86 words, 4.9 s for 860, **21.6 s for 1 720 words** (~11 min VO). Needs a band / anchor split for 4.4.

## 7. Pitfalls (verified)

- **DTW needs `-nfa`**: flash attention is on by default in this build and silently leaves `t_dtw = -1`.
- `--vad` maps segment offsets back to the input timeline, **not** `t_dtw` → VAD and DTW cannot be combined in one call; chunk the audio yourself.
- `-ml 1 -sow` segment offsets without VAD are useless for timing (first word at 0.00 s although speech starts at 1.6 s; drift up to 1.1 s).
- `whisper-vad-speech-segments.exe` prints nothing with `-np`; parse stdout without it (times in centiseconds).
- Multi-file `whisper-cli a.wav b.wav` writes `a.wav.json`, `b.wav.json` (do not pass `-of`).
- Windows paths: whisper-cli, the VAD tool and ffmpeg handled **spaces and Polish characters** in model/input/output paths and a UTF-8 `--prompt` (tested `żółć ąę/głos.wav`). Spawn without a shell, args as array.
- **ffmpeg filter args with Windows paths** (`arnndn=m=`, later `amovie`, `ass`, …): `C:/…` breaks the graph parser. Works: `m=C\\:/…` (unquoted, two backslashes) or `m='C\:/…'`; simplest: relative file name + `cwd` = model dir (used in the spike).
- SAPI (test-only): Desktop voices are 16 kHz; with any other output rate `AudioPosition` is scaled by rate/16000 → wrong event times.
- `zip` extraction: Git Bash `tar` is GNU tar (no zip); `%SystemRoot%\System32\tar.exe` (bsdtar) extracts zips. The app should extract in Node or ship unpacked.
- Read whisper output from the JSON file (UTF-8), never from the console (code page).
- The gyan.dev ffmpeg is GPL and ships `--enable-whisper` (`af_whisper`); the app must not depend on either (D7: LGPL/external binary). All filters used here are native ffmpeg filters, but verify the chain on an LGPL build in 4.1.

Downloads (official sources, verified): GitHub release API `digest` sha256 for the zips; Hugging Face LFS sha256 for models (`ggerganov/whisper.cpp`, `ggml-org/whisper-vad`); git blob SHA-1 for `sh.rnnn`. Speeds here: 273 MB in 18 s, 1.5 GB in 95 s. Licences: whisper.cpp MIT, Whisper weights MIT, Silero VAD MIT, rnnoise BSD-3 (models declared non-copyrightable in the repo README) → add to `docs/licenses.md` when shipped.

## 8. GO / NO-GO

- **D6 (whisper.cpp + alignment): GO.** Script-faithful words with ≈ 90 ms mean start error and ~88–96 % of words within the ±150 ms anchor tolerance (§3.3 of PLAN), PL works at least as well as EN, runtime is seconds on GPU and acceptable on CPU. Conditions: chunk mode + DTW calibration (not raw whisper timestamps), alignment flags low-coverage regions, retry policy for decoder failures.
- **D7 (ffmpeg for audio): GO.** All needed processing (high-pass, afftdn, arnndn, measurement, limiter) is native ffmpeg; replace loudnorm-as-normaliser with measure + gain + limiter.

## 9. Requirements for PLAN 4.1–4.4

**4.1 ffmpeg manager**
- Detect user-provided ffmpeg/ffprobe; probe `-version` and required filters (`highpass, afftdn, arnndn, alimiter, astats, ebur128/loudnorm`) via `ffmpeg -h filter=X` exit code; prefer an LGPL build.
- Run with `-nostdin -hide_banner`, array args, `cwd` support (filter paths), stderr capture; parse `loudnorm` JSON (last `{…}` block) and `astats`/`ametadata` lines; progress via `-progress pipe:1`.
- Escape helper for filter-graph path values (`C\\:` rule above) with a unit test; spaces + non-ASCII path fixtures.

**4.2 audio clean**
- Presets: light (`highpass 70, afftdn nr=10`), **standard default** (`highpass 80, afftdn nr=20`), heavy (`highpass 80, arnndn sh.rnnn`); `nf` = measured p10 of 50 ms RMS windows, clamped [−80, −20]. Never `afftdn` before `arnndn`.
- Normalisation: pass 1 measure I (loudnorm/ebur128) → `volume=<−16−I> dB` + `alimiter=limit=0.794:attack=5:release=60:level=false` → verify; repeat once if |ΔI| > 0.3 LU. Report before/after I, TP, LRA + noise floor. AC tolerance: **I = −16 ± 0.5 LUFS, TP ≤ −1.5 dBTP** (spike: ±0.13, ≤ −1.9).
- Output `vo.clean.wav` 48 kHz s16 mono (stereo only if the source is stereo and channels differ). Optional "level takes" (`dynaudnorm=f=400:g=31:p=0.9:m=6`). Optional silence shortening must happen **before** ASR (words must be timed on the final audio).
- Test fixtures: generate the degraded samples in the test (seeded `anoisesrc` + `aevalsrc`), do not commit WAVs.

**4.3 whisper.cpp**
- Model download on demand with sha256 check (values from HF LFS / GitHub `digest`), resumable, to app data dir; offer: turbo-q5 (default, 574 MB), small (fallback, 488 MB); Silero VAD (0.9 MB) always. Backend: CUDA zip if `nvidia-smi` present (273 MB, cuBLAS 11.8 worked with driver 592), else BLAS (21 MB).
- Pipeline: original audio → 16 kHz mono → `whisper-vad-speech-segments` (add `-vmsd 25`) → chunks (split ≥ 1.5 s pauses, merge ≤ 28 s, pad 0.25 s) → one `whisper-cli -l <lang> -ml 1 -sow -ojf -np -nfa -dtw <preset> chunk…` → shift by chunk start → `t = t_dtw − lead(model)`, `tEnd` = next word start.
- `words.raw.json` (zod): `{version, engine, model, lang, mode, audioS, words: [{text, t, tEnd, p, tDtw}]}` — see `spikes/03-audio/fixtures/*.words.raw.json`.
- Language from `project.json` (no auto-detect). Retry policy: coverage < 0.85 or a repeated n-gram loop → rerun failing chunks with `-bs 5 -tp 0.2` / other model and keep the best coverage.

**4.4 alignment**
- Port `spikes/03-audio/align.mjs` to TS (normalisation, number words EN/PL, diacritic folding, merge/split ≤ 3, interpolation, mismatch regions, confidence) and add a non-decreasing clamp on `t` (flag clamped words).
- Scale: banded DP or split at unique exact anchors so a 20-min script aligns in < 1 s.
- Extend normalisation: unit abbreviations (KB/MB/MHz/km/%), PL number inflection (jeden/jednego), ordinals.
- AC on committed fixtures (`spikes/03-audio/fixtures/`, truth = SAPI events): turbo coverage ≥ 0.92 per sample and start MAE ≤ 120 ms, ≥ 85 % of words within ±150 ms; raw WER thresholds: turbo ≤ 7 % EN (en-doom 4.7 %, noisy 6.0 %) and ≤ 5 % PL (4.2 %); `monotonic` true.

## 10. Files

`spikes/03-audio/`: `run.mjs` (orchestrator), `fetch.mjs` (downloads + hash check), `synth.ps1` + `prepare.mjs` (SAPI samples, truth, degradation), `clean.mjs`, `asr.mjs`, `align.mjs` + `align.test.mjs`, `matrix.mjs`, `report.mjs`, `lib/`, `samples/*.txt`, `fixtures/` (≈ 85 KB JSON). Large artefacts under `spikes/03-audio/.cache/` (gitignored, ≈ 4 GB incl. all runs).
