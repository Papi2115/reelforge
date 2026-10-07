# ReelForge 2.4 — "sharp UI/UX" proposal

Status: **PROPOSAL, awaiting Papi's approval.** No code has changed. Evidence: `docs/ux/audit-2.3.md` (issue ids
W/S/N/M/F/D/V/A/T/E/L/P below refer to it). Clickable mockup: `docs/ux/mockups/index.html` (double-click).

Goal in one line: **at any moment the window shows what you can watch, what is wrong in plain words, and one
button for the next thing to do.** The retro look stays. Only the words, the structure and the state logic change.

---

## 1. Principles (the rules every packet follows)

1. **One next action.** Exactly one primary (orange) button in the "Now" strip under the header. Every other button
   in the window is secondary.
2. **Results before status.** A step's status is computed from what exists (files, shots, reports) *and* from the
   runner. "Failed" never appears next to usable output without saying what is usable.
3. **Switch, result and action live together.** A feature that is turned on in one place, shows results in a second
   and needs a decision in a third gets one home (Director drawer or Library).
4. **Nothing that cannot be used yet is shown.** Empty projects show empty states with one action, not disabled
   panels, "No … yet" rows or a demo video.
5. **Plain words, user's verbs.** No file names, runner stage names, ids or past-tense pipeline labels in UI text.
   The dictionary in §4 is enforced by a unit test.
6. **The preview is sacred.** It never drops below 640×360 (integer 1×) at 1280×720. Documents and reports open
   beside or below it, never squeezing it.
7. **Keep the retro look** (§7, §10).

---

## 2. Information architecture

### 2.1 Six steps instead of nine rows

The user makes decisions at six points. The runner's ten stages map onto them; sub-stages that need no decision
run chained and are visible only inside their step.

| Step (UI) | Runner stages (`PipelineStageKey`) | The user decides / does | Done means |
|---|---|---|---|
| 1 **Script** | `script` | brief, approve the script, Hook lab, sources | script approved |
| 2 **Voice** | `voiceover`, `clean`, `words` | record or import; clean-up and word timing run on their own | words timed |
| 3 **Plan** | `storyboard`, `assets` (optional) | read the shot plan, approve photos (when research is on) | storyboard ok + package decided |
| 4 **Scenes** | `scenes` (+ final check, variants, locks) | watch, fix shots, pick variants | all shots built and checked |
| 5 **Sound** | `sound-cues`, `mix` | levels, music, "Mix the sound" | mix rendered |
| 6 **Export** | `export` | format, file name, YouTube texts | MP4 written |

### 2.2 Window anatomy (1280×720 and up)

```
┌ Header 40 ──────────────────────────────────────────────────────────────────────────────────────┐
│ ■ ReelForge  Doom on a calculator ▾ │ 1 Script ✓─2 Voice ✓─3 Plan ✓─[4 Scenes 6/7 ⚠]─5 Sound─6 Export │ Needs you (2) Library ⚙ ? │
├ Now strip 44 ───────────────────────────────────────────────────────────────────────────────────┤
│ ⚠ 6 of 7 shots built and playable. s02 failed: Claude stopped before saving the scene.  [Retry s02] Fix with Claude · Details │
├ Left 280 ──────┬ Preview (≥ 640×360) ─────────────────────────────────┬ Side (Chat | Director) ───┤
│ Step panel     │                                                       │ rail 44 at < 1400 px      │
│ (Scenes: shot  │   transport  ▶ 0:04.90 / 0:30.50  ─────●──────        │ 360 px open               │
│  list + checks)│   Direct this shot… (/)                               │                           │
├────────────────┴ Bottom dock (tabs): Timeline | Scenes check | Sound | Words ────────────────────┤
│ Shots / Narration / Audio (3 default tracks)                                                    │
├ Status bar 24 ──────────────────────────────────────────────────────────────────────────────────┤
│ History · Claude: connected                                                       ReelForge 2.4 │
└─────────────────────────────────────────────────────────────────────────────────────────────────┘
```

- **Header:** brand · project menu (title ▾: Project settings, Open folder, Close project) · **step bar** · Needs
  you · Library · Settings · Help. Versions move to Help → About (W3).
