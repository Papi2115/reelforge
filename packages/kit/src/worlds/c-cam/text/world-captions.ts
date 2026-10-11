/**
 * `C_CAM_CAPTIONS` (PLAN.md#14.18): the Grim Ink captions as the engine calls them. The engine
 * hands over the shot's scene; the captions find the ink stage the scene painted last (its hidden
 * caption hook, stage.ts) and letter the line over that frame, so preview and export show the
 * same pixels as the prototypes' caption pass. No stage painted: false (the engine's own captions).
 */
import { CAPTION_HOOK, type CaptionPainter } from '../stage.js';
import {
  C_CAM_CAPTION_MAX_WORDS,
  paintCaption,
  type CaptionFrame,
  type CaptionScene,
  type WorldCaptions,
} from './captions.js';

type CaptionHook = (painter: CaptionPainter) => boolean;

function hookOf(object: unknown): CaptionHook | undefined {
  if (typeof object !== 'object' || object === null) return undefined;
  const visible = (object as { readonly visible?: unknown }).visible !== false;
  const hook: unknown = Reflect.get(object, CAPTION_HOOK);
  return visible && typeof hook === 'function' ? (hook as CaptionHook) : undefined;
}

export const C_CAM_CAPTIONS: WorldCaptions = Object.freeze({
  maxWords: C_CAM_CAPTION_MAX_WORDS,
  draw(scene: CaptionScene, text: string, frame: CaptionFrame): boolean {
    const hooks: CaptionHook[] = [];
    scene.traverse((object) => {
      const hook = hookOf(object);
      if (hook !== undefined) hooks.push(hook);
    });
    // The last stage in the scene is the one on top; one that was not painted is skipped.
    for (const hook of hooks.reverse()) {
      const drew = hook((g, target) => {
        paintCaption(g, target, text, frame);
      });
      if (drew) return true;
    }
    return false;
  },
});
