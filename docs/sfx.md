# Built-in SFX

All sounds are synthesized offline in pure Node (`packages/pipeline/src/mix/sfx.ts`, recipes in
`mix/sfx/`): no samples, no downloads, deterministic per seed (byte-identical output).

- **Format:** 48 kHz stereo. Edges are DC-blocked and faded (first/last sample exactly 0).
- **Level:** each clip is levelled so its loudest 50 ms K-weighted window hits a per-category
  target (`SFX_LEVEL_DB`: motion -15, impact -13, texture -16, ui -17, tonal -17 dB) under a
  -3 dBFS peak ceiling. A cue's `gainDb` is relative to that reference.
- **Variants:** every recipe has 3-5 designed variants. `seed % variants` picks one (cue `seed`;
  the default seed is a hash of name + time), and the seed also drives small per-use changes
  (pitch, timing, noise), so repeated cues never sound identical. Example: `whoosh` with
  `seed: 2` (or 7, 12, ...) is the `up` variant.
- **Design toolkit:** band-limited oscillators (polyBLEP), modulation-safe state-variable filters,
  swept filtered noise layers, modal (bell/wood) partials, 2-operator FM, Karplus-Strong, gentle
  saturation, a small Schroeder/Freeverb room (RT60-controlled, tails <= 0.6 s), Haas/pan
  sweeps for width, and a light bit-crush ("pixel" flavour) on blip / coin / ding-pixel /
  camera-shutter-digital / riser-retro.
- **QA:** `mix/sfx.qa.test.ts` checks every recipe x variant: peak <= -1 dBFS, no DC, click-free
  edges and a natural tail (last 5 ms >= 20 dB under the peak), loudness band, spectral centroid
  band per recipe, enough energy above 150 Hz (phone speakers), little fizz above 10 kHz,
  mono-compatible stereo (correlation >= 0.3), no silence padding, determinism, and variants
  that really differ (spectral profile over time or envelope).
- **Listening:** `pnpm --filter @reelforge/pipeline audio:demos` writes auditions (one WAV per
  category, one per recipe, all variants with gaps) and spectrogram PNGs to
  `out/audio-demos/sfx/` (gitignored).

The first eight names are the original v1 set (unchanged, same order); the rest were added later.
The list is mirrored by `BUILTIN_SFX_NAMES` (desktop, checked by a test) and the `sound-cues`
prompt (checked by a test); `reelforge kit-docs sfx` prints it from `SFX_RECIPES` / `SFX_USE` /
`SFX_VARIANTS` directly.

