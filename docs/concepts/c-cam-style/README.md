# C-CAM — style C with dynamic camera (documentation package)

**C-CAM** is the hand-built "grim caricature" cartoon style Papi picked as the official style to bring into ReelForge:
style **C** (canvas 2D, every frame a pure function of `t`, each character its own hand-drawn function on a shared
anatomy rig, flat grime, an uneven ink line, acting on twos) plus the **camera work from the c-plus experiments**
(cuts inside a shot, push-ins and pull-backs, Dutch tilt, extreme close-ups, foreground silhouettes). Nothing else from
c-plus (lighting passes, face system, doubled strokes) is part of it.

This folder holds three finished 60-second films in the style and the full written documentation, so that:
- the ReelForge Manager/Coder can port the style into the app (start with [07-REELFORGE_INTEGRATION](docs/07-REELFORGE_INTEGRATION.md));
- the runtime Claude (the one that writes scenes per video) can draw new characters, sets and shots in this style
  (start with [01-STYLE_GRAMMAR](docs/01-STYLE_GRAMMAR.md) and [04-CHARACTER_GUIDE](docs/04-CHARACTER_GUIDE.md)).

Every factual statement in these docs is taken from the code; citations are `file:line`. Paths that start with
`films/` are relative to this folder; paths that start with `packages/`, `docs/`, `styles/`, `templates/` are relative
to the repository root. Things that could not be established from the code are marked **UNKNOWN**.

## The three films

| # | Folder | Title (poster) | Topic | Runtime | Shots | In-shot camera setups | Hand-built cast |
|---|---|---|---|---|---|---|---|
| 1 | [films/01-samurai-edo](films/01-samurai-edo/showcase.html) | Would You Survive as a Samurai in Peaceful Japan? | Edo-period samurai as clerks in debt to rice merchants | 62.0 s | 11 | 40 framings | you, merchant, elder, clerk, keeper, rival + a cat + townspeople |
| 2 | [films/02-papal-conclave](films/02-papal-conclave/showcase.html) | How Not to Choose a Pope (Viterbo, 1268) | The 1268–1271 papal election and the origin of "conclave" | 63.0 s | 12 | 37 setups | stubborn, tired, mayor, gregory, roofer, baker + townsfolk/cardinals |
| 3 | [films/03-apollo-11](films/03-apollo-11/showcase.html) | Would You Survive Landing on the Moon? | Apollo 11 descent: 1202 alarm, boulders, low fuel | 63.0 s | 13 | 35 framings | you, commander, orbiter, director, guidance + engineers |

Runtimes and shot counts are `ST.DURATION` / `ST.SHOTS.length` measured by loading each page (see "Verification" below);
film tables: `films/01-samurai-edo/js/film.js:4`, `films/02-papal-conclave/js/film.js:5`, `films/03-apollo-11/js/film.js:4`.
Setup counts: film 2 = the sum of its `cuts` lists (37, also `films/02-papal-conclave/NOTES.md:4`); films 1 and 3
were counted by hand from the cut tables and direct `ST.camera` segments in `js/shots/*.js` (one framing per table
row; the catalogue is in [05-CAMERA_GUIDE](docs/05-CAMERA_GUIDE.md)). Gallery page: [index.html](index.html).

Each film folder is self-contained (double-click works, `file://`, no server, no network):

```
films/<nn-topic>/
  showcase.html        the film + player (canvas 1920x1080)
  test.html            dev page: turnaround sheets (every character x 6 views x poses + 6 expressions)
  script.txt           narration lines as given
  storyboard.md        facts, cast roles, shot list with target times
  NOTES.md, CHANGES.md what this variant is, what changed vs "c-base" (camera only)
  proof/               sheet.png (contact sheet), turnarounds.png (01, 02) or cuts.png (03)
  tools/proof.mjs      contact sheet renderer (Playwright + installed Chrome)
  tools/shoot.mjs      single-image capture (e.g. the turnaround sheet)
  js/                  engine copy + topic code (cast/, sets/, shots/, film.js, props.js, edo.js | acting.js | lunar.js)
```

