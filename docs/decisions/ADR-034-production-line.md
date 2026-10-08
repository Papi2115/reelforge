# ADR-034: Production line (ReelForge 3.2)

Status: accepted (2026-10-07). Code: `packages/shared/src/queue.ts` (`productionQueueSchema`,
`queueItemSchema`, `lineStateSchema`, `QUEUE_STEPS`), `packages/stages/src/queue/` (state machine,
scheduler, store, lock, `QueueRunner`, `StageQueueExecutor`, project factory, brief writer,
`queueAttention`), `packages/prompts/prompts/brief.md`. Task: PLAN.md#13.9 part a (headless
engine; IPC and UI are separate packets). User guide: `docs/production-line.md`.

## Context

Papi wants to drop a list of topics and get films one after another with minimal intervention,
per channel (≥ 3 channels, each with its own voice), overnight, pausing on the Claude usage limit
(docs/roadmap-3.0.md, PLAN.md#13.9). Safeguards: one film at a time (Claude load), a ✓/⚠ report
per film, "Needs you" for approvals. The pipeline stages, their gating, limits and autocommits
already exist (StageRunner); the line must reuse them, not fork them (CLAUDE.md §3.3).

## Decision

- **Data.** One queue per channel, `<userData>/queues/<channelId>.json` (version 1, zod, atomic
  writes, read-modify-write serialized per file): `{ autoApproveScript (false), paused,
  defaultTargetMinutes (8), items[] }`. An item: `topic`, optional own `brief`, `language` (`en`
  default; `pl` accepted), `targetMinutes`, `style`, `genrePreset` (recorded until 13.8),
  `projectPath`, `stageProgress` (per step: `running | waiting | done | skipped | failed`, absent =
  pending), `error`, `warnings` (the ⚠ report), `reviewedAt`, `history` (status changes, capped).
  `<userData>/queues/line.json` keeps the usage-limit pause and the channel served last.
- **Steps.** `project → brief → script → approval → voiceover → clean → words → storyboard →
  assets → scenes → final-review → sound-cues → mix → export → publish`. The status (`queued`,
  `brief`, `scripting`, `needs-approval`, `needs-voice`, `building`, `exporting`, `done`, `failed`)
  is derived from the step states; only `paused` (user hold) is set by hand.
- **One step at a time.** The runner picks one step, runs it, persists, picks again: re-check
  waiting gates (no side effects while closed) → pre-approval work (brief, script; at most 5 films
  waiting for approval) → the film already building → the next film to build. Channels take
  turns for new work. So at most one film ever builds, and a waiting or failed film never blocks
  the others.
- **Gates.** Script approval = the app's own field (`pipeline.json` `stages.script.approvedAt`),
  skipped only with `autoApproveScript`. Voice-over: the channel's `VoiceProvider` (13.14) if any,
  else "needs voice" until a recording is imported. Asset review (research mode `ask`) also waits.
- **Brief.** A user brief is written as is; otherwise one Sonnet turn with the new `brief` prompt
  (critic permissions: read-only, no web) writes topic, hook, key facts to check, tone, audience;
  one repair turn. The length is always the user's.
- **Limits and failures.** `limit` (stage error or turn status) pauses the whole line until the
  reset (CLI time, else 15 min backoff), persisted in `line.json`; with the app's LimitGuard the
  stage itself waits and the line mirrors the guard (`limitSignalFromGuard`). `blocked` (not logged
  in, CLI missing, billing guard) stops the line without failing the film. Any other failure marks
  the film `failed` with step + reason; the line goes on. The quiet final review never fails a film
  (its problems become ⚠).
- **Crash safety.** A step is marked `running` before it starts; on start the runner turns
  leftover `running` steps back to pending and runs them again (stages are re-runnable; a stage
  already `done` and not stale is not re-run). `stop()` aborts the running step (StageRunner kills
  the process tree) and leaves it pending. `<userData>/queues/runner.lock` (pid + token, `wx`)
  allows one line per app; a dead owner's lock is taken over.
- **Schedules.** `runUntil: idle | time`, optional quiet hours (local "HH:MM", may cross
  midnight) in which no step starts.
- **Injection.** `QueueRunner` takes the store, a project factory, a step executor, a clock, a
  usage-limit signal and a notifier — fully testable without Claude. `StageQueueExecutor` is the
  production executor (StageRunner per project from the app, export/publish kit injected).

## Consequences

- The desktop packet wires: a `StageQueueExecutor` sharing the app's StageRunner/pipeline store,
  the app's export and publish kit as `FilmStep`s, `limitSignalFromGuard(appGuard)`, IPC over
  `QueueStore` + `QueueRunner` events, and the "Needs you" inbox from `queueAttention`.
- A film's project is a normal project (`<channel projectsDir>/<slug>-<id>`): the user can open
  it, approve the script, import a voice-over or fix a failure in the usual UI, then `poke()`.
- New prompt `brief` (v1): bundled prompts gain one id; existing prompts, fixtures and evals are
  unchanged (each eval case got a golden `brief` reply).
