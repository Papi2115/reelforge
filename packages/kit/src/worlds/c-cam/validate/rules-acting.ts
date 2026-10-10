/**
 * Acting rule (C-CAM, PLAN.md#14.9): a built person states its one recurring tic, the
 * `signatureGag` (draw/gags.ts), so every film gives each person a recognisable beat (the
 * commander's gum, the pilot's sweat). A warning: the figure is not broken without one.
 *
 * Public API: `noSignatureGag`.
 */
import { GAG_KINDS } from '../draw/gags.js';
import type { RuleContext } from './context.js';

/** Warns when the character declares no `signatureGag`. */
export function noSignatureGag(ctx: RuleContext): void {
  ctx.check();
  if (ctx.character.signatureGag !== undefined) return;
  ctx.fail({
    view: null,
    pose: null,
    message: `${ctx.character.id} has no signature gag: nothing marks this person out between shots`,
    fix: `add signatureGag: { kind, note } (kinds: ${GAG_KINDS.join(', ')}); note = what the tic says about them, e.g. { kind: 'gum', note: 'chews gum when bored' }`,
    measured: 0,
    limit: 1,
  });
}
