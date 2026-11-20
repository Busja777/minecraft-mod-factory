// A small JSON Schema (draft-07) validator, enough for the two official SMAPI schemas
// (https://smapi.io/schemas/manifest.json and https://smapi.io/schemas/content-patcher.json).
// No npm dependency. It supports exactly the keywords these schemas use:
//   $ref (local #/…), type, enum, const, pattern, minimum, properties, required,
//   additionalProperties, propertyNames, items, dependencies, allOf, anyOf, oneOf, not, if/then/else.
// An unknown keyword throws, so a schema update that needs more is noticed instead of passing.
// The patterns are .NET regexes; atomic groups (?>…) and a leading (?i) are translated to JS.
const IGNORED = new Set(['$schema', '$id', '$comment', 'title', 'description', 'default', 'examples', 'definitions', 'allowComments', 'allowTrailingCommas', '@documentationUrl', '@errorMessages']);
const KNOWN = new Set(['$ref', 'type', 'enum', 'const', 'pattern', 'minimum', 'properties', 'required', 'additionalProperties', 'propertyNames', 'items', 'dependencies', 'allOf', 'anyOf', 'oneOf', 'not', 'if', 'then', 'else']);

const regexCache = new Map();
export function dotnetRegex(pattern) {
  if (!regexCache.has(pattern)) {
    let flags = 'u';
    let p = pattern;
    if (/^\^?\(\?i\)/.test(p)) { flags += 'i'; p = p.replace('(?i)', ''); }
    p = p.replace(/\(\?>/g, '(?:');
    try { regexCache.set(pattern, new RegExp(p, flags)); } catch { regexCache.set(pattern, new RegExp(p, flags.replace('u', ''))); }
  }
  return regexCache.get(pattern);
}

const typeOf = v => v === null ? 'null' : Array.isArray(v) ? 'array' : Number.isInteger(v) ? 'integer' : typeof v;
const isType = (v, t) => t === 'number' ? typeof v === 'number' : t === 'integer' ? Number.isInteger(v) : typeOf(v) === t;
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function resolve(root, ref) {
  if (!ref.startsWith('#/')) throw new Error(`only local $ref supported: ${ref}`);
  return ref.slice(2).split('/').reduce((o, k) => {
    if (!o || !(k in o)) throw new Error(`unresolved $ref ${ref}`);
    return o[k];
  }, root);
}

// → [problem texts], each starting with the JSON path ("$.Changes[0].Target: …")
export function validate(schema, value, root = schema, at = '$') {
  if (schema === true || schema === undefined) return [];
  if (schema === false) return [`${at}: not allowed`];
  const out = [];
  for (const k of Object.keys(schema)) if (!IGNORED.has(k) && !KNOWN.has(k)) throw new Error(`schema keyword "${k}" is not supported by tools/stardew/schema.js`);
  if (schema.$ref) out.push(...validate(resolve(root, schema.$ref), value, root, at));
  if (schema.type) {
    const types = [].concat(schema.type);
    if (!types.some(t => isType(value, t))) out.push(`${at}: expected ${types.join(' or ')}, got ${typeOf(value)}`);
  }
  if (schema.enum && !schema.enum.some(e => equal(e, value))) out.push(`${at}: must be one of ${schema.enum.join(', ')}`);
  if ('const' in schema && !equal(schema.const, value)) out.push(`${at}: must be ${JSON.stringify(schema.const)}`);
  if (typeof value === 'string' && schema.pattern && !dotnetRegex(schema.pattern).test(value)) out.push(`${at}: "${value}" does not match ${schema.pattern}`);
  if (typeof value === 'number' && schema.minimum !== undefined && value < schema.minimum) out.push(`${at}: below ${schema.minimum}`);
  if (typeOf(value) === 'object') {
    const props = schema.properties || {};
    for (const r of schema.required || []) if (!(r in value)) out.push(`${at}: missing required field ${r}`);
    for (const [k, v] of Object.entries(value)) {
      if (schema.propertyNames) out.push(...validate(schema.propertyNames, k, root, `${at}.${k} (name)`));
      if (k in props) out.push(...validate(props[k], v, root, `${at}.${k}`));
      else if (schema.additionalProperties === false) out.push(`${at}: unknown field ${k}`);
      else if (typeof schema.additionalProperties === 'object') out.push(...validate(schema.additionalProperties, v, root, `${at}.${k}`));
    }
    for (const [k, dep] of Object.entries(schema.dependencies || {})) {
      if (!(k in value)) continue;
      if (Array.isArray(dep)) { for (const r of dep) if (!(r in value)) out.push(`${at}: ${k} needs ${r}`); } else out.push(...validate(dep, value, root, at));
    }
  }
  if (Array.isArray(value) && schema.items) value.forEach((v, i) => out.push(...validate(schema.items, v, root, `${at}[${i}]`)));
  for (const s of schema.allOf || []) out.push(...validate(s, value, root, at));
  if (schema.anyOf && !schema.anyOf.some(s => !validate(s, value, root, at).length)) out.push(`${at}: matches none of the allowed forms (anyOf)`);
  if (schema.oneOf) {
    const n = schema.oneOf.filter(s => !validate(s, value, root, at).length).length;
    if (n !== 1) out.push(`${at}: must match exactly one allowed form (oneOf), matches ${n}`);
  }
  if (schema.not && !validate(schema.not, value, root, at).length) out.push(`${at}: matches a forbidden form (not)`);
  if (schema.if) {
    const ok = !validate(schema.if, value, root, at).length;
    if (ok && schema.then) out.push(...validate(schema.then, value, root, at));
    if (!ok && schema.else) out.push(...validate(schema.else, value, root, at));
  }
  return out;
}
