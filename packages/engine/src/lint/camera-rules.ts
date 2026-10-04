/**
 * `camera-api`: a scene may only use the members of `ctx.camera` (PLAN.md#12.28). Anything else
 * (`ctx.camera.fov = 30`, `ctx.camera.focus`, a guessed `ctx.camera.zoom(...)`) is either
 * undefined at runtime or silently ignored; the camera itself is `ctx.camera.object`.
 */
import type { MemberExpression } from 'acorn';
import { CAMERA_API_MEMBERS } from '../camera/camera-api.js';
import { memberKey } from './ast.js';
import type { RuleContext } from './api-rules.js';
import { lookup, type Scope } from './scope.js';

/** Checks `ctx.camera.<member>` where `ctx` is a function parameter (the scene context). */
export function checkCameraMember(
  member: MemberExpression,
  scope: Scope,
  context: RuleContext,
): void {
  const { object } = member;
  if (object.type !== 'MemberExpression' || memberKey(object) !== 'camera') return;
  if (object.object.type !== 'Identifier' || object.object.name !== 'ctx') return;
  if (lookup(scope, 'ctx')?.kind !== 'param') return;
  const key = memberKey(member);
  if (key === undefined || CAMERA_API_MEMBERS.includes(key)) return;
  context.report(member, {
    rule: 'camera-api',
    message: `\`ctx.camera.${key}\` is not part of the camera API, so it does nothing (or is undefined).`,
    fix: `Use one of ctx.camera.${CAMERA_API_MEMBERS.join(', ')} (see \`reelforge kit-docs camera\`); the Three.js camera is ctx.camera.object (e.g. ctx.camera.object.fov), focus/blur is ctx.camera.rackFocus.`,
  });
}
