# ReelForge 2.3.5 — UX audit (input for the 2.4 "sharp UI/UX" rebuild)

Date: 2026-10-04 · Build: v2.3.5 (`apps/desktop`, built from `main` + phase-12 branch) · Window 1280×720 unless noted.
Screenshots: `docs/ux/shots/` (40 PNGs, downscaled to 1280 px wide; the `*-1920` ones show the 1920×1080 layout at
1600 px). They were taken with fake-claude and `claude` searched in an empty folder, so the status bar reads
"Claude: not installed" in the new ones. That is test isolation, not a finding. Older shots (from the smoke suite
of the same day, still v2.3.0 in the corner) fill the states the new run could not reach: shots 18, 19, 20, 28, 32,
35 and 40.

Severity: **blocker** = the user draws the wrong conclusion or gets stuck · **confusing** = works, but the user has
to guess · **polish** = looks or feels off, low cost.

The 1.1 audit (`docs/ux-audit.md`) fixed the cramped layout (chat rail, compact shots, track toggles, next-step
card). This audit is about what 2.x added on top of that and about the status language. Most problems now come from
three root causes:

1. **The UI speaks in pipeline internals.** Nine runner stages show up as nine rows with past-tense labels
   ("Audio cleaned", "Words timed"), and every status word comes from runner state. The user's question is
   different: "what can I watch, and what do I do next?"
2. **Status is computed per stage, without the output.** "Failed" wins over "the output is there and playable".
   "Done" is shown under steps that are not done. Empty states are picked from missing *reports*, not from missing
   *results*.
3. **2.x features were added where the code was, not where the user looks.** Each feature has its switch in one
   place (Project settings), its result in a second (the Scenes built document) and its action in a third (timeline
   toolbar, script editor, chat).

---

## 1. Screen-by-screen

### 1.1 Welcome and first run — shots 01, 02

| # | Issue | Sev. | Root cause | Fix |
|---|---|---|---|---|
| W1 | Welcome is good: three clear cards, one marked "START HERE". | — | — | Keep it as the model for empty states. |
| W2 | In "Connect Claude" the disabled **Continue** is a dull orange block that still reads as a button (02). Measured: 3.2:1 text contrast, background only 2.5:1 against an enabled primary. | confusing | `button:disabled { opacity: .55 }` (`styles.css`) applied to `.primary` | Disabled primary turns into a neutral outline with muted text, and a one-line reason next to it ("Install Claude Code first"). |
| W3 | Electron/Chrome versions sit in the header of every screen. | polish | `App.tsx` header `app-meta` | Move them to Help → About. |

### 1.2 Start screen — shots 03, 04

| # | Issue | Sev. | Root cause | Fix |
|---|---|---|---|---|
| S1 | **New project…** is a muddy brown block until a title is typed (03). It looks broken, not disabled. | confusing | Same opacity rule (W2) | Same fix as W2, plus a placeholder hint: "Type a title to start". |
| S2 | At 1920×1080 the form column stays 340 px, and the demo floats in a large black area (04). | polish | `.start-screen { width: 340px }` | Cap the start layout at ~1200 px and centre it. Label the preview "Example: Doom on a calculator". |
| S3 | The preview plays a demo that is not explained. Is it my project? An example? | confusing | `StartLayout` → `PreviewPanel source=demo` without a caption | Add a caption "Example video" plus "Open the example project" under it. |

### 1.3 New project: brief, demo fallback — shots 05, 06, 07

