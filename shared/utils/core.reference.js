/**
 * shared/utils/core.reference.js — version 1.0.0
 *
 * Canonical reference implementation for three small, algorithmic helpers
 * used across Foundation and future Phase 2A backend code. See core.md for
 * the contract each function must satisfy and notes on where a runtime
 * (e.g. Apps Script) should use its own native primitive instead of this
 * exact algorithm — the contract is the output shape, not this file's
 * specific implementation.
 *
 * Plain, portable functions only: no `import`/`export`, no framework, no
 * dependency on anything outside this file. Runnable directly in Node for
 * testing (`node shared/utils/core.reference.js`); never loaded at runtime
 * by any implementation — see shared/README.md.
 */

/**
 * Returns a lowercase, hyphenated RFC 4122 v4 UUID string, e.g.
 * "3fa85f64-5717-4562-b3fc-2c963f66afa6".
 *
 * Contract: a 36-character string, five hyphen-separated groups
 * (8-4-4-4-12 hex digits), version nibble "4", variant nibble one of
 * "8"/"9"/"a"/"b". This reference implementation is illustrative — Apps
 * Script's own `Utilities.getUuid()` already satisfies this exact contract
 * and is what `apps-script/FoundationUtils.gs` actually uses; see core.md.
 */
function generateId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    var r = (Math.random() * 16) | 0;
    var v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Returns the current instant as an ISO 8601 timestamp string, e.g.
 * "2026-07-02T18:04:11.123Z". Always UTC ("Z" suffix), always
 * millisecond-precision — matches the timestamp format already used
 * throughout Phase 1.5's schema (docs/12, docs/25 §5.1).
 */
function nowIso() {
  return new Date().toISOString();
}

/**
 * Escapes a value for safe embedding in HTML — neutralizes the five
 * characters that matter for HTML injection (&, <, >, ", '). Contract:
 * input is coerced to a string first (never throws on a non-string
 * input); output is safe to embed in an HTML text or attribute context.
 *
 * Same algorithm Phase 1.5's apps-script/Utils.gs already uses for
 * escapeHtml_() — this reference formalizes it as a shared contract
 * rather than a Phase-1.5-specific helper, since Foundation needs the
 * identical behavior under a distinct name (apps-script/FoundationUtils.gs's
 * escapeFoundationHtml_(), to avoid colliding with Phase 1.5's own
 * escapeHtml_() now that both live in the same Apps Script project).
 */
function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
