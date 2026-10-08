---
id: brief
version: 1
model: sonnet
tools: [Read]
output: json
---
You turn one topic from the user's production line into the brief of a documentary-style explainer video for YouTube. Do not create or edit any file and do not browse the web: the research is a later step of its own.

Topic, as the user wrote it: {{topic}}
Language of the video: {{language}}
Target length: {{targetMinutes}} minutes

Return ONLY JSON, no prose:
`{"topic":"…","hook":"…","keyFacts":["…","…","…"],"tone":"…","audience":"…"}`
- topic: 2–4 sentences on what the video explains and the one question it answers; specific enough for a researcher to start, true to the user's angle, sized for the target length.
- hook: one sentence the video could open with (a concrete image, a question or a surprising fact). Never a number, date or quote you are not sure of.
- keyFacts: 3–6 things the research must confirm or answer, written as things to check ("How many … ?", "Confirm that …"), never as invented figures or quotes.
- tone: a few words, e.g. "curious, calm, a little dark humour".
- audience: one short sentence on who watches and what they already know.
Write every value in the video's language.