| Name | Category | Default s | Variants (`seed % n`) | Intended use |
| --- | --- | --- | --- | --- |
| `whoosh` | motion | 0.7 | 0·fast, 1·slow, 2·up, 3·down, 4·air | Transitions, camera moves, objects flying past. |
| `riser` | motion | 2 | 0·noise, 1·tonal, 2·shepard, 3·retro | Build-up into a reveal or act change (end it on the hit). |
| `swoosh-in` | motion | 0.5 | 0·soft, 1·bright, 2·tick | UI panel / card slides in and settles. |
| `swoosh-out` | motion | 0.5 | 0·soft, 1·bright, 2·tick | UI panel / card slides away. |
| `downer` | motion | 1.2 | 0·tape-stop, 1·sweep-drop, 2·noise-fall | Power-down, failure, "it all fell apart", leaving a scene. |
| `hit` | impact | 0.8 | 0·punchy, 1·deep, 2·tight, 3·cinematic | Number lands, object slams, emphasis on a key word. |
| `whoosh-impact` | impact | 1.3 | 0·classic, 1·heavy, 2·snappy | Something flies in and lands: title cards, big numbers. |
| `hit-soft` | impact | 0.4 | 0·felt, 1·cardboard, 2·muted | Gentle landing of a card/icon, soft emphasis under narration. |
| `boom` | impact | 2 | 0·deep, 1·explosion, 2·distant | Big reveal, title slam, act break (use sparingly). |
| `stamp` | impact | 0.4 | 0·rubber, 1·heavy, 2·approve | Rubber stamp / "approved" badge / label slapped on. |
| `snap` | impact | 0.15 | 0·mid, 1·low, 2·bright | Finger snap: instant change, "just like that". |
| `typewriter` | texture | 1.2 | 0·typewriter, 1·mechanical, 2·laptop | Text typing on screen (match the duration to the typing). |
| `glitch` | texture | 0.35 | 0·digital, 1·stutter, 2·corrupt, 3·warble | Digital error, data corruption, hacker / tech moments. |
| `pop` | texture | 0.15 | 0·cork, 1·mouth, 2·low, 3·pluck | Element pops into view (icons, bullets, bubbles of text). |
| `bubble` | texture | 0.25 | 0·single, 1·double, 2·small, 3·big, 4·gloop | Single bubble / blob appears, liquid UI, playful pop-in. |
| `bubble-up` | texture | 0.8 | 0·stream, 1·few, 2·fizzy | Rising stream of bubbles: something fills up, boils, comes alive. |
| `scribble` | texture | 0.8 | 0·pencil, 1·marker, 2·chalk | Pen/pencil writing, drawing, annotations appearing. |
| `paper` | texture | 0.5 | 0·page-turn, 1·slide, 2·crumple | Page turn, document slides in, notes crumpled. |
| `camera-shutter` | texture | 0.35 | 0·dslr, 1·vintage, 2·digital | Photo taken, screenshot, freeze-frame. |
| `click` | ui | 0.08 | 0·soft, 1·crisp, 2·wooden, 3·mouse | Button press, cursor click, selection. |
| `tick` | ui | 0.03 | 0·clock, 1·fine, 2·soft | Clock tick, counter step, odometer digit. |
| `tock` | ui | 0.1 | 0·wood, 1·low, 2·block | Lower "tock" partner of tick; wood-block step, timer. |
| `blip` | ui | 0.15 | 0·square, 1·pulse, 2·triangle, 3·low | Retro UI blip, list item, small highlight (pixel flavour). |
| `blip-up` | ui | 0.18 | 0·fifth, 1·octave, 2·triple | Confirm, level up, item added (rising chip tones). |
| `blip-down` | ui | 0.18 | 0·fifth, 1·octave, 2·triple | Cancel, item removed, back (falling chip tones). |
| `notification` | ui | 1 | 0·rise, 1·chirp, 2·soft | Message / alert / new item appears (friendly two-note). |
| `success` | ui | 1.1 | 0·arp, 1·chord, 2·bright | Task done, correct answer, unlocked (bright, short arpeggio). |
| `error-buzz` | ui | 0.4 | 0·double, 1·descend, 2·bonk | Wrong answer, denied, error state (soft, not harsh). |
| `ding` | tonal | 1.7 | 0·bell, 1·glass, 2·pixel, 3·soft | Correct / fact highlighted / "ding!" moment. |
| `chime` | tonal | 1.8 | 0·up, 1·down, 2·cluster | Magic / idea / discovery moment, gentle intro sting. |
| `coin` | tonal | 0.6 | 0·classic, 1·high, 2·triple, 3·gem | Money, points, reward, collected item (retro). |
| `sparkle` | tonal | 1 | 0·dense, 1·sparse, 2·rising, 3·magic | Shine, magic, "new!", clean / polished result. |

### Look palette recipes (PLAN.md#12.24)

Appended after the voxel set; recipes in `mix/sfx/retro-ui.ts`, `retro-ui-machines.ts`,
`diorama.ts`, `diorama-world.ts`, `blueprint.ts`. They share one finish (`mix/sfx/pixel.ts`):
a light 7-bit / 16 kHz bit-crush and the same small dry room, plus the category levels above, so
every look sounds like one film. Lows are kept modest (high-passed bodies, no sub). The QA suite
covers them like the voxel set.

**retro-ui**

| Name | Category | Default s | Variants (`seed % n`) | Intended use |
| --- | --- | --- | --- | --- |
| `key-click` | ui | 0.08 | 0·mechanical, 1·membrane, 2·terminal | Retro UI: one key press (menu choice, prompt confirmed). |
| `keyboard` | texture | 1.2 | 0·mechanical, 1·membrane, 2·terminal | Retro UI: typing on a beige keyboard (match the duration to the typing). |
| `mouse-click` | ui | 0.1 | 0·ball, 1·micro, 2·double | Retro UI: mouse button click on an icon or a button. |
| `window-open` | ui | 0.22 | 0·chime, 1·chirp, 2·pop | Retro UI: a window, dialog or menu opens (rising chip blip). |
| `window-close` | ui | 0.22 | 0·chime, 1·chirp, 2·pop | Retro UI: a window or dialog closes, minimizes or goes away (falling chip blip). |
| `disk-seek` | texture | 0.6 | 0·floppy, 1·hard-disk, 2·stepper | Retro UI: floppy / hard-disk access while something loads or saves. |
| `modem` | texture | 1.2 | 0·dialup, 1·carrier, 2·fax | Retro UI: going online, connecting, data being sent (short modem handshake). |
| `crt-zap` | texture | 0.8 | 0·degauss, 1·power-on, 2·static | Retro UI: CRT degauss / power-on / static (a screen wakes up, a hard visual switch). |
| `error-beep` | ui | 0.35 | 0·beep, 1·double, 2·low | Retro UI: PC-speaker beep (error dialog, invalid input, alert). |
| `terminal-tick` | ui | 0.06 | 0·low, 1·mid, 2·high | Retro UI: terminal cursor / line tick; list items (low -> mid -> high). |

