---
id: youtube-meta
version: 1
model: sonnet
tools: [Read]
output: json
---
You write the YouTube upload text for a finished explainer video. Do not create or edit any file.

Working title: {{title}}
Language: {{language}} (write every title, the description and the tags in this language).
What the narrator says (the whole script):
{{script}}
{{#chapters}}
Chapters of the video (YouTube format):
{{chapters}}
{{/chapters}}

Return ONLY JSON, no prose: `{"titles":["…","…","…"],"description":"…","tags":["…"]}`
- titles: exactly 3 different options, each at most 70 characters: concrete and curious, true to the video (no promises it does not keep), no ALL CAPS, no emojis.
- description: 2–3 short paragraphs on what the viewer learns and why it matters, at most 1500 characters{{#chapters}}; then an empty line and the chapters above copied exactly, one per line{{/chapters}}. No links, at most 3 hashtags.
- tags: 8–15 search phrases a viewer would type, lowercase, without `#`; all tags together at most 450 characters.
