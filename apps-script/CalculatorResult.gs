/**
 * Calculator Result — Batch PXP-6 (docs/44-PHASE-2B-TECHNICAL-PLAN.md §8.2,
 * §11.4, §22; ADR-013; docs/47-PHASE-2B-IMPLEMENTATION-RULES.md governs this
 * and every later batch). Implements shared/schemas/calculator-result.schema.json
 * version 1.0.0. Phase 2B's Pillar 3 (docs/44 §4.1) — a patient's permanently-
 * recorded computation against one Calculator Registry entry
 * (CalculatorRegistry.gs). This batch ships no dashboard card or patient-
 * facing UI (see CalculatorRegistry.gs's own header comment and
 * shared/constants/calculator-registry.md's "No Module Registry entry, no
 * dashboard UI in this batch" section) — these are the generic
 * create/list routes a future Calculator UI batch would call once a real
 * calculator exists to compute against.
 *
 * Create and list only, both scoped strictly to the session-derived
 * patient_id (ADR-002) — the same lifecycle FoundationSymptomLog.gs/
 * CheckInResponse.gs already established. No update, no delete, no
 * per-entry get-by-id (no product requirement for one, mirroring
 * CheckInResponse.gs's own disclosed scope boundary).
 *
 * ---- JSON storage: docs/44 §11.4's policy, this platform's second use ----
 * `input_snapshot` is stored as a JSON-encoded string in a single Sheet
 * cell — the same disclosed exception to ADR-006's flat-column convention
 * CheckInResponse.gs's `answers` already established (its own header
 * comment names CalculatorResult as this policy's anticipated second use).
 * Every function that returns a CalculatorResult record to a caller
 * (foundationCreateCalculatorResult_(), foundationGetPatientCalculatorResults_())
 * returns `input_snapshot` as a real, parsed object — matching
 * shared/schemas/calculator-result.schema.json's own contract
 * (shared/README.md's "Contract vs. implementation-only detail").
 *
 * Validation, at write time, enforces every docs/44 §11.4 rule:
 * `input_snapshot` must be a flat object (no nested objects/arrays); every
 * present field_key must exist in the referenced (calculator_slug,
 * definition_version)'s own input_fields list; every `required` input field
 * must be present; every value must satisfy its declared type/min/max; the
 * referenced (calculator_slug, definition_version) pair must be a real
 * Calculator Registry entry (CalculatorRegistry.gs) — impossible to satisfy
 * today since that registry ships empty, so every create call is rejected
 * until a future batch registers a real calculator, the same fail-closed-
 * by-absence discipline every other registry-backed entity in this
 * repository already exhibits. Unlike CheckInResponse.gs, there is no
 * assignment-style enforcement step here — docs/44 §8.4 settles that
 * calculator visibility is governed by PatientModuleState (§7.2) alone,
 * once a future batch wires a calculator into the Module Registry; this
 * generic write path itself has no assignment concept to enforce.
 * `result_value` is never computed here — see this file's own header note
 * above and CalculatorRegistry.gs's "no formula-execution logic" statement.
 * Serialization is deterministic — keys written in the calculator's own
 * input_fields-list order (foundationBuildDeterministicCalculatorInputSnapshot_())
 * — so re-serializing identical inputs never produces a spurious
 * byte-level diff, the concrete, checkable property docs/44 §11.4 names.
 *
 * Not Foundation-prefixed, for the same reason CheckInResponse.gs isn't
 * generic infrastructure (docs/29 §2): a concrete entity built on
 * Foundation's frozen infrastructure. Zero modification to any frozen
 * Foundation/Identity & Access/Patient Access/PXP-1..5 file — reuses
 * FoundationDataStore.gs's existing generic insert/query operations and
 * FoundationAudit.gs's existing foundationLogAuditEvent_() exactly as both
 * were already designed to be reused (ADR-009).
 *
 * Depends on CalculatorRegistry.gs, FoundationDataStore.gs,
 * FoundationAudit.gs, FoundationUtils.gs, FoundationContracts.gs,
 * FoundationErrorHandling.gs.
 */

var FOUNDATION_CALCULATOR_RESULTS_SHEET_ = 'CalculatorResults';
var FOUNDATION_CALCULATOR_RESULTS_COLUMNS_ = ['record_id', 'patient_id', 'calculator_slug', 'definition_version', 'input_snapshot', 'result_value', 'computed_at'];

// Mirrors CheckInResponse.gs's FOUNDATION_CHECKIN_RESPONSES_MAX_ENTRIES_ — a
// local constant, not FoundationConfig.gs (Foundation's ten files are
// frozen, docs/35 §9).
var FOUNDATION_CALCULATOR_RESULTS_MAX_ENTRIES_ = 50;

// The real, server-side size bound docs/44 §11.4 requires, mirroring
// CheckInResponse.gs's FOUNDATION_CHECKIN_ANSWERS_MAX_BYTES_ exactly,
// applied here to the serialized input_snapshot JSON text.
var FOUNDATION_CALCULATOR_INPUT_SNAPSHOT_MAX_BYTES_ = 8192;

