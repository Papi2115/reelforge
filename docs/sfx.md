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
prompt.

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