| # | Issue | Sev. | Root cause | Fix |
|---|---|---|---|---|
| N1 | **The preview silently plays the Doom demo inside a brand-new project** (06, 07). The only hint is a small yellow chip ("No shots yet · the demo scene plays until Storyboard has run"). Papi took it for his own video. | **blocker** | `preview-source.ts` `resolvePreview()` falls back to `getDemoManifest()` for `no-storyboard` | No demo inside a project. Show an "empty stage" card in the preview instead: what will appear here, and the one next action. |
| N2 | Eight rows of "Waiting for …" on a fresh project, with mixed targets: "Storyboard — Waiting for Script" (it also needs Words), and Sound mixed's chip wraps onto a second line (06). | confusing | `status-view.ts` `waitingText()` names the *nearest earlier unfinished row*, not the real dependency. The label width is not reserved. | Do not show waiting chips at all for steps that have not started. The order of the step bar already says it. Show "Not started" (muted) and the real requirement on hover only. |
| N3 | A selected row shows `brief.json is missing: fill in the brief.` (06) | confusing | Runner gating reason passed through raw (`pipeline-view.ts` `rowDetail` → `reasons[0]`) | Never show file names in status text: "Fill in the brief first." |
| N4 | The direction bar ("Direct the shot…"), Tension, Tracks 6/6, six timeline rows with "No … yet" and **Cards — "On-screen cards are not shown here yet"** all show on a project with nothing in it (06). | confusing | Every panel always renders (`Workspace.tsx`) | Hide whatever cannot be used yet. The timeline shows one line: "The timeline fills in after your voiceover." Remove the Cards row until it works. |
| N5 | Header shows `voxel-pixel-crisp640` (an id). | polish | `App.tsx` `project.style` | Show the style's display name: "Voxel Pixel · Crisp 640". |
| N6 | Brief → Write script works well: live steps (08), then Review & approve (09). | — | — | Keep. |

### 1.4 Main workspace, example project — shots 11, 12, 13, 14, 15, 20

| # | Issue | Sev. | Root cause | Fix |
|---|---|---|---|---|
| M1 | **"Ready to run" says nothing about what it means or what happens** ("Sound design mixed — Ready to run"). The next-step button repeats the jargon: "Run Sound design mixed" (11). | **blocker** | Status words and button labels are built from row labels (`next-step.ts` `runOrSelect`, `status-view.ts`) | Buttons say the outcome and the cost: "Mix the sound (about 1 min, no Claude)". The status chip says "Ready". The "why" goes in one sentence, not a tooltip. |
| M2 | **"Waiting for Cleanup"**, "Waiting for Sound mix": "Cleanup" is a step the user never runs by hand (20). | confusing | `SHORT_STEP_NAMES` in `status-view.ts` exposes runner stages | Fold clean + words into the Voice step. Never name a sub-step the user cannot act on. |
| M3 | **"Words timed — Done" sits under "Voiceover added — Waiting for Script"**, and Storyboard/Scenes are "Done" below unfinished steps (20; fixture project with outputs but no approved script / voiceover). | **blocker** | `pipeline-view.ts` `isDone()` = has output, independent of upstream. Each row is judged alone. | Rule: a step is never shown as plain Done below a step that is not done. Show it as "Kept from before — will update after Voice" (muted check) or as "Out of date". |
| M4 | **"Scenes built — Done" while the Scenes document says "No shot is built yet. Run Scenes built in the pipeline." and Final review says "Scenes are not built yet"**. Every shot shows the ○ "Not built yet" badge although every scene plays (12, 23). | **blocker** | The example has scene files but no `scenes` report. `ScenesPanel`/`scenes-view.ts` and `shotBadges()` read only the report. | Build the empty states from files *and* reports: "7 scenes built · not checked yet — Run the final check". Badge ○ means "not checked", never "not built". |
| M5 | Status legend (14) explains nine status words. A legend at all is a sign the words are not self-explanatory. | confusing | `STATUS_LEGEND` | With the new status rules (≤ 6 words, each with a sentence) the legend goes away. |
| M6 | Three small buttons in the Pipeline heading (Assets, Brief, ˄) do unrelated things: open a dialog, open a document, collapse the list (11). | confusing | `PipelineSidebar.tsx` heading actions | Brief belongs to the Script step. Assets moves to a "Library" button in the header. The collapse goes away with the step bar. |
| M7 | Generic step actions **Open / Replace / Run / Redo**: "Replace" on the Script row means "use a text file", on Voiceover "import a recording". "Redo" vs "Run" vs "Retry" vs "Resume" is runner talk (15). | confusing | One action component for every row (`StageActions.tsx`) | Each step gets its own named actions inside its panel ("Use a script file…", "Record a new take", "Build scenes again…"). The step bar itself has none. |
| M8 | Shots list: the chip "title-card" / "metaphor-object" is the internal *treatment* id. The "○" button is a QA badge. "Δ/X only" is a filter. "Compact" is a toggle that looks like a primary orange button (11). | confusing | `ShotsPanel.tsx` | Treatment as muted plain text with tooltip "Shot type". Badge with a word on hover ("Not checked"). Filter "Problems only". "Compact" as an icon toggle. |
| M9 | Header links "Project settings", "Close project" look like plain text; "Help" and "Settings" sit far right with the versions (11). | polish | `App.tsx` | Project title becomes a menu (Project settings, Open folder, Close). Header right: Needs you · Library · Settings · Help. |
| M10 | Status bar: "Saved locally · git history" (a button), "Models: per step · Usage: —" (dash = unknown). | polish | `StatusBar.tsx` | "History" button. "Claude: connected · Sonnet/Opus per step". Hide usage until there is a number. |
| M11 | At 1920 (12) the chat opens by default and pushes the preview; the chat starts with three suggestion chips that are each a full-film Claude turn. | polish | `chat-dock.ts` `CHAT_AUTO_OPEN_WIDTH = 1400` | Fine to keep. Mark film-wide suggestions with their cost ("whole film · ~5 min"). |

