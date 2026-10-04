# UI copy and terminology (PLAN.md#11.2)

One word per thing, everywhere in the app (pipeline, buttons, panels, chat, settings, tests).

## Terms

| Term | Means | Do not say |
|---|---|---|
| **Step** | One row of the pipeline (Script written … Video exported). | stage (in UI text; the code keeps `stage`) |
| **Shot** | One entry of the storyboard (`s01`, `s02_glass`…), a time range of the video. | scene (for the time range), clip |
| **Scene** | The animation code of a shot (`scenes/s01_title.js`). | shot file |
| **Storyboard** | The list of shots (step "Storyboard"). | shot list |
| **Voiceover** | Your recorded voice (step "Voiceover added"). | voice-over, VO (in UI text) |
| **Words** | The timed words of the voiceover (step "Words timed"). | transcript, timing file |
| **Cues** | Sound effects, ambience and music placed on the timeline (`cues.json`). | sound events |
| **Mix** | The rendered sound of the video (`audio/mix.wav`). | render (alone) |
| **Lock** | A shot nothing changes until it is unlocked. | freeze, pin |
| **Variants** | 2–3 alternative builds of one shot to pick from. | versions, takes |
| **Chat** | The Claude panel on the right. | assistant |
| **Assets** | Real photos/footage downloaded into the project (step "Assets", only when research is on and the storyboard asks for some). | media, images (alone) |
| **Asset package** | Candidates Claude proposes for your approval (research mode "Ask me for each package"). | proposal (in UI text) |

## Step status words

Same colour and dot per status everywhere; the legend is the (i) next to "Pipeline".

| Status | Chip | Means |
|---|---|---|
| done | Done | Finished; Redo runs it again. |
| ready | Ready to run | Everything it needs is there. |
| review | Review & approve | Read the result (the script, the asset package), then approve it. |
| running | Running… 42 % | Working now; the detail line names the current step. |
| queued | Queued | Starts when the running step finishes. |
| waiting | Waiting for *Voiceover* | Names the nearest earlier step that is not done (short names: Script, Voiceover, Cleanup, Words, Storyboard, Assets, Scenes, Sound mix, Export); "Waiting for the brief", "Needs your recording" at the start. |
| stale | Out of date — rebuild | Something it uses changed. |
| paused | Paused (usage limit) — resumes 14:05 | The Claude usage limit; resumes by itself. |
| interrupted | Interrupted — Resume | The app closed while it ran. |
| failed | Failed — see details | Select it for the error, then Retry. |

## Buttons and sentences

- Buttons name the action: "Add your voiceover", "Run Words timed", "Open the script", "Rebuild Storyboard", "Stop building". Not "Show", "OK", "Go".
- The next-step card: one short sentence + one primary button; the reason goes into the (i) tooltip.
- Empty states say what to do next: "No shots yet. Add your voiceover, then run Words timed and Storyboard: the shots appear here."
- Counts use the right noun form (`plural()` in `apps/desktop/src/shared/plural.ts`): "1 shot", "16 shots".
- Icon-only buttons always have a tooltip; a keyboard shortcut goes into the tooltip in brackets: "Hide chat (Ctrl+Shift+C)", "Play (Space)", "Lock this shot … (Shift+L)".
- Settings vs Project settings: **Settings** (header, right) are app-wide; **Project settings** (header, next to the project title) live in `project.json` — Visuals: "Voxel only — the classic look" / "Mixed looks — voxel + <looks>", "Vary backgrounds subtly between shots"; every option says when it applies ("Applies to the next Storyboard and Scenes build") and never marks a step out of date.
- Research assets (Project settings → Research): "Ask me for each package" (default for new projects) / "Automatic from selected sources" (+ a checklist: Wikimedia Commons, Openverse, Internet Archive, NASA Image and Video Library, Library of Congress) / "Full auto ⚠ risky" (red warning: unverified licences, the user is responsible) / "Off" (no network). The Assets dialog: "Asset package N: choose what Claude may use", "Approve selected (N)", "Reject all"; licence chips read "CC BY 4.0" or "⚠ unverified". The export dialog: "⚠ N assets have an unverified licence: check them before publishing (the export is not blocked)." and "Credits for the video description" with Copy.
- Listen toggle: "Full mix" (voice, effects, ambience, music with your latest edits) / "Voice only".
