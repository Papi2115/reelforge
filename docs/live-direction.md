# Live co-direction (PLAN.md#12.14)

While the film plays, type a short command into the bar under the preview (press `/` to focus
it). Simple commands change the shot under the playhead at once, without rebuilding its scene;
commands only Claude can do become a variants rebuild of the shot. Decision record:
`docs/decisions/ADR-023-live-direction.md`.

## Commands (English / Polish)

Case, diacritics and punctuation do not matter ("Jaśniej!" = "jasniej"). "much"/"dużo" doubles a
step, "a bit"/"trochę"/"please"/"proszę" are ignored, "make it …"/"zrób …" may lead.

| Command | Polish | Effect (one step) |
| --- | --- | --- |
| slower, slow down | wolniej, zwolnij | rate −0.2 (min 0.4) |
| faster, speed up | szybciej, przyspiesz | rate +0.2 (max 1.6) |
| normal speed | normalnie, normalne tempo | rate back to 1 |
| darker | ciemniej, przyciemnij | tone −0.25 (min −1) |
| brighter, lighter | jaśniej, rozjaśnij | tone +0.25 (max +1) |
| zoom in, closer | przybliż, bliżej | zoom +0.1 (max 1.3) |
| zoom out, wider | oddal | zoom −0.1 |
| arrow on the word X [at the top left] | strzałka na słowie X [po lewej] | arrow mark on the word |
| ring / circle X | zakreśl X, kółko na X | ring mark |
| underline X | podkreśl X | underline mark |
| highlight this / X | zaznacz to / X | spotlight on the point (the rest dims) |
| callout on X | dymek na X | box with the word |
| badge on X | znaczek na X | "!" badge |
| remove the arrow / remove all marks | usuń strzałkę / usuń wszystko | removes the last such mark / all |
| clear, reset | wyczyść, resetuj | removes every direction of the shot |
| undo / redo | cofnij / ponów | the session's history |

**Words.** "X" is matched against the shot's timed words (words.json): exact first, else a
prefix (≥ 3 letters) or one typo (≥ 4 letters); several words match a phrase. With several
occurrences the one nearest to the playhead wins (the confirmation says "nearest of 2"). "this",
"here", "to", "tu" or no word = the word spoken at the playhead. A word spoken in another shot is
an error that names where it is.

**Where.** A trailing region (`center`, `left`, `right`, `top`, `bottom`, combinations like
`top left`; Polish `środek`, `lewo/lewej`, `prawo/prawej`, `góra/górze`, `dół/dole`) places the
mark; otherwise the last point clicked in the preview (pulled 10 % inside the frame), otherwise the
centre. The mark appears on the word's start and stays until 1.5 s after it ends (at least 2 s,
never past the shot); its label stays in the style's safe area.

Anything else ("make it a terminal", "use the diorama look") is offered as **Rebuild with
Claude**: two variants of the shot with the command as the note (`docs/shot-variants.md`), with
progress in the Variants dock; nothing changes until you pick one.

## What is stored

`directions.json` in the project root (tracked, zod `directionsFileSchema`, atomic write):

```json
{ "version": 1, "shots": { "s03": { "rate": 0.8, "dim": -0.25, "zoom": 1.1,
  "overlays": [ { "id": "arrow-1", "kind": "arrow", "x": 0.28, "y": 0.3, "region": "top-left",
    "at": 12.4, "until": 14.6, "word": { "index": 41, "text": "light" } } ] } } }
```

Every command is a commit `Direction s03: <command>` (step `direction`): the project History can
go back across sessions; the bar's history (undo/redo) covers the current session. A missing or
invalid file renders as if there were none.

## How it renders (preview = export)

The preview/export manifest (`apps/desktop/src/main/project-manifest.ts`) gives each shot its
`direction`; the export cache key covers it. The engine applies it on top of the built scene:

