'use strict';
/**
 * Minimal, dependency-free JSON Schema validator — supports exactly the
 * subset of Draft 2020-12 actually used by shared/*.schema.json in this
 * repository: `type` (single or array-of-types), `required`,
 * `properties`, `additionalProperties` (boolean form only), `enum`,
 * `const`, `format` ("email", "date-time" — lightweight pattern checks,
 * not full RFC 3339/5322 conformance), `minLength`, and a top-level
 * `oneOf` of schema fragments (each checked against the same instance,
 * matching real JSON Schema `oneOf` semantics for a fragment that only
 * constrains a subset of properties).
 *
 * Deliberately not a general-purpose validator, and deliberately not an
 * npm package — this repo's "no dependencies beyond Node's standard
 * library" rule (validation/static-analysis/README.md,
 * validation/phase-1-5/README.md) applies here too. See
 * validation/phase-2a-foundation/README.md for exactly what this does
 * and does not check.
 */

var FORMAT_CHECKS = {
  email: function (v) { return typeof v === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); },
  'date-time': function (v) {
    return typeof v === 'string'
      && !isNaN(Date.parse(v))
      && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/.test(v);
  }
};

function typeOf(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value; // 'object', 'string', 'number', 'boolean', 'undefined'
}

function isObjectSchema(schema) {
  return schema.type === 'object' || (Array.isArray(schema.type) && schema.type.indexOf('object') !== -1);
}

function validateAgainst(schema, data, pathStr, errors) {
  if (schema.type) {
    var allowed = Array.isArray(schema.type) ? schema.type : [schema.type];
    var actual = typeOf(data);
    if (allowed.indexOf(actual) === -1) {
      errors.push(pathStr + ': expected type ' + allowed.join('|') + ', got ' + actual);
      return; // further checks on the wrong type would only add noise
    }
  }

  if (schema.const !== undefined) {
    if (JSON.stringify(data) !== JSON.stringify(schema.const)) {
      errors.push(pathStr + ': expected const ' + JSON.stringify(schema.const) + ', got ' + JSON.stringify(data));
    }
  }

  if (schema.enum) {
    if (!schema.enum.some(function (v) { return JSON.stringify(v) === JSON.stringify(data); })) {
      errors.push(pathStr + ': ' + JSON.stringify(data) + ' is not one of ' + JSON.stringify(schema.enum));
    }
  }

  if (schema.format && FORMAT_CHECKS[schema.format] && data !== null && data !== undefined) {
    if (!FORMAT_CHECKS[schema.format](data)) {
      errors.push(pathStr + ': does not match format "' + schema.format + '"');
    }
  }

  if (schema.minLength !== undefined && typeof data === 'string' && data.length < schema.minLength) {
    errors.push(pathStr + ': length ' + data.length + ' is below minLength ' + schema.minLength);
  }

  if (isObjectSchema(schema) && typeOf(data) === 'object') {
    (schema.required || []).forEach(function (key) {
      if (!Object.prototype.hasOwnProperty.call(data, key)) {
        errors.push(pathStr + ': missing required property "' + key + '"');
      }
    });
    if (schema.properties) {
      Object.keys(schema.properties).forEach(function (key) {
        if (Object.prototype.hasOwnProperty.call(data, key)) {
          validateAgainst(schema.properties[key], data[key], pathStr + '.' + key, errors);
        }
      });
    }
    if (schema.additionalProperties === false) {
      Object.keys(data).forEach(function (key) {
        if (!schema.properties || !Object.prototype.hasOwnProperty.call(schema.properties, key)) {
          errors.push(pathStr + ': unexpected property "' + key + '" not defined in the schema');
        }
      });
    }
  }

  if (schema.oneOf) {
    var matchCount = schema.oneOf.filter(function (branch) {
      var branchErrors = [];
      validateAgainst(Object.assign({ type: schema.type }, branch), data, pathStr, branchErrors);
      return branchErrors.length === 0;
    }).length;
    if (matchCount !== 1) {
      errors.push(pathStr + ': matched ' + matchCount + ' of oneOf\'s branches, expected exactly 1');
    }
  }
}

/**
 * Validates `data` against `schema`. Returns `{valid, errors}` — never
 * throws on a mismatch; an invalid instance is an expected outcome, not
 * an error, matching this repo's own response-envelope convention.
 */
function validate(schema, data) {
  var errors = [];
  validateAgainst(schema, data, '$', errors);
  return { valid: errors.length === 0, errors: errors };
}

module.exports = { validate: validate };
