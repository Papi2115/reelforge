# Spike: ElevenLabs public API for paragraph-by-paragraph voiceover

Accessed: 2026-10-07 (all URLs below fetched that day). Base URL: `https://api.elevenlabs.io` (regional hosts exist: US/EU/India/Singapore).

Method note: pages were read through a summarising fetcher, so details are paraphrased. Rows marked VERIFIED were stated on an official `elevenlabs.io/docs` or API-reference page. Rows marked UNVERIFIED were not found, were contradictory, or came only from third-party/secondary sources. Re-check VERIFIED numbers against the live page before hard-coding them (ElevenLabs shipped Eleven v4 on 2026-09-28; docs are moving fast).

## 1. Auth, key checks, quota, limits

| Topic | Finding | Status | Source |
|---|---|---|---|
| Header | `xi-api-key: <key>` on every request | VERIFIED | /docs/api-reference/authentication |
| Key restrictions | A key can be restricted by (a) endpoint scope, (b) per-key credit quota, (c) IP allowlist (1-100 entries, public IPs only; others get 403) | VERIFIED | /docs/api-reference/authentication, /docs/overview/administration/workspaces/api-keys.md |
| Scope names | Official page shows only `text_to_speech` as an example; no full list. Third-party integration docs list `text_to_speech`, `voices_read`, `user_read`, `user_write`, and say the User permission is now just "No Access / Access" | UNVERIFIED (secondary) | search results (docs.melius.com, vocab.ai) |
| Restricted key can do TTS + list voices + read subscription? | Plausible with TTS + Voices(read) + User access, but no official statement. **Test in the key-validation step and show a clear "key lacks permission X" message (403)** | UNVERIFIED | - |
| Per-key quota | Create-key API field `character_limit` = max characters/month for that key | VERIFIED | /docs/api-reference/service-accounts/api-keys/create |
| Check key + quota | `GET /v1/user/subscription` (also `GET /v1/user` embeds `subscription`) | VERIFIED | /docs/api-reference/user/subscription/get |
| Quota fields | `character_count` (used), `character_limit` (period max), `next_character_count_reset_unix`, `tier`, `status`, `character_refresh_period`, `voice_limit`, `voice_slots_used`, `can_use_instant_voice_cloning`, `can_use_professional_voice_cloning`, `max_credit_limit_extension` (replaces deprecated `max_character_limit_extension`) | VERIFIED | same |
| Tier values | free, starter, go, creator, pro, growing_business, scale_2024_08_10, grant_*, trial, enterprise | VERIFIED | same |
| Credits vs characters | Billing page says "credits" = old "characters"; subscription endpoint still reports characters. Treat as the same unit; whether `character_count` is net of model multipliers (Flash 0.5) is UNVERIFIED | partly | /docs/overview/administration/billing.md |
| Usage history | `GET /v1/usage/character-stats` is **deprecated** in favour of `/v1/workspace/analytics/query/usage-by-product-over-time` (workspace analytics; scope for restricted keys UNVERIFIED). Not needed for v1 of the feature | VERIFIED (deprecation) | /docs/api-reference/usage/get |
| Concurrency per plan (parallel in-flight requests) | Free 2, Starter 3, Creator 5, Pro 10, Scale 15, Business 15 | VERIFIED | /docs/help-center/technical/api-error-code-429 |
| Rate limits (req/min) | Not documented; only concurrency | UNVERIFIED | - |
| Characters per request | Per model, not per tier (see section 2). Tier-specific caps not documented | UNVERIFIED for tiers | /docs/overview/models |

### HTTP errors (retry semantics)

| Code | Meaning | Retry |
|---|---|---|
| 401 | invalid/missing key | no |
| 402 | insufficient credits / payment | no, surface "out of credits" |
| 403 | key lacks permission, IP not allowlisted, feature not on plan | no |
| 422 | validation error (`detail` array) | no, fix request |
| 429 | `too_many_concurrent_requests` (plan concurrency) or `system_busy` (transient) | yes, exponential backoff; `system_busy` succeeds on retry |
| 500 / 503 | server error / maintenance | yes, backoff |

Source: /docs/eleven-api/resources/errors (401/402/403/422/429/5xx table VERIFIED). The same page also lists specific error `code` strings (e.g. `concurrent_limit_exceeded`, `text_too_long`); these looked generic and conflict with the help-center strings above, so **treat exact `code` strings as UNVERIFIED** and branch on HTTP status plus `too_many_concurrent_requests`/`system_busy` text.

