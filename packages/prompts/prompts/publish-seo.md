---
id: publish-seo
version: 1
model: sonnet
tools: [Read]
output: json
---
You write the YouTube search metadata of a finished explainer video: its tags and its chapter timestamps. Do not create or edit any file and do not browse the web: work only with what is below. Write everything in English.

Video title: {{title}}
Length: {{durationS}} s

The channel it is published on (the tags must fit the whole channel, not only this video):
{{channel}}

What the narrator says (the whole script):
{{script}}
{{#beats}}
The script's outline (beats):
{{beats}}
{{/beats}}{{#research}}
Research notes (names, places, dates and numbers people search for):
{{research}}
{{/research}}{{#chapters}}
Candidate chapter starts: the video's cuts, one per line as `seconds (m:ss) · what the narrator says from there`:
{{candidates}}
{{/chapters}}
Return ONLY JSON, no prose: `{"title":"…","tags":{"oneWord":["…","…","…","…","…"],"twoWord":["…","…","…","…","…"],"threeWord":["…","…","…","…","…"]},"chapters":[{"t":0,"title":"…"},{"t":48.2,"title":"…"}]}`

Tags: what a viewer types into YouTube search.
- Exactly 5 per list: every `oneWord` tag is one word, every `twoWord` tag two words, every `threeWord` tag three words (words are separated by spaces; `sci-fi` is one word). Lowercase, no `#`, no commas, no tag twice across the lists.
- Each list mixes the video's own subject (the people, places, objects, events and ideas the narration names) with umbrella phrases of the channel's niche that fit every video of the channel, e.g. `science explained`, `history documentary`, `how money works`, `why empires fall`.
- Most important first in each list.
- True to the video: no names, promises or topics it does not cover, no clickbait, no other channels' names.

Title: one search-friendly title of at most 70 characters, true to the video (no ALL CAPS, no emojis).

Chapters:{{#chapters}}
- Between {{chapterMin}} and {{chapterMax}} chapters. The first starts at `0`; every other `t` is copied exactly from a candidate line above. Chapters start at least 10 s apart and the last one at least 10 s before the end.
- Split where the narration moves to a new question or a new stage of the story, so the chapters have similar lengths.
- Each title (at most 60 characters, title case) is a phrase a viewer would search for plus what happens in that part, e.g. `How Rome Debased Its Coins`, `Why the Bridge Collapsed`, `The Chip That Fit in a Watch`. Never storyboard words (shot, panel, page, scene, camera), never a bare `Intro`, `Conclusion` or `Part 2`; no two titles alike.{{/chapters}}{{^chapters}}
- The video is too short for chapters: return `"chapters":[]`.{{/chapters}}
