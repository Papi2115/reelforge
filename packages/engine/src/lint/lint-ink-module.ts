/**
 * Lint of the Grim Ink project modules (PLAN.md#14.8): `kit-ext/people/<id>.js` and
 * `kit-ext/places/<id>.js`. The same forbidden-API rules as scenes (they draw inside scene
 * frames), no module state written by functions (one instance serves every shot), the module
 * contract (`export const person` / `place`: literal data valid for the kit, the id equal to the
 * file name, the drawing functions present) and the world's grammar: ink shapes only, so no text
 * (`fillText`: lettering is drawn ink), no gradients, patterns, filters, shadows or images, and a
 * file of at most 250 lines (a module is one person / place, not a library).
 */
import {
  PERSON_FUNCTION_KEYS,
  PLACE_FUNCTION_KEYS,
  personDataSchema,
  placeDataSchema,
} from '@reelforge/kit';
import { INK_MODULE_LIMITS, kitExtensionOfFile } from '@reelforge/shared';
import type { AnyNode, Program } from 'acorn';
import { childNodes, isFunctionNode, memberKey, staticKey } from './ast.js';
import { checkProgram } from './checker.js';
import { collectExports, type SceneExports } from './contract-rules.js';
import { normalizeDiagnostics, type LintDiagnostic, type Report } from './diagnostics.js';
import { collectingReport, parseScene, type LintSceneOptions } from './lint-scene.js';
import { staticValue } from './prop-meta.js';
import { checkModuleStateWrites } from './prop-rules.js';
import { analyzeScopes } from './scope.js';

export type InkModuleKind = 'people' | 'places';

interface KindSpec {
  /** Exported binding: `person` / `place`. */
  readonly binding: string;
  readonly functions: readonly string[];
  readonly required: readonly string[];
  readonly data: typeof personDataSchema | typeof placeDataSchema;
  readonly example: string;
}

const SPECS: Readonly<Record<InkModuleKind, KindSpec>> = {
  people: {
    binding: 'person',
    functions: PERSON_FUNCTION_KEYS,
    required: ['torso', 'head'],
    data: personDataSchema,
    example:
      "export const person = { id: 'nightBaker', name: 'The Night Baker', D: { ... }, neck: [...], headScale: 1.1, seed: 2100, tones: { skin: '#c9946e', skinD: '#9a6a50' }, arm: { ... }, leg: { ... }, torso(g, ink, view) { ink.blob(...); }, head(g, ink, view, face) { ink.eye(...); } };",
  },
  places: {
    binding: 'place',
    functions: PLACE_FUNCTION_KEYS,
    required: ['draw'],
    data: placeDataSchema,
    example:
      "export const place = { id: 'bakeryBackRoom', name: 'The bakery back room', bounds: [1920, 1080], light: { x: 900, y: 300, rx: 600, ry: 400, color: '#e0a050' }, anchors: { oven: [1400, 900] }, collide: [], draw(g, ink, t) { ink.rect(...); } };",
  },
};

/** Canvas members the grammar forbids (text, gradients, patterns, filters, shadows, pixels). */
const FORBIDDEN_MEMBERS: ReadonlyMap<string, string> = new Map([
  ...['fillText', 'strokeText', 'measureText', 'font'].map((name): [string, string] => [
    name,
    'text: Grim Ink letters are drawn ink, never a font',
  ]),
  ...['createLinearGradient', 'createRadialGradient', 'createConicGradient', 'createPattern'].map(
    (name): [string, string] => [name, 'gradients and patterns: colour is flat tone shapes'],
  ),
  ...['filter', 'shadowBlur', 'shadowColor', 'shadowOffsetX', 'shadowOffsetY'].map(
    (name): [string, string] => [name, 'filters and shadows: shade with crescents and hatching'],
  ),
  ...['drawImage', 'getImageData', 'putImageData'].map((name): [string, string] => [
    name,
    'images and pixel reads: everything is drawn shapes',
  ]),
]);