## 2. Text-to-speech endpoints

### Models (docs /docs/overview/models, VERIFIED)

| Model ID | Max chars/request | Languages | Notes for this product |
|---|---|---|---|
| `eleven_v4` | 10,000 | 90+ (Polish listed) | Newest (2026-09-28); emotive; docs recommend it for stitching; audio tags `[laughing]`; IPA via `/.../`; no `<break>` tags |
| `eleven_multilingual_v2` | 10,000 | 29 (Polish listed) | "Most stable on long-form"; best number normalization; supports `<break>` and SSML phoneme; **API default model** |
| `eleven_v3` | 5,000 | 70+ | Expressive; **no request stitching**; no `<break>` |
| `eleven_flash_v2_5` | 40,000 | 32 | Cheapest (50% lower per char), fast; numbers/dates NOT normalized by default (Enterprise-only `apply_text_normalization` per this page - conflicts with the convert endpoint doc, see below) |
| `eleven_flash_v2` | 30,000 | English | Real-time |
| `eleven_turbo_v2_5` / `eleven_turbo_v2` | - | - | **Deprecated**, replace with Flash |
| `eleven_v4_turbo`, `eleven_v3_conversational` | n/a | - | Real-time/WebSocket oriented; not for batch VO |

Whether `eleven_v4` is supported by `/with-timestamps` and by `previous_request_ids` conditioning in practice: the stitching page names v4 as the recommended model (VERIFIED), the timestamps page does not list models (UNVERIFIED).

### `POST /v1/text-to-speech/{voice_id}` request (VERIFIED, /docs/api-reference/text-to-speech/convert)

| Field | Where | Notes |
|---|---|---|
| `output_format` | query | default `mp3_44100_128`. Allowed: mp3_22050_32, mp3_24000_48, mp3_44100_32/64/96/128/192, pcm_8000/16000/22050/24000/32000/44100/48000, wav_* (same rates), opus_48000_32/64/96/128/192, ulaw_8000, alaw_8000. **mp3_44100_192 needs Creator+; pcm/wav 44.1 kHz needs Pro+** |
| `enable_logging` | query | default true; false = zero retention, **Enterprise only**, disables history and stitching |
| `text` | body, required | |
| `model_id` | body | default `eleven_multilingual_v2` |
| `language_code` | body | ISO 639-1; ignored if model does not support it; **not supported by multilingual_v2** |
| `voice_settings` | body | `stability` 0.5, `similarity_boost` 0.75, `style` 0, `speed` 1.0 (docs elsewhere cite 0.7-1.2), `use_speaker_boost` true (defaults shown are the documented defaults) |
| `seed` | body | int 0..4294967295, best-effort determinism, not guaranteed |
| `previous_text` / `next_text` | body | context text; ignored if the matching `*_request_ids` is given |
| `previous_request_ids` / `next_request_ids` | body | max 3 each; IDs from earlier responses |
| `pronunciation_dictionary_locators` | body | max 3, `{pronunciation_dictionary_id, version_id?}`. Phoneme rules only on v4/flash_v2/v3; other models need alias rules |
| `apply_text_normalization` | body | `auto` (default) / `on` / `off` (convert doc shows no Enterprise gate; models page says Enterprise for Flash - UNVERIFIED which is right) |
| `apply_language_text_normalization` | body | Japanese only, adds latency |

Response: binary audio body. Response headers `request-id` and `character-cost` are documented in the SDK examples of the intro and stitching guides (VERIFIED as header names, /docs/api-reference/introduction.md; the OpenAPI page itself does not list them).

### `POST /v1/text-to-speech/{voice_id}/with-timestamps` (VERIFIED, /docs/api-reference/text-to-speech/convert-with-timestamps)

Same body as above (page lists model_id, output_format, voice_settings, seed, previous/next text, pronunciation dictionaries, previous/next request ids). Response JSON:

```json
{
  "audio_base64": "<base64 audio>",
  "alignment": {
    "characters": ["H","e","l","l","o"],
    "character_start_times_seconds": [0.0, 0.07, ...],
    "character_end_times_seconds": [0.07, 0.12, ...]
  },
  "normalized_alignment": { "characters": [...], "character_start_times_seconds": [...], "character_end_times_seconds": [...] }
}
```

