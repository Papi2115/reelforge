/** The built-in stage implementations, one per StageId. */
import type { StageId } from '../ids.js';
import type { StageDefinition } from '../types.js';
import { cleanStage } from './clean.js';
import { mixStage } from './mix.js';
import { scenesStage } from './scenes.js';
import { scriptStage } from './script.js';
import { soundCuesStage } from './sound-cues.js';
import { storyboardStage } from './storyboard.js';
import { voiceoverStage } from './voiceover.js';
import { wordsStage } from './words.js';

export type StageRegistry = { readonly [S in StageId]: StageDefinition<S> };

export const BUILT_IN_STAGES: StageRegistry = {
  script: scriptStage,
  voiceover: voiceoverStage,
  clean: cleanStage,
  words: wordsStage,
  storyboard: storyboardStage,
  scenes: scenesStage,
  'sound-cues': soundCuesStage,
  mix: mixStage,
};