/** Members that are only forbidden as assignment targets (`pts.filter(...)` is fine). */
const ASSIGNED_ONLY: ReadonlySet<string> = new Set([
  'font',
  'filter',
  'shadowBlur',
  'shadowColor',
  'shadowOffsetX',
  'shadowOffsetY',
]);

/** Kind of a module path `kit-ext/people|places/<id>.js` (any separator, any prefix). */
export function inkModuleKindOfPath(file: string): InkModuleKind | undefined {
  const match = /(?:^|\/)(kit-ext\/(?:people|places)\/[^/]+\.js)$/.exec(file.replaceAll('\\', '/'));
  const kind = match?.[1] === undefined ? undefined : kitExtensionOfFile(match[1])?.kind;
  return kind === 'people' || kind === 'places' ? kind : undefined;
}

function fileId(filename: string): string | undefined {
  return /([^/\\]+)\.js$/.exec(filename)?.[1];
}

function findBinding(program: Program, name: string): AnyNode | undefined {
  for (const statement of program.body) {
    if (statement.type !== 'ExportNamedDeclaration') continue;
    const declaration = statement.declaration;
    if (declaration?.type !== 'VariableDeclaration') continue;
    for (const declarator of declaration.declarations) {
      if (declarator.id.type === 'Identifier' && declarator.id.name === name) {
        return declarator.init ?? declarator;
      }
    }
  }
  return undefined;
}

function checkExports(program: Program, exports: SceneExports, spec: KindSpec, report: Report) {
  for (const [name, entry] of exports.named) {
    if (name === spec.binding) continue;
    report(entry.at, {
      rule: 'ink-module-contract',
      severity: 'warning',
      message: `The engine only reads \`${spec.binding}\`; \`${name}\` is ignored.`,
      fix: 'Keep helpers as module-level functions without `export`.',
    });
  }
  if (exports.defaultExport) {
    report(exports.defaultExport, {
      rule: 'ink-module-contract',
      message: `The engine reads \`export const ${spec.binding} = { ... }\`, not a default export.`,
      fix: spec.example,
    });
  }
  if (!exports.named.has(spec.binding)) {
    report(program, {
      rule: 'ink-module-contract',
      message: `The module does not export \`${spec.binding}\`.`,
      fix: spec.example,
    });
  }
}

/** Data fields read statically (undefined when one is computed: checked when it loads). */
function readFields(
  object: AnyNode,
  spec: KindSpec,
  report: Report,
): {
  readonly data: Record<string, unknown> | undefined;
  readonly id: AnyNode | undefined;
  readonly idValue: unknown;
} {
  const fail = (at: AnyNode, message: string, fix = spec.example): void => {
    report(at, { rule: 'ink-module-contract', message, fix });
  };
  if (object.type !== 'ObjectExpression') {
    fail(object, `\`${spec.binding}\` must be an object literal.`);
    return { data: undefined, id: undefined, idValue: undefined };
  }
  const data: Record<string, unknown> = {};
  const seen = new Set<string>();
  let literal = true;
  let idNode: AnyNode | undefined;
  let idValue: unknown;
  for (const property of object.properties) {
    const key =
      property.type === 'SpreadElement' ? undefined : staticKey(property.key, property.computed);
    if (property.type === 'SpreadElement' || key === undefined) {
      fail(
        property,
        `\`${spec.binding}\` must list its fields literally (no spreads or computed keys).`,
      );
      literal = false;
      continue;
    }
    seen.add(key);
    if (spec.functions.includes(key)) {
      if (!isFunctionNode(property.value) || property.value.async || property.value.generator) {
        fail(property.value, `\`${spec.binding}.${key}\` must be a plain synchronous function.`);
      }
      continue;
    }
    const value = staticValue(property.value);
    if (key === 'id' || key === 'name') {
      if (!value.ok) fail(property.value, `\`${spec.binding}.${key}\` must be a string literal.`);
      if (key === 'id') {
        idNode = property.value;
        idValue = value.ok ? value.value : undefined;
      }
    }
    if (value.ok) data[key] = value.value;
    else literal = false;
  }
  for (const name of spec.required) {
    if (!seen.has(name)) fail(object, `\`${spec.binding}.${name}(...)\` is missing.`);
  }
  return { data: literal ? data : undefined, id: idNode, idValue };
}

