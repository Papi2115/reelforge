# Grim Ink (c-cam) — the direction layer

What the three concept films do BEFORE any drawing: the narrative accents a director plans on top of the
narration. Source: `docs/concepts/c-cam-style/films/{01-samurai-edo,02-papal-conclave,03-apollo-11}` (shot files,
`film.js`, `storyboard.md`, NOTES/CHANGES) and `docs/concepts/c-cam-style/docs/05-CAMERA_GUIDE.md` §4–§9,
`06-FILM_AUTHORING.md` §2. (The styles7 folders hold only proof sheets; there is no styles7 papal folder, so the
papal numbers come from the c-cam film and its `CHANGES.md`.) This teaches HOW; never copy the films' content.
Used by: the `c-cam-direction` prompt (digest in `packages/prompts/src/worlds/c-cam-direction.ts`), the
`direction.json` validators and the storyboard / scene-build / critic sections of Grim Ink (PLAN.md#14.16).

## 1. Devices (with a shot of the films and why it works)

| Device | Example (film · shot · what happens) | Why it works |
|---|---|---|
| Running gag: setup → escalation → payoff | Apollo · the Commander chews gum in `title`, `pad`, `lander`, `descent`, `manual` (CU "chewing, calm"), then `land` ECU: he slowly blows a bubble in the silence after touchdown | The tic is planted while nothing depends on it, keeps coming back under rising pressure, and pays off in the one quiet beat where it reads as character (calm under pressure), not decoration |
| Running gag tied to a status joke | Samurai · the Merchant is always one bow lower but in charge: `title`, `loan` ("he bows lower"), `ledger`, `payoff` ("you bow deeply; he bows slightly") | The gag IS the film's claim (merchants ranked lower but held the debts), so each repeat restates the fact visually |
| Prop gag that escalates | Papal · the Stubborn Cardinal's grievance notebook: writes (`hall`), keeps writing while others suffer (`bread`), ECU stylus adds one more line (`refuse`), wears it as a rain hat (`roof`) | Each use raises the stakes of the same object; the last use turns it upside down |
| Accident beat (not narrated, motivated) | Samurai · `street`: turning to admire yourself, your scabbard CLACKs into another samurai's (ECU), both freeze, endless apology bows; `wrongbow`: the hat rolls and stops against the Elder's toe | The narration says "mostly for show" / "one wrong bow"; the mishap is the physical proof, invented by the director, not a new claim |
| Climax close-up on an instrument | Apollo · `manual` ECU: the glove on the control stick, small calm moves ("flies the last part by hand") | The film's decisive fact happens in a hand on a thing; the ECU makes the viewer watch the thing that decides the outcome |
| Climax ECU on the meaning | Papal · `choice` ECU: the stone inscription CUM CLAVE ("it means: with a key") | The film's turn is a word; the ECU holds the word as an object |
| Reaction hold / deadpan | Samurai · `wrongbow`: the Elder looks at the hat, then at you (low tilted CU, 1.2 s); Apollo · `lander`: Commander shrugs, chewing | Fast-fast-hold: the beat lands, the face holds still ≥ 0.4 s, the viewer laughs in the gap |
| Cause → effect cut | Apollo · `lander`: ECU finger pokes the wall → it dents → CU the Commander shrugs | Three framings = action, consequence, judgement |
| Reverse / over-the-shoulder | Apollo · `window`: over your shoulder at the boulders → tilted close on the crater → reverse on your sweating face at the window; Samurai · `ledger` OTS on the Merchant | What is seen, then who sees it: the viewer gets both the information and its emotional price |
| Foreground silhouette | Papal · chair back (`hall`), street corner (`lock`), door jamb (`choice`), accusing arms at the lens (`refuse`); Apollo · door edge (`pad`) | Depth and a peeping point of view in a flat world, one per framing that needs it |
| Dutch tilt on tension | Apollo · alarm ECU 6°, panic wide −5°, fuel needle −5°; Papal · roof −7°, refusal 7° | Tilt marks the beat as wrong/tense; level framings everywhere else keep it meaningful |
| Slow push on realisation | Samurai · `wake` push-in 2.2→2.8 on the grin; Papal · `years` push-in on the shout | The camera leans in as the character understands |
| Pull-back reveal | Samurai · `ledger`: from "YOU" at the top of the page down the unfolding list (2.4→1.5); Apollo · `orbit`: pull back until the lonely astronaut is small | The scale of the problem (or loneliness) appears as the frame widens |
| Smash cut (expectation vs reality) | Samurai · `dream`: sunset sword clash → hard cut to you between two towers of paper | The cut itself is the joke |
| Prop reveal for scale | Apollo · `computer`: close on the guidance computer → pull back as a modern phone thuds in beside it | A comparison the narration states becomes one image |
| Time-passing gag | Papal · `years`: the Tired Cardinal's beard grows under the year slate, tally marks pile up | Duration shown as a change on a person |
| Crowd gag | Papal · `payoff`: every hand up at once, ballots flying | The group acts as one body for the punchline |
| Title frame = thumbnail | All three · `title`: the main cast lined up in character (sweating / chewing / smug), the title thudding in letter by letter, the place behind | The first frame sells the premise and the people before a word is explained |

## 2. Measured statistics

Framing classes from the shot files' cut tables and comments (wide = establishing/two-shot at z ≤ 1.2, medium
1.3–1.6, close = a face at 1.7–2.6, ECU = an object or insert, OTS/reverse separate). Title cards counted
separately (1 framing each, 4.0 s).

