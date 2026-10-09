# 09 · History and decisions — how C-CAM was chosen

A short log reconstructed from the experiment folders in `docs/concepts/styles7/` (their NOTES/CHANGES/COMPARE files)
and from the Manager's work packet of 2026-10-09. The folders carry no dates; the order below follows the folder
numbers and the cross-references inside the notes. Nothing is copied here; follow the pointers. Paths starting with `films/` are
relative to the C-CAM folder; `../../styles7/…` is relative to this `docs/` folder (= `docs/concepts/styles7/`).

| Step | Folder(s) | What was tried | Outcome |
|---|---|---|---|
| 1. Technique pilots | `../../styles7/01-rome-ascent` (comic print, 640×360 index buffer), `02-euro-comic-pyramid` (Euro clear line), `03-kluchy-black-death` (soft "dumpling" blobs), `04-upa-pirates` (mid-century graphic), `05-marker-prehistory` (felt-tip marker), `06-pen-viking` (ballpoint pen) | very different drawing techniques on short pilots (each `NOTES.md` line 1–12) | not continued as the style; which of these were the "5 candidate styles" Papi compared is **UNKNOWN** from the repo (the packet says five; six pilots exist) |
| 2. Grim caricature | `../../styles7/07-great-stink-london` | "grammar distilled from two Polish adult cartoons (proportions, face build, line, colour, light), applied to original people", every character hand-written (`../../styles7/07-great-stink-london/NOTES.md:1-5`) — the *Blok Ekipa / Egzorcysta*-inspired look | became the base grammar of C |
| 3. Variants of 07 | `08-tulip-mania-gritty` (A: grittier), `09-gold-rush-anatomy` (B: bodies built per view), `10-dancing-plague-both` (**C = A + B**: grit + anatomy), `11-prohibition-arms-only` (D: arm system only) | split the improvements to judge them separately | **C** kept: palette/pools/grit + 4 torsos/heads per view, 2-bone IK, face guard, solved grips (`../../styles7/10-dancing-plague-both/CHANGES.md:1-30`) |
| 4. C vs c-plus | `12-mammoth-hunt`, `13-miami-80s`, `14-sparta-agoge`, `15-pirate-ship`, `16-roman-emperor`: each `baseline-c/` vs `c-plus/` on the same script | c-plus = C "pushed toward the Egzorcysta / Blok Ekipa vibe": faces redrawn from briefs, hard key + rim light, vignettes, **camera work** (cuts inside shots, ECU, Dutch, OTS, foreground silhouettes), heavier wandering line with doubled strokes, more acting tics, individual background people (`../../styles7/12-mammoth-hunt/COMPARE.md:9-18`) | camera liked; c-plus films had bugs (next row) |
| 5. Three-way comparison | `17-samurai-edo`, `18-papal-conclave`, `19-apollo-11`: `c-base/` (C as is), **`c-cam/` (C + the c-plus camera only)**, `c-plus-fixed/` (c-plus look on the fixed engine), `19…/c-plus-faces/` (faces re-balanced after Papi's "over the top" remark) | same script and storyboard per topic, only the variant differs (`../../styles7/17-samurai-edo/c-base/NOTES.md:1-18`, `../../styles7/19-apollo-11/c-plus-faces/CHANGES.md:1-30`) | **C-CAM chosen** (packet) |
| 6. Engine fix (not part of C-CAM) | `../../styles7/20-cplus-engine` | consolidated c-plus engine; root causes of the c-plus bugs fixed with a validator suite: A anchors vs drawing (arms out of jowls), B face guard, C doubled limb strokes, D handshakes never met (234 px apart), E jaw tier detaching, F misc. (`../../styles7/20-cplus-engine/CHANGES.md:7-40`); new character contract (`../../styles7/20-cplus-engine/CHARACTER_CONTRACT.md`) | the path for a later engine upgrade of C-CAM (keep the C look) |
| 7. Packaging | `films/01..03` | the three `c-cam/` films copied here unchanged (only `script.txt` and `storyboard.md` added per film: a recursive diff against `../../styles7/1x-*/c-cam` shows nothing else) + this documentation | — |

## Decisions recorded

- **Style C over c-plus** because the c-plus variants showed arm, jaw and handshake bugs (packet); those bug families
  are the ones the c-plus engine later fixed (`../../styles7/20-cplus-engine/CHANGES.md:7-34`).
- **Only the camera** was taken from c-plus into C: "The one change: camera work (ported from c-plus, nothing else)"
  (`films/01-samurai-edo/NOTES.md:6`); not ported: key/rim light, vignette, c-plus faces, briefs, grime,
  line weight, doubled strokes, rig changes (`films/01-samurai-edo/NOTES.md:17`,
  `films/02-papal-conclave/NOTES.md:13`).
- **Faces**: when the c-plus faces were judged "sometimes over the top", the direction was "more grim realism than goofy
  caricature", max two strong exaggerations per face (`../../styles7/19-apollo-11/c-plus-faces/CHANGES.md:9-12`) — applies to
  new C-CAM characters too ([01 §6](01-STYLE_GRAMMAR.md#6-face-construction)).
- **Grammar, not generator**: every character hand-built per film, only brushes/rig/poses shared
  (`../../styles7/10-dancing-plague-both/CHANGES.md:30`), consistent with ReelForge's world principle
  (`docs/worlds/DECISIONS.md:67-75`).
- **Upgrade path**: the c-plus engine (step 6) is the documented way to add validators and safer anchors later, without
  adopting the c-plus look ([04 §9](04-CHARACTER_GUIDE.md#9-common-mistakes-and-whether-c-avoids-them),
  [07 §11](07-REELFORGE_INTEGRATION.md#11-task-breakdown-paste-into-planmd) task 14.13).
