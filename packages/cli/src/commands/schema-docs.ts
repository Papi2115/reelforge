/** Compact text of JSON Schemas (kit params, ctx.text options) for the `kit-docs` reference. */

type JsonSchema = Readonly<Record<string, unknown>>;

function isSchema(value: unknown): value is JsonSchema {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** A JSON Schema list keyword (`enum`), or [] when absent. */
function schemaValues(value: unknown): readonly unknown[] {
  return Array.isArray(value) ? value : [];
}

function schemaList(value: unknown): JsonSchema[] {
  return Array.isArray(value) ? value.filter(isSchema) : [];
}

/** Short type of a JSON Schema: `"a"|"b"`, `number`, `[number, number, number]`, `string[]`. */
export function typeSummary(schema: JsonSchema): string {
  const values = schema['enum'];
  if (Array.isArray(values)) return values.map((value) => JSON.stringify(value)).join('|');
  if ('const' in schema) return JSON.stringify(schema['const']);
  const union = [...schemaList(schema['anyOf']), ...schemaList(schema['oneOf'])];
  if (union.length > 0) return union.map(typeSummary).join('|');
  const tuple = schemaList(schema['prefixItems']);
  if (tuple.length > 0) return `[${tuple.map(typeSummary).join(', ')}]`;
  const type = schema['type'];
  if (type === 'array') {
    const items = schema['items'];
    return `${isSchema(items) ? typeSummary(items) : 'any'}[]`;
  }
  if (typeof type === 'string') return type === 'integer' ? 'int' : type;
  return 'any';
}

export interface ParamDoc {
  readonly name: string;
  readonly type: string;
  readonly required: boolean;
  readonly defaultValue: unknown;
  /** First allowed value of an enum (for examples). */
  readonly firstValue: unknown;
  readonly description: string | undefined;
}

export function paramDocs(params: JsonSchema): ParamDoc[] {
  const properties = isSchema(params['properties']) ? params['properties'] : {};
  const required = Array.isArray(params['required']) ? params['required'] : [];
  return Object.entries(properties).map(([name, value]) => {
    const schema = isSchema(value) ? value : {};
    const description = schema['description'];
    const values = schema['enum'];
    return {
      name,
      type: typeSummary(schema),
      required: required.includes(name),
      defaultValue: schema['default'],
      firstValue: schemaValues(values)[0],
      description: typeof description === 'string' ? description : undefined,
    };
  });
}

export function formatParam(param: ParamDoc): string {
  const optional = param.required ? '' : '?';
  const fallback =
    param.defaultValue === undefined ? '' : ` = ${JSON.stringify(param.defaultValue)}`;
  return `${param.name}${optional}: ${param.type}${fallback}`;
}
