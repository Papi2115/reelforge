# Generated background music

`packages/pipeline/src/mix/music/` renders soft, deterministic background beds in pure Node (no
samples, no downloads). Same request -> byte-identical WAV.

## API

- `generateMusic({ seed, mood, durationS, bpm?, key?, structure?, energy?, loopable? })` ->
  `{ clip, score, lufs }` (48 kHz stereo). Without `bpm` the tempo is picked from the mood range
  and nudged so whole bars fit `durationS` exactly.
- `writeMusicFile(projectDir, options)` -> `audio/music/gen-<mood>-<seed>-<hash>.wav` (16-bit).
  The hash covers every option and `MUSIC_ENGINE_VERSION`, so an existing file is reused only for
  the identical request.
- `planActMusic(acts, { seed, moods, gainDb, crossfadeS?, edgeFadeInS?, edgeFadeOutS?, timelineS? })`
  (pure) -> per act: generation options + a ducked music cue (`loop: false`, the bed is rendered
  to the cue's exact length). Without `crossfadeS` beds meet at the act edges and fade 1 s / 2 s;
  with it each bed runs half the crossfade into its neighbours and fades over the overlap, and the
  film edges fade `edgeFadeInS` / `edgeFadeOutS`. `generateActMusic(projectDir, acts, options)`
  renders them (cached) and returns the cues for `cues.json`. An act's `energy` (0..1) maps to the
  bed's intensity.

## In the sound-cues stage

`packages/stages/src/sound/` (`acts.ts`, `music.ts`, `design.ts`). On unless the app setting
`music.enabled` is off or the user has their own files in `audio/music/` (those win: one ducked bed
per shot group, as before; generated `gen-*.wav` files never count as the user's).

- **Acts:** films under 75 s are one act; longer ones are cut into ~60 s acts (>= 30 s) at shot
  boundaries, a non-cut transition counting as 10 s closer to the ideal boundary; roles intro /
  body / outro.
- **Energy** from the shot density (shots per minute: 4 -> 0.3, 8 -> 0.5, 12 -> 0.7, 16+ -> 0.9),
  x0.85 for intro and outro; a bed gets at most 0.7 (light music).
- **Mood** from the project style: `voxel-pixel-crisp640` calm-tech / bright-explainer /
  retro-wave, `noir-voxel` tense-investigation / lofi-chill, `soft-480` lofi-chill / calm-tech
  (others calm-tech / bright-explainer). Intro / outro and energy < 0.6 get the first, < 0.8 the
  second, otherwise the third. Claude's sound-cues turn may set `moods` in `cues.json` (one per
  act, validated: mood names by the schema, one entry per act); the stage then re-renders those
  beds and keeps Claude's gain / ducking of each bed.
- **Mix:** beds at -5 dB (about -28 LUFS before the master), 2 s crossfades between acts, 1.5 s
  fade-in / 3 s fade-out at the film edges, ducked by the voice with the Medium sidechain preset
  (threshold -30 dB, ratio 8, 20 / 400 ms). The mix QA (docs/sfx.md) checks ducking >= 6 dB, the
  voice >= 15 dB over the music in the speech bands and <= 12 % of the music stem below 120 Hz.

## Moods

| Mood | Tempo | Harmony | Parts |
| --- | --- | --- | --- |
| `calm-tech` | 84-96 | lydian/major, add9/sus, 2 bars per chord | soft supersaw pad, Karplus-Strong pluck arpeggio, light short bass, soft kick/rim/hats |
| `lofi-chill` | 70-84 | major/dorian 7th/9th chords | FM e-piano (tremolo, tape wow), quiet pad, warm short bass, swung low-passed drums, faint hiss (no vinyl crackle) |
| `tense-investigation` | 70-84 | phrygian/minor sus chords | mid-register pad, sparse high plucks, sparse low pulses (never a drone), heartbeat kick, slow build |
| `bright-explainer` | 100-116 | major triads/add9 | staccato bright plucks, light pad, short bass, soft kick + claps + hats |
| `retro-wave` | 84-100 | minor/dorian | detuned saw pad, 16th filter-envelope synth arp, octave pulse bass, gated-reverb snare |

## How it avoids typical procedural-music problems

- **Static loops:** an arrangement (intro / main / break / main / outro) with an energy level per
  section decides which parts play and how dense; the break and second main use a progression
  variant (rotation / relative substitution), each section picks its own arpeggio shape and bass
  line; the pad cutoff follows the energy and drifts slowly; timing (+-6 ms) and velocity
  (+-8 %) are humanized; drum fills lead into main sections.
- **Harsh saws:** pads are 5 detuned polyBLEP saws through a 12 dB/oct state-variable low-pass
  (energy-dependent 0.5-4 kHz) plus a 9 kHz one-pole; the bed gets a -2 dB shelf at 9 kHz.
- **Droning / mutant bass:** bass notes are at most one beat long, start at E2 (MIDI 40) or
  higher, follow a moving line (root / fifth / octave, the second bar of a chord starts on the
  fifth), and the whole bed is high-passed at 80 Hz (24 dB/oct) with a -3 dB shelf below 150 Hz.
  Kicks are short and tuned around 60 Hz.
- **Sloppy mixing:** voice leading keeps chord changes smooth; a broad -3 dB dip around 1 kHz
  leaves room for narration; a shared reverb is high-passed at 250 Hz; widening is mono-safe
  (side channel above 150 Hz only, correlation tested); the bed is normalized to -23 LUFS
  integrated (BS.1770 in Node) with a soft limiter at -1 dBFS, so the mixer's ducking and
  master work from a known level.
- **Loops:** loopable beds fold the release / reverb tail back onto the start, so end -> start is
  seamless (tested: no seam click, level and spectrum match).

## QA (`music.qa.test.ts`, `score.test.ts`)

Per mood: energy below 120 Hz <= 12 % overall and <= 15 % in every 5 s window with no upward
trend; no 1/6-octave band in 40-120 Hz above the 120 Hz-4 kHz median; >= 60 % of the energy in
250 Hz-4 kHz; <= 2 % above 8 kHz; -23 +- 0.5 LUFS; crest factor 8-22 dB; peak <= -1 dBFS; stereo
correlation >= 0.3; onset autocorrelation peaks on the beat grid; click-free loop seam;
determinism. Score: every note in key, pads/bass on chord tones, chord roots from a library
progression, bass notes <= 1 beat and no repeated-pitch run longer than 4 s, density follows
energy, different seeds give different note sequences. Integration
(`music.integration.test.ts`, real ffmpeg): new SFX + a generated bed mix to -14 LUFS, ducked
>= 6 dB under speech, byte-identical re-render.

Listening: `pnpm --filter @reelforge/pipeline audio:demos` writes 60 s demos per mood and
spectrograms to `out/audio-demos/music/`. Subjective quality is not covered by tests.
