# Real run Grim Ink 2: "What If You Won Your Freedom in the Colosseum?" (PLAN.md#14.14)

Date: 2026-10-11 · Claude Code CLI on the user's subscription (sanitized env, `apiKeySource: none`)
· Windows 11 · run by the Coder through the stage code: `StageRunner` with `experimentalWorlds:
true`, scenes `concurrency: 2`, `maxFixIterations: 1`. Code: `phase-14/ccam-wave3a` at 8f13d7e
(casting rule + lead exemption) plus the two fixes in §6; `pnpm exec tsc -b`, `pnpm build:cli`,
`pnpm check:cli-bundle` before each resume. **Built from scratch**: a fresh `createProject({ style:
'c-cam' })`, seed 1775947088 (sample 1: 1887198338), research mode off, `captions: 'words'` in
project.json (the new film switch, no driver flag). Nothing was copied from sample 1; only the
topic is the same. Driver `scratch/real-run-ccam-2/` (gitignored): `drive.mjs`, `sheets.mjs`,
`guard.mjs` (stops at a `rejected` event or the seven_day ceiling), `repro-det.mjs`, logs `*.out`.

Output (`C:\Users\galar\Desktop\ReelForge-test-films\`):
- `grim-ink-test-2.mp4`: 35.17 s, 1920×1080, 24 fps, H.264 NVENC + AAC, 30.8 MB.
- `grim-ink-test-2-contact-sheet.png`: 3 frames per shot.
- `grim-ink-test-2-modules.png`: the 8 module QA sheets.
- `grim-ink-test-2-opening-frame.png`: the thumbnail still, `out/opening-frame.png`, 1280×720.
- Project folder: `grim-ink-test-2 work\Colosseum Freedom\`.

## 0. Rules for this run (no voice)
- **Voice-over:** a silent 48 kHz wav of the film length, imported by the real voiceover stage.
- **Words:** synthetic, 150 wpm (0.4 s per word, +0.4 s after each sentence). All 74 words timed, 100 % coverage.
- **Clean:** refused the silence (by design). The test stand-in is a pink-noise bed at -62.6 LUFS, as in sample 1.
- **Length:** the script stage wrote **74 words → 35.2 s**, over the 30 s target. The brief asked for at most 62
  words, but the new c-cam prompt states a budget of 75 words (2.5 w/s × 30 s) that leaves out the
  sentence pauses, and the model followed the prompt. Not edited by hand.

## 1. Script and facts
Research (Sonnet, 5 sources), script plus one repair:
> You've won. The crowd roars, and the editor, the man who gave the games, hands you a wooden sword.
> The crowd has been begging for it. The rudis. You're free. / If you were a slave, you're freed. If
> you volunteered, your contract ends. Either way, the wooden sword is your proof. / So what does a
> free man do next? The answer is odd. Some went back. The arena paid. Freedom, it seems, was
> negotiable.

Fact check:
- ✓ The editor grants the rudis, often under pressure from the crowd.
- ✓ A volunteer's contract ends.
- ✓ "Some went back; the arena paid", with no invented number.
- ⚠ "If you were a slave, you're freed" is stated flat. Whether the rudis alone meant manumission is
  disputed; sample 1 hedged this point.

## 2. Direction plan (`direction.json`, Sonnet)
The first attempt ran on the brand-new casting rule. Claude's plan was rejected twice
(`direction-cast-overexposed`: the protagonist was in 5 of 8 beats, over the 60 % cap) and the
minimal fallback plan stood in. After 8f13d7e (the lead may be in up to 85 % of the beats), the
plan passed with 0 repairs:

**Cast (4), each with a distinct silhouette:**
- `gladiator`, protagonist ("you"). Axis: bull neck, chafed collar mark.
- `editor`, authority. Pear-shaped toga, big head, laurel, wine cup.
- `lanista`, foil. Eyebrows that never come down, wax tablet, coin purse.
- `freedman`, comic relief. Ears like soup plates; already free and already back.

**Signature gags (setup → escalation → payoff):**
- `gladiator` tugCollar: b02 → b05 → b08 (93 % of the film). Why: "the freed man still feels the collar".
- `lanista` checklist (ticks a name off): b04 → b06 → b07. Why: "his tally is the arena's claim on
  every freed man".

**Accidents:**
- b02: the rudis tip knocks the editor's wreath crooked, and he leaves it that way.
- b07: the coin purse splits and the coins roll across the sand.

**Climax:** b07, ECU of the coin purse dropping into an open palm beside the rudis. Why: "the one
fact that turns freedom into a negotiation".

**Crowds:**
- b02: the stands roar and stamp.
- b03: they beg with open hands.
- b07: the line of former fighters shuffles back in.

**titleFrame:** "Freedom Was Negotiable". Gladiator (tired, the rudis "like it might bite"), editor
(akimbo, smug, wine), lanista (arms folded, coin purse) on arenaSand. Accent object: the rudis.

**Motifs:** rudis, coin purse, collar.

Storyboard: 8 shots, 4 treatments; title card s01 lasts 1.5 s. Warnings: 2 short shots, a tension-tempo
note, and the loop "what does a free man do next?" is closed without a foreshadow.

## 3. People and places (`c-cam-modules`)
All 8 are built ✓, with **no placeholders**. Run 1 failed because of pipeline bug 1, and run 2 was
stopped by the module turn cap; both are covered in §6. The final resume built only arenaGate.

| Module | Result | Notes |
| --- | --- | --- |
| people gladiator | ✓ 1 attempt | Collar band, broken nose, loincloth, rudis via a lib. The bull-neck axis barely reads. |
| people editor | ✓ 1 | Laurel, big red nose, toga with a purple stripe, wine cup. The strongest character. |
| people lanista | ✓ 1 | Heavy brows, slicked hair, grey-blue tunic, tablet. |
| people freedman | ✓ 2 (1 critic fix) | Huge pink ears, small body, green tunic. |
| places arenaSand / arenaStands / arenaTunnel / arenaGate | ✓ 1 each | Stands with a begging-hands crowd built in (best place). Tunnel: oven, shields, shackles. Gate: barred arch, mask, town beyond. |

## 4. Scenes, look, sound, export
- **Scenes:** 8 shots, 7 ✓ and 1 ⚠ (s01_title: "too few human traces", 1 of 3).
  - Turns: 8 Opus builds + 3 Opus fixes (s01 ×1, s08 ×2) + 11 Sonnet critic turns.
  - No failures and no placeholders. No accent or label false positives this time.
- **Sound:** 11 sfx, 1 ambience and music mood `calm-tech` (odd for a Roman arena).
  Mix -14.04 LUFS, TP -1.94 dBTP.
- **Export:**
  - 844 frames in 293 s on SwiftShader, 2 workers, NVENC.
  - Font probe: `{ fallback: false }`, so Arial Black was found and the system font was used.
  - Opening-frame thumbnail written.

## 5. Papi's complaints, point by point (frame evidence = shot id @ film seconds)

**1. "Characters without character": mostly fixed.**
- Four distinct people are on screen, against 2 (one a placeholder) in sample 1. Each has its own
  head shape, colours and prop: editor (laurel, nose, wine; s02, s03 @13.9), freedman (soup-plate
  ears that **blush pink while he counts coins**, s07 @31.6), lanista (brows, tablet; s04 @18.5),
  gladiator (collar scar; s05 @20.8).
- Still weaker than the prototypes:
  - The bodies are stick-thin and similar in size.
  - Poses are mostly `stand`.
  - Faces change little within a shot.
  - The gladiator's design axis does not read.

**2. "No little gags / no running gag with payoff": mostly fixed, but subtle.**
- Both arcs are on screen:
  - **tugCollar:** the collar mark is always visible; hand to the neck in the s02 "neck" cut (≈8 s)
    and in s05; **payoff s08 @33.2**: close-up, hand at his bare neck, looking at the gate, then he
    walks in (s08 @34.4).
  - **checklist:** lanista ticking the tablet in s04 "tick" (≈17 s), s06 and s07 (@31.6).
- Accidents:
  - The wreath is knocked, with an impact star and a camera shake (s02 @7.2).
  - The purse splits and coins spill (s07 @30.6).
- The motions are small in medium shots; at speed the tug and the tick are easy to miss. No
  sweat-or-gum-level micro-gags beyond these.

**3. "Close-ups illogical": fixed.** Every ECU and close-up has a stated reason and shows the noun
being said:
- s02 "sword": the rudis passing hands (information).
- s03 "rudis": held up on "The rudis".
- s04 "tablet": the line scratched through on "contract ends".
- s05 "sword": grain and worn grip on "proof".
- s07 "purse": the climax.
- Small timing slip: the climax ECU plays over "Some went back" and leaves just as "The arena paid" starts.

**4. "Stiff camera, no depth": improved.**
- 22 framings in 35 s (sample 1: ~17 in 32 s), matching the storyboard's plan cut for cut
  (s01 1, s02 4, s03 3, s04 4, s05 2, s06 3, s07 2, s08 3), with wide, medium, close, ECU, OTS and
  reverse all used.
- Depth: foreground silhouette heads and a black foreground arm with the rudis (s02, s03), an OTS
  over the lanista (s06), crowd rows behind the actors (s02, s03), a shake on the knock (s02).
- Inside a cut the camera mostly holds or pushes in gently.
- The s05 and s07 beats were planned with 3–4 framings, but the storyboard handed those shots
  only 2 each (the scenes built them as given).

**5. Captions: fixed in look.**
- Matches the prototype numbers: Arial Black 46 px, bone #e2d8b8, 11 px ink outline, one sentence
  per line at the bottom centre. The system font was found; no fallback.
- Placement issues:
  - s03 @13.9: the caption "You're free." duplicates the poster lettering "YOU'RE FREE" just above it.
  - s01: the caption sits under the title lettering.

**6. "First frame = poster/thumbnail": mostly fixed.**
- s01 is a real poster: the three main people acting the premise (rudis held like it might bite,
  wine cup, coin purse) on arenaSand under "FREEDOM WAS NEGOTIABLE". `opening-frame.png` is a usable
  thumbnail.
- Problems:
  - The title card lasts only 1.5 s; Apollo holds its title ~4 s.
  - At t=0 the title is still being lettered ("FREED…", s01 @0.22).
  - The burned caption "You've won." is in the thumbnail.

**Cast and crowd (new requirement):**
- **4 distinct named people on screen** (all four appear in at least 2 shots; 3 of them inside the first 60 %).
- Crowds:
  - The cheering stands (s02, `ink.crowd.rows`).
  - The begging-hands crowd (s03, arenaStands module).
  - The queue of former fighters (s07 @31.6).
  - Foreground audience silhouettes (s02, s03).
- Apollo has 5 people plus crowds; this is close.
- Defect: some crowd members wear **conical straw hats** (s02 @7.2/@8.4), which are wrong for Rome.

## 6. Pipeline bugs found and fixed (minimal, with tests)
1. **Captions broke the people QA (false positive).**
   - Cause: with `captions: 'words'`, `isolatedManifest()` drew captions on the *standalone* contact
     sheet. Page 0 (t=0.5) and its repeat (t=2.5) showed different words: 16 160 px differ in the
     caption band y 984–1037.
   - Effect: every person failed "deterministic" and became a placeholder. The CLI's `people-preview`
     drops the words, so Claude's fix turns could not reproduce the failure (~$3 wasted).
   - Fix: no captions on standalone plans (`packages/cli/src/project/shots.ts`; test in
     `shots-film.test.ts`).
2. **A stopped modules step lost everything.**
   - Cause: `.reelforge/ink-modules.json` was written only at the end, so a resume would have
     rebuilt all modules.
   - Fix:
     - The report is now saved after each module.
     - On resume, a module whose newest commit is "<Noun> <id> built ✓" is recovered (no turn;
       `c-cam/recover.ts`).
     - "Up to date" now needs a record for every design.
     - StageContext gets the optional `git` options.
   - Test: `c-cam-modules-stage.test.ts`, "resumes a step stopped before its report". The real
     resume built only arenaGate.

## 7. Wall clock, turns, cost
`costUsd` = ledger deltas at list price (not a bill). Rate-limit events: 75 × `allowed_warning`,
seven_day utilization 0.79 → 0.82, no `rejected` event, `limitHits: 0`.

| Stage | Wall | Turns | costUsd |
| --- | --- | --- | --- |
| research + script + repair | 67 s | 3 Sonnet | 0.28 |
| voiceover / clean (refused) / words | 1.3 / 0.9 / 0.5 s | – | – |
| direction, 1st (old rule → fallback, discarded) | 67 s | 2 Sonnet | 0.19 |
| direction, 2nd | 23 s | 1 Sonnet | 0.08 |
| tension + storyboard | 179 s | 2 Sonnet | 0.46 |
| modules run 1 (bug 1, killed) | ~14 min | 4 | 3.11 |
| modules run 2 (stopped at the 6-turn cap) | 37 min | 16 (Opus + critic) | 8.03 |
| modules run 3 (arenaGate only) | 367 s | 2 | 1.19 |
| scenes build | 1955 s | 22 (8 build + 3 fix Opus, 11 critic) | 17.08 |
| sound cues / mix | 28 / 5 s | 1 Sonnet | 0.40 |
| export (844 frames, NVENC) | 293 s | – | – |
| **Total** | **~2 h 10 min incl. stops** | **53** | **30.83** |

Scenes cost $2.13 per shot (sample 1: $1.19). Modules done once cleanly would cost ~$9.2 for 8;
~$3.3 went to the two pipeline problems.

## 8. Still short of the Apollo / papal / samurai prototypes
- **Faces carry less acting than in Apollo.** Apollo's close-ups have sweat, a gum bubble and
  wide-eyed panic. Here the faces mostly change their mouth.
- **Few reaction close-ups.** Apollo cuts to a reaction on nearly every line.
- **The title card is too short.** It needs about 3–4 s.
- **Staging slips:**
  - The editor walks in mid-air beside the stairs (s02 @5.1).
  - Arms tangle at the handover (s02 @8.4).
  - The rudis carries carved letters "RVDIS", a label on an object.
- **Music:** `calm-tech` ignores the world's mood.

## 9. Verdict: 6.5/10 (sample 1: 5/10)
Clear progress where Papi complained: a real ensemble with crowds, two gag arcs with payoffs,
accidents, close-ups with reasons, more framings with foreground depth, prototype captions, and a
poster opening. It still reads as a competent draft rather than the prototypes: the acting is thin,
the gags are small, and there are staging slips.

Top 5 defects (root-cause class):
1. **Gags and acting too subtle at speed** (tug, tick, few expression changes). Cause: *prompt*
   (gag beats should get a close framing) and *kit vocabulary* (gag amplitude, face acting).
2. **Staging contacts:** a floating walk beside the stairs, tangled arms at the handover. Cause:
   *validator* (scene QA has no ground/contact check) and *model limit*.
3. **Period errors in the crowd** (conical straw hats). Cause: *kit vocabulary*; crowd variants are
   not period-gated.
4. **Title card:** 1.5 s, still lettering at t=0, caption burned into the thumbnail. Cause: *prompt*
   (storyboard title length) and *pipeline* (the opening frame should render without captions).
5. **Script:** 74 words / 35 s and an unhedged disputed fact. Cause: *prompt* (the budget leaves out
   the pauses; ~62 words for 30 s) and the script validator's hedge rule.