- **Step bar** (`layout/StepperBar.tsx`, new): six pixel-block segments. Each shows its number, name and a status
  glyph. Clicking a step opens its panel on the left. The current step is outlined in accent. It replaces the
  list in `PipelineSidebar.tsx`.
- **Now strip** (`layout/NowStrip.tsx`, new): one sentence about the state + the one primary button + at most two
  text links. It replaces `NextStepCard.tsx`. It is present in every state: running ("Mixing the sound · usually
  under a minute · no Claude usage · Stop"), paused, done.
- **Left column = the current step's panel.** In Scenes and later it is the shot list (today's `ShotsPanel`). In
  Script it is the brief/script summary. In Voice it is recording and take info. The step's own named actions live
  here (M7).
- **Centre:** preview + transport + the collapsed direction input (T2).
- **Side column, tabs:** **Chat** | **Director**. Collapsed to a 44 px rail under 1400 px wide, as today
  (`chat-dock.ts`).
- **Bottom dock, tabs:** Timeline (default) | Scenes check | Sound | Words | Variants. Documents that today squeeze
  the preview (`CenterDocument.tsx`) open here. "Expand" takes over the centre temporarily, with a "Back to preview"
  pill (D2).
- **Status bar:** History · Claude status · version (M10).

### 2.3 "Needs you" inbox

A header button with a count and a popover list (`layout/NeedsYou.tsx` + pure `stages/attention-view.ts`). Every
item has a sentence and one button. Sources (all exist today, scattered):

| Item | Today | Button |
|---|---|---|
| Script waiting for your OK | row "Review & approve" | Open the script |
| Photos to approve (n) | optional Assets row | Review photos |
| Shot broken / has notes (n) | QA badges ✗/⚠ in the shot list | Show s02 |
| Wow moments to accept (n) | Scenes doc → Dramaturgy | Open in Director |
| Too much of the same (n open) | Scenes doc → Editing | Open in Director |
| Unsourced claims (n) | Script → Sources | Open sources |
| Out of date steps | "Out of date — rebuild" chips | Rebuild <step> |
| Word timing needs whisper.cpp | `WordsSetupNotice` | Download |
| Claude not connected / usage paused | status bar, chat | Settings / wait |

The Now strip shows the most important inbox item. The inbox shows all of them. Nothing else in the UI shouts.

### 2.4 Director drawer (all the 2.2–2.3 "direction" features in one place)

Side column tab **Director** (`director/DirectorDrawer.tsx`, new). Each section has the same anatomy: switch ·
one-line status · the result · the action. The switches are the same `project.json` fields as Project settings;
both places edit them.