- **rate** — anchor-safe time remap (`packages/shared/src/time-remap.ts`, the reveal-moment
  curve with `rate` up to 1.6): windows over the gaps between the shot's visual hits (anchors and
  sfx cues, shot edges), ≥ 0.6 s, the 4 longest. s(from) = from and s(to) = to, so every hit and
  VO word keeps its time; inside a gap the motion runs slower and catches up (or runs ahead and
  settles). A shot without hits gets one window over the whole shot — the only anchor-safe
  "uniform" hold. Composed with a reveal-moment slow motion: direction first, then the moment.
  Limit: the average speed between two hits cannot change (that would move the hits).
- **dim** — the 12.27 palette-shift pass with darker or lighter tone-family neighbours, the
  amount = |dim| through a 4x4 Bayer dither: every pixel stays a palette colour.
- **zoom** — centred crop-scale of the finished frame by integer nearest-neighbour index maps
  (no blur, copied pixels only).
- **overlays** — the annotation layer of ADR-008 at screen targets, in an own pixel surface
  composited over the frame with the palette LUT (vibe guard clean).

During a transition the zoom blends between the two shots and the tone follows the shot that
dominates the picture. Shots without a direction run the old code path bit for bit (all goldens
unchanged). The preview swaps a changed direction in through `setShotDirection` (harness RPC
`direct`) — no shot rebuild, no reload. `reelforge frames` renders the scene as authored (like
reveal moments).

## Speed (benchmark)

`apps/desktop/src/main/live-direction.bench.test.ts`: 10 commands (EN and PL: slower, ciemniej,
zoom in, arrow on the word calculator, podkreśl exam, zakreśl memory, highlight this, faster,
jaśniej, usuń strzałkę) on the example project "Doom on a calculator", each: parse + atomic write
+ real git commit + manifest rebuild + hot-reload plan + the engine's frame pass. CI bar: median
< 1 s. Set `REELFORGE_BENCH_OUT=<file>` to get the timings.

| Run (Windows 11, dev machine, 2026-10-04) | Median | Range |
| --- | --- | --- |
| 1 | 239 ms | 227–275 ms |
| 2 | 247 ms | 234–255 ms |
| 3 | 258 ms | 230–291 ms |

Not included: the file watcher batch (150 ms) and one engine seek (a frame, ~10–30 ms on a GPU),
so a command shows in the player in about 0.4–0.5 s. Parsing alone is well under 1 ms. The locked
shot test (s04 locked → refused, directions.json unchanged) runs in the same file.

## Voice (optional, no code)

Windows has system dictation: click into the command bar and press **Win+H**, speak "slower" or
"strzałka na słowie światło", the text lands in the input; press Enter. Polish works when the
Windows display/speech language includes Polish. Nothing is recorded or sent by ReelForge; the
app needs no microphone permission for this. A built-in push-to-talk (e.g. local whisper.cpp on a
short clip) could be added later on top of the same parser.

## Tests

`packages/shared/src/{live-direction,live-direction-parse}.test.ts` (schema, merge, rate windows,
EN/PL grammar, fuzzy words, ambiguity, regions, removal), `packages/engine/src/direction.test.ts`
(composition with moments, tone/zoom/marks palette-pure and deterministic),
`packages/engine/test/render/live-direction.test.ts` (SwiftShader: hot apply = fresh load,
clearing restores the plain frames, arrow goldens `live-direction-arrow-1.2/2.5`, vibe guard, rate
keeps anchors and cues), `packages/pipeline/src/export/cache-key.test.ts`,
`apps/desktop/src/main/directions-service.test.ts` (commit per command, locked refused, manifest
merge), `apps/desktop/src/renderer/preview/{reload-plan,preview-controller}.test.ts` (direction-only
hot apply), `apps/desktop/src/renderer/direction/direction-view.test.ts` (history, chips, status,
`/`), e2e `apps/desktop/test/direction.smoke.test.ts`.