### 1.5 Steps running / failed — shots 16, 17, 18, 19

| # | Issue | Sev. | Root cause | Fix |
|---|---|---|---|---|
| F1 | **Papi's case: "Scenes built — Failed" while the shot list is full and the film plays.** One shot's rebuild failing marks the whole step Failed. The next-step card says "Scenes built failed." with "See what failed", and the next row says "Ready to run" as if nothing happened. (Could not be reproduced in the capture run: fake-claude crashed the rebuild before the stage started. Logic confirmed in code.) | **blocker** | `pipeline-view.ts` `rowStatus()`: `infos.some(isFailed)` comes before any look at output. `next-step.ts` `attentionStep('failed')` | New status "Built with problems": "6 of 7 shots built · s02 failed: <one-line reason>". Actions: Retry s02 · Fix with Claude · Show details. The film stays playable, and the user is told so. |
| F2 | Words step failure (18): a red sentence about HTTP 404 inside the sidebar, plus Try again / Open Settings / Not now. The next-step card above it talks about something else (Storyboard out of date). | confusing | `WordsSetupNotice` is a separate banner, not part of the next action | One "Needs you" item: "Word timing needs whisper.cpp (download failed: server answered 404)" → Try again · Settings. |
| F3 | Scene error overlay (19): raw lint output in mono over the preview, plus an FPS overlay. Useful for Claude, frightening for Papi. | confusing | `PreviewOverlays.tsx` shows `scene lint failed` verbatim | First line in plain words ("s02 can't play: its scene uses randomness that changes every frame."). Button "Fix with Claude". The raw text sits behind "Details". |
| F4 | Running (16): the sidebar says "Running… 0 %" and the detail line reads "Mixing · 0 % · 0:00" (elapsed). Nothing says how long it will take or that it needs no Claude. | polish | `StageProgress.tsx` | "Mixing the sound · usually under a minute · no Claude usage". |
| F5 | The direction history popover stayed open after Escape and covers the speed / mute / snapshot / size / FPS controls of the transport (16, 17, 25–27, 30). | confusing | `CommandBar.tsx` history list positioned over `TransportBar` | Popovers close on Escape and on outside click, and never cover the transport. |
| F6 | After the mix (17) "Video exported — Ready to run", while the detail line under the buttons shows "-14.16 LUFS, true peak -1.95 dBTP" for the *selected* (sound) row. | polish | `StageDetail` shows the selected row's result | Show results in the step's panel in plain words: "Loudness OK for YouTube (−14 LUFS)". |