1. **Tension curve:** switch, mini curve (SVG of `tension.json`), "Rising · drawn by you", **Edit curve** (opens
   today's `TensionPanel` over the timeline), presets.
2. **Story beats:** surprise moments ("4 planned · 3 in the frames"), questions & answers ("2 open, both
   answered"), **wow moments with Accept / Reject / Preview** (moved from `DramaturgySection.tsx`).
3. **Editing:** cut on the beat ("94 % of cuts on the beat ✓"), too much of the same ("1 open: whoosh 4× — Swap
   sound · Ignore") (moved from `EditingSection.tsx`).
4. **Opening:** Hook lab entry ("Try 3 other openings") + the current opening's first line.
5. **Directions:** history of live directions with Undo/Redo (moved from the `CommandBar.tsx` popover), "Clear all".
6. Footer: "Changes apply at the next Plan / Scenes build. Nothing is marked out of date."

### 2.5 Library (everything that is material, not direction)

Header button **Library** → dialog with left tabs (`assets/LibraryDialog.tsx`, rename of `AssetsDialog.tsx`):

- **This film:** photos to approve (package cards), your files ("Add files…"), downloaded with licences. Research
  mode as a select in the header (L3).
- **All projects:** the shared asset library (today's Library tab).
- **Characters:** people style + mascot for this film, with "New projects start with…" defaults (moved out of
  Project settings → Characters/Mascot and Settings → Projects).
- **Your taste:** today's Settings → Taste, with a scope note "on this computer, all projects".

### 2.6 What stays in Settings / Project settings

- **Settings (app):** Claude, Models (+ "Save Claude usage", "Final check after building"), Projects (defaults),
  Performance, Tools.
- **Project settings (film identity):** title, language, fps, Looks (look mode + vary backgrounds), research mode.
  Direction switches show as rows with "Open in Director". The dialog gets left section tabs like Settings (P1).

---

## 3. Status language rules

The status of a step comes from `stages/stations-view.ts` (new, pure). It combines `StagesState`, the snapshot's
files and the stage reports. There are seven words, and each has a fixed glyph and colour:

| Status | Glyph / colour | When | The Now strip says |
|---|---|---|---|
| Not started | □ muted | nothing produced, not runnable yet | (never the subject) |
| Ready | ▶ accent | runnable, nothing produced | outcome + cost: "Build the 7 scenes (Opus, about 12 min)" |
| Working | ● accent, pulsing pixel | running / queued | what, how long, Stop |
| Needs you | ◆ accent-text | approval, review, a decision | the decision |
| Done | ■ ok | output present and upstream done | — |
| Built with problems | ▲ warn | output present, some parts failed or flagged | "6 of 7 built · s02 failed: <reason>" + Retry s02 |
| Out of date | ◇ warn | output present, an input changed | "<what changed> → rebuild <step>" |

Hard rules (enforced by tests in `stations-view.test.ts`):

1. **Usable output wins.** If a step failed but produced usable output (shots that play, a mix that exists), the
   status is *Built with problems*, never *Failed*. Pure *Failed* (red ✗) is only for "nothing usable came out",
   and then the sentence names the reason and the retry.
2. **Never Done below not-done.** If an upstream step is not done, downstream output shows as *Kept from before*
   (muted ■ with a tooltip "will update after Voice"). This fixes M3.
3. **No waiting chips.** Not started steps carry no text. The bar's order is the explanation. Hover gives the real
   requirement ("Needs: timed words"), taken from the stage's gating reasons and translated (no file names).
4. **Paused and interrupted are Working variants**, with their own sentence ("Paused by your Claude usage limit —
   resumes at 14:05", "Stopped when the app closed — Continue").
5. **Every status sentence answers two questions: what can I watch, what do I do.** Template: `<what exists>.
   <what is wrong, if anything>. [<one action>]`.
6. **Empty states come from files, not reports** (fixes M4, V1, V2): "7 scenes · not checked yet — Run the final
   check", "Recorded 0:31 · not compared with the script yet".
7. **Errors are translated first.** Raw output (lint, ffmpeg, HTTP) is always behind "Details", never the first line
   (F3).

---

## 4. Naming dictionary (EN, enforced)

`docs/ui-copy.md` becomes v2 with this table. A unit test (`apps/desktop/src/renderer/copy-dictionary.test.ts`, new)
scans the renderer's `.tsx/.ts` string literals for the forbidden words in the right column.

| Use | Means | Never say in UI |
|---|---|---|
| Step / Script, Voice, Plan, Scenes, Sound, Export | the six steps | stage, pipeline, Script written, Words timed, Storyboard (as a step), Scenes built, Sound design mixed, Video exported |
| Shot | a time range of the film (`s01`) | scene (for the range), clip |
| Scene | the animation of a shot | — |
| Shot plan | the list of shots (Plan step) | storyboard (as a button label is OK only in "Shot plan") |
| Voiceover | your recorded voice | voice-over, VO |
| Clean-up, Word timing | sub-steps inside Voice | Audio cleaned, Cleanup (as a status), whisper (except Tools) |
| Sound effects, Music, Ambience, Sound mix | the audio | cues, render, stems (except Export → Advanced) |
| Check / Final check / Timing check | QA | QA, sync report, final review |
| Not checked · Checked · Has notes · Broken | shot check states | ○ ✓ ⚠ ✗ alone without a word on hover |
| Variants | 2–3 alternative builds of a shot | takes, versions |
| Lock | shot nothing changes | freeze, pin |
| Director | the drawer with direction features | dramaturgy, co-direction |
| Tension curve | the curve | tension map |
| Story beats: Surprise moments · Questions & answers · Wow moments | dramaturgy features | pattern interrupt, open loop, reveal moment |
| Cut on the beat · Too much of the same | editing features | beat sync, repetition control |
| Hook lab | three alternative openings | intro generator |
| Library · Photos to approve · Your files | material | assets, asset package, media |
| Your taste | learned preferences | taste profile, personalisation |
| YouTube texts | description, chapters, tags, credits | publish kit, metadata, YouTube extras |
| History | the project's git history | git, commit (except in the History drawer details) |
| Needs you | the inbox | notifications, alerts |
| Save Claude usage | economy | economy mode |

Button rule: verb + object + (cost when it uses Claude): "Build scenes (Opus · ~12 min)", "Mix the sound",
"Export video", "Retry s02", "Ask Claude to fix s02". Never "Run", "Redo", "Open", "OK" alone.

---

## 5. Onboarding and empty states

- **Welcome** stays (it works, W1). After "New video from a brief" the project opens on Script with the brief form
  in the left panel and the preview showing the **empty stage**: a pixel-framed card, "Your video will play here",
  the six steps with rough times, and the Now strip "Describe your video in a few sentences → Write the script".
  **No demo inside a project** (N1). `preview-source.ts` drops the demo fallback for projects; the start screen keeps
  the demo, captioned "Example video" (S3).
- **Per-step empty states** (one sentence + one button):
  - Voice: "Record your voiceover (read the approved script) or import a file."
  - Plan: "Claude plans the shots from your timed words. [Plan the shots (Sonnet · ~2 min)]"
  - Scenes: "7 shots planned. [Build scenes (Opus · ~12 min)]"
  - Sound: "[Mix the sound]"
  - Export: "[Export video]"
- **Guided tour:** cut from today's steps (`onboarding/tour.ts`) to three: the step bar, the Now strip, the
  Director drawer. Shown once.
- **Hidden until usable:** direction input (until scenes exist), Tension/Tracks tools (until there are words), the
  timeline (one line until there is audio), the Cards track (removed).

---

## 6. Keyboard map

| Keys | Action | Status |
|---|---|---|
| Space · ← → · Shift+← → · Home/End · J K L · M | player | keep (`preview/transport-keys.ts`) |
| V · Shift+L | variants · lock shot | keep |
| Ctrl+Z · Ctrl+Y / Ctrl+Shift+Z · Delete · + − | timeline | keep |
| ? | shortcuts | keep |
| Ctrl+Shift+C | show/hide chat | keep |
| **Ctrl+Enter** | do the Now strip's primary action (asks first when it uses Claude) | new |
| **Alt+1 … Alt+6** | open step 1–6 | new (plain 1–3 stay with the Hook lab dialog) |
| **Ctrl+Shift+D** | Director tab | new |
| **Ctrl+Shift+N** | Needs you popover | new |
| **/** | focus "Direct this shot" | keep (exists, undocumented: add to the list) |
| **Ctrl+,** | Settings | new |
| **Esc** | close the innermost popover → dialog → clear selection, in that order | changed |
| **Ctrl+.** | stop Claude | new (Esc no longer stops Claude: today Esc means three things, F5) |

Files: `layout/app-keys.ts`, `onboarding/HelpDialogs.tsx` (`SHORTCUT_GROUPS`), `docs/ui-copy.md`.

---

## 7. Visual language: keep, then sharpen

### 7.1 Keep (do not touch)

- Palette tokens in `styles.css :root`: `--bg #0d0e12`, `--panel #15161c`, `--panel-raised #1d1f28`, accent `#ff8a3d`
  family, ok/warn/error, text/muted.
- The 2×2 pixel brand mark, square status dots, mono timecodes and shot ids (`s01` in mono bold), the orange
  playhead and shot blocks in the timeline, the indigo preview frame.
- Small radii (3–6 px). Dark only.

### 7.2 Fix

| Topic | Today | 2.4 |
|---|---|---|
| Control borders | `--border #2b2e3a`, 1.34:1 on panel | new `--border-control #646a80` (3.37:1 on panel, 3.06:1 on raised) for buttons and inputs. `--border` stays for dividers. |
| Disabled | `opacity .55` (default 5.6:1 still looks enabled; primary 3.2:1 still orange) | no opacity. Text `--text-disabled #7d8094` (4.6:1), 1 px **dashed** `--border`, no fill, no hover. A disabled primary becomes a neutral dashed button + a reason line. |
| Spacing | 20 values | `--space-1..6` = 2 · 4 · 8 · 12 · 16 · 24 px. Lint rule (stylelint-free: a unit test greps CSS for raw px in padding/gap/margin outside the scale). |
| Type | 11 sizes, 10–11 px common | `--text-xs 12` (meta only) · `--text-sm 13` · `--text-md 14` (body) · `--text-lg 16` (panel titles) · `--text-xl 20` (dialog titles). Nothing under 12 px. |
| Radii | 2/3/4/6/8/10/999 | `--radius-1 2px` (chips, pixel), `--radius-2 4px` (controls), `--radius-3 6px` (panels, dialogs). Pills (999) become 2 px chips: more pixel. |
| Focus | 2 px accent outline | keep, add a 2 px offset "pixel" double outline on dark accent surfaces. |
| Icons | SVG + unicode ✓⚠✗○Δ★⏹ | one 16 px pixel-grid SVG set in `layout/icons.tsx` (square caps, 2 px strokes): check, warn, broken, not-checked, lock, play, stop, director, library, inbox. Unicode glyphs only in text, never as the sole label. |
| Pixel font | none in UI | optional, last packet: step bar labels and dialog titles in a pixel face generated from the engine's own CC0 display font (ADR-005), so no new licence. If it costs more than one packet, drop it. |
| Primary weight | many orange buttons per screen ("Compact", "Render mix", "Add my assets…", "Generate 3 variants", "Run") | orange fill only for the Now strip's action and a dialog's main action. Toggles that are "on" use `--accent-soft` with accent text. |

The contrast test `apps/desktop/test/support/theme-contrast.test.ts` gets two more checks: non-text 3:1
(`--border-control` on panel/raised/bg) and disabled text ≥ 4.5:1 on its surfaces.

### 7.3 Responsive rules

| Width × height | Left | Side | Bottom dock | Preview |
|---|---|---|---|---|
| 1280×720 (min) | 280 px | rail 44 px (Chat/Director open as an overlay sheet, 360 px) | 160 px, 3 tracks | 640×360 (1×) guaranteed |
| 1440–1919 | 300 px | 360 px open | 200 px | largest integer scale that fits, else 1× letterboxed |
| 1920×1080 | 320 px | 380 px open | 260 px, up to 6 tracks | 1280×720 (2×) |

- Step bar labels shorten to numbers + glyphs under 1360 px (the name stays in the tooltip and aria-label).
- The Now strip wraps to 2 lines at most. Long reasons are cut with "Details".
- Dialogs: max 1000×(window−80), with section tabs on the left above 1100 px and on top below.
- `layout/pane-sizes.ts` gets the preview minimum as a hard constraint (today the docked document can shrink it).

### 7.4 Accessibility

- Step bar = `nav` with `aria-current="step"`. Each step button reads "Scenes: built with problems, 6 of 7".
- Now strip = `role="status"`, `aria-live="polite"`. Status changes are announced once.
- Inbox popover = `role="dialog"` with a list. Focus goes to the first item and returns to the button on close.
- Every icon-only control has a name and a tooltip with its key (already the rule, keep).
- Targets ≥ 24×24 px (the shot row lock/badge buttons are 22 px today).
- `prefers-reduced-motion`: no pulsing "Working" pixel, no animated progress stripes (UI only; scenes are unaffected,
  CLAUDE.md §3.2).

---

## 8. Before / after: the six worst screens

### 8.1 Workspace, scenes step failed with a full shot list (F1, M1, M3)

Before (shots 11/16/20): nine rows; "Scenes built — Failed — see details", "Sound design mixed — Ready to run",
"Waiting for Cleanup"; NEXT "Scenes built failed. [See what failed]".

After (mockup state "Mid-build"):

```
1 Script ■  2 Voice ■  3 Plan ■  [4 Scenes ▲ 6/7]  5 Sound □  6 Export □                 Needs you (2)
▲ 6 of 7 shots are built and play in the preview. s02 failed: Claude stopped before saving the scene.
  [Retry s02]  Ask Claude to fix s02 · Details
Shots: s01 ■ Checked · s02 ✗ Broken (placeholder in preview) · s03 ■ … ; Sound step: no text (not started).
```

### 8.2 New project (N1–N5)

Before (06/07): the Doom demo plays, eight "Waiting for …" chips, `brief.json is missing`, direction bar, six
timeline rows of "No … yet".
After (mockup state "New project"): empty stage card in the preview; the step bar with Script current; the Now strip
"Describe your video in a few sentences; Claude writes the script. [Write the brief]"; no timeline rows, no direction
bar.

### 8.3 Scenes document (M4, D2, D3)

Before (23/24/40): the preview shrinks to ~230 px. "No shot is built yet" while 7 scenes play. Final review /
Dramaturgy / Editing / Sync report stacked.
After: bottom dock tab **Scenes check**: "7 scenes built · 5 checked ✓ · 1 has notes · 1 not checked yet —
[Run the final check (Haiku · ~2 min)]", then a per-shot table (shot, check, timing ±ms, notes, actions). Story beats
and editing are in the Director. The preview keeps its size.

### 8.4 Assets (L1–L3)

Before (35/36): an optional "Assets" row between Storyboard and Scenes, an "Assets" heading button, a dialog called
Assets with "This project"/"Library".
After: Plan step → "2 photos to approve" in the Now strip and in Needs you → **Library** dialog, tab "This film",
section "Photos to approve" (same cards). Research mode is a select at the top. The word "Assets" is gone.

### 8.5 Export (E1–E4)

Before (33/34): "Add to queue", an empty Queue panel, a YouTube block and a Publish kit block both with chapters,
encoder/workers at top level, a checked "chapters.txt" that will not be written.
After: left column **Format** (1080p / 1440p / 4K) · **Quality** · **File name** · Advanced ▸ (encoder, CPU cores,
folder) · [Export video]. Right column **YouTube texts** (description, chapters with the reason when skipped, tags,
credits; Copy each; "Ask Claude to improve"). Progress replaces the right column while exporting; the queue appears
only when there is more than one job.

### 8.6 Project settings (P1, P2)

Before (38/39): one long scroll of large orange cards; direction switches far from their results; characters split
between two dialogs.
After: left tabs **Film** (title, language, fps) · **Looks** (look mode as compact radios, "vary backgrounds", sample
thumbnails behind a link) · **Research** · **Direction** (compact switch rows with "Open in Director"). Characters
move to Library → Characters.

---

## 9. Migration plan: work packets

Twelve packets, each ≤ 400 LOC of diff, each shippable on its own (`main` stays green). UI only: no engine, kit,
pipeline, prompts or `project.json` schema changes. The direction switches already exist as fields. E2E smoke tests
depend on labels (`apps/desktop/test/support/pipeline-rows.ts` finds rows by label inside `region "Pipeline"`), so
every packet that renames UI updates those helpers and runs **only the affected smoke files** (the dev PC is
overloaded; no full `test:app`).

| # | Packet | Files (main) | Acceptance | Tests |
|---|---|---|---|---|
| U1 | **Truthful empty states** (bug fixes, no redesign): scenes/badges/final-check/voiceover/words empty states read files, not only reports | `stages/scenes-view.ts`, `stages/ScenesPanel.tsx`, `stages/final-review-view.ts`, `stages/vo-view.ts`, `stages/VoiceoverPanel.tsx`, `stages/WordsPanel.tsx`, `layout/ShotsPanel.tsx` badge label | Example project: Scenes panel says "7 scenes built · not checked yet"; badges read "Not checked"; Voiceover shows the file and "Not compared with the script yet"; Words lists 76 words with no "Run Words timed" line | unit: views with "files present, report missing"; smoke: `onboarding.smoke` screenshot |
| U2 | **Tokens v2**: control border, disabled style, spacing/type/radius scales as CSS vars; replace raw values in `styles.css`, `ui.css`, `layout/*.css` | CSS only + `theme-contrast.test.ts` | Contrast test covers non-text 3:1 and disabled ≥ 4.5:1; screenshots: no layout shift > 4 px at 1280×720 | unit contrast; smoke: `app.smoke` layout screenshots, eyeballed |
| U3 | **Status model v2** (pure): six steps, seven statuses, rules §3 (usable output wins, never Done below not-done, no waiting text, translated reasons) | new `stages/stations-view.ts` (+ test), `stages/pipeline-view.ts` (expose output facts), `stages/status-view.ts` (statuses → words) | Table test with ≥ 20 cases incl. Papi's "failed with full shot list" → "Built with problems: 6 of 7", fixture "Words done under Voice waiting" → "Kept from before" | unit only |
| U4 | **Header + status bar cleanup**: project menu, versions → About, style display name, "History", Claude status wording | `App.tsx`, `layout/StatusBar.tsx`, `onboarding/HelpDialogs.tsx` | No Electron/Chrome in the header; project menu has Project settings / Open folder / Close project | smoke: `app.smoke`, `onboarding.smoke` (selectors updated) |
| U5 | **Empty stage instead of the demo** + hide-until-usable (direction input, Tension/Tracks, empty timeline rows, Cards track) | `preview/preview-source.ts`, `preview/PreviewOverlays.tsx`, `preview/PreviewPanel.tsx`, `direction/CommandBar.tsx`, `layout/TimelinePanel.tsx`, `timeline/timeline-view.ts` | New project: preview shows the empty-stage card, no demo frame (canvas not rendered or blank); start screen still plays the captioned demo | unit: `preview-source.test.ts`; smoke: `stages.smoke` |
| U6 | **Step bar + Now strip** (uses U3): replaces the row list and the next-step card; the left column shows the current step's panel (existing panels re-hosted) | new `layout/StepperBar.tsx`, `layout/NowStrip.tsx`; `layout/PipelineSidebar.tsx` (slimmed to step panel), `layout/NextStepCard.tsx` (removed), `Workspace.tsx`, `test/support/pipeline-rows.ts` | One primary button in the window in each mockup state; Alt+1–6 open steps; `aria-current` on the current step | unit: step-bar view; smoke: `pipeline`, `stages`, `onboarding` (helpers updated) |
| U7 | **Needs you inbox** (pure collector + popover) | new `stages/attention-view.ts` (+ test), `layout/NeedsYou.tsx`; reads existing reports (scenes, dramaturgy, repetition, claims, assets, whisper) | Count matches the items; each item's button navigates; Ctrl+Shift+N | unit; smoke: `locks-review.smoke` (adds one inbox assertion) |
| U8 | **Bottom dock**: documents open as dock tabs, not over/under the preview; preview minimum enforced | `layout/AppShell.tsx`, `layout/pane-sizes.ts` (+ test), `layout/CenterDocument.tsx` → `layout/BottomDock.tsx`, `Workspace.tsx` | At 1280×720 with Scenes check open the canvas is ≥ 640×360 | unit: pane sizes; smoke: `player.smoke`, `timeline.smoke` |
| U9 | **Director drawer**: side tab with Tension summary, Story beats (moved), Editing (moved), Opening (Hook lab entry), Directions history (moved from popover), inline switches | new `director/DirectorDrawer.tsx`; move `dramaturgy/DramaturgySection.tsx`, `editing/EditingSection.tsx`; `layout/ChatPanel.tsx` (tabs), `direction/CommandBar.tsx` (history out), `stages/ScenesPanel.tsx` (sections out) | All five sections reachable in ≤ 2 clicks; switching a feature on/off writes `project.json` once (same commit message as today) | smoke: `dramaturgy`, `tension`, `direction`, `hook-lab` (selectors) |
| U10 | **Library dialog**: rename Assets → Library with tabs This film / All projects / Characters / Your taste; header button; remove the Assets heading button and the optional row label | `assets/AssetsDialog.tsx` → `assets/LibraryDialog.tsx`, `assets/LibraryPanel.tsx`, `settings/TasteSettings.tsx` (re-hosted), `project/CharacterRows.tsx` (re-hosted), `stages/pipeline-view.ts` (assets → Plan sub-item) | Photos package reachable from Now strip / inbox / Library; Settings → Taste tab shows "Moved to Library → Your taste" | smoke: `assets`, `own-assets`, `characters-settings` |
| U11 | **Export dialog v2**: "Export video", Advanced disclosure, merged YouTube texts, chapters checkbox honest | `export/ExportDialog.tsx`, `export/export-view.ts` (+ test), `publish/PublishKit.tsx`, `export/YoutubeExtras.tsx` (merged) | Short film: chapters row says "skipped: needs 3 chapters of 10 s"; the queue shows only while running | unit; smoke: `sound-export.smoke` |
| U12 | **Copy pass + keys + docs**: dictionary test, button rule, Esc order, Ctrl+., new shortcuts dialog, `docs/ui-copy.md` v2, Project settings section tabs | new `copy-dictionary.test.ts`; `layout/app-keys.ts`, `onboarding/HelpDialogs.tsx`, `project/ProjectSettingsDialog.tsx`, many string edits | Dictionary test green (no forbidden words in renderer strings); Esc never stops Claude | unit; smoke: `chat.smoke` (Esc), `project-settings.smoke` |
| U13 (optional) | Pixel face for step bar + dialog titles from the engine's CC0 display glyphs | build script + `styles.css` | Visual sign-off by Papi; licence row in `docs/licenses.md` | screenshots |

**Order:** U1 → U2 → U3 → U4 → U5 → U6 → U7 → U8 → U9 → U10 → U11 → U12 (→ U13). U1, U2 and U4 can ship alone as a
2.3.6 "quick wins" release if Papi wants something sooner. U6 is the big visible switch. Everything before it is safe
under the old layout.

**Risks**

- *E2E churn:* the smoke tests find UI by role and label, so U6, U9 and U10 rename a lot. Mitigation: keep the
  accessible names stable where possible (the step bar keeps `region "Pipeline"`-equivalent `nav "Steps"`, plus a
  helper update in the same packet), and run only the touched smoke files.
- *Hidden muscle memory:* Papi knows where Tension and Hook lab are today. Mitigation: old entry points stay for one
  release as links ("Tension → now in Director").
- *Status model regressions:* U3 is pure and table-tested before any UI uses it.
- *Scope creep into features:* no packet adds features. Anything that needs new data (time estimates per step) uses
  numbers already shown elsewhere (`VariantSetup` estimates, perf docs) or stays out.
- *Preview performance:* the empty stage is a DOM card, not a scene; the step bar has no animation in the preview
  canvas. §3.2/§3.3 are untouched (engine unchanged).

---

## 10. What NOT to change

- The palette, the orange accent, the dark theme, the pixel brand mark, square status dots, mono ids and timecodes.
- The preview canvas, its integer pixel scaling and everything in `packages/engine` / `packages/kit` (preview =
  export, CLAUDE.md §3.3).
- The Welcome screen layout, the Hook lab dialog, the variants setup (honest cost line), the asset package cards,
  the chat behaviour (turns, queue, history, selection targeting), the History drawer and revert model.
- Locks, variants, the shot ids, the timeline's look (orange shot blocks, cue pins, waveform).
- Keyboard shortcuts that exist today (only additions, plus the Esc fix).
- No telemetry, no network for UI, no web fonts from the internet (CLAUDE.md §3.4, §6).

---

## 11. Decisions for Papi

1. Approve the six steps (Script · Voice · Plan · Scenes · Sound · Export) and the seven status words?
2. Director drawer as a tab next to Chat (proposal), or a separate right drawer?
3. Taste and Characters move to Library? (Today: Settings → Taste, Project settings → Characters.)
4. Ship U1, U2 and U4 first as 2.3.6 quick wins, or wait for the full 2.4?
5. Try the pixel face for titles (U13), or keep system text everywhere?

### Answers (Papi, 2026-10-06)

1. **Keep the old-school Premiere-Pro vibe; rebuild lightly.** Layout stays roughly as it is; improvements by taste. Hard requirement:
   **clicking any element (e.g. Sound) immediately opens everything it offers and everything that can be changed there** (inspector
   / effect-controls idea) — every pipeline row/step gets one "all options" panel. The six-step bar (U6) is therefore reworked as a light
   layer on the existing rows (statuses + clearer sentences), not a new layout.
2. **Director = tab next to Chat (A).**
3. **Taste and Characters do NOT go to a global Library**: they differ per animation style/world and per channel. Characters/heroes live
   with the world (Style) settings; taste lives with the channel (13.13) and can be per world. Library keeps only material
   (photos, your files, other projects). U10 changes accordingly.
4. Quick fixes are not a separate 2.3.8; they ship inside 3.0 (U1, U2, U4 first).
5. Pixel face for titles: Papi did not know what it is (today the UI text is system font; the pixel feel only comes from the brand mark,
   square dots, mono timecodes). Try it last (U13) on step/section titles and dialog titles only, one CSS variable to switch off; Papi judges the screenshot.
Also: publish helper postponed (13.11); the number of channels can change, so channels are a dynamic list, never a fixed 3 (13.13).