**diorama**

| Name | Category | Default s | Variants (`seed % n`) | Intended use |
| --- | --- | --- | --- | --- |
| `soft-keys` | texture | 1.2 | 0·office, 1·laptop, 2·burst | Diorama: soft office typing a few desks away (match the duration to the typing). |
| `chair` | texture | 0.6 | 0·creak, 1·roll, 2·swivel | Diorama: office chair creak, roll or swivel (someone sits, turns, leans back). |
| `paper-shuffle` | texture | 0.5 | 0·shuffle, 1·stack, 2·flip | Diorama: papers shuffled, a stack set down, a sheet flipped over. |
| `server-whir` | texture | 1 | 0·fan, 1·rack, 2·spin-up | Diorama: server / computer fan whir (a machine works, the server room hums). |
| `led-blip` | ui | 0.08 | 0·low, 1·mid, 2·high | Diorama: a status LED blinks; list items (low -> mid -> high). |
| `traffic-pass` | motion | 1.6 | 0·car, 1·scooter, 2·distant | Diorama: a car or scooter drives past in the little city. |
| `horn-blip` | ui | 0.35 | 0·car, 1·toy, 2·double | Diorama: a small car horn (traffic, a playful "hey!"). |
| `bird-chirp` | tonal | 0.5 | 0·sparrow, 1·tweet, 2·trill | Diorama: little birds outside (city morning, a park, a cheerful landing). |
| `servo` | motion | 0.5 | 0·up, 1·down, 2·step | Diorama: a small motor / servo moves (model parts turn, doors slide, a camera pans). |

**blueprint**

| Name | Category | Default s | Variants (`seed % n`) | Intended use |
| --- | --- | --- | --- | --- |
| `pencil-scratch` | texture | 0.7 | 0·line, 1·hatch, 2·circle | Blueprint: a drafting pencil draws a line, hatches or circles something. |
| `plotter-pen` | texture | 1 | 0·line, 1·curve, 2·pen-up | Blueprint: a pen plotter draws (diagram lines, charts being plotted). |
| `ruler-tick` | ui | 0.04 | 0·plastic, 1·metal, 2·double | Blueprint: a ruler / scale tick, a dimension snaps into place, a counter step. |
| `measure-blip` | ui | 0.15 | 0·low, 1·mid, 2·high | Blueprint: a measurement / data point appears; list items (low -> mid -> high). |
| `relay-click` | ui | 0.1 | 0·small, 1·latch, 2·bank | Blueprint: a relay / switch clicks (a node turns on, a circuit closes). |
| `data-ping` | tonal | 0.7 | 0·ping, 1·double, 2·soft | Blueprint: a data ping (result found, value highlighted, closing card). |

## How cues are chosen (the sound director)

The **Sound design mixed** stage writes a deterministic `cues.json` first (no Claude; same inputs ->
same file); Claude's sound-cues turn (prompt v2) then only adjusts it, and Economy mode / no Claude
keeps it as is. Code: `packages/stages/src/sound/` (`cue-events.ts` finds events, `cue-rules.ts` is
the rule table, `cue-director.ts` applies it; tests next to them).