### 1.6 Shots, Scenes document, variants — shots 21, 22, 23, 24, 31, 40

| # | Issue | Sev. | Root cause | Fix |
|---|---|---|---|---|
| D1 | Shot details open *inline* in the list and push the other shots down. At 720 px only 2–3 shots stay visible (21). | confusing | `ShotDetails.tsx` rendered inside the list | Details go in a popover next to the row, or into the bottom dock. The list keeps its rows. |
| D2 | Opening any document (Scenes, Sound, Variants) docks it under the preview and **shrinks the preview to ~230 px tall** (23, 27, 31). The thing you are judging gets smaller than the report about it. | **blocker** | `Workspace.tsx` `center-stack has-dock` + `CenterDocument` | Documents open in a tabbed bottom dock (where the timeline is) or as a right sheet. The preview never drops below 640×360 (1×) at 1280×720. |
| D3 | The Scenes document stacks five unrelated things: "No shot is built yet", Final review, Dramaturgy (interrupts, open loops, reveal moments with Accept/Reject), Editing (beat sync, repetition) and the Sync report. The header has three buttons: Check sync · Run final review · Back to preview (23, 24, 40). | confusing | `ScenesPanel.tsx` grew one section per feature | Scenes panel = build progress + per-shot check. Dramaturgy and Editing move to the Director drawer. Sync and final check merge into one "Check" result. |
| D4 | Variants dock (31) is clear ("≈ 3 Opus turns, about 6–12 min" is exactly right). It replaces the preview area the same way as D2. | polish | Same as D2 | Same fix. |
| D5 | The right-click menu (22) is the only discoverable place for Variants besides the V key. | polish | — | Keep it, and also add a visible "Variants" action in the shot popover. |

### 1.7 Script, Voiceover, Words — shots 09, 25, 26, 32

| # | Issue | Sev. | Root cause | Fix |
|---|---|---|---|---|
| V1 | **Voiceover panel says "No voice-over yet: import a file or record one." directly under "vo.original.wav · 0:31 · imported"** (25). | **blocker** | `vo-view.ts` reads the voice-vs-script report, not the file | Empty states come from the file. A missing report reads "Not compared with the script yet". |
| V2 | **Words panel says "Run Words timed to check the recording against the script word by word." above 76 timed words**, while the step is Done (26). | confusing | Same as V1 | Same. |
| V3 | "voice-over" (panel text) vs "Voiceover" (step). `ui-copy.md` forbids the first. | polish | Copy drift | Copy check in a unit test (dictionary of forbidden words). |
| V4 | Script tabs Brief · Script · Research · Beats · Sources: Research and Beats are Claude's working files. Hook lab is a small button in the corner of the editor (09). | confusing | `ScriptPanel.tsx` exposes every artefact | Tabs: Brief · Script · Sources. Research and Beats go into a "Claude's notes" disclosure. Hook lab becomes a visible card under the script: "Try 3 other openings". |
| V5 | The Hook lab dialog itself (32) is good: side by side, word counts, a source warning, one button per card. | — | — | Keep. |

### 1.8 Sound — shot 27

| # | Issue | Sev. | Root cause | Fix |
|---|---|---|---|---|
| A1 | Four buttons for one job: Generate cues · Default cues (no Claude) · Render mix · Render mix + stems. The order of use is not obvious. | confusing | `SoundPanel.tsx` | One primary "Mix the sound". The others go under "More": "Ask Claude for new sound effects", "Use the default effects", "Also save stems". |
| A2 | "Mix report: No mix yet. Generate cues (or use the default ones), then Render mix." plus a list of SFX counts. | polish | — | Plain: "15 sound effects placed · no music yet". |

