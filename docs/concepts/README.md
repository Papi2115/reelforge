# Character concepts (ported to kit.cast in 2.3.5)

Status: **ported** (2026-10-04, ReelForge 2.3.5, PLAN.md#12.20 part 1): the mascots, the side cast, the mannequin,
the 8 poses and the expressions live in `packages/kit/src/characters/` as `kit.cast` (docs/characters.md, ADR-024).
This page stays the design reference (look, proportions, palettes, poses).

## What is here
- `characters.html` — standalone, offline 3D gallery (open by double-click). Tabs: Maskotki / Obsada / Manekin / Porównanie.
  Poses 1–8, expressions Q–I (mascots only), turntable on space. Generated procedurally (boxes, no repo imports).
- `shots/*.png` — screenshots of each tab, for a quick look without running the page.

- `banner/` — YouTube channel banner for **BlockBrain**, 3 versions (`banner.html` with zone overlay, device preview and
  PNG export; `banner-v1..3.png` at 2560×1440; `shots/` = mobile-safe / desktop / TV crops). **Chosen: v1 (Lab diorama).**
- `avatar/` — matching 800×800 avatar, 3 variants (Bulb / Brain / BB monogram) with circle previews 176→24 px on dark and
  light UI and a channel-header mock. Variant not chosen yet.
- `voxplain/` — the channel was renamed to **Voxplain** (2026-10-06): banner v1 with VOX/PLAIN logotype + 3 avatars (Bulb, Brain, VP) in `voxplain.html`. **This is the current branding**; `banner/` and `avatar/` are the old BlockBrain versions.

## Decisions (Papi)
- **Channel mascot: Bulb** (lightbulb head; "Eureka!" pose glows/flickers). Appears whenever a stand-in person is needed and recurs across a film.
  Other candidates (Screen, Fox, Bean) were not chosen but may stay as optional style variants.
- **Side cast liked:** Scientist, Doctor, Engineer, Finance, Teacher, Historian, Kid, Hacker, Detective, Astronaut — as more interesting
  default NPCs (instead of the old hoodie guy). Some may be slightly exaggerated → judge in real animations.
- **Mannequin** (cream, smooth, ball joints) stays as the anatomy-consistent neutral option.
- Old kit character (`kit.props.character`, hoodie guy) is considered bland and slightly breaks the style.

## What 2.0.5-test should answer
1. How do Bulb and the cast behave in real scenes/animations (timing, readability at 640x360, next to anatomy props)?
2. What looks better in practice: cast vs. mannequin vs. old hero; which designs are over the top?
3. Does the expression system (voxel eyes/brows/mouth + blink) and pose personality (anticipation, spring overshoot,
   delayed head, secondary motion) survive a port into `packages/kit` with golden-frame tests?

## Porting notes
- Source of truth for look/poses is the page code at the top of `characters.html` (≈1200 lines, then an inlined Three.js bundle).
- Existing rig to extend or replace: `packages/kit/src/props/character*.ts` (see `docs/kit-catalog.md` → `kit.props.character`).
- Keep scenes deterministic (§3.2 of CLAUDE.md): the page uses a seeded hash, no `Math.random`.
- Licences/fonts: nothing external was added; Three.js (MIT) is inlined.