- `alignment` maps to the **original** input characters; `normalized_alignment` maps to the text **after normalization** (e.g. "2" becomes "two"), so lengths differ when numbers/dates/abbreviations are expanded. Word timing = group characters between whitespace in `alignment`, which keeps original-text word boundaries (good for caption/anchor matching).
- Units: seconds, per character, relative to start of that request's audio.
- Accuracy/drift/silence handling: **UNVERIFIED** (not documented). Whether the `request-id` header is also returned and stitching-conditionable on this endpoint: UNVERIFIED.
- Can it replace whisper? For ElevenLabs-generated VO, the script text is known and alignment is produced by the TTS itself, so a forced-alignment pass is likely unnecessary; paragraph-level offsets then need adding by summing exact decoded durations (see 5). **Risk to plan:** no published accuracy figures; measure against whisper on 2-3 sample paragraphs (EN and PL) before dropping whisper, and keep whisper as fallback/validator. Also the response is JSON with base64 audio (about +33% payload) so decode in Node, do not stream.

## 3. Voices

| Topic | Finding | Status | Source |
|---|---|---|---|
| List/search own voices | `GET /v2/voices` params: `search`, `voice_type` (personal, community, default, workspace, saved), `category` (premade, cloned, generated, professional, high_quality), `page_size` (max 100, default 10), `next_page_token`, `has_more`, `sort` (`created_at_unix`/`name`), `include_total_count`, plus gender/age/language/accent/use_cases filters. Voice object: `voice_id`, `name`, `category`, `labels`, `settings`, `verified_languages`, `preview_url`, `sharing`, `fine_tuning` | VERIFIED | /docs/api-reference/voices/search |
| One voice | `GET /v1/voices/{voice_id}` (includes `settings`; docs state there is no separate per-voice settings endpoint) | VERIFIED | /docs/api-reference/voices/get |
| Default settings | `GET /v1/voices/settings/default` returns stability 0.5, similarity_boost 0.75, style 0, speed 1.0, use_speaker_boost true | VERIFIED | .../voices/settings/get-default |
| Voice Library | `GET /v1/shared-voices` (page_size max 100, category professional/famous/high_quality, language, accent, gender, age, use_cases, sort trending/usage...; fields `voice_id`, `public_owner_id`, `free_users_allowed`, `preview_url`, `has_more`). To use one it must be added to the account ("add shared voice" endpoint page was a 404 for me: path UNVERIFIED) | VERIFIED (list) / UNVERIFIED (add) | /docs/api-reference/voices/voice-library/get-shared |
| Free tier + library | Library voices are not usable via API on the free tier | VERIFIED | /docs/overview/capabilities/voices.md |
| Premade voices | Docs say the legacy premade/default voices **expire 2026-12-31**. Do not rely on premade voices for stored channel presets | VERIFIED (as stated) | same |
| Cloning | IVC on most paid tiers (subscription field `can_use_instant_voice_cloning`); PVC needs Creator+. Exact IVC tier cutoff: billing page says cloning starts at Starter | VERIFIED | voices.md, billing.md |
| Commercial use | Free plan = non-commercial only (ToS 1(c)); paid plans may use for commercial purposes; you retain rights in Output subject to the Prohibited Use Policy; voice-library voices governed by a separate Voice Library Addendum (not read). Cite, do not interpret: https://elevenlabs.io/terms-of-use | VERIFIED (cited) | terms-of-use |

Implication: each channel needs a **paid** key; the app should refuse/flag `tier == "free"` (non-commercial, no library voices).

## 4. Cost model

| Topic | Finding | Status |
|---|---|---|
| Unit | Billed per character (credits = characters). Rollover of up to 2 months of unused credits on monthly/annual plans | VERIFIED (billing.md) |
| Multipliers | Official docs do **not** publish per-model credit multipliers. Secondary sources: 1 credit/char for Multilingual v2, about 0.5 for Flash/Turbo; v4 multiplier unknown. API list prices from the pricing page: v4 $0.08/1k chars (promotional $0.022 until 2026-10-12), v3 $0.08, Flash/Turbo $0.04 | pricing page VERIFIED as shown, multipliers UNVERIFIED; prices are volatile |
| Estimate before generating | `chars = len(text)` (after any tag/normalization edits) x model multiplier (default 1.0 until measured) vs `character_limit - character_count` from `/v1/user/subscription`. Show a range, not a promise | recommendation |
| Actual cost | Response header `character-cost` per request (SDK docs); also `character_count` delta in the subscription endpoint. Log both and calibrate the multiplier per model from the first real runs | header name VERIFIED, semantics UNVERIFIED |
| Regenerations | TTS overview says each piece can be regenerated up to 2 times free - applies to the **web UI**; API behaviour UNVERIFIED, assume every call is billed | UNVERIFIED |
| Free tier | non-commercial only; Library voices blocked on API; high-quality output formats gated | VERIFIED |