### 1.9 Timeline, tension, direction bar — shots 28, 29, 11

| # | Issue | Sev. | Root cause | Fix |
|---|---|---|---|---|
| T1 | Tension is a toolbar button that opens a panel under the timeline. The panel then says "The tension map is off for this project … turn it on in Project settings → Direction" (28). The switch, the curve and the effect live in three different places. | **blocker** (for 2.x features) | `TimelinePanel` toggle + `TensionPanel` note + `ProjectSettingsDialog` row | Director drawer → Tension: switch, curve preview, "Edit curve" (opens the curve over the timeline), what it changes. |
| T2 | The direction bar takes a full row under the transport, always: shot id, input, Apply, History (n), and 5–6 chips (11). It is the least-used control, yet it is permanently visible. | confusing | `CommandBar.tsx` in `PreviewPanel` footer | Collapse to one input "Direct this shot… (/)". Chips only on focus. History lives in the Director drawer. Hidden until scenes exist. |
| T3 | Timeline hint "Alt: drag without snapping · double-click Cues to add a sound" is permanent help text. | polish | `TimelineTools.tsx` | Move it into the shortcuts dialog and the tooltips. |
| T4 | "Tracks 6/6" includes the dead "Cards" row. | polish | `timeline-view.ts` | Remove Cards until it renders. Default tracks: Shots, Narration, Audio. |

### 1.10 Export and publish kit — shots 33, 34

| # | Issue | Sev. | Root cause | Fix |
|---|---|---|---|---|
| E1 | The main button is **"Add to queue"**, not "Export". The queue panel is empty ("Nothing exported in this session yet"). | confusing | `ExportDialog.tsx` queue model leaks into the UI | "Export video" (primary). The queue is visible only while something runs. |
| E2 | "chapters.txt" is checked while the label says "YouTube needs at least 3 chapters, got 2". The user cannot tell if it will be written. | confusing | Checkbox state independent of the check | Disable it with the reason, or write it and say "chapters skipped (video too short)". |
| E3 | Two overlapping sections on the right: **YouTube** (Suggest with Claude, chapters) and **Publish kit** (description, chapters, tags, credits, Refresh). Chapters appear in both. | confusing | Two features (6.x YouTube extras, 12.17 publish kit) side by side | One "YouTube texts" section: description, chapters, tags, credits, each with Copy. "Ask Claude to improve" is one button. |
| E4 | Technical knobs at the same level as the main choice: Encoder, Test encoder, Render workers, Output folder. | polish | — | Format + Quality + File name visible. Everything else under "Advanced". |

### 1.11 Assets and library — shots 35, 36

| # | Issue | Sev. | Root cause | Fix |
|---|---|---|---|---|
| L1 | **"Assets" is three different things**: a button in the Pipeline heading (always), a pipeline row that appears only when research is on and the storyboard asked for photos, and the dialog with two tabs. Papi did not understand the step (35: the row appears between Storyboard and Scenes, with "Review & …" cut off). | **blocker** | `PIPELINE_ROWS` optional `assets` row + heading button + `AssetsDialog` | The Plan step has a "Photos to approve (2)" item and the inbox lists it. The Library (header) holds your files, downloads and the shared library. The word "Assets" disappears from the UI. |
| L2 | The asset package review is good (35): thumbnails, source, licence chip, Approve selected (n) / Reject all. Thumbnails were grey in the test (no network), which is fine. | — | — | Keep the cards. |
| L3 | "Your files" explains itself in a long sentence, and research mode is shown as a subtitle ("Research: Ask me for each package") that cannot be changed here (36). | polish | — | Make the research mode a select in the Library header, the same setting as Project settings. |

### 1.12 Settings and Project settings — shots 37, 38, 39

