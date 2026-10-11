# Brief 13 — PLAN.md#14.20: prop, set-piece, crowd and acting vocabulary from the prototypes

Branch: `phase-14/ccam-vocabulary`. Repository: Papi2115/reelforge.
Read `docs/worlds/briefs/ccam/README.md` first. Papi's verdict on the first sample: no character,
none of the authored little things (gum chewing, sweat, swords clinking by accident, joystick
close-ups). The prototypes had a RICH vocabulary of props, set pieces, crowds and two-person
physical gags written once per film (`props.js`, `crowd.js`, `acting.js`, `lunar.js`, `edo.js`).
Claude today must draw every object from scratch inside a small scene — that is why the result is
empty and generic.

## Goal
Port the prototypes' reusable vocabulary into the kit as PARAMETERIZED, period-neutral vocabulary
(NOT templates, NOT showcase content): `ink.props.*`, `ink.crowd.*`, `ink.acting.*`, and
instrument/console objects, each documented and golden-tested. Claude composes and varies them per
narration; nothing is a finished scene.

## Read first
`docs/concepts/c-cam-style/docs/{01,03,04,05,06}*.md`, all `films/*/js/{props,crowd,acting,lunar,
edo,brushes,rig,poses}.js`, the older papal conclave and samurai prototypes in
`docs/concepts/styles7/17-samurai-edo/` and `18-papal-conclave/` (find their prop/crowd/acting
code), and the existing kit API: `packages/kit/src/worlds/c-cam/{stage-ink,draw/*,modules/*}`.
Mind the gag toolkit already in `draw/gags.ts`, `gag-acts.ts`, `gag-props.ts`.

## Do
1. Inventory every prop, set piece, crowd device and two-body gag in the three C-CAM films and the
   papal/samurai prototypes into `docs/worlds/c-cam-VOCABULARY.md` (name, what it is, params used,
   which film/shot, how it carries narration). Group into families.
2. Implement families as kit vocabulary (new files under `packages/kit/src/worlds/c-cam/vocabulary/`,
   each <= 400 lines, pure functions `(g, ink, opts)`, deterministic via the hash, no module state):
   - `props`: tables/desks/benches, columns/arches/doors/windows, torches/lamps with light pool
     hooks, banners/flags, barrels/crates/sacks, scrolls/tablets/ledgers/papers/pens (period `kind`),
     weapons (sword, spear, shield, club) with wear/state, tools, bottles/cups/plates/food, vehicles
     minimal (cart, boat) — parameters: size, wear, tone, kind, state (e.g. broken/lit/open);
   - `instruments`: lever/joystick/dial/gauge/switch panel/console with N elements, labelled via
     ink lettering, with `press`/`turn`/`pull` state arguments of t (for the climax ECU on an
     instrument);
   - `crowd`: tiers/rows of silhouettes and simple faces with reactions (cheer, gasp, hush, wave,
     point, lean), density and tone parameters, deterministic jitter, foreground silhouettes;
   - `acting`: two-body physical gags and choreography: clink (weapons collide by accident),
     stumble, drop-and-catch, handshake, flinch, bow, push, hand-over, point-and-turn, shared-object
     tug, double-take — each takes two figures' handles and a start time and yields hand targets/pose
     overrides for the rig (via `reachPalm`/poses) plus optional prop motion;
   - `fx`: small flat-shape effects the prototypes use (dust puff, spark, sweat drop, impact star,
     steam, smoke curl, shake lines) with `t0`, `dur`, `seed`.
3. Wire into the stage `env.ink` (namespaces `props`, `instruments`, `crowd`, `acting`, `fx`) and
   people/places modules (`ink` object), update lint allow-lists, kit-docs topics (one per family,
   <= 6 KB each; index < 28 KB) and the c-cam API constants list (`c-cam-api.ts`) so prompts name
   them from ONE source.
4. Tests: determinism, parameter ranges, no forbidden identifiers; golden sheets per family
   (`ccam-vocab-<family>.png`, several parameter variants each) and LOOK at them — compare with the
   prototype frames; list differences.
5. Examples: for each family one tiny scene in `packages/kit/examples/c-cam/vocab/` showing a
   gag/prop used with a narrative reason.

## Constraints
No showcase content as defaults (no Apollo LM/DSKY objects as such: generalize into consoles with
parameters; the specific Apollo versions remain in examples/c-cam/apollo/). Other worlds unchanged.
Split the work with several `coder` subagents on disjoint files (props / instruments / crowd /
acting+fx) and integrate. `pnpm typecheck`, `lint`, `test`, `test:render` green.