## Quick start

1. Open `films/<film>/showcase.html` (double-click). It plays immediately.
2. Keys (`films/03-apollo-11/js/player.js:58-73`):

| Key | Action |
|---|---|
| Space | play / pause |
| 1–9 | jump to shot n and play |
| ↑ / ↓ or P / N | previous / next shot |
| ← / → | one frame back / forward (1/24 s), pauses |
| C | captions (narration) on/off |

3. URL parameters (`films/03-apollo-11/js/player.js:11-13`): `?t=12.5` start time in seconds, `&paused=1` start paused,
   `&captions=0` captions off. Example: `showcase.html?t=33&paused=1&captions=0`.
4. Hooks for tools (`films/03-apollo-11/js/player.js:79-85`): `window.__duration` (seconds),
   `window.__seek(s)` (pause and draw time s), `window.__showcase.frame(t)` → PNG data URL of frame t,
   `window.__showcase.shots` → `[{ id, title, t0, t1 }]`. The dev page exposes `window.__test.sheet(id)` and
   `window.__test.all(scale)` (`films/03-apollo-11/js/test-page.js:69-88`).
5. Proof sheets from the command line (Node 24, uses the repo's `playwright-core` and the installed Chrome; paths are
   hard-coded at `films/03-apollo-11/tools/proof.mjs:7,13`):
   `node films/03-apollo-11/tools/proof.mjs out.png [framesDir|-] [t1,t2,…|-] [page.html]`.

## Reading order

| Doc | For whom | What |
|---|---|---|
| [docs/01-STYLE_GRAMMAR.md](docs/01-STYLE_GRAMMAR.md) | anyone drawing new material | the rulebook: line, palette, grime, proportions, faces, costume, sets, lettering, timing, anti-patterns |
| [docs/02-ARCHITECTURE.md](docs/02-ARCHITECTURE.md) | coder | how a frame is produced end to end, load order, time model, determinism |
| [docs/03-API_REFERENCE.md](docs/03-API_REFERENCE.md) | coder / runtime Claude | every `ST.*` function used by the films |
| [docs/04-CHARACTER_GUIDE.md](docs/04-CHARACTER_GUIDE.md) | runtime Claude / coder | the character contract, a worked example, checklist, known pitfalls |
| [docs/05-CAMERA_GUIDE.md](docs/05-CAMERA_GUIDE.md) | runtime Claude / coder | camera semantics, the three cut-table dialects, shot catalogue, how to author a shot |
| [docs/06-FILM_AUTHORING.md](docs/06-FILM_AUTHORING.md) | runtime Claude / coder | script → storyboard → cast/sets/shots/film.js, tools, rendering |
| [docs/07-REELFORGE_INTEGRATION.md](docs/07-REELFORGE_INTEGRATION.md) | ReelForge Manager | **the port plan**: what ReelForge expects, gaps, layout, tasks, risks, open questions |
| [docs/08-KNOWN_ISSUES_AND_BACKLOG.md](docs/08-KNOWN_ISSUES_AND_BACKLOG.md) | Manager | real defects and limits, Papi's taste |
| [docs/09-HISTORY_AND_DECISIONS.md](docs/09-HISTORY_AND_DECISIONS.md) | everyone | how the style was chosen |

## Verification (2026-10-09, from this folder)

All three `showcase.html` and `test.html` pages were loaded headless (playwright-core 1.63.0 + installed Chrome):
no console errors or page errors; durations 62 / 63 / 63 s; `ST.renderFrame` at 1920×1080 took a median of
4.0 / 3.3 / 5.6 ms per frame (90th percentile 8.7 / 14.2 / 7.5 ms) on Papi's machine. Determinism results are in
[02-ARCHITECTURE §6](docs/02-ARCHITECTURE.md#6-determinism) — short version: bit-identical on a CPU-backed canvas,
except film 1's daydream shot (scratch canvas), see [08](docs/08-KNOWN_ISSUES_AND_BACKLOG.md).
