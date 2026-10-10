/**
 * What a world says in the stage prompts (PLAN.md#13.6, ADR-029). The storyboard, scene-build,
 * scene-fix and critic prompts keep the voxel text in `{{^world}}…{{/world}}` sections and render
 * these instead when the stage passes a world's variables; every other project gets the prompts
 * byte for byte as before.
 */
import type { ContinuityKind } from '@reelforge/shared';
import type { WorldPace } from './pace.js';

export interface WorldPromptText {
  /** Storyboard, first line: "the director/storyboard artist for <film>". */
  readonly film: string;
  /** Storyboard: what the world is and what never appears in it. */
  readonly brief: string;
  /** Storyboard: the "Rolls and looks" lines (A/B/C with the world's looks and an example). */
  readonly rolls: string;
  /** Storyboard (tension map on): rolls and looks by tension. */
  readonly tensionLooks: string;
  /** Storyboard: the look rhythm sentence. */
  readonly rhythm: string;
  /** What every look of the world shares (a phrase without a final full stop). */
  readonly shared: string;
  /** Storyboard: how a non-cut `transitionIn` is written in this world. */
  readonly transitionIn: string;
  /** Storyboard: the camera rules of the world's looks. */
  readonly camera: string;
  /** Storyboard (pattern interrupts on): the interrupt example and the kinds of this world. */
  readonly interrupts: string;
  /** Storyboard: how annotations are drawn in this world. */
  readonly marks: string;
  /** Scene-build: how the annotation plan is implemented. */
  readonly annotate: string;
  /** Scene-build: the motion rule (replaces "Camera always moving."). */
  readonly motion: string;
  /** Scene-build: step 4 (what to do when the kit has no prop). */
  readonly missing: string;
  /** The world's craft brief (QUALITY.md §9, ≤ 1.5 KB): scene-build and scene-fix. */
  readonly craftBrief: string;
  /** Critic: "a strict visual QA reviewer for <medium> video frames". */
  readonly criticMedium: string;
  /** Critic: the style line's parenthesis. */
  readonly criticStyle: string;
  /** Critic: the vibe check paragraph. */
  readonly vibe: string;
  /** Critic: the world's craft checklist (focal point, traces, slop tells). */
  readonly checklist: string;
  /**
   * Storyboard (continuity links on, films of 45 s+): which pairs of shots this world links and
   * with which kind (after the film's link quota).
   */
  readonly continuity: string;
  /** Script (surprise beats on): what a surprise is in this world (replaces the voxel example). */
  readonly surprise: string;
  /**
   * Script: how the narration itself is written for this world (Game B2: the topic told as one
   * game run, PLAN.md#13.15); absent = the script prompt is the plain explainer's.
   */
  readonly script?: string;
  /**
   * Scene-build in a portrait short (PLAN.md#13.18): how the world's page is laid out on a 9:16
   * frame (one rule line of the prompt's short section); absent = the world has no portrait
   * wording.
   */
  readonly short?: string;
  /**
   * The world's moment catalog (worlds/variety.ts): a closed list the storyboard plans per shot
   * (`worldMoment`), the scene builds with the exact API and the critic looks for. `plain` is
   * the absence of a moment and is not listed.
   */
  readonly moments: readonly WorldMomentOption[];
  /**
   * The world's film grammar (Game B1 rework, docs/beta-feedback.md: "it no longer reads as a
   * game"): the framing views a shot names (`worldView`) and the film-level rules of the
   * storyboard validator (world-grammar.ts). Absent = no such rules (every other world).
   */
  readonly grammar?: WorldFilmGrammar;
  /**
   * The world's transition pace (worlds/pace.ts, Comic: pages flow into each other): a looser
   * non-cut budget, denser continuity links, the dry-run check. Absent = the defaults.
   */
  readonly pace?: WorldPace;
  /**
   * The world has no page-native transitions (Grim Ink: hard cuts between shots, the camera cuts
   * inside them): the storyboard is never asked for distinct transition styles. Absent = it is.
   */
  readonly cutsOnly?: boolean;
}

