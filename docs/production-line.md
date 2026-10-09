# Production line

Drop a list of topics into a channel's queue; the line turns them into finished films one after
another (PLAN.md#13.9, ADR-034). It stops only where it needs you: approving a script, a
voice-over when the channel has no voice generator, an asset review, or a failure.

## How a film moves

| Step | What happens | Waits for you when |
| --- | --- | --- |
| project | new project in the channel's projects folder, `<topic-slug>-<id>`, channel style/world | – |
| brief | your own brief as is, or one Sonnet turn: topic, hook, key facts to check, tone, audience | – |
| script | the Script stage (research + script) | – |
| approval | the "Approve script" gate of the app | always, unless the queue has auto-approve on |
| voiceover | the channel's voice generator, else your recording | no voice generator and no recording |
| clean … mix | the pipeline stages as in the app (assets only with research on) | asset package to review |
| final-review | the quiet whole-video review (problems become ⚠, never a failure) | – |
| export | the app's export ("Video exported") | – |
| seo | tags and timestamps: `publish/seo.json` (15 tags, 5–8 chapters; one Sonnet turn, else the deterministic fallback and a ⚠), committed; skipped for shorts | – |
| publish | the app's publish kit (its tags and chapters come from `publish/seo.json`) | – |

Status of a film: `queued → brief → scripting → needs-approval → building (needs-voice) →
exporting → done`, or `failed` (step + reason), or `paused` (on hold by you).

## Rules of the line

- **One step at a time, one film building at a time.** Scripts are written first (at most 5 films
  waiting for your approval), so you can approve a batch in the evening and the line builds
  overnight. A film that waits or fails never holds up the next one. Channels take turns.
- **Usage limit.** The whole line pauses until the limit resets and goes on by itself; the pause
  survives an app restart. A limit hit while writing the tags and timestamps never holds the
  film: the fallback is written (⚠ "regenerate"), and the line pauses before its next step.
- **Films from before 3.4** (publish kit already done) count the tags and timestamps step as
  skipped and stay done.
- **Claude not usable** (logged out, CLI missing): the line stops; no film is marked failed.
- **Closing the app / crash.** The running step is aborted and runs again next time; nothing done
  is lost. Only one line runs per app (lock file).
- **Schedules.** Run until idle or until a time; optional quiet hours (no new step starts).

## In the app

Header → **Production line** (Ctrl+Shift+L): one tab per channel, the line's status, Start / Stop, "Run until" (nothing is
left, or a time), quiet hours, the channel's options (approve scripts automatically, pause the channel, default length),
"Add topics (one per line)" with "Topic | 6" for a 6-minute film, and the queue with each film's status, its live step and
its buttons (Open script → Approve script, Add voice, Retry, Hold / Resume, Move up / down, Remove, Open project, the video
folder and the publish kit). Films are made in English. The films that wait for you are also in "Needs you"; a system
notification (Settings → Projects → Production line) says when a film is ready, needs you, or the line stops.

- Started with "Run until nothing is left", the line stays on after it ran out of work: approving a script (in the dialog
  or in the film's Script panel), importing a voiceover, saving a channel's key, adding topics, Resume or Retry let it go
  on by itself. Stop turns that off.
- A channel with an ElevenLabs voice and key (Settings → Channels) gets its voiceovers generated; without them the film
  waits ("Voice needed") until you record or import one in its project.
- The line uses the app's own stages (one runner per project: a stage you run in the same film meanwhile is refused as
  "busy"), the Claude usage-limit pause of the chat, the app's export and publish kit, and a render service of its own for
  the film being made, so the film you have open does not matter.
- Closing the app stops the running step (it runs again next time); the line does not start by itself on the next launch.

## Files

- `<app data>/queues/<channelId>.json` — the channel's queue (version 1).
- `<app data>/queues/line.json` — usage-limit pause, last channel served.
- `<app data>/queues/runner.lock` — the running line's pid.
- `<app data>/production-line.json` — notifications on/off and the quiet hours (the app's).

## API for the desktop app (`@reelforge/stages`)

- `QueueStore(queuesDir)`: `read`, `channelIds`, `addTopics(channelId, [{ topic, brief?,
  language?, targetMinutes?, style?, genrePreset? }])`, `removeItem`, `moveItem`, `hold`,
  `resume`, `retry`, `markReviewed`, `setOptions({ autoApproveScript?, paused?,
  defaultTargetMinutes? })`, `update`, `updateItem`, `readLine`; event `changed(queue, origin)`.
- `QueueRunner({ store, projects, executor, clock?, limits?, notifier?, quietHours?,
  maxPendingApprovals?, limitBackoffMs?, pollMs?, lock?, channelIds? })`:
  `start({ runUntil? }) → Result<'idle' | 'time' | 'stopped' | 'blocked', string>`, `stop()`,
  `poke()` (after an approval/import done in the app), `approveScript(channelId, itemId)`,
  `isRunning`, `lineStatus`, `dispose()`. Events: `queue`, `step` (started/finished + outcome),
  `stage` (StageEvent of the running stage), `progress` (brief/voice/export/tags/publish lines),
  `line` (`running | waiting | limit | quiet | stopped`, `until`, current step).
- `StageQueueExecutor({ runnerFor, pipelineStore?, claude?, briefModel?, voiceFor?, exportFilm?,
  publishSeo?: { model?, channel?, commit? }, publishKit?, finalReview? })` (the `seo` step runs
  `runQueueSeo`, also without `publishSeo`: prompt model, no channel, no commit); `createQueueProjectFactory({ channel, create? })`;
  `limitSignalFromGuard(guard)`; `queueAttention(queue)` for the "Needs you" inbox.
- `VoiceProvider { generate({ projectDir, channelId, signal }) → Result<{ file, warnings? }> }`
  is implemented with 13.14; the file it returns is imported by the Voiceover stage.

## Cost and time (for planning)

From the Sketchbook real run (docs/real-run-sketchbook-3.md, a 55 s film, 12 shots): research +
script ≈ 1 min, storyboard ≈ 2 min, scenes ≈ 18 min, final review ≈ 2 min, export ≈ 2 min — about
26 minutes of stages; scene building (Opus) is ~90 % of the usage and grows with the shot count
(Papi's measurement: an 8-minute film ≈ 20 min, 2–3 % of a weekly 20x limit). The brief turn adds
one short Sonnet turn per film.
