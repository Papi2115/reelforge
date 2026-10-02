/**
 * CSS animations/transitions run on the browser clock, so a seeked frame would show an arbitrary
 * in-between state. Detects them in style assignments, `style.setProperty`, `setAttribute('style')`
 * and `@keyframes` anywhere in string literals.
 */
import type { AnyNode, AssignmentExpression, CallExpression } from 'acorn';
import { memberKey, staticString } from './ast.js';
import type { RuleContext } from './api-rules.js';

const ANIMATED_STYLE_PROPERTY = /^(webkit|moz|ms|o)?(animation|transition)/i;
const ANIMATED_CSS_PROPERTY = /^(-(webkit|moz|ms|o)-)?(animation|transition)/i;
const ANIMATED_CSS_DECLARATION =
  /(^|[;{\s])(-(webkit|moz|ms|o)-)?(animation|transition)(-[a-z-]+)?\s*:/i;

const MESSAGE =
  'CSS animations/transitions run on the browser clock, not on video time; a seeked frame would show an arbitrary in-between state.';
const FIX =
  'Set the style value directly from t inside update() (e.g. `el.style.opacity = String(Math.min(t / 0.5, 1));`), or draw text with ctx.text.';

function report(node: AnyNode, context: RuleContext): void {
  context.report(node, { rule: 'no-css-animation', message: MESSAGE, fix: FIX });
}

/** Text of a string literal or of every quasi of a template literal. */
function stringText(node: AnyNode): string | undefined {
  if (node.type === 'TemplateLiteral') {
    return node.quasis.map((quasi) => quasi.value.cooked ?? quasi.value.raw).join(' ');
  }
  return staticString(node);
}

function isStyleObject(node: AnyNode): boolean {
  return node.type === 'MemberExpression' && memberKey(node) === 'style';
}

export function checkStyleAssignment(assignment: AssignmentExpression, context: RuleContext): void {
  const target = assignment.left;
  if (target.type !== 'MemberExpression') return;
  const key = memberKey(target);
  if (key === undefined) return;
  if (isStyleObject(target.object) && ANIMATED_STYLE_PROPERTY.test(key)) {
    report(target, context);
    return;
  }
  if (key === 'cssText' || key === 'style') {
    const text = stringText(assignment.right);
    if (text !== undefined && ANIMATED_CSS_DECLARATION.test(text))
      report(assignment.right, context);
  }
}

export function checkStyleCall(call: CallExpression, context: RuleContext): void {
  if (call.callee.type !== 'MemberExpression') return;
  const method = memberKey(call.callee);
  const [first, second] = call.arguments;
  if (!first || first.type === 'SpreadElement') return;
  if (method === 'setProperty' && isStyleObject(call.callee.object)) {
    const property = staticString(first);
    if (property !== undefined && ANIMATED_CSS_PROPERTY.test(property)) report(call, context);
    return;
  }
  if (
    method === 'setAttribute' &&
    staticString(first) === 'style' &&
    second &&
    second.type !== 'SpreadElement'
  ) {
    const text = stringText(second);
    if (text !== undefined && ANIMATED_CSS_DECLARATION.test(text)) report(call, context);
  }
}

/** `@keyframes` in any string: a stylesheet is being injected. */
export function checkKeyframes(node: AnyNode, context: RuleContext): void {
  const text = node.type === 'TemplateElement' ? node.value.raw : staticString(node);
  if (text?.includes('@keyframes')) report(node, context);
}