| # | Issue | Sev. | Root cause | Fix |
|---|---|---|---|---|
| P1 | Project settings is a single long scroll (~6 screens at 1280×720): Visuals (looks with a seven-item bullet list), Ambient, Characters, Mascot, Research (four large radio cards), Direction (Tension, Dramaturgy × 3, Editing × 2). Every switch is a big orange card when on (38, 39). | confusing | `ProjectSettingsDialog.tsx` `ROWS`, one card style for everything | Left-hand section tabs, like Settings already has. Switches as compact rows with a one-line hint. Long look descriptions behind "What do the looks look like?". |
| P2 | Where a setting lives is arbitrary: **Taste** is in app Settings, **Characters/Mascot** defaults in Settings → Projects but the choice in Project settings, **Economy mode** and **Final review** in Settings → Models, the **library** switches in Settings → Projects. | confusing | Each feature placed where its data is stored | Rule: *what the film looks and sounds like* → Director / Library. *How the app runs* → Settings. Project settings keeps the film's identity (title, language, looks, characters). |
| P3 | "Saved automatically to C:\Users\…\settings.json" in a mono footer on every Settings tab (37). | polish | `SettingsDialog.tsx` footer | "Saved automatically." Path behind a "Show file" link. |
| P4 | Models tab (37) reads well (Haiku/Sonnet/Opus explained, model per step). | — | — | Keep. |

---

## 2. Jargon list (current label → plain replacement)

UI language stays English. Left column: what the app shows today (source file).

| Today | Where | Replace with |
|---|---|---|
| Pipeline | `PipelineSidebar.tsx` | Steps (the step bar) |
| Script written / Voiceover added / Audio cleaned / Words timed | `pipeline-view.ts` `PIPELINE_ROWS` | Script · Voice (sub-steps "Recording", "Clean-up", "Word timing" inside the Voice panel only) |
| Storyboard | same | Plan (shots) |
| Assets (step) / Asset package | same, `AssetsDialog.tsx` | Photos to approve |
| Assets (button, dialog) | `PipelineSidebar.tsx` heading | Library |
| Scenes built | same | Scenes |
| Sound design mixed / Mix / Render mix | same, `SoundPanel.tsx` | Sound · "Mix the sound" |
| Video exported / Add to queue | same, `ExportDialog.tsx` | Export · "Export video" |
| Ready to run | `status-view.ts` | Ready (plus a button naming the outcome) |
| Waiting for Cleanup / Waiting for Sound mix | `status-view.ts` `SHORT_STEP_NAMES` | Not started (hover: "Comes after Voice") |
| Failed — see details | same | Needs a fix: <reason> · or "Built with problems: 6 of 7 shots" |
| Out of date — rebuild | same | Out of date: <what changed> |
| Review & approve | same | Needs your OK |
| Interrupted — Resume | same | Stopped when the app closed · Continue |
| Open / Replace / Run / Redo | `StageActions.tsx` | Named actions per step ("Open the script", "Use a script file…", "Build scenes", "Build all scenes again…") |
| brief.json is missing / timing/words.json is missing | runner reasons | "Fill in the brief first" / "Time the words first" (never a file name) |
| title-card, metaphor-object… (chip) | `ShotsPanel.tsx` | Shot type (muted text, tooltip) |
| ○ / ✓ / ⚠ / ✗ (QA badge) | `ShotsPanel.tsx` | Not checked · Checked · Has notes · Broken |
| Δ/X only | `ShotsPanel.tsx` | Problems only |
| Compact | `ShotsPanel.tsx` | One line per shot (icon toggle) |
| Check sync / Sync report / Fix sync issues | `ScenesPanel.tsx` | Timing check |
| Run final review / Final review | `ScenesPanel.tsx`, Settings → Models | Final check |
| Cues / Generate cues / Default cues (no Claude) | `SoundPanel.tsx`, timeline | Sound effects · "Ask Claude for sound effects" · "Use the default effects" |
| Cards (track) | timeline | (removed until it works) |
| Tension / Tension map | timeline toolbar, Project settings | Tension curve |
| Dramaturgy / Pattern interrupts / Open loops / Reveal moments | Project settings, `DramaturgySection.tsx` | Story beats: Surprise moments · Questions & answers · Wow moments |
| Beat sync / Repetition | `EditingSection.tsx` | Cut on the beat · Too much of the same |
| Direct the shot / History (n) / Clear directions | `CommandBar.tsx` | Direct this shot (/) · Directions (n) |
| Taste / Taste profile | Settings → Taste | Your taste |
| Publish kit / YouTube extras | `ExportDialog.tsx` | YouTube texts |
| Economy mode | Settings → Models | Save Claude usage |
| Render workers / Test encoder / Native (snapshot) / FPS | Export, transport | Speed (CPU cores) · Check encoder · Snapshot size · Performance overlay |
| Saved locally · git history | `StatusBar.tsx` | History |
| Models: per step · Usage: — | `StatusBar.tsx` | Claude: connected (usage hidden until known) |
| voxel-pixel-crisp640 | header | Voxel Pixel · Crisp 640 |
| voice-over (panel text) | `VoiceoverPanel.tsx`, `vo-view.ts` | voiceover (as `ui-copy.md` already says) |