// ---- Pure helpers — no Apps Script dependency, covered by Conformance Tests ----

/**
 * Returns an array of human-readable error strings (empty if
 * `inputSnapshot` is valid against `inputFields`, the exact ordered
 * input-field list of one Calculator Registry version). Mirrors
 * foundationValidateCheckInAnswers_() exactly, generalized field names
 * only (`inputFields`/`input_snapshot` instead of `questions`/`answers`).
 */
function foundationValidateCalculatorInputSnapshot_(inputFields, inputSnapshot) {
  var errors = [];
  if (!inputSnapshot || typeof inputSnapshot !== 'object' || Array.isArray(inputSnapshot)) {
    errors.push('input_snapshot must be a flat object.');
    return errors;
  }
  var knownFieldKeys = inputFields.map(function (f) { return f.field_key; });
  Object.keys(inputSnapshot).forEach(function (key) {
    if (knownFieldKeys.indexOf(key) === -1) {
      errors.push('input_snapshot contains an unrecognized field "' + key + '".');
      return;
    }
    var value = inputSnapshot[key];
    if (value !== null && typeof value === 'object') {
      errors.push('input_snapshot.' + key + ' must be a flat value, not an object or array (docs/44 §11.4).');
    }
  });
  inputFields.forEach(function (f) {
    var hasValue = Object.prototype.hasOwnProperty.call(inputSnapshot, f.field_key) && inputSnapshot[f.field_key] !== null && inputSnapshot[f.field_key] !== undefined;
    if (f.required && !hasValue) {
      errors.push(f.field_key + ' is required.');
      return;
    }
    if (!hasValue) {
      return;
    }
    var value = inputSnapshot[f.field_key];
    if (f.type === 'number') {
      if (typeof value !== 'number' || isNaN(value)) {
        errors.push(f.field_key + ' must be a number.');
      } else {
        if (f.min !== undefined && value < f.min) {
          errors.push(f.field_key + ' must be at least ' + f.min + '.');
        }
        if (f.max !== undefined && value > f.max) {
          errors.push(f.field_key + ' must be at most ' + f.max + '.');
        }
      }
    } else if (f.type === 'boolean') {
      if (typeof value !== 'boolean') {
        errors.push(f.field_key + ' must be true or false.');
      }
    } else if (f.type === 'string') {
      if (typeof value !== 'string') {
        errors.push(f.field_key + ' must be a string.');
      }
    }
  });
  return errors;
}

/**
 * Returns a new object containing only `inputSnapshot`'s fields that are
 * actually present, keyed in `inputFields`' own declared order — the
 * deterministic serialization docs/44 §11.4 requires, mirroring
 * foundationBuildDeterministicCheckInAnswers_() exactly.
 */
function foundationBuildDeterministicCalculatorInputSnapshot_(inputFields, inputSnapshot) {
  var ordered = {};
  inputFields.forEach(function (f) {
    var hasValue = Object.prototype.hasOwnProperty.call(inputSnapshot, f.field_key) && inputSnapshot[f.field_key] !== null && inputSnapshot[f.field_key] !== undefined;
    if (!hasValue) {
      return;
    }
    var value = inputSnapshot[f.field_key];
    ordered[f.field_key] = typeof value === 'string' ? value.trim() : value;
  });
  return ordered;
}

/**
 * Returns an array of human-readable error strings (empty if `input` is
 * valid) for the request body's own shape — the deeper Calculator Registry
 * lookup happens in foundationCreateCalculatorResult_() itself, mirroring
 * foundationValidateCheckInResponseInput_()'s "pure shape check first,
 * registry check after" discipline.
 */
function foundationValidateCalculatorResultInput_(input) {
  var errors = [];
  if (!input || typeof input.patient_id !== 'string' || input.patient_id.trim() === '') {
    errors.push('patient_id is required.');
  }
  if (!input || typeof input.calculator_slug !== 'string' || input.calculator_slug.trim() === '') {
    errors.push('calculator_slug is required.');
  }
  if (!input || typeof input.definition_version !== 'number' || !Number.isInteger(input.definition_version) || input.definition_version < 1) {
    errors.push('definition_version must be a positive integer.');
  }
  if (!input || !input.input_snapshot || typeof input.input_snapshot !== 'object' || Array.isArray(input.input_snapshot)) {
    errors.push('input_snapshot must be a flat object.');
  }
  if (!input || (typeof input.result_value !== 'number' && typeof input.result_value !== 'string') || input.result_value === '') {
    errors.push('result_value is required and must be a number or a non-empty string.');
  }
  return errors;
}

/**
 * Converts one Sheets row (a raw record with `input_snapshot` still a JSON
 * string) into this entity's real, contractual API shape —
 * `input_snapshot` parsed back into an object, per this file's own header
 * comment on the contract boundary. Mirrors foundationCheckInRowToApiShape_()
 * exactly, including its fail-soft degrade-to-empty-object behavior for a
 * malformed stored string (should never happen — every write path
 * serializes via JSON.stringify()).
 */
