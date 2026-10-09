# 06 · Film authoring — how a C-CAM film is assembled

How the three standalone films were built and how to build another one in the same form. (How the same work maps
onto ReelForge's stages is in [07-REELFORGE_INTEGRATION](07-REELFORGE_INTEGRATION.md).)

## 1. From text to film

```
script.txt ──► storyboard.md ──► cast/*.js (one per role) ─┐
 (narration)   (facts, cast       topic brushes             ├─► shots/*.js ─► film.js ─► timeline.js ─► player.js
               roles, shots       (edo.js / lunar.js /      │   (defineShot)   (order,     (one clock,    (keys, hooks)
               with times)        props.js / acting.js)     │                  durations,   captions)
                                  sets/*.js (one fn per ────┘                  captions)
                                  setting)
```

| Step | File | What it contains | Example |
|---|---|---|---|
| Script | `script.txt` | the narration only, one sentence per line, title first | `films/02-papal-conclave/script.txt` (16 lines) |
| Storyboard | `storyboard.md` | header (runtime, captions, "no audio"), **FACTS** to keep hedged, **CAST** roles (each "individually hand-built"), **SHOTS** with target times, narration and visual beat | `films/01-samurai-edo/storyboard.md:1-12` |
| Cast | `js/cast/<id>.js` | one hand-built character per file + `crowd.js` | [04-CHARACTER_GUIDE](04-CHARACTER_GUIDE.md) |
| Topic brushes | `js/props.js`, `js/edo.js` / `js/lunar.js`, `js/acting.js` | props and set pieces of the topic, built only from the shared brushes | `films/03-apollo-11/js/lunar.js:1-3` |
| Sets | `js/sets/sets-a..c.js` | one function per setting: `ST.setXxx(ctx, t, o)` | `films/02-papal-conclave/js/sets/sets-b.js:30` |
| Shots | `js/shots/shots-a..d.js` | 3–4 shots per file, `ST.defineShot(id, {...})` | `films/03-apollo-11/js/shots/shots-a.js:48-64` |
| Film table | `js/film.js` | `ST.FILM = [{ id, dur, lines: [[from, to, text]] }]` | `films/03-apollo-11/js/film.js:4-18` |
| Page | `showcase.html` | script tags in load order + the player chrome | `films/03-apollo-11/showcase.html:21-58` |
| Dev page | `test.html` | engine + props + cast files + `test-page.js` | `films/03-apollo-11/test.html:18-30` |

Folder conventions: topic files ≲ 200 lines each (engine `brushes.js` is 324; largest topic files: `films/01-samurai-edo/js/cast/you.js` 194,
`films/02-papal-conclave/js/cast/stubborn.js` 185); shots grouped 3–4 per file in film order; set and shot ids are short
lowercase words (`wake`, `nopope`, `payoff`); every function that other files use is published on `ST`.

## 2. Length and timing rules (as used)

- Film length **60 ± 2–3 s** (storyboards: "total 60 ± 2 s", `films/01-samurai-edo/storyboard.md:12`; actual 62–63 s).
- **11–13 shots**; shot durations 3–7 s (title 4 s, payoff 3–4 s): `films/*/js/film.js`.
- Caption lines are in **shot time**, start 0–0.3 s after the cut, end at or just before the shot end; a shot may have
  0–3 lines (film 2's title carries its line in the poster lettering: `films/02-papal-conclave/js/film.js:1-2,6`).
- Inside a shot: one gag beat, one reaction; cuts inside the shot on beats ([05 §3](05-CAMERA_GUIDE.md#3-rhythm-cuts-beats-and-the-12-fps-acting));
  expression snaps and head jolts on the beat; holds ≥ 0.4 s.
- Recurring gag across shots (merchant always one bow lower; the Stubborn's notebook; the Commander's gum) and a
  **payoff** shot that calls back to it ("Survival tip: …" in all three films).

## 3. Add a shot

```js
// js/shots/shots-x.js
'use strict';
(function () {
  const ST = window.ST, C = ST.C, K = ST.key, S = ST.step, CAST = ST.CAST, tw = ST.twos;
  ST.defineShot('fuel', {
    title: 'Fuel', role: 'the clock',                       // shown in the player's note line
    note: 'Tilted close-up: the needle in the red; ECU glove on the armrest; your face.',
    render(ctx, t) {                                        // t = shot time, seconds
      const tt = tw(t);                                     // acting time (twos)
      ST.cutCam(ctx, t, [                                   // 1. camera FIRST (film 3 dialect)
        { at: 0, x: 560, y: 600, z: [[0, 1.6], [1.6, 1.7]], rot: -5 },
        { at: 1.6, x: 1300, y: 860, z: 2.4 },
        { at: 2.8, x: 1500, y: 540, z: 1.6, rot: 5 },
      ]);
      ST.setPanelWall(ctx, 420);                            // 2. set
      /* 3. props, 4. people back to front, 5. foreground, 6. fg silhouettes */
      CAST.you.draw(ctx, { x: 1560, y: 1720, s: 1.75, t, yaw: -1, sweat: true,
        expr: S(t, [[0, 'miserable'], [2.0, 'scared']]) });
    },
  });
})();
```
(abridged from `films/03-apollo-11/js/shots/shots-c.js:39-60`). Then:
1. add `{ id: 'fuel', dur: 4.0, lines: [[0, 4.0, 'Reports say fuel is dangerously low.']] }` to `film.js` in its place;
2. add `<script src="js/shots/shots-x.js">` before `film.js` in `showcase.html` (`timeline.js` throws on a film id
   without a definition, `films/03-apollo-11/js/timeline.js:9`);
3. reload; jump with the number keys; check every framing with ← / →.

Rules inside `render`: pass `t` to every character (blinks, talk), use `tw(t)` for positions/poses, `S(t, …)` for
expression snaps; never keep state between calls.

## 4. Add a set

A set is a function of `(ctx, t, o)` that paints the world for a setting in world coordinates (1920×1080 frame at
zoom 1, drawn wider for camera coverage). Follow [01 §8](01-STYLE_GRAMMAR.md#8-backgrounds-sets); example
`films/02-papal-conclave/js/sets/sets-b.js:30-78` (`ST.setHall` with options for time passing: tally count, year,
snow, cobwebs, candle, roof gap). Return values are allowed when a shot needs geometry (`setHall` returns the roof
cut x for clipping, `sets-b.js:77`; `films/02-papal-conclave/js/shots/shots-d.js:19-23`). Animated parts read `t` and
step on twos (rain, `sets-b.js:134-145`; noren sway, `films/01-samurai-edo/js/edo.js:72-80`).

## 5. Add a prop

A prop is a drawing function in the current space, placed by the caller at a solved point:
`ST.mug(ctx, x, y, tilt, seed, steam)` (`films/03-apollo-11/js/props.js:47-57`), `ST.bigKey(ctx, x, y, ang, seed)` centred
at the grip (`films/02-papal-conclave/js/cast/mayor.js:110-118`). Rules: centre the prop on its grip point; take a seed;
build it from `ST.blob/tube/rough/stroke`; give it a shade crescent and a little hatching; one accent colour at most;
animate by a parameter (`page`, `bite`, `steam`, `flip`), never by internal state.

## 6. Tools (what exists)

Both tools hard-code two paths (`films/03-apollo-11/tools/proof.mjs:7,13`, `tools/shoot.mjs:6,10`):
```js
createRequire('C:/Users/galar/Desktop/yt/node_modules/.pnpm/playwright-core@1.63.0/node_modules/playwright-core/')
executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe'
```
They need the ReelForge repo's installed `playwright-core` 1.63.0 and an installed Google Chrome; on another machine
or after a pnpm update the paths must be edited (**caveat**). Launch flags: headless, `--force-color-profile=srgb`.

| Tool | Usage | Output |
|---|---|---|
| `tools/proof.mjs` | `node tools/proof.mjs <sheet.png> [framesDir\|-] [t1,t2,…\|-] [page.html]` | a contact sheet (3 columns; tiles 640×360 in film 1, 480×270 in films 2–3), labels `NN-shotid-time`; default times = 12 %, 50 %, 93 % of every shot (film 2: shot start + middle of every `cuts` entry + end); optional full-size PNG per frame in `framesDir`; exit 1 on console errors (`films/03-apollo-11/tools/proof.mjs:22-59`) |
| `tools/shoot.mjs` | `node tools/shoot.mjs <page.html[?query]> <out.png> ["js expression returning a PNG data URL"]` | one PNG; default expression `window.__showcase.frame(0)`; turnarounds: `"window.__test.all(0.5)"` (`tools/shoot.mjs:1-29`) |

Notes:
- Pass absolute Windows paths; the tools convert backslashes and prefix `file:///`.
- Frames come from `window.__showcase.frame(t)` = the player's default (GPU-backed) canvas, so two runs can differ in
  a few pixels ([02 §6](02-ARCHITECTURE.md#6-determinism)).
- There are **no validators** in C-CAM's `tools/` (no anchor/tangle/contact checks). The c-plus engine has
  `tools/validate.mjs` (`../../styles7/20-cplus-engine/NOTES.md:3-5`).

## 7. Rendering to PNG and MP4

- **PNG frames**: `node tools/proof.mjs sheet.png framesDir 0,0.5,1,…` writes one full-size 1920×1080 PNG per listed
  time. For every frame of a film, list `k/24` for k = 0 … 24·duration − 1 (≈ 1500 frames per film; not done so far).
- **MP4: no tool exists in C-CAM.** What would be needed (not implemented, not verified): render frames at `k/24` from a
  CPU-backed canvas (`getContext('2d', { willReadFrequently: true })` + `ST.renderFrame` + `getImageData`), stream the RGBA
  bytes to ffmpeg (`-f rawvideo -pix_fmt rgba -s 1920x1080 -r 24 -i -`), H.264. ReelForge already has this pipeline
  for its own engine (`docs/export.md:7-15`); porting the style into ReelForge (doc 07) is the intended way to get MP4s
  with audio, not a separate C-CAM exporter.
- There is no audio in the films (storyboards say "no audio", `films/02-papal-conclave/storyboard.md:1`).

## 8. Checklist before calling a film done

1. All `showcase.html` and `test.html` pages load with no console errors (`proof.mjs` exits 1 otherwise).
2. Contact sheet + one frame per framing looked at (film 2's proof tool does the per-cut sampling).
3. Turnaround sheets looked at for every new character ([04 §10](04-CHARACTER_GUIDE.md#10-how-to-test-a-character)).
4. Every on-screen word comes from the script/facts (ReelForge's text-provenance rule, `docs/worlds/QUALITY.md:11-12`).
5. One accent per shot; tilt only on tense beats; no set edge visible in any framing.
6. Captions readable over every frame (they sit at y ≈ 1010 with an 11-px ink outline).