---

## 3. Where every 2.x feature lives today

"Switch" = turns it on. "Result" = where you see what it did. "Action" = where you act on it. Three different places
for one feature is the norm, which is why the features feel scattered.

| Feature (version) | Switch | Result | Action | Why it is hard to find |
|---|---|---|---|---|
| Looks (2.0) | Project settings → Visuals → Look mode | Only in the frames | — | Nothing in the workspace says which look a shot uses. The shot "type" chip is a different thing. |
| Ambient variation (2.0) | Project settings → Visuals | Preview | — | Fine (set and forget). |
| Transitions, sound palettes (2.0) | — (automatic) | Preview, mix | — | Invisible by design. OK. |
| Research mode (2.1) | Project settings → Research | Assets dialog subtitle | — | You see it in the dialog but cannot change it there. |
| Asset package review (2.1) | Research = "Ask me" | Optional "Assets" pipeline row (appears mid-pipeline) | Assets dialog | The row appears out of nowhere and is called "Assets" (L1). |
| Your files (2.1) | — | Assets dialog → This project | "Add my assets…" | Behind a small heading button labelled "Assets". |
| Shared library (2.1) | Settings → Projects → Asset library | Assets dialog → Library tab | Use in project | Two dialogs, two names. |
| Sources / claims (2.1) | — | Script → Sources tab | Check sources | Fine, but no signal elsewhere when a claim is unsourced (only Hook lab warns). |
| Publish kit (2.1) | — | Export dialog, bottom right (scroll) | Copy / Save to publish/ | Below the fold, next to the overlapping "YouTube" block (E3). |
| Tension curve (2.2) | Project settings → Direction | Tension panel under the timeline (toolbar button) | Presets, drag, Propose with Claude | Switch, curve and effect in three places (T1). |
| Cinematic camera (2.2) | — | Frames | — | Invisible, fine. |
| Cut on the beat (2.2) | Project settings → Direction → Editing | Scenes document → Editing section | — | You have to open "Scenes built" to see an editing result. |
| Too much of the same (2.2) | Project settings → Direction → Editing | Scenes document → Editing | Swap sound / Re-pick transition / Ignore | Same. Proposals wait there silently, with no count anywhere. |
| Surprise moments, Q&A loops (2.2) | Project settings → Direction → Dramaturgy | Scenes document → Dramaturgy | Click a row = seek | Same. |
| Wow moments (2.2) | Project settings → Direction → Dramaturgy | Scenes document → Dramaturgy → Reveal moments | Accept / Reject / Preview | **Decisions waiting for the user, hidden in a report.** Nothing tells you they exist. |
| Hook lab (2.3) | — | Script → Script tab → "Hook lab…" (top-right of the editor) | Use this opening | Small secondary button. Only visible when the script document is open. |
| Taste (2.3) | Settings → Taste (app-wide) | Settings → Taste | Export / Forget | Learns from variant picks and locks in the workspace, but the only place to see it is app Settings. |
| Live direction (2.3) | — | Command bar under the preview (always) | Type, chips, History popover | The opposite problem: always visible, takes a row, rarely used (T2). |
| Variants (1.2) | — | Variants dock | Right-click / V / shot details | Discoverable only by right-click or keyboard. |
| Locks (1.2) | — | Lock icon per shot | Lock all ✓ | Fine. |
| Characters / mascot (2.3.5) | Project settings → Characters / Mascot; defaults in Settings → Projects | Frames | — | Two dialogs for the same choice. |
| Economy mode, final check | Settings → Models | — | — | A film-quality decision filed under "Models". |

