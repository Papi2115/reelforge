# ReelForge 3.0 – 3.3 roadmap (agreed with Papi, 2026-10-06)

Source of truth for tasks: `PLAN.md` phase 13 (task ids 13.x). Foundations of the worlds: `docs/worlds/DECISIONS.md`, quality rules: `docs/worlds/QUALITY.md`,
UI redesign proposal: `docs/ux/redesign-2.4.md` (+ `docs/ux/audit-2.3.md`, clickable mockup `docs/ux/mockups/index.html`).
Shorts factory is **3.5** (separate generator). Older ideas stay in `docs/roadmap-2.0.md` ("not scheduled").

## Product goals behind 3.x
1. Many more films with clearly different, human-feeling visual identities ("worlds"), no AI slop.
2. A **production line**: drop a list of topics → briefs → scripts (approved) → voice → scenes → sound → export → publish pack, with minimal intervention, for
   **at least 3 channels, each with its own voice and ElevenLabs account/key**.
3. A clear, intuitive UI (retro vibe and colours kept).

## New objects introduced
- **Channel** (13.13): name, ElevenLabs API key (own per channel; stored encrypted with Electron safeStorage, never in the repo), voice id + voice settings,
  default world/genre preset, publish defaults (description template, tags, credits style), taste profile, projects folder/series, brand kit. Projects belong to a channel.
- **ElevenLabs voice generation** (13.14): Voiceover stage "Generate" (paragraph by paragraph, controlled pauses, stitched; per-sentence re-takes; cost estimate; optional
  alignment from the API to shorten Words timed — verify in the vendor docs before promising); manual import stays. Network exception in CLAUDE.md §3.4 (user-provided keys,
  direct app → ElevenLabs only; unrelated to Anthropic rules in §3.1).

## Dependencies (what blocks what)
- 13.1 world architecture and 13.2 continuity links are independent of each other (kit/looks registry vs engine transitions + storyboard schema) → run in parallel; every world needs both.
- Worlds (13.6 Sketchbook, 13.3 Comic, 13.4 Game B2, 13.5 Game B1) need 13.1 + 13.2; each lives in its own kit/looks folders → worlds can be built in parallel with each other
  once 13.1/13.2 exist (limited by Claude subscription load and PC, not by code conflicts); order of delivery: Sketchbook → Comic → B2 → B1.
- 13.7 anti-slop guards: independent of worlds' rendering (scene QA, prompts, critic) → starts in 3.0, gets world-specific checklists with each world.
- 13.12 UI/UX rebuild: desktop renderer only → parallel to all engine/world work; world selector rows are added to Project settings when each world lands.
- 13.13 channels + 13.14 voice generation: shared/desktop/stages (settings, Voiceover stage) → parallel to worlds; 13.14 needs 13.13.
- 13.9 production line (queue): needs 13.13 + 13.14 (voice) and the new UI inbox (13.12); needs stable stage pause/resume (exists).
- 13.8 genre presets: framework early, final mapping needs all worlds.
- 13.11 publication helpers: thumbnail studio uses world styles (after ≥ 2 worlds); upload helper independent.
- 13.10 long-form tests: rolling, one per world right after it ships; final round at the end.

## Version plan
### 3.0 — Foundations + first world + new UI
Tracks run in parallel:
- **A (engine/kit):** 13.1 + 13.2 together → then **13.6 Sketchbook** (cheapest world; renderer, hand/pen tip, fonts, 2 breakthrough scenes: pop-up, accordion).
- **B (desktop):** **13.12 UI/UX rebuild** (packets U1–U12 incl. the quick fixes from the audit; status language, Now strip, Needs you, Director drawer, Library).
- **C (stages/prompts):** **13.7 anti-slop guards v1** (text provenance, clutter, symmetry/uniformity, human-trace counter, critic checklists) + fact-check workflow for `[verify]`.
- Release gate: Sketchbook film of 3–5 min on real Claude (13.10 round 1), no-harm hashes for existing looks, CI green.
### 3.1 — Comic + channels and voice
- **A:** **13.3 Comic** (multi-panel compositor in the engine, print Style, A/B/C looks, sepia flashback + double-page spread, continuity links in panel language).
- **B:** **13.13 Channels** + **13.14 ElevenLabs voice generation** (≥ 3 channels, own key + voice each).
- **C:** long-form test of Sketchbook/Comic, guards v2 (comic traces), prompts tuning from the real runs.
### 3.2 — Game B2 + production line + publishing
- **A:** **13.4 Game B2** (raycaster look in the kit, level description format + validator for runtime Claude, HUD, automap, intermission tally, cartridge-throw interaction).
- **B:** **13.9 Production line** (topic list → briefs → queue → export → publish pack, per channel, overnight, pauses on limit; "Needs you" inbox for approvals/⚠).
- **C:** **13.11 Publication helpers** (thumbnail studio from film frames in the world's style; upload helper — API upload is usually private for unverified projects, verify) + 13.8 genre-preset framework.
### 3.3 — Game B1 + genre presets + hardening
- **A:** **13.5 Game B1** (Atari TV inside a living room, boss cards, cartridge/level-select transitions, high-score + manual scenes).
- **B:** **13.8 final mapping** (true crime / tech / history / finance / science → world + rhythm + music + transitions), tuned on long-form results.
- **C:** final **13.10 long-form tests** for all worlds, hygiene (files > 400 lines, perf, flaky tests), installer + release notes, README/docs.

## Rules for execution (lessons)
- Prefer **cloud sessions started by Papi** (credit) for showcase/doc-heavy work; local coders only with targeted tests; full suites run on GitHub CI (repo is public).
- Each world: standalone HTML showcase is the visual contract; port must match it (compare frames). Keep deliberate roughness (QUALITY.md).
- Every new feature behind a project switch; "no harm" tests for existing looks/styles; docs + ADR per task.
- Open decisions are tracked in `PLAN.md` (13.9, 13.11, 13.12) and in the memory index.
