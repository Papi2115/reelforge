# Grim Ink quality rubric (PLAN.md#14.17)

How the quality lab (`docs/worlds/c-cam-lab-report.md`) scores a Grim Ink film against the concept
films (`docs/concepts/c-cam-style/films/*/proof/`, Apollo 11 = film 3). Score every line 1–10 on
the rendered frames (one frame in the middle of every framing of the cut table), side by side
with the Apollo proof sheet. Be honest: 10 = indistinguishable from the concept film, 7 = clearly
the same show, 5 = the look is there but the craft is not, 3 = generic.

| Line | Pass (concept level) | Fail signs |
| --- | --- | --- |
| **Character** | Each person is specific and ugly-lovable, one exaggeration axis readable at thumbnail size; the signature gag is visible (face ≥ 90 px of 1080 and the acting hand in frame when it plays); 4+ different expressions across the film; acting on twos with jolts and holds, poses that change with the beat. | Stiff stand poses; the same expression all film; the gag played off-frame, behind a back or at 40 px; arms out of the jowls; a placeholder. |
| **Narrative accents** | A running gag with setup, escalation and a payoff late in the film (81–96 %); at least one accident the narration motivates; a purposeful climax ECU on the object the decision happens in. | Gag only once or as decoration; no mishap; the climax framed on a guessed point that misses the object. |
| **Camera** | 2–5 framings per shot cut on the narration's beats; an ECU 0.4–1.5 s; no static single wide longer than 2 s; Dutch tilt only on tense beats; focal point off-centre; close-ups and ECUs about half of all framings. | One wide per shot; centred subjects; tilt on calm beats; a framing that shows the set's edge. |
| **Depth** | ≥ 3 layers in most framings: the place, mid props, the people, a foreground piece (a back at the lens, bars, heads, a spear, an arm). | People pasted on a flat wall; nothing between the camera and the actors. |
| **Text** | Only ink lettering of narration words, on the thing it names (a blade, a purse, a sign), above the caption band (y < 886), never overlapping the captions. | Typeset or `ctx.text`; words the narration never says; lettering floating in the air; overlap with captions. |
| **Colour** | Muddy flat palette with dirty whites; one warm pool behind the people; ONE accent object per shot that stands out from its ground. | The accent on a ground of its own colour (mustard on mustard sand); several accents; gradients, glows. |
| **Coherence** | Every prop and gag object fits the period and place (antiquity: scroll, wax tablet, cup, goblet; no bound book, mug, clock, paper cup); people's costumes tell their job. | A coffee mug in Rome, modern bound books, a steel hilt on a wooden practice sword. |

Overall = the mean of the seven lines, rounded down; a line at ≤ 3 caps the film at 5.

How to check without a model: `reelforge lint`, `reelforge people-preview` (runs the validators),
`reelforge places-preview`, `reelforge frames --shot <id> --at <the middle of every cut>`, then the
stage's own QA (`run-stage <project> scenes`): source checks (traces, text provenance), the frame
guards and the critic.
