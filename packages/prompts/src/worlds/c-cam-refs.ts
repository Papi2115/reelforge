/**
 * Grim Ink (c-cam) authoring references of PLAN.md#14.19 as the prompts and the kit-docs name
 * them: the film's shared libraries (`kit-ext/lib/<name>.js` -> `ctx.kit.lib.<name>`, modules'
 * `ink.lib.<name>`) and the on-demand technique topics (`reelforge kit-docs shots`: annotated,
 * trimmed shots of the concept films, labelled "technique, not content"). The topic texts live in
 * packages/cli/src/commands/kit-docs-c-cam-shots.ts.
 */

/** Project folder of the film's shared libraries. */
export const C_CAM_LIB_DIR = 'kit-ext/lib';

/** `reelforge kit-docs lib`: how a library is written and called. */
export const C_CAM_LIB_TOPIC = 'lib';

/** `reelforge kit-docs <topic>` of the technique shots (index first). */
export const C_CAM_SHOT_TOPICS = {
  index: 'shots',
  runningGag: 'shot-running-gag',
  climaxEcu: 'shot-climax-ecu',
  accident: 'shot-accident',
  reverseOts: 'shot-reverse-ots',
  foregroundTension: 'shot-fg-tension',
} as const;

export type CCamShotTopic = (typeof C_CAM_SHOT_TOPICS)[keyof typeof C_CAM_SHOT_TOPICS];
