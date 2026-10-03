# ReelForge v1.1.0 UX Audit (PLAN.md#11.2)

## Executive Summary

ReelForge has a solid dark, pixel-art-friendly aesthetic and clear visual hierarchy. However, at 1280x720, the interface is cramped, with overlapping information density across panels. Status terminology is ambiguous, and the right-panel Chat is always visible, reducing preview space. The timeline layer stack is overwhelming. Top 10 priority fixes would remove ~40% of cognitive load and improve usability.

---

## Issue Table: By Screen

### Main Workspace (1280x720)

| Issue | Why It Hurts | Suggested Fix | Severity |
|-------|-------------|---------------|----------|
| Chat panel always visible | Eats 25-30% of horizontal space; preview pane tiny | Add hamburger toggle, hidden by default at <1400px | BLOCKER |
| Timeline tracks all visible | 7 rows (shots, narration, cues, audio, cards, ambience, music) = dense overlapping labels | Toggle visibility checkbox per track; default show 3 core tracks | MAJOR |
| Pipeline status ambiguous | "Ready" / "Waiting" / "Stale" unclear; is it blocking? | Use verbs: "Run this", "Rebuild (upstream changed)", "In progress" | MAJOR |
| Preview area shrinks to 400x225px | Hard to see on-screen text or fine animations | (Addressed by Chat toggle above) | BLOCKER |
| Left sidebar shots truncated | Shot names cut off at 1280x720; 40 items, tiny scrollbar | Add shot search; or collapse to icon-only below 1400px | MAJOR |

### Pipeline Sidebar

| Issue | Why It Hurts | Suggested Fix | Severity |
|-------|-------------|---------------|----------|
| "Next:" instruction text long | Users miss action at a glance | Extract action: "Show" -> "Show script"; move rationale to info icon | MAJOR |
| Checkboxes + status + buttons mixed | Hard to scan; unclear which is current/next | Separate done items (fold); show only active + next step | MAJOR |
| "Show" button vague | Click doesn't indicate what opens | Rename to "Show <stage>" (e.g. "Show script") | MINOR |

### Settings Models

| Issue | Why It Hurts | Suggested Fix | Severity |
|-------|-------------|---------------|----------|
| Model names without descriptions | User sees "Sonnet/Opus/Haiku", no idea which is fast/cheap | Add 1-line tag: "(fast, balanced)" / "(powerful)" / "(quick)" | MAJOR |

### Sound Design Panel

| Issue | Why It Hurts | Suggested Fix | Severity |
|-------|-------------|---------------|----------|
| Too many simultaneous controls | SFX list + buttons + library + render tabs = decision paralysis | Collapse by default; show only "Generate cues" + "Render mix" | MAJOR |
| Mix mode names confusing | "Full mix" / "Voice-over only" / "Preview" not obvious | Rename: "Full (all tracks)" / "Voice only" / "Preview (0-20s)" | MINOR |

### Timeline Visualization

| Issue | Why It Hurts | Suggested Fix | Severity |
|-------|-------------|---------------|----------|
| Shot labels unreadable when zoomed out | 10min video = shot name ~3px tall | Show shot number (s01) by default; name on hover or zoom >1.0x | MINOR |
| Drag-drop SFX picker hard at 1280x720 | Popup too small, hard to drag onto tiny timeline | Add modal: select SFX -> click "Insert at [time]" | MINOR |

### Empty States

| Issue | Why It Hurts | Suggested Fix | Severity |
|-------|-------------|---------------|----------|
| "Storyboard stage writes storyboard.json" cryptic | User unsure what to do | Rewrite: "Storyboard created after voiceover added. Next: add voiceover, run stage." | MINOR |

---

## Top 10 Priority Fixes

1. **(P0)** Hide Chat panel by default at <1400px or add hamburger toggle
2. **(P0)** Make timeline tracks collapsible (default: Shots + Narration + Audio only)
3. **(P1)** Clarify Pipeline status: "Ready" -> "Run this", "Stale" -> "Rebuild (changed)", "Waiting" -> "Waiting"
4. **(P1)** Simplify "Next:" instruction: extract action into button label ("Show script" not "Show")
5. **(P1)** Collapse Pipeline done items; show only active + next step
6. **(P1)** Collapse Sound design SFX library by default
7. **(P1)** Add model tooltips (fast/powerful/quick) next to Settings dropdowns
8. **(P2)** Add shot search or collapse sidebar to icons below 1400px
9. **(P2)** Smart timeline label hiding: show every Nth shot label based on zoom
10. **(P2)** Rewrite empty state messages (action-focused, not technical)

---

## Proposed Information Architecture

### Always Visible
- Top: Project title + status
- Left (collapsible): Pipeline checklist + next action + shots list
- Center: Preview
- Bottom: Timeline (3 core tracks by default)

### Toggle/Modal
- Chat: hamburger menu, hidden by default <1400px
- Timeline tracks: checkbox panel in header
- Settings: modal (not sidebar)
- History: drawer (keep as-is)

### Workflow Simplification
1. Pipeline: separate done items (fold) from in-progress + next
2. Sound: hide SFX library until user clicks "Manage SFX"
3. Status labels: 5 terms only (Run this, Rebuild, In progress, Review, Done)
4. Onboarding: 2 essential steps + deferred tooltips

---

## Strengths Worth Keeping

- Dark theme + pixel-art aesthetic (users love it)
- Color coding (green Done, orange Next, red errors)
- Preview-first layout (large center)
- Git auto-commit per stage (safety net)
- Chat multi-turn logic (well designed)

