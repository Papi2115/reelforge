# Brief 09 — PLAN.md#14.16: the DIRECTION layer for Grim Ink films

Branch: `phase-14/ccam-direction`. Repository: Papi2115/reelforge.
Read `docs/worlds/briefs/ccam/README.md` first (rules; you are the Manager, code through the `coder`
subagent, reading through `scout`).

## Why (Papi's verdict on the first sample, `docs/real-run-grim-ink-1.md`, `docs/beta-feedback.md`)
"Tragedy: people without character, none of the little gags (the gum chewed all film in Apollo and
the bubble at the end), close-ups that are illogical while in Apollo every close-up had a clear
narrative sense (the joystick during the landing), stiff camera, no depth." The kit CAN do these
things (gag toolkit, cut table, foreground layers) but NOTHING PLANS them: the storyboard and
scene-build prompts have no direction layer, and nothing checks that gags/close-ups appear and are
visible. The concept films (Apollo, papal conclave, samurai) are full of AUTHORED narrative accents:
a running gag with setup → escalation → payoff, accidents (samurai clinking swords), close-ups at
culminating moments, deadpan holds, reverse shots, depth through layers.

## Goal
Add a **Direction** step for c-cam projects, between "Words timed" and "Storyboard": Claude plans
the film's narrative accents BEFORE shots exist; the storyboard and scene prompts consume the plan;
validators and the critic check that the plan was executed.

## Part A — analysis (write it first; it feeds the prompts)
Read `docs/concepts/c-cam-style/films/*/js/shots/*.js`, `film.js`, `acting.js`, `props.js`, the NOTES
files, `docs/concepts/c-cam-style/docs/05-CAMERA_GUIDE.md`, `06-AUTHORING.md`, `08-KNOWN_ISSUES...`,
and the older styles7 notes for the papal and samurai films (`docs/concepts/styles7/17-samurai-edo`,
`18-papal-conclave`, NOTES.md/CHANGES.md). Produce `docs/worlds/c-cam-DIRECTION.md` (<= 12 KB):
1. A catalogue of DEVICES with concrete examples (shot id + what happens + WHY it works): running
   gag with setup/escalation/payoff (gum → bubble), accident beat, climax close-up on an instrument
   or object (joystick), reaction hold, reverse/over-the-shoulder, foreground silhouette, Dutch tilt
   on tension, slow push on realisation, smash cut, prop reveal, deadpan stillness, crowd gag, etc.
2. Measured statistics per film: number of framings per shot (2–5), average framing length, share
   of wide/medium/close/ECU, how many gags per person, where the payoff sits (% of runtime), how
   many accident beats, how many close-ups have a stated reason.
3. Rules of thumb the validators can check (turn these into numbers).
Topic-neutral wording: it teaches HOW, not Apollo content.

## Part B — the step
1. Schema (packages/shared, zod, versioned): `direction.json` = { version, motifs: [{id, object,
   meaning}], cast: [{id, signatureGag: {kind, arc: {setup: beatRef, escalations: beatRef[],
   payoff: beatRef, why}}}], beats: [{id, narration span, intent: 'setup'|'reveal'|'reaction'|
   'cause-effect'|'tension'|'punchline'|'breath', camera: {progression: [{framing:
   'wide'|'medium'|'close'|'ecu'|'ots'|'reverse', subject, why}], tilt?: boolean}, accident?: string,
   gagRefs: string[]}], climax: {beatRef, ecuSubject, why}, accidents: string[] }.
2. Prompt `c-cam-direction` v1 (Sonnet, no tools): inputs script.txt, timed words/beat anchors,
   channel/genre, world craft brief digest, the DIRECTION playbook digest (<= 3 KB), list of gag
   kinds (`C_CAM_VOCABULARY.gags`) — output the JSON. Hard rules: every person has ONE signature gag
   with a payoff in the last third of the film that is tied to a narration beat; at least one
   accident beat per film (a physical small mishap that is NOT in the narration but is motivated);
   one climax ECU on an OBJECT/instrument with a stated narrative reason; every close-up/ECU has a
   `why` (information, emotion, cause→effect, consequence); framings per shot 2–5 (this is the depth
   rule); no decorative gags; facts stay faithful to the script (never invent claims).
3. Stage plumbing: stage action `direction` (c-cam only, Sonnet; fix turn once; cached by script hash;
   committed like other stages; shows in the pipeline as part of "Storyboard" step or its own row —
   follow the 'world-assets' pattern: a sub-action, no new top-level step), deterministic fallback
   (when Claude fails: a minimal valid plan from the script so the film still builds, with ⚠).
4. Validators (stages/prompts validators, errors with fix hints): running gag has setup ≥ 1 and
   payoff in last 30% of runtime; signature gag appears in ≥ 3 distinct shots for a person with
   ≥ 3 shots; ≥ 1 accident; climax ECU exists and matches a shot; every ECU/close shot has `why`;
   2–5 framings per shot; wide:close ratio (not all wide); no two consecutive shots with the same
   framing progression.
5. Storyboard + scene-build + critic prompts consume `direction.json`: shots carry `direction`
   refs (beat id, gag ref, framing progression), scene-build gets the exact per-shot plan and MUST
   execute it (cut table with the planned framings, gag calls with `t0` on the planned beat, the
   climax ECU), critic checks execution (gag visible: face height >= 90 px at the gag moment; ECU
   framing present; payoff drawn). Prompt fixtures: only c-cam fixtures change.
6. Tests: schema, validators (good + deliberately broken plans), stage with fake-claude (success,
   repair, fallback), prompt fixtures, snippets-through-kit where relevant.

## Acceptance
`pnpm typecheck`, `pnpm lint`, `pnpm test` green; other worlds/fixtures byte-identical;
`docs/worlds/c-cam-DIRECTION.md` present; PR description lists the schema, validators and
thresholds and what is NOT done. Do not run real Claude; use fake-claude fixtures.