function foundationCalculatorResultRowToApiShape_(row) {
  var parsedInputSnapshot;
  try {
    parsedInputSnapshot = JSON.parse(row.input_snapshot || '{}');
  } catch (err) {
    parsedInputSnapshot = {};
  }
  return {
    record_id: row.record_id,
    patient_id: row.patient_id,
    calculator_slug: row.calculator_slug,
    definition_version: row.definition_version,
    input_snapshot: parsedInputSnapshot,
    result_value: row.result_value,
    computed_at: row.computed_at
  };
}

/**
 * Sorts two entries for full-history display: computed_at descending.
 * Mirrors foundationCompareCheckInResponsesDesc_() exactly.
 */
function foundationCompareCalculatorResultsDesc_(a, b) {
  if (a.computed_at !== b.computed_at) {
    return a.computed_at < b.computed_at ? 1 : -1;
  }
  return 0;
}

// ---- Sheets-backed operations ----

/**
 * Creates a new Calculator Result entry. `input.patient_id` must already be
 * session-derived by the caller (ADR-002) — this function never re-derives
 * it. Validation failure is an expected outcome (direct envelope, not the
 * generic wrapper), the same convention every other Foundation entity's
 * create function already follows. Order of checks: (1) request shape, (2)
 * the referenced (calculator_slug, definition_version) is a real Calculator
 * Registry entry (always false today — the registry ships empty, docs/44
 * §11.4's fail-closed-by-absence discipline), (3) input_snapshot validates
 * against that version's own input_fields, (4) the serialized size bound.
 */
function foundationCreateCalculatorResult_(input) {
  var errors = foundationValidateCalculatorResultInput_(input);
  if (errors.length > 0) {
    return buildFoundationErrorEnvelope_('FOUNDATION_INVALID_INPUT', errors.join(' '));
  }

  var patientId = input.patient_id.trim();
  var calculatorSlug = input.calculator_slug.trim();

  var calculator = foundationGetCalculatorBySlugAndVersion_(calculatorSlug, input.definition_version);
  if (!calculator) {
    return buildFoundationErrorEnvelope_('FOUNDATION_INVALID_INPUT', 'calculator_slug/definition_version does not match a real Calculator Registry entry.');
  }

  var inputErrors = foundationValidateCalculatorInputSnapshot_(calculator.input_fields, input.input_snapshot);
  if (inputErrors.length > 0) {
    return buildFoundationErrorEnvelope_('FOUNDATION_INVALID_INPUT', inputErrors.join(' '));
  }

  var deterministicInputSnapshot = foundationBuildDeterministicCalculatorInputSnapshot_(calculator.input_fields, input.input_snapshot);
  var inputSnapshotJson = JSON.stringify(deterministicInputSnapshot);
  if (inputSnapshotJson.length > FOUNDATION_CALCULATOR_INPUT_SNAPSHOT_MAX_BYTES_) {
    return buildFoundationErrorEnvelope_('FOUNDATION_INVALID_INPUT', 'Your calculator inputs are too long.');
  }

  return withFoundationErrorHandling_(function () {
    var recordId = generateFoundationId_();
    var sheetRow = {
      record_id: recordId,
      patient_id: patientId,
      calculator_slug: calculatorSlug,
      definition_version: input.definition_version,
      input_snapshot: inputSnapshotJson,
      result_value: input.result_value,
      computed_at: foundationNowIso_()
    };
    foundationDsInsert_(FOUNDATION_CALCULATOR_RESULTS_SHEET_, FOUNDATION_CALCULATOR_RESULTS_COLUMNS_, sheetRow);
    foundationLogAuditEvent_('calculator_result_created', patientId, patientId, 'record_id=' + recordId + ';calculator_slug=' + calculatorSlug + ';definition_version=' + input.definition_version);
    return foundationCalculatorResultRowToApiShape_(sheetRow);
  });
}

/**
 * Returns `patientId`'s own Calculator Result entries, sorted newest-first
 * and capped at FOUNDATION_CALCULATOR_RESULTS_MAX_ENTRIES_, each converted
 * to this entity's contractual API shape (`input_snapshot` parsed, never
 * the raw stored JSON string). `patientId` must already be session-verified
 * by the caller (ADR-002) — this function never re-derives it.
 */
function foundationGetPatientCalculatorResults_(patientId) {
  return withFoundationErrorHandling_(function () {
    var rows = foundationDsQuery_(FOUNDATION_CALCULATOR_RESULTS_SHEET_, FOUNDATION_CALCULATOR_RESULTS_COLUMNS_, function (row) {
      return row.patient_id === patientId;
    });
    rows.sort(function (a, b) { return foundationCompareCalculatorResultsDesc_(a, b); });
    return rows.slice(0, FOUNDATION_CALCULATOR_RESULTS_MAX_ENTRIES_).map(foundationCalculatorResultRowToApiShape_);
  });
}
