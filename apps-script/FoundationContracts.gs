/**
 * Foundation-layer response envelope. Adapted from
 * shared/contracts/response-envelope.schema.json version 1.0.0 — see
 * shared/contracts/response-envelope.md for the full contract. Every
 * Foundation function reachable from outside this project's internal call
 * graph should return exactly this shape via one of the two builders
 * below, never a raw value and never a thrown exception (see
 * FoundationErrorHandling.gs, which is the only place that should call
 * buildFoundationErrorEnvelope_() for an *unexpected* failure — call sites
 * that know their own expected error cases, e.g. "not found", may call
 * either builder directly).
 *
 * No dependency on any other module — leaf-level.
 */

/**
 * Builds a success envelope. `data` may be any JSON-serializable value
 * (object, array, string, number, boolean) or omitted, in which case it
 * is normalized to null — the envelope's `data` key is always present.
 */
function buildFoundationOkEnvelope_(data) {
  return {
    status: 'ok',
    data: data === undefined ? null : data,
    error: null
  };
}

/**
 * Builds an error envelope. `code` should be a stable, machine-readable
 * identifier (e.g. "FOUNDATION_NOT_FOUND") — once shipped, a code's
 * meaning must never change; add a new one instead of repurposing it.
 * `message` must be human-readable and non-technical (docs/04 Error
 * State: "Friendly. Actionable. Never technical.") — never a raw
 * exception message or stack trace.
 */
function buildFoundationErrorEnvelope_(code, message) {
  return {
    status: 'error',
    data: null,
    error: {
      code: String(code),
      message: String(message)
    }
  };
}