---

## 4. Visual language today (what to keep, what to fix)

Measured from `apps/desktop/src/renderer/**/*.css`:

- **Palette (keep):** `--bg #0d0e12`, `--panel #15161c`, `--panel-raised #1d1f28`, `--border #2b2e3a`, text
  `#ececf1` / muted `#a0a3b5`, accent `#ff8a3d` (+ `#ffb07a` text, `#b85a1c` dark), ok `#7ee2a2`, warn `#f2c14e`, error
  `#ff8a8a`. The "dark navy" Papi likes mostly comes from the preview's indigo/purple scenes framed by this near-black
  chrome with a faint blue cast. Text tokens all pass AA (tested in `apps/desktop/test/support/theme-contrast.test.ts`).
- **No pixel font in UI text.** The UI uses `system-ui`/Segoe UI and Cascadia Mono. The pixel feel comes only from
  the 2×2 brand mark, square status dots, mono timecodes and the preview itself. The engine's own CC0 pixel fonts
  (`packages/engine/src/text/font-display.ts`, ADR-005) are not used in the chrome.
- **Disabled controls fail.** Opacity 0.55 on everything:
  - disabled default buttons keep **5.6:1** text contrast and look enabled ("Run" next to "Open" in 15);
  - disabled primary drops to **3.2:1** (below AA) and still looks orange.
  - The test does not cover either.
- **Control borders are invisible.** `--border` on `--panel` is **1.34:1**; WCAG 1.4.11 asks for 3:1 for input and
  button boundaries. Buttons read as text floating on the panel.
- **Spacing:** 20 different values in use (most common: 8, 6, 4, 10, 2, 12, 16, plus odd ones 3, 5, 7, 14, 18, 22, 34).
  No scale.
- **Type:** 11 different font sizes (12 px ×126, 11 px ×38, 13 px ×32, plus 10, 14, 15, 16, 17, 24, 26). 11 px and
  10 px text is hard to read on a 1280 laptop.
- **Radii:** 4 px (39), 6 px (21), 3 px (12), pills 999 px (11), 8/10 px (4). Pills fight the pixel look.
- **Icons:** `layout/icons.tsx` (SVG) mixed with unicode ✓ ⚠ ✗ ○ Δ ★ ⏹ in labels. Inconsistent size and weight.

---

## 5. Screens not captured, and why

- **"Failed next to a full shot list" (F1):** the capture script rebuilt one shot with fake-claude set to crash.
  The click timed out behind an open popover, so the state was not reached. Covered by the code path
  (`pipeline-view.ts` `rowStatus`) and by shots 18/19 (other failed states).
- **Tension panel at 1920 / new run:** the toolbar click timed out behind the same popover. Shot 28 is the smoke
  suite's capture of the same panel (fixture project).
- **Assets with a real package and thumbnails:** needs a research run. Shot 35 is the smoke suite's capture with the
  local test asset server.
- **Paused (usage limit), queued and interrupted:** not reproducible without the real limit or a crash mid-run. They
  use the same chip/next-step components as running/failed, so the same findings apply.