function checkData(
  object: AnyNode,
  fields: ReturnType<typeof readFields>,
  spec: KindSpec,
  filename: string,
  report: Report,
): void {
  const expected = fileId(filename);
  const id = fields.idValue;
  if (fields.id && typeof id === 'string' && expected !== undefined && id !== expected) {
    report(fields.id, {
      rule: 'ink-module-contract',
      message: `\`${spec.binding}.id\` is "${id}" but the file is ${expected}.js; scenes reach it by its file name.`,
      fix: `Set id: '${expected}' or rename the file to ${id}.js.`,
    });
  }
  if (fields.data === undefined) return;
  const parsed = spec.data.safeParse(fields.data);
  if (parsed.success) return;
  const problems = parsed.error.issues
    .map((issue) => `${issue.path.map(String).join('.') || spec.binding}: ${issue.message}`)
    .join('; ');
  report(object, {
    rule: 'ink-module-contract',
    message: `\`${spec.binding}\` data is invalid: ${problems}.`,
    fix: `See reelforge kit-docs ${spec.binding === 'person' ? 'people' : 'places'} for every field.`,
  });
}

function checkGrammar(program: Program, report: Report): void {
  const visit = (node: AnyNode, assigned: boolean): void => {
    if (node.type === 'MemberExpression') {
      const name = memberKey(node);
      const why = name === undefined ? undefined : FORBIDDEN_MEMBERS.get(name);
      const applies = name !== undefined && (assigned || !ASSIGNED_ONLY.has(name));
      if (why !== undefined && name !== undefined && applies) {
        report(node.property, {
          rule: 'ink-grammar',
          message: `\`${name}\` is outside the Grim Ink grammar (${why}).`,
          fix: 'Use the ink toolbox: ink.blob / ink.inkLine / ink.brushStroke / ink.hatch / ink.pool (reelforge kit-docs people).',
        });
      }
    }
    for (const child of childNodes(node)) {
      visit(child, node.type === 'AssignmentExpression' && child === node.left);
    }
  };
  visit(program, false);
}

function checkLength(source: string, program: Program, report: Report): void {
  const lines = source.split('\n').length;
  if (lines > INK_MODULE_LIMITS.maxLines) {
    report(program, {
      rule: 'ink-module-contract',
      message: `The module has ${String(lines)} lines; one person / place stays within ${String(INK_MODULE_LIMITS.maxLines)}.`,
      fix: 'Simplify the drawing (fewer, bolder shapes) or split the scenery into another place.',
    });
  }
}

export function lintInkModule(
  source: string,
  options: LintSceneOptions,
  kind: InkModuleKind,
): LintDiagnostic[] {
  const program = parseScene(source, options.filename);
  if (!('type' in program)) return [program];
  const diagnostics: LintDiagnostic[] = [];
  const report = collectingReport(diagnostics);
  const tree = analyzeScopes(program);
  const spec = SPECS[kind];
  checkExports(program, collectExports(program, tree), spec, report);
  const object = findBinding(program, spec.binding);
  if (object !== undefined) {
    checkData(object, readFields(object, spec, report), spec, options.filename, report);
  }
  checkProgram(program, { source, report, tree, updateFunction: undefined });
  checkModuleStateWrites(program, tree, report);
  checkGrammar(program, report);
  checkLength(source, program, report);
  return normalizeDiagnostics(diagnostics);
}