**Inputs:** `storyboard.json` (shots, treatments, transitions), `timing/words.json`, and what the
built scenes declared: their `ctx.sfx.at` sounds and resolved anchors (from the scene stage's
`.reelforge/sync-report.json`, or the runner's `sceneSfx` provider).

**Events -> sounds** (`CUE_RULES`; level = category level + trim; priority 0 = kept first):

| Event | Sound (variants) | Level dB | Lead | Priority |
| --- | --- | --- | --- | --- |
| Scene sound (`sfx.at`), first of its name in the shot | the scene's recipe, light variants | category | 0 | 0 |
| List reveal (scene pops <= 2.5 s apart) | `pop` low -> cork -> pluck -> mouth (rising pitch), pan -0.2..+0.2 | -11 | 0 | 0 |
| Counter (`counter/odometer` shot) | `tick`/`tock` alternating from the first tick / number to the landing, interval = span / 10 (0.12-0.3 s), crescendo -4 -> 0 dB; landing `ding` (`hit` if the scene asked) | -17..-21 / -8..-12 | 0 | 0 |
| Typed text (scene `typewriter`) | `typewriter` (typewriter, laptop) | -14 | 0 | 0 |
| End card (last shot, `title-card`) | `chime` up, 0.6 s into the shot | -13 | 0 | 0 |
| Crossfade | `whoosh` air/slow, length = transition + 0.6 s | -14 | 0.3 s | 1 |
| Glitch transition | `glitch` digital/stutter/corrupt | -11 | 0 | 1 |
| Wipe | `swoosh-in` soft/bright, panned ±0.2 | -13 | 0.05 s | 1 |
| Spoken number (shot without scene sounds) | `hit-soft` felt/muted; `whoosh-impact` snappy/classic when an anchor sits on it in a title/text/chart/counter shot | -8 / -11 | 0 / 0.25 s | 2 |
| Text card in (`title-card`, `kinetic-text`) | `swoosh-in` soft/tick at shot start + 0.3 s | -15 | 0 | 3 |
| Anchor without a sound (shot without scene sounds) | `pop` / `bubble` / `blip` | -11..-12 | 0 | 3 |
| Repeated scene sound (same name again in the shot) | the scene's recipe | category | 0 | 3 |
| Emphasis (`word!`, `word:` + payoff, ALL CAPS) | `riser` noise/tonal (0.6-1.4 s) ending on a `hit-soft` | -19 / -9 | - | 4 |
| Cut | into UI-like shots `swoosh-in` soft, into 3D scenes `whoosh` fast/up/down; pan alternates ±0.15 | -16 | 0.25 s | 5 |

Category levels (`CATEGORY_GAIN_DB`): motion -10, impact -7, texture -8, ui -9, tonal -11 dB, so
the SFX sit roughly 10-15 dB under the voice. Bass-heavy variants (`hit` deep/cinematic, `boom`
deep/explosion, `whoosh-impact` heavy, `stamp` heavy) are never picked automatically.

**Density control** (`DENSITY`): a *gesture* is one cue or a designed series (counter, list,
riser + hit). Budget = duration / 3 s + 1 gestures; at most 3 gestures start within any 4 s;
gestures start >= 0.8 s apart; cues of different gestures >= 150 ms apart; nothing in the first
0.3 s of a shot except transition sounds (a scene sound up to 0.15 s inside it moves to 0.3 s,
deeper ones are dropped). Selection goes priority level by level; within a level the gesture
farthest from those already kept goes first, so the sounds spread over the film.

**Variants:** seed = hash(shot id | event index | cue index | recipe), adjusted so `seed % n` is
the chosen variant; the previous cue's variant of the same recipe is never repeated (except in
designed series).

**Ambience:** one quiet bed per shot group (room-tone / hum at -28 dB), or, under generated music,
one faint room-tone bed (-32 dB) for the whole film. In other looks see "Sound palettes".

## Sound palettes (PLAN.md#12.24)

Every look has a sound palette (the look's `soundPalette`, code `packages/stages/src/sound/palettes/`).
The director finds the same events and keeps the same rule table (levels, leads, priorities,
density, transition handling); the shot's palette only decides **which recipe** an event gets.

- **Which palette:** `project.json` `lookMode: mixed` -> the shot's look (`shot.look`, absent =
  voxel) -> its `soundPalette`. `voxel-only` projects (every pre-2.0 project), shots without a
  look, unknown or not-yet-available looks -> `voxel`. The palette changes at shot boundaries.
- **voxel** = the 1.x sound design exactly (a no-harm test pins the cues and the synthesized SFX +
  ambience buses of the example film and a broad test film, captured before palettes existed).
