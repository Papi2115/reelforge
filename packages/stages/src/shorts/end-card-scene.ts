/**
 * The scene of a short's fixed end card (PLAN.md#13.18), written by the app, never by Claude: the
 * kit's moving backdrop (`kit.fx.endCard`: sliding stripes, a play badge) and the text as engine
 * pixel-font titles with literal scales (so the phone-legibility check reads them), placed by the
 * kit's `endCardLayout` for the shot's format. Pure function of t like every scene (§3.2).
 * Every style gets the same neutral card in its own palette (no world-specific lettering yet).
 */
import {
  END_CARD_CAMERA,
  endCardLayout,
  endCardNameScale,
  splitEndCardText,
  type EndCardFormat,
} from '@reelforge/kit';
import type { StoryboardShot } from '@reelforge/shared';

/** First line of an app-written end card scene. */
export const END_CARD_SCENE_MARKER = '// reelforge:end-card';

/** How far the camera pushes in over the card (units), so the frame never holds still. */
const PUSH_IN = 0.5;
/** When the lead line and the channel name pop in (local seconds). */
const LEAD_AT = 0.1;
const NAME_AT = 0.3;

export interface EndCardSceneInput {
  readonly shot: Pick<StoryboardShot, 'id' | 'treatment'>;
  readonly text: string;
  readonly format: EndCardFormat;
}

/** A title call with literal options (JSON values), shown until the end of the shot. */
function titleCall(text: string, options: Record<string, unknown>): string {
  const entries = Object.entries(options).map(([key, value]) => `${key}: ${JSON.stringify(value)}`);
  entries.push('until: ctx.shot.duration');
  return `  ctx.text.title(${JSON.stringify(text)}, { ${entries.join(', ')} });`;
}

export function endCardSceneSource(input: EndCardSceneInput): string {
  const { format } = input;
  const layout = endCardLayout(format);
  const { lead, name } = splitEndCardText(input.text);
  const meta = { id: input.shot.id, title: 'End card', treatment: input.shot.treatment };
  const [x, y, z] = END_CARD_CAMERA.position;
  const titles = [
    ...(lead === undefined
      ? []
      : [
          titleCall(lead, {
            id: 'end-card-lead',
            pos: [0.5, layout.leadY],
            scale: layout.leadScale,
            maxWidth: 0.8,
            at: LEAD_AT,
            enter: 'slide-up',
            exit: 'fade',
          }),
        ]),
    titleCall(name, {
      id: 'end-card-name',
      pos: [0.5, layout.nameY],
      valign: 'top',
      scale: endCardNameScale(format, name),
      maxWidth: 0.8,
      color: 'accent1',
      at: NAME_AT,
      enter: 'pop',
      exit: 'fade',
    }),
  ];
  return `${END_CARD_SCENE_MARKER} - the short's end card, written by the app (PLAN.md#13.18); "Scenes built" rewrites it.
export const meta = ${JSON.stringify(meta)};

export function build(ctx) {
  const { three, scene, palette, kit } = ctx;
  scene.background = new three.Color(palette.shadow);
  scene.add(kit.env.lights({ preset: 'default' }));
  const card = kit.fx.endCard({ format: ${JSON.stringify(format)}, duration: ctx.shot.duration });
  scene.add(card);
  return { card };
}

export function update(t, state, ctx) {
  state.card.update(t);
  const push = ${String(PUSH_IN)} * ctx.ease.easeOutCubic(Math.min(1, t / ctx.shot.duration));
  ctx.camera.set({ position: [${String(x)}, ${String(y)}, ${String(z)} - push], target: [0, 0, 0], fov: ${String(END_CARD_CAMERA.fov)} });
${titles.join('\n')}
}
`;
}
