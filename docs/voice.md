# Voice generation (ElevenLabs)

PLAN.md#13.14, ADR-033. Code: `packages/pipeline/src/voice/` (exported from `@reelforge/pipeline`),
schemas `packages/shared/src/takes.ts`. API facts: `docs/spikes/elevenlabs-api.md` (2026-10-07).
This part is the engine only; the Voiceover stage button, channel key lookup and UI are the next packet.
Manual voice-over import stays as it is.

## Flow

1. **Preflight** — `client.getSubscription()` (checks the key, reads `tier` and quota) →
   `pickOutputFormat(tier)` (Pro+: `pcm_44100`, lossless; Creator+: `mp3_44100_192`; else `mp3_44100_128`),
   `concurrencyForTier(tier)` → `client.limiter.setMax(n)`.
2. **Estimate** — `pendingCharacters(projectDir, script, settings)` (only chunks without a reusable take) →
   `estimateCost({ characters, modelId, quota, calibration })` → "about N characters (X% of your remaining Y)"
   plus a warning with the reset date when it does not fit.
3. **Generate** — `generateVoiceover(...)`: one request per script paragraph (blank-line paragraphs, the same
   indices as `words.json`), a paragraph longer than 80% of the model cap is split between sentences.
   Sequential by default; each request carries the previous chunks' `request-id`s (≤ 3, < 2 h old, same
   voice/model) and the script around it as `previous_text`/`next_text` (sent only when no ids replace it).
   With `stitching: 'text'` requests may run in parallel (`parallel`), capped by the limiter.
4. **Output** — every take is an immutable file `audio/takes/<chunkId>-<n>.mp3|wav` (pcm is wrapped in a
   WAV header, samples unchanged) + `<takeId>.alignment.json`; `audio/takes/takes.json` records text hash,
   model, voice settings, seed, request id, `character-cost`, duration and which take is active. Takes are
   decoded to 44.1 kHz mono (mp3 through ffmpeg) and joined in Node: 0.6 s silence between paragraphs,
   0.25 s inside a split paragraph, 10 ms raised-cosine fade at every take edge (no clicks), written as
   16-bit `audio/vo.original.wav`. No per-take loudness change: the Audio cleaned stage normalises the
   whole file.
5. **Words** — with `withTimestamps`, the character alignment (original text) becomes
   `timing/words.elevenlabs.json` in the `words.json` schema (script word indices, paragraph, chunk offset
   added). It does **not** replace `timing/words.json`: Words timed still runs whisper. `compareWithWhisper`
   gives median / p95 / max start offsets to decide later; preferring API timing stays **off** until measured
   on real takes.
6. **Retake** — `retakeSentence({ sentenceId, ... })` regenerates the chunk (paragraph) holding the
   sentence with the neighbours' request ids on both sides, stores take `n+1`, re-assembles, and returns
   `impact`: shots overlapping the old range (`changedShotIds`) and later shots that only move
   (`shiftedShotIds`, `shiftS`). Refused (`stale-manifest`) when the script changed since Generate.

Re-running Generate after a script edit reuses every chunk whose text, voice, model, settings, seed and
format are unchanged, so only edited paragraphs cost characters. A failed run keeps the takes already paid
for (the manifest is saved after every take).

## Errors

`VoiceError.kind`: `auth` 401, `payment` 402, `forbidden` 403, `validation` 400/422 — never retried;
`rate-limit` 429, `server` 5xx, `network`, `timeout` — retried (default 5 attempts, 500 ms doubled, ≤ 8 s,
jitter ×0.5–1, a longer `Retry-After` wins, capped at 60 s); `aborted`; plus `invalid-response`,
`invalid-input`, `stale-manifest`, `alignment`, `decode`, `io`. The key is held in a private field; every
message built from a response, an exception or a retry event goes through `redactSecret` (canary test).

## UNVERIFIED assumptions (check with the first real key, ~2k characters)

- Credit multipliers: 1.0 for `eleven_multilingual_v2` / `eleven_v4`, 0.5 for flash. Replaced by
  `calibrateCosts` from the `character-cost` header as soon as one real response has it.
- `character-cost` semantics (credits after the model multiplier?) and whether it is sent on
  `/with-timestamps`; whether `previous_text`/`next_text` are billed (assumed not).
- `request-id` header on `/with-timestamps` and whether `eleven_v4` / flash accept `previous_request_ids`
  (v3 is known not to; unknown models are treated as non-stitching with a 5,000-character cap).
- `alignment.characters` equals the text sent, character for character (the converter tolerates only
  whitespace differences and otherwise fails with `alignment`). Alignment accuracy vs whisper: unknown.
- Loudness/pace consistency between takes and retakes; whether the 0.6 s / 0.25 s pauses sound natural.
- Tier gates of output formats for `go`, `growing_business`, `trial` (treated like their neighbours) and the
  concurrency of `go` (falls back to 2).
- API error `code` strings: only HTTP status is used.
- Characters are counted as code points; the vendor's counting rule is not documented.

## Public API (for the desktop integration)

`ElevenLabsClient({ apiKey, baseUrl?, fetch?, maxConcurrency?, retry?, timeoutMs?, onEvent? })` with
`getSubscription()`, `listVoices({ search?, voiceType? })`, `generate(request)`, `limiter`;
`pickOutputFormat`, `concurrencyForTier`, `DEFAULT_VOICE_MODEL`, `voiceModelSpec`, `chunkCharBudget`;
`planVoiceChunks`, `splitScriptParagraphs`, `splitSentences`; `estimateCost`, `calibrateCosts`;
`generateVoiceover`, `pendingCharacters`, `retakeSentence`, `shotImpact`, `DEFAULT_VOICE_PAUSES`,
`VoiceGenerationSettings`; `createTakeDecoder(ffmpeg | null)`; `alignmentToWords`, `buildApiWordsFile`,
`compareWithWhisper`; `readTakesManifest`, `VOICE_FILES`; schemas `voiceTakesFileSchema`,
`voiceAlignmentFileSchema`, `ttsVoiceSettingsSchema` in `@reelforge/shared`.

Tests run against `src/voice/testing/fake-elevenlabs.ts` (node:http on 127.0.0.1): no real network or key.