Rough budget (for planning, assuming 1 credit/char): 6-15 min of speech at about 150 wpm is about 900-2,250 words, about 5k-14k characters per film, about 10-20k with retakes. Starter/Creator monthly allowances cover only a few films; confirm each plan's current credit allowance on the pricing page (the fetched page text was garbled, so I am not quoting allowances).

## 5. Per-sentence retake and stitching

- Stitching is documented: take `request-id` from the response headers of a finished request, pass up to 3 of them in `previous_request_ids` (and/or `next_request_ids`) of the next one. Conditions (VERIFIED, request-stitching page): **not available for `eleven_v3`**; request IDs must be younger than **2 hours**; streaming audio must be fully read first; not available to Enterprise accounts with increased privacy (zero retention). Docs recommend `eleven_v4` for it.
- `previous_text`/`next_text` is the stateless alternative (VERIFIED as parameters; used if IDs are absent or older than 2 hours). Also the TTS overview recommends splitting large text with these parameters.
- Retake of one sentence: re-send just that sentence with `previous_text` = the preceding sentence(s) and `next_text` = the following one(s) from the script (works regardless of the 2-hour window), same `voice_settings`, same `model_id`, new/or same `seed`. Then splice into the paragraph timeline. UNVERIFIED: how well the retake matches loudness and pacing of its neighbours; plan for a loudness-normalise (the existing gain+alimiter chain) and a short crossfade on cut points in the mix stage.
- Determinism: `seed` is best-effort only; the same seed does not guarantee identical audio (VERIFIED wording). So store every accepted take as a file and never regenerate to "reproduce" it. A retake is a new take, not a replay.
- Loudness consistency across requests is not documented (UNVERIFIED). Measure LUFS per take and apply gain, as in ADR-003.
- Recommended chunking for 6-15 min films: one request per paragraph (about 300-900 chars, well under every model limit), generated **sequentially** (needed for `previous_request_ids`), each with `previous_text`/`next_text` as fallback; per-sentence retake only for the selected sentence. Concurrency is irrelevant on the sequential path; if parallelising across paragraphs, cap at (plan concurrency - 1) and handle 429.

## 6. Pitfalls

| Topic | Finding | Status |
|---|---|---|
| Pauses | `<break time="x.xs" />` (max 3 s) only on the older family (Multilingual v2 etc.); excessive tags cause instability. v4/v3 do **not** support `<break>`; use punctuation, ellipses, dashes, paragraph structure, or insert silence in the mix stage | VERIFIED (best-practices.md) |
| SSML | `<phoneme>` (CMU Arpabet recommended, IPA) on v2-family; v4 uses `/IPA/` inline; alias tags (`<alias>`) and pronunciation dictionaries (.pls) as alternatives. Pronunciation-dictionary phoneme rules only on v4, flash_v2, v3. Non-English IPA/CMU requires v4 | VERIFIED |
| Numbers/dates | Normalization on by default (`apply_text_normalization: auto`); Multilingual v2 normalizes best; Flash v2.5 normalizes poorly by default. Best practice: pre-expand numbers/symbols/abbreviations in the script | VERIFIED |
| Language | Polish listed for both Multilingual v2 (29 langs) and v4 (90+). `language_code` not supported by multilingual_v2 (it infers from text). Quality of Polish vs English: UNVERIFIED | VERIFIED (listing) |
| Deprecations | Turbo v2/v2.5 deprecated; premade voices expire 2026-12-31; `/v1/usage/character-stats` deprecated; `optimize_streaming_latency` deprecated; v4 launched 2026-09-28 so v4 behaviour/pricing may still change. Store `model_id` per project and surface errors on unknown model | VERIFIED |
| Privacy | Default: requests/history retained. Zero Retention Mode is Enterprise-only (`enable_logging=false`), eligible for TTS, not for voice cloning; it disables history and stitching. So with normal keys scripts are retained by ElevenLabs; mention in settings UI | VERIFIED (/docs/eleven-api/resources/zero-retention-mode.md) |

## Minimal HTTP calls the app needs

All requests: header `xi-api-key: <key>` (never log it; store via safeStorage per channel). Use Node `fetch` from the main process; errors: parse JSON body, branch on status.