/** One framing of a shot (storyboard `worldView`): where it starts and ends, room or screen. */
export interface WorldViewOption {
  readonly id: string;
  readonly start: 'room' | 'screen';
  readonly end: 'room' | 'screen';
  /** Camera moves between the room and the screen inside the shot. */
  readonly moves: number;
  readonly description: string;
}

/** Film-level grammar rules of a world (validators/world-grammar.ts). */
export interface WorldFilmGrammar {
  /** The views every shot names in `worldView`. */
  readonly views: readonly WorldViewOption[];
  /** At least this share of the shots plays a game moment (`WorldMomentOption.game`). */
  readonly minGameShare: number;
  /** The gameplay moment: at least max(minGameplay, ceil(shots / gameplayEveryShots)) shots. */
  readonly gameplayMoment: string;
  readonly minGameplay: number;
  readonly gameplayEveryShots: number;
  /** Room <-> screen switches: at most max(maxSwitchesMin, floor(duration x perMinute / 60)). */
  readonly maxSwitchesMin: number;
  readonly switchesPerMinute: number;
  /** The same moment (or plain) at most this many shots in a row, whatever the roll. */
  readonly maxKindRun: number;
  /** Game-native (non-cut) transitions: at least max(min, round(duration / everyS)). */
  readonly minNativeTransitions: number;
  readonly nativeTransitionEveryS: number;
  /** The rhythm check's non-cut cap for this world: about one per this many seconds. */
  readonly transitionEveryS: number;
  /** Breakthroughs that never share one film (the pair every early film repeated). */
  readonly exclusiveBreakthroughs: readonly string[];
}

/** One planned page moment of a world (storyboard `worldMoment`). */
export interface WorldMomentOption {
  /** Kebab-case id the storyboard writes, e.g. `popup`. */
  readonly id: string;
  /** A breakthrough showpiece (counted by the quota, spaced, at least two kinds). */
  readonly breakthrough: boolean;
  /** The looks that host it (the shot must be in one of them); empty = any look. */
  readonly looks: readonly string[];
  /**
   * Breakthroughs: what in the narration calls for it, a few words for the quota repair message
   * ("a reveal or twist" → popup).
   */
  readonly cue?: string;
  /** Storyboard: "use when the narration …" (plain words, no full stop). */
  readonly useWhen: string;
  /** Scene-build / scene-fix: the exact call and its caps. */
  readonly build: string;
  /** Critic: what must be visible in the frames once it has started. */
  readonly visible: string;
  /** The page-native transition style the shot must open with (e.g. a torn-out page). */
  readonly transition?: string;
  /**
   * The shortest shot that can host it, seconds (real run Sketchbook 4: a strip planned in a
   * 3.9 s shot was silently dropped by the scene); the storyboard validator enforces it.
   */
  readonly minShotS?: number;
  /** A game screen (gameplay, menus, bosses): counts for the grammar's game share. */
  readonly game?: boolean;
  /** May come back within the moment repeat window (the world's gameplay itself). */
  readonly repeatable?: boolean;
  /**
   * Someone of the narration speaks in it (Game B2 `dialogue`): planned only where the shot's
   * words quote someone or carry a speech verb (validators/world-speakers.ts).
   */
  readonly speaker?: boolean;
}

/** A page-native transition of a world, as the storyboard prompt and validator see it. */
export interface WorldTransitionOption {
  readonly id: string;
  /** Plain transition type of the style (its fallback). */
  readonly type: string;
  /** The style's own length, seconds. */
  readonly duration: number;
  readonly description: string;
  /**
   * The continuity link kind it renders (Game B1: the calendar zoom, the cartridge in / out):
   * named on a shot, it needs the shot's `continuity` link (validators/world-variety.ts).
   */
  readonly link?: ContinuityKind | undefined;
}
