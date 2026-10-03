# Shot variants (PLAN.md#11.3)

"Variants…" on a shot builds 2–3 genuinely different versions of it, shows them next to the
current scene and lets the user pick one instead of fixing blindly. The existing "Rebuild this
shot" stays as it is.

## In the app

- **Open**: Shots panel → QA badge → **Variants…**, right-click a shot → **Variants…**, or **V**
  on the selected shot. Locked shots refuse ("Shot is locked — unlock first").
- **Form**: 2 or 3 variants (default 3, Economy mode 2), an optional note sent with every variant
  ("make it calmer"), the estimate from the usage ledger (`≈ 3 Opus turns, about 3–6 min`;
  defaults before the first scene: 150 s per build turn, 20 s per critic turn; low end = every
  variant passes QA at once, high end = one fix each; waves = count / scene concurrency).
- **Generation**: a Scenes built run (`action: 'variants'`) — usage booked to `scenes`, Stop and the
  usage-limit pause work as for any scene run. The dock shows `Variants: 1/3 done · <step>`.
- **Compare**: the current scene + the variants as cards: a looping low-res clip (8–24 frames of
  the shot's own time range, rendered by the app's engine into
  `.reelforge/frames/variants/<shot>/<card>/`, half size, ≤ 4 s loop), the direction, ✓/⚠
  (Building…, Dropped + reason) and the first critic note (all notes in the tooltip).
  **▶ Play** plays the card in the main preview with the project audio: the preview manifest
  gets the variant as the shot's scene (per-shot hot reload) and the shot's range loops.
- **Decide**: **Use this one** (Enter) · **Keep current** · **Discard all** · **↻** regenerate one
  variant (same direction) · **New set…** (next directions). **Lock after picking** (off by
  default) locks the shot with the pick. Keys: 1/2/3 select, arrows move, Enter picks.
- **Restart**: the sets live in `.reelforge/variants/`; on the next start the view reopens for the
  first shot with variants. Variants a closed app left building are dropped as "interrupted".
  A set is removed as soon as the shot's scene or storyboard entry changes (fingerprint).

## Direction library (`packages/stages/src/variants/directions.ts`)

A set takes consecutive entries starting at `round × count` (wrapping): the first set of a shot
gets the first entries, every later set (after a decision or "New set…") the next ones. Pure and
deterministic.

| id | label | what makes it different |
|---|---|---|
| `hero-push` | Hero object, slow push-in | one big hero prop, slow push-in, few elements, a reaction on the key word |
| `orbit-depth` | Orbit, layered depth | camera arc around the subject, fore/mid/background layers, floating elements (parallax) |
| `kinetic-text` | Text-forward kinetic | big pixel-font cards on their anchors, minimal 3D, nearly still camera |
| `diorama-wide` | Wide diorama | high wide view of a small voxel world, slow truck/pan, one detail highlighted |
| `macro-reveal` | Macro detail, then reveal | starts very close on a detail, fast pull-back reveal on the key word |
| `build-up` | Build-up sequence | objects pop in one after another on their words, camera tracks sideways |
| `contrast` | Contrast / transformation | two states side by side or one turning into the other, a camera swing on the key word |
| `low-dramatic` | Low angle, dramatic light | low camera, strong key light and shadow, rising camera, one punchy accent |

The direction label and brief go into the `scene-build` prompt (v4, `{{#direction}}` section, plus
the user's note); each QA fix request says which variant file to edit and to keep the direction.

## Files

| path | what | git |
|---|---|---|
| `.variants/<shot>/v<n>.js` | work file the runtime Claude writes (it may not write `.reelforge/`); excluded through `.git/info/exclude`, removed after the build | no |
| `.reelforge/variants/<shot>/v<n>.js` | stored variant scenes | no |
| `.reelforge/variants/<shot>/variants.json` | `shotVariantSetSchema`: round, note, base fingerprint, per variant direction, status (`building` / `ready` / `dropped`), QA record, reason | no |
| `.reelforge/taste.json` | `tasteLogSchema`: per decision shot, treatment, decision (`pick` / `keep-current` / `discard`), directions offered, chosen (`none`), note, QA scores, time — local only, nothing reads it yet (PLAN.md#12.13) | no |
| `scenes/<shot>.js` | changed only by a pick (`Shot s03: picked variant 2 (<direction>)`) | yes |

## QA per variant

The same loop as a shot build: scene-build turn (Opus per settings, fresh detached session) →
missing props through the shared prop builder (built once per run, used by every variant) →
lint → smoke frames of the variant file at the shot's place (`ShotRenderRequest.scene`) →
programmatic checks → Haiku critic (sheet `.reelforge/frames/qa/<shot>/v<n>-build-r0.png`) →
at most one fix turn. A variant that ends ✗ or whose turn fails is dropped with the reason; when
none is left the action fails ("No variant of s03 passed QA; the current scene is kept"). If a
variant turn edits the current scene anyway, it is restored (warning).