| # | Purpose | Request | Response (relevant) |
|---|---|---|---|
| 1 | Validate key + quota | `GET /v1/user/subscription` | `{"tier":"creator","status":"active","character_count":12345,"character_limit":100000,"next_character_count_reset_unix":1790000000,"can_use_instant_voice_cloning":true,...}` ; 401 = bad key, 403 = missing permission |
| 2 | List voices | `GET /v2/voices?page_size=100&voice_type=personal` (repeat with `next_page_token` while `has_more`; also try `voice_type=saved`/`default`) | `{"voices":[{"voice_id","name","category","labels","settings","preview_url","verified_languages"}],"has_more":false,"next_page_token":null}` |
| 3 | Voice settings (optional) | `GET /v1/voices/{voice_id}` | `settings.{stability,similarity_boost,style,speed,use_speaker_boost}` |
| 4 | TTS plain | `POST /v1/text-to-speech/{voice_id}?output_format=mp3_44100_128`<br>`Content-Type: application/json` | binary audio; headers `request-id`, `character-cost` |
| 5 | TTS + alignment | `POST /v1/text-to-speech/{voice_id}/with-timestamps?output_format=mp3_44100_128` | JSON `{audio_base64, alignment, normalized_alignment}` |

Body for 4 and 5:

```json
{
  "text": "Paragraph text here.",
  "model_id": "eleven_multilingual_v2",
  "voice_settings": {"stability": 0.5, "similarity_boost": 0.75, "style": 0, "speed": 1.0, "use_speaker_boost": true},
  "seed": 12345,
  "previous_text": "Previous paragraph (optional).",
  "next_text": "Next paragraph (optional).",
  "previous_request_ids": ["<request-id from prior response header>"]
}
```

Rules: send `previous_text` only when no `previous_request_ids` (the text is ignored otherwise); omit `language_code` for multilingual_v2.

## Recommended chunking + stitching strategy

1. Preflight: call 1, check `tier != free`, compute `estimate = chars x multiplier(model)`; if `estimate > character_limit - character_count`, block with a clear message and next reset date.
2. Normalise script for TTS (expand numbers/symbols; on v4 optionally add `[tags]`; on v2-family optionally `<break>`).
3. Split by paragraph (never mid-sentence), each below the model limit; keep sentence boundaries in a side map (character offsets) for retakes.
4. Generate sequentially, default `eleven_multilingual_v2` for stable long-form (switchable to `eleven_v4`), pass `previous_request_ids` (last 1-3 IDs, < 2 h old) plus `previous_text`/`next_text` fallback; call the `/with-timestamps` variant only if alignment replaces whisper, otherwise plain call, then whisper as today.
5. Persist per take: audio file, request-id, model, settings, seed, `character-cost`, timestamp. Take = immutable.
6. Retake sentence: new request with neighbouring `previous_text`/`next_text`, splice, loudness-match, crossfade, re-derive word timing for that paragraph only.
7. Backoff on 429/5xx (exponential with jitter, max about 5 tries); never retry 401/402/403/422.

## Top unknowns to close with a real-key test (cheap, about 2k chars)

Restricted-key scope names accepted for TTS + voices + subscription; `character-cost` semantics per model; `request-id` header on `/with-timestamps`; alignment accuracy vs whisper (EN, PL); loudness variation between retakes; Polish quality on v4 vs multilingual v2; whether `eleven_v4` accepts `previous_request_ids` as docs imply.

## Sources (all https://elevenlabs.io unless noted)

/docs/api-reference/authentication, /docs/api-reference/text-to-speech/convert, /docs/api-reference/text-to-speech/convert-with-timestamps, /docs/api-reference/user/subscription/get, /docs/api-reference/user/get, /docs/api-reference/voices/search, /docs/api-reference/voices/get, /docs/api-reference/voices/settings/get-default, /docs/api-reference/voices/voice-library/get-shared, /docs/api-reference/usage/get, /docs/api-reference/service-accounts/api-keys/create, /docs/overview/models, /docs/overview/capabilities/text-to-speech, /docs/overview/capabilities/text-to-speech/best-practices, /docs/overview/capabilities/voices, /docs/overview/administration/billing, /docs/overview/administration/workspaces/api-keys, /docs/eleven-api/guides/how-to/text-to-speech/request-stitching, /docs/eleven-api/guides/how-to/text-to-speech/pronunciation-dictionaries, /docs/eleven-api/resources/errors, /docs/eleven-api/resources/zero-retention-mode, /docs/help-center/technical/api-error-code-429, /blog/eleven-v4, /pricing/api, /terms-of-use. Not fetchable/404: `/docs/api-reference/rate-limits`, add-shared-voice page, help-center languages page (403).
