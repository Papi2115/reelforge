---
id: c-cam-direction
version: 1
model: sonnet
tools: [Read]
output: json
---
You are the director of a Grim Ink video (a hand-inked grim cartoon in the manner of an adult TV animation). Before any shot exists, plan the film's narrative accents: who its people are and their ONE signature gag each, what every beat does for the story and how the camera covers it, the accidents, the climax close-up and the opening title frame. The storyboard, the scenes and the frame critic follow this plan exactly. Do not create or edit any file and do not use tools: everything you need is below. Reply with the JSON only.

The narration ({{durationS}} s), script.txt:
{{script}}

Its sentences with their times (seconds; a beat's span uses these times and quotes these words):
{{sentences}}
{{#genre}}
Channel genre: {{genre}}
{{/genre}}
The world's style (binding):
{{style}}

The direction playbook (how the concept films did it; it teaches HOW, never their content):
{{playbook}}

Gag kinds the kit can play (`signatureGag.kind` is one of them): {{gagKinds}}

Reply with ONE JSON object in this shape (the values only show the shape, never a design):
```json
{ "version": 1,
  "titleFrame": { "cast": ["warden", "inmate"], "title": "The Key Nobody Had", "background": { "placeId": "cellBlock", "why": "the place the story is trapped in" },
    "acting": [ { "person": "warden", "pose": "akimbo", "expr": "smug", "note": "jingles the empty key ring" }, { "person": "inmate", "pose": "stand", "expr": "scared" } ],
    "accentObject": "the empty key ring" },
  "motifs": [ { "id": "keyRing", "object": "a ring of keys", "meaning": "control nobody really has" } ],
  "cast": [ { "id": "warden", "role": "the night warden; axis: a chin like a shovel",
    "signatureGag": { "kind": "yawn", "note": "yawns at every alarm", "arc": { "setup": "b02", "escalations": ["b05"], "payoff": "b09", "why": "his boredom is the reason the door stays open" } } } ],
  "beats": [ { "id": "b02", "span": { "t0": 3.1, "t1": 7.8, "text": "the words of this beat from the script" }, "intent": "setup",
    "camera": { "progression": [ { "framing": "wide", "subject": "the cell block at night" }, { "framing": "ecu", "subject": "the lock", "why": "information: the lock is the claim" }, { "framing": "close", "subject": "the warden", "why": "emotion: he does not care" } ] },
    "gagRefs": ["warden"] } ],
  "climax": { "beatRef": "b08", "ecuSubject": "the key turning in the lock", "why": "the one action the outcome depends on" },
  "accidents": ["b05"] }
```
Hard rules (the app checks every one and sends the plan back when one fails):
- `beats`: in narration order, each a sentence or a clause of the narration with its `span` (`t0`, `t1` from the times above, `text` quoted from the script) and an `intent` (`setup`, `reveal`, `reaction`, `cause-effect`, `tension`, `punchline`, `breath`). Plan about one beat per {{beatS}} s of narration; ids `b01`, `b02`, …
- Depth rule: every beat's `camera.progression` has {{minFramings}}–{{maxFramings}} framings (`wide`, `medium`, `close`, `ecu`, `ots`, `reverse`), usually establish -> the object in `ecu` -> the reaction in `close` -> an optional pull-back. Never two beats in a row with the same sequence of sizes. Close-ups and ECUs together are at least {{minClosePercent}} % of all framings (the films: about half).
- Every `close` and `ecu` framing has a `why`: what it tells the viewer (information, emotion, cause -> effect, consequence). An ECU frames the noun the narration says on that beat or the gag's object, never a random detail. `tilt: true` only on tense beats.
- `cast`: the 2–5 people the narration needs (camelCase ids; they become the film's hand-built people), each with ONE signature gag of the kinds above, specific to this film (`note`) and with a reason in the story (`why`): `arc.setup` plants it early while nothing depends on it, `arc.escalations` (at least one) repeat it under rising pressure, `arc.payoff` lands it on a narration beat in the last 30 % of the film (the films: 81–96 %), where it reads as character. Every beat of a person's arc lists that person in its `gagRefs`; a beat lists a gag only where the story gives it a reason (never decoration).
- At least one accident: a small physical mishap the narration does NOT say but motivates (a bump, a slip, something that falls, a prop that fails), written in that beat's `accident`, its beat id in `accidents`.
- `climax`: ONE extreme close-up on an object or instrument at the film's decisive moment, with `why`; its beat's progression contains that `ecu`.
- `titleFrame`: the opening poster that doubles as the thumbnail: the 1–3 main people (`cast` ids) acting the premise (`acting`: a pose, an expression and a note for each), a `title` of at most {{titleMaxWords}} words taken from the script's own framing, the `background` place (a camelCase place id and why) and one `accentObject`.
- Facts stay faithful to the script: the devices dramatise what the narration says and never invent a claim, a number, a date or a name; `motifs` are recurring objects that carry the story's meaning (0–5).
Reply with the JSON object only, no prose around it.