| | Samurai | Papal | Apollo | All |
|---|---|---|---|---|
| Length / shots | 62 s / 11 | 63 s / 12 | 63 s / 13 | 188 s / 36 |
| Framings (excl. title) | 39 over 10 shots | 36 over 11 | 34 over 12 | 109 over 33 |
| Framings per shot: mean (min–max) | 3.9 (3–5) | 3.3 (2–4) | 2.8 (2–4) | 3.3 (2–5) |
| Mean framing length (incl. title) | 1.55 s | 1.70 s | 1.80 s | 1.68 s |
| ECU length | 0.4–1.8 s | 0.75–1.8 s | 0.6–2.4 s | median ≈ 1.4 s |
| Wide / medium / close / ECU / OTS+reverse | 35 / 25 / 20 / 18 / 3 % | 27 / 8 / 41 / 22 / 3 % | 26 / 14 / 34 / 20 / 6 % | 29 / 16 / 31 / 20 / 4 % |
| Close + ECU share | 38 % | 63 % | 54 % | 51 % |
| Shots opening on wide/medium/OTS | 9 / 10 | 11 / 11 | 8 / 12 | 85 % |
| Framings with a Dutch tilt (2–7°) | 23 % | 57 % | 37 % | 38 % |
| Foreground silhouettes / OTS backs | 2 | 7 | 3 | ≈ 1 per 3 shots |
| Adjacent shots with the same size sequence | 0 | 1 (`death`→`hall`: wide→ECU→close) | 0 | 1 of 30 pairs |

People and gags (main = one of the three title-card people):

| | Main people | Signature gag, shots it appears in | Payoff (% of runtime) |
|---|---|---|---|
| Samurai | You · Merchant · Elder | bows/dignity 4 · one bow lower 4 · stamping 3 | deep bow + cat 94 % · slight bow 94 % · fury 88 % |
| Papal | Stubborn · Tired · Mayor | notebook 5 · asleep 5 · the key 4 | notebook hat 81 % · wet wake-up 83 % · smug key swing 96 % |
| Apollo | You · Commander · Orbiter | sweat 11 · gum 7 · sandwich 2 (small role) | arm squeeze 95 % · bubble 87 % · sandwich alone 89 % |

- One signature gag per person; minor roles (Clerk, Baker, Flight Director) get at most one one-off.
- Payoffs sit at 81–96 % of the runtime (mean ≈ 89 %), each on a narration beat (touchdown, "they removed the
  roof", "survival tip").
- Accident beats (not narrated, motivated): Samurai 4 (CLACK, the bale buckling your knees, the hat at the toe,
  the cat), Papal 2 (notebook hat, rain on the sleeper), Apollo 1–2 (helmet clicks down, you jolt).
- Every ECU names its subject and its event in the cut table (22 / 22): 19 are the noun the narration says on
  that beat (bell, key, loaf, alarm, ledger, coins), 3 are gag beats (bubble, stylus page, squeeze).
- Climax ECU on an object: Apollo glove on the stick at 70 %, Samurai ledger "YOU" at 78 %, Papal CUM CLAVE at 91 %.

## 3. Rules of thumb (the validators' numbers)

1. Plan before shots: motifs, cast with ONE signature gag each, beats with an intent and a framing progression,
   accidents, the climax ECU and the title frame (`direction.json`).
2. Depth rule: 2–5 framings per shot (title frame: 1). Measured 2–5, mean 3.3.
3. Every close / ECU framing states its `why` (information, emotion, cause → effect, consequence). Measured 100 %.
4. Not all wide: close + ECU ≥ 25 % of all framings (measured 38–63 %); a shot usually opens wide/medium/OTS.
5. Running gag: setup before the payoff, at least one escalation; the payoff beat sits in the last 30 % of the
   runtime (measured ≥ 81 %); a person with 3+ shots plays the gag in at least 3 of them (measured 3–11).
6. At least one accident beat per film (measured 1–4), physical, small, not in the narration, motivated by it.
7. One climax ECU on an object or instrument with a stated narrative reason; its shot must contain an `ecu`.
8. No two adjacent shots with the same framing sequence (the films slip once in 30 pairs; the validator does not).
9. The first shot is the title frame: the 1–3 main people acting the premise, the title (≤ 6 words, from the
   script's own framing), the place behind them and one accent object; look `ink-poster`, 1.5–3 s in ReelForge
   (the films used 4 s without narration under it), lettering thudding in.
10. Dutch tilt only on tension beats (2–7°, alternating sign); level for title, calm and establishing framings.
11. Facts stay the script's: devices dramatise what is said, never add a claim.
