# ADR-033: ElevenLabs voice generation

Status: accepted (2026-10-07). Code: `packages/pipeline/src/voice/`, `packages/shared/src/takes.ts`.
Docs: `docs/voice.md`, `docs/spikes/elevenlabs-api.md`. Task: PLAN.md#13.14 (part a: engine; the stage and
UI integration is a separate packet).

## Context

Papi produces on ≥ 3 channels, each with its own ElevenLabs key and voice (ADR-031). The Voiceover stage
gets a "Generate" path next to manual import. CLAUDE.md §3.4 allows exactly one network exception for it:
the app's main process talks to ElevenLabs with the user's channel key. Requirements: paragraph by
paragraph with controlled pauses, stitched requests, a cost estimate before spending, per-sentence retakes
that rebuild only the affected scenes, and optionally the vendor's timing instead of whisper.

## Decision

- **Client**: plain `fetch` (no SDK, no new dependency), injectable base URL/fetch, typed `VoiceError`
  results; retries only 429/5xx/network/timeout with exponential backoff + jitter and `Retry-After`;
  never 401/402/403/422. A FIFO limiter caps in-flight requests at the plan's documented concurrency
  (default 2). The key sits in an ES private field; all error/event text is redacted (canary test).
- **Chunk = paragraph** (split between sentences only when a paragraph exceeds 80% of the model cap).
  Generation is sequential so each request can carry the previous chunks' request ids (≤ 3, < 2 h);
  `previous_text`/`next_text` are the fallback. Parallel generation only with text-only stitching.
- **Takes are immutable files** with a versioned zod manifest (`takes.json`): the active take per chunk
  and the assembled timeline. Pcm (Pro+) is stored losslessly as WAV, otherwise the best mp3 the tier
  allows. Re-running Generate reuses unchanged chunks; the manifest is saved after every take.
- **Assembly in Node, not an ffmpeg filtergraph**: takes are decoded once (ffmpeg only for mp3) and joined
  sample-exactly with silence (0.6 s paragraph, 0.25 s split) and 10 ms fades at take edges. Sample-exact
  offsets make the API word times exact in the assembled file; the output is byte-deterministic for the
  same takes. No per-take loudness normalisation (Audio cleaned does it on the whole file).
- **Retake = the chunk holding the sentence** is regenerated with both neighbours as context. Splicing a
  single sentence into an existing take was rejected for now: it needs cut points from alignment, a
  crossfade inside speech and a loudness match, and the cost saving per retake is small (one paragraph).
  The result lists overlapping shots (rebuild) and later shots that only shift.
- **Timing from the API** is written to `timing/words.elevenlabs.json` (words.json schema) and never
  replaces whisper's `words.json` until `compareWithWhisper` on real takes shows it is good enough.

## Consequences

- No stage or UI changes yet; the integration packet wires the channel key (main process only), the
  estimate dialog, progress, the retake action and stale-scene marking from `impact`.
- Cost multipliers and several header semantics are UNVERIFIED (docs/voice.md) and get calibrated from
  the first real run.
- `audio/takes/` grows with every retake (history by design); clean-up is a follow-up.
