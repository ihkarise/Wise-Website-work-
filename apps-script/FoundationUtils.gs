/**
 * Foundation-layer utility helpers. Adapted from shared/utils/core.reference.js
 * version 1.0.0 — see shared/utils/core.md for the contract each function
 * must satisfy, and specifically why generateFoundationId_() uses Apps
 * Script's native Utilities.getUuid() rather than porting the reference's
 * Math.random()-based algorithm (same contract, better implementation).
 *
 * Every name here is prefixed to guarantee zero collision with Phase 1.5's
 * existing global functions now that both share one Apps Script project
 * (docs/29 §14's Decision 1) — see escapeFoundationHtml_() vs. Phase 1.5's
 * own Utils.gs escapeHtml_() for the concrete example this was written to
 * avoid.
 *
 * No dependency on any other module — leaf-level, same discipline as Phase
 * 1.5's own Utils.gs.
 */

/**
 * Returns a lowercase, hyphenated RFC 4122 v4 UUID string via Apps
 * Script's native UUID generator. Contract: shared/utils/core.md
 * "generateId()".
 */
function generateFoundationId_() {
  return Utilities.getUuid();
}

/**
 * Returns the current instant as an ISO 8601 UTC timestamp string.
 * Contract: shared/utils/core.md "nowIso()".
 */
function foundationNowIso_() {
  return new Date().toISOString();
}

/**
 * Escapes a value for safe embedding in HTML. Contract: shared/utils/core.md
 * "escapeHtml(value)". Identical algorithm to Phase 1.5's Utils.gs
 * escapeHtml_(), distinctly named to avoid a global-scope collision now
 * that both files live in the same project.
 */
function escapeFoundationHtml_(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
