# Example project: "Doom on a calculator"

`templates/examples/doom-on-a-calculator/` is the project the app offers on first run (Welcome →
"Open the example project", PLAN.md#10.3). The app copies it into
`Documents/ReelForge Projects/<unique name>/`, adds the template files (CLAUDE.md, .gitignore,
style bibles), commits it and marks Script / Voiceover / Audio cleaned / Words timed / Storyboard /
Scenes built as done, so a new user can press Play, edit a scene in the chat and run Sound design →
Export to get an MP4.

## What is committed

| File | How it was made |
|---|---|
| `script.txt`, `brief.json`, `project.json` | Written by hand (76 words, ~30 s). |
| `audio/vo.original.wav` | Windows SAPI voice "Microsoft David Desktop", rate +2, 16 kHz mono 16-bit, 300 ms lead, 350 ms paragraph breaks, 900 ms tail (`spikes/03-audio/synth.ps1` with an added `Rate`). Licence note: `docs/licenses.md`. |
| `timing/words.json` | SAPI word-boundary events (one per script token; end = last viseme before the next word) aligned to `script.txt` with the pipeline's `alignScript` + `buildWordsFile` (76/76 exact). |
| `storyboard.json` | 7 shots, treatments title-card → kinetic-text → metaphor-object → counter/odometer → character-scene → ui-mockup → title-card. |
| `scenes/s01…s07_*.js` | Hand-written with the kit only; QA'd with `reelforge lint`, `frames`, `contact-sheet` and `anchors` (no MISS). |
| `cues.json` | Hand-written: the scenes' sfx on their anchors + whooshes before the glitch transitions, a hum bed and room tone in the classroom shot. |

Not committed (made by the app or the stages): `audio/vo.clean.wav` (the app copies the original:
the synthesized voice is already clean), `audio/mix.wav`, `out/`, `.reelforge/`.

## Changing it

Edit the scenes and check them from the example folder with the CLI
(`node ../../../packages/cli/dist/reelforge.mjs lint|frames|anchors`), then delete the
`.reelforge/` folder it leaves behind. If the script changes, re-synthesize the voice and re-time
the words the same way. Tests: `packages/cli/src/example-project.test.ts` (validate, lint, anchors,
audio size) and `packages/cli/test/render/example-project.test.ts` (frames, cards, sync).