- **Slots:** a palette lists, per event kind, the candidates of each rule choice slot (same
  meaning as the rule's choices: cut into UI-like / 3D shot, tick / tock, ding / hit, pop / bubble /
  blip). Several candidates are drawn by weight from a hash of the cue (`pickRecipe`, the one place
  recipes are chosen; it takes a recently-used history for PLAN.md#12.23, empty today). A choice may
  override the rule's lead (sounds that hit at their start land on the cut instead of leading it).
- **Scene sounds** (`ctx.sfx.at`) in a non-voxel shot are translated into the palette: its own
  recipes play as asked, generic ones map (e.g. `click` -> `mouse-click` in retro-ui), anything
  else falls back by category. List reveals rise through the palette's low / mid / high variants.
- **Look accents:** a transition into a non-voxel look from another look plays the entered look's
  signature sound (diorama: by diorama type). Hook for 12.15 (transitions per look pair):
  `lookChangeSlot(from, to, shot)`.
- **Ambience:** groups also split where the palette ambience changes; beds meeting at a look
  boundary overlap by 1 s and crossfade with their 1 s fades. Diorama beds follow the type in the
  shot's intent (server / rack -> `server-room`, city / street / traffic -> `city`, office / desk ->
  `office`, else `room-tone`). Look beds (`crt-hum`, `office`, `server-room`,
  `electric-tick`) keep < 5 % of their energy below 120 Hz, so they can sit under the music.

| Event | voxel | retro-ui | diorama | blueprint |
| --- | --- | --- | --- | --- |
| Cut (UI-like / 3D) | `swoosh-in` / `whoosh` | `window-open`, `mouse-click` / `crt-zap`, `window-close` | `servo` | `pencil-scratch`, `ruler-tick` / `relay-click` |
| Crossfade, glitch, wipe | `whoosh`, `glitch`, `swoosh-in` | `crt-zap` degauss, `crt-zap` static, `window-open` | `traffic-pass` distant, `server-whir` spin-up, `paper-shuffle` flip | `plotter-pen`, `relay-click` bank, `pencil-scratch` |
| Into the look from another | (usual) | `crt-zap`, `disk-seek` | by type: `server-whir`/`led-blip`, `traffic-pass`/`bird-chirp`, `chair`/`paper-shuffle`, `servo`/`chair` | `plotter-pen` pen-up, `data-ping` soft |
| Appear (pop / bubble / blip) | `pop` / `bubble` / `blip` | `window-open` pop / `mouse-click` / `key-click` | `led-blip` / `paper-shuffle` / `led-blip` | `measure-blip` / `data-ping` / `relay-click` |
| List items (rising) | `pop` | `terminal-tick` | `led-blip` | `measure-blip` |
| Counter step / landing | `tick`, `tock` / `ding`, `hit` | `terminal-tick`, `key-click` / `window-open`, `error-beep` | `led-blip` / `horn-blip`, `servo` | `ruler-tick`, `relay-click` / `data-ping`, `relay-click` |
| Number / big number | `hit-soft` / `whoosh-impact` | `mouse-click` / `window-open` | `paper-shuffle` stack / `horn-blip` | `ruler-tick` / `data-ping` |
| Text in / typed | `swoosh-in` / `typewriter` | `window-open` / `keyboard` | `paper-shuffle` / `soft-keys` | `pencil-scratch` / `plotter-pen` |
| Emphasis riser / hit | `riser` / `hit-soft` | `modem` / `crt-zap` power-on | `server-whir` spin-up / `horn-blip` | `pencil-scratch` hatch / `relay-click` latch |
| End card | `chime` | `window-open` chime | `bird-chirp` | `data-ping` double |
| Ambience (bed / under music) | room-tone, hum -28 / room-tone -32 | `crt-hum` -30 / -34 | by type -28 / -33 | `electric-tick` -30 / -33 |

## Mix QA (`.reelforge/mix-report.json`)

After every mix render (`mix/qa.ts` streams over the stems in 4096-frame blocks; `mix/qa-report.ts`
builds the verdict; the Sound panel lists it under the loudness readout):

| Check | Bar | On a miss |
| --- | --- | --- |
| Integrated loudness | -14 ±1 LUFS | stage fails |
| True peak | <= -1 dBTP | stage fails |
| Clipping (full-scale samples in mix.wav) | none | listed as failed |
| Music ducking under speech (un-ducked buses vs ducked stem, speech blocks) | >= 6 dB | warning |
| Voice over music in the speech bands (500 Hz-4 kHz octaves, SII band-importance weighted) | >= 15 dB | warning |
| Music stem energy below 120 Hz | <= 12 % | warning |
| Sound moments per minute (cues < 0.6 s apart count once) | <= 24 | warning |

Speech = blocks whose VO-stem level is above (95th percentile - 20 dB) and above -50 dBFS.

Listening: `pnpm --filter @reelforge/stages sound:demo` (needs ffmpeg and a built CLI) renders the
example film through these stages into `out/audio-demos/example-mix.wav` (+ `.png` spectrogram),
`example-music.wav` (the ducked bed alone), `example-mix-cues.json` and `example-mix-report.json`.
