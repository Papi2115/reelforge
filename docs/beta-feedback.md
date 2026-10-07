# Beta feedback list (3.x worlds)

Policy (Papi, 2026-10-07): ship each world as a beta; finish all worlds and all 3.0–3.3 features first, then fix by taste after hands-on use.
Source for the first entries: `docs/real-run-sketchbook-3.md` (defect table) and the follow-ups of the coders. Add Papi's own findings at the top.

## Sketchbook (beta)
- Camera `pushIn` is a no-op on sketch pages while prompts still ask for pushes (wasted turns) → page-level push or stop asking. (run 3 #3)
- Pop-up: opening hidden under a transition when `at ≤ 0`; pull tab travels only a few px; pulling hand rests 1.7 s. (#4)
- Gauges fill red by default → 4 red elements in one frame. (#5)
- Text guard lets small invented numbers through via the calculation rule (19/17/23 on a 21 card). (#6)
- Pop-up intent guard accepts ungrounded intents ("a pretty decoration"). (#8)
- Stagger variance flags pre-drawn marks (`at` < 0). (#9)
- Critic counts chrome (binding, paper, hand) as traces; misses ghost writing, reversed order, invented numbers, red overload, empty opening. (#10)
- First second of a hook can be near-empty (s01 2.7 s). (#11)
- A pages repeat the ground-line composition despite layouts. (#12)
- Pale ballpoint hero numbers on kraft/card (low contrast). (#13)
- `appear: 'bloom'` still sweeps left to right on big words (reads as writing). 
- Prompt wording still says "the hero mark keeps its time" (`packages/prompts/src/worlds/sketchbook.ts`, `sketchbook-snippets.ts`) — now: hero never displaces an earlier-timed task.
- Kit sketch-graph docs still show strip `end: 'now'`.
- Dedicated sketchbook sound recipes (pen click, marker thump, paper tear) instead of reused ones (needs `apps/desktop/src/shared/timeline-contract.ts`).
- Quality scores of real films: 16.6 / 16.8 / 16.25 of 20 (showcase 18–19).

## Infrastructure
- Engine `build-harness.ts`: write harness atomically (race when parallel scene turns rebuild it).
- Desktop autocommits (chat turns etc.) still use `add --all`; use `paths`.
- `scenes` contact sheet says "TIMED OUT" for a harness that did not start (needs separate flag).
- Remember an NVENC open failure per session so the next export skips the doomed GPU pass.
- `reelforge looks`, `lookSummaries` scope for experimental worlds, `templates/project/CLAUDE.md` voxel wording, prop builder in a world, asset-research wording ("photo on the CRT").
- Files over ~400 lines: `packages/prompts/src/validators/storyboard.ts` (482), `apps/desktop/src/main/main.ts` (656), `Workspace.tsx` (439), `styles.css`.
- Flaky: `apps/desktop live-direction.bench.test.ts` under load; own-assets smoke (retry diagnostics added).

## UI (light rebuild still open)
- U6 (status words polish), U8 dock, U10 library (taste/characters per world/channel instead), U11 export dialog v2, U12 copy pass (pattern interrupts / open loops wording), U13 pixel face for titles.
- Clicking Script/Voiceover/Words opens a document over the preview — judge if too much.
- Docked Sound panel is short at 720p.
