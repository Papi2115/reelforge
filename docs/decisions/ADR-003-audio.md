# ADR-003: Audio cleaning, ASR and alignment (D6, D7)

Status: accepted (2026-10-02). Evidence: `docs/spikes/03-audio.md`.

**Decision:** GO. whisper.cpp (default model `large-v3-turbo-q5_0` for EN and PL, `small` as CPU fallback) + Needleman–Wunsch alignment to the script; ffmpeg for cleaning.

**Consequences (tasks 4.1–4.4):**
- Run ASR on the original audio (denoising did not help; rnnoise hurt). Use VAD chunking + DTW timestamps with a per-model offset kept in config (base 230, small 200, medium 330, turbo 210 ms); re-measure on a real voice.
- Cleaning: highpass + per-file-measured `afftdn`; `arnndn` only in the heavy preset, before `afftdn`. Normalize with measure + gain + `alimiter`, not two-pass `loudnorm` (fell back to dynamic mode 12/12).
- Alignment must be banded/anchor-split (O(n²) took 21.6 s for 1,720 words) and keep word times non-decreasing; allow 3:1/1:3 merges and flag low-coverage regions.
- Do not depend on the machine's ffmpeg (GPL with whisper built in); verify filters on an LGPL build. Add whisper.cpp, Whisper weights, Silero VAD, rnnoise to `docs/licenses.md` when shipped.
