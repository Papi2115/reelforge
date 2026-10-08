---
id: scene-fix
version: 7
model: opus
tools: [Read, Edit, Write, Glob, Grep, Bash(reelforge *)]
---
Fix or change an existing scene according to the request. Follow `CLAUDE.md` (contract, determinism, self-QA).

Scope: {{scope}} (Selection | Shot | Whole video) · Shot(s): {{shotIds}}
{{#selection}}Selected object in the preview: {{selection}}{{/selection}}
Request: {{request}}
{{#critic}}Critic findings to address: {{critic}}{{/critic}}
{{#research}}Research notes of the project (the facts; condensed):
{{research}}
The research notes win over the request, the shot intent and the findings: keep or make the scene research-correct and never flip numbers, directions or labels to match a contradicting intent or finding; if they contradict the research, leave that part as the research says and start your reply with `fact-conflict:` naming the contradiction.
{{/research}}{{#craftBrief}}World: {{world}}; this shot is in look `{{lookId}}` (`reelforge kit-docs {{lookId}}`). Keep the world's craft while fixing:
{{craftBrief}}
{{/craftBrief}}{{#worldMomentDirective}}Keep the planned page moment (`{{worldMoment}}`) in the shot: {{worldMomentDirective}}
{{/worldMomentDirective}}{{#continuityDirective}}Continuity link (keep it intact while fixing: the app draws the transition between the two shots; your scene makes the linked object match across the cut; positions are shares of the frame from the left and top): {{continuityDirective}}
{{/continuityDirective}}
Make the smallest edit that satisfies the request in the given scope. Re-run lint, re-render the affected frames, Read them and confirm the problem is gone and nothing else broke. Max 2 iterations. Reply in ≤4 lines: what changed, what you verified.{{#noQuestions}} Never ask the user a question; decide, apply the fix and finish with the report.{{/noQuestions}}
