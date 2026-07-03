/**
 * Basic per-email rate limiting for Foundation's public, unauthenticated
 * login-link-request endpoint — docs/29 §10's "New consideration Phase
 * 1.5 didn't have: ... mitigate account-enumeration and email-bombing
 * with an identical response regardless of match, plus basic per-email/
 * per-IP rate limiting on link requests (ADR-010)."
 *
 * Per-IP limiting is deliberately not implemented, stated openly rather
 * than silently dropped: Apps Script Web Apps never expose a caller's IP
 * address to doPost(e) — the event object carries only
 * parameter/parameters/postData/contentLength/queryString, no IP field,
 * on this platform. This is a real, verified constraint of the runtime,
 * not an oversight. Per-email limiting (below) is the concrete mitigation
 * for both concerns docs/29 §10 names — enumeration probing and
 * email-bombing both require repeatedly naming an email address, which
 * this file directly bounds regardless of the caller's network origin.
 *
 * Uses CacheService, not a Sheet — a rate-limit counter is inherently
 * ephemeral, so a Sheet-backed row per counter would be over-abstraction
 * at pilot scale (ADR-006), the same reasoning shared/schemas/login-token.md
 * already applied to avoid a second HMAC secret. Script-level cache
 * (shared across every execution of this project), never user-level.
 *
 * Fails open on a CacheService error, a deliberate and documented
 * exception to ADR-010's "more secure default" (which itself permits
 * exactly this: "any exception is a deliberate, documented, reviewed
 * decision — never a silent one"). The reasoning: this layer is a
 * supplementary abuse mitigation, not the login flow's actual security
 * boundary — that boundary is FoundationLoginTokens.gs's single-use,
 * short-TTL, generically-rejected token (IA-1), which does not depend on
 * this file at all. Failing closed here would turn a transient Cache
 * hiccup into a full outage of a patient-facing public endpoint, a worse
 * outcome than a brief lapse in a secondary mitigation.
 *
 * Depends on nothing else in this project — CacheService and Utilities
 * are platform primitives, the same leaf-level standing FoundationUtils.gs
 * and FoundationContracts.gs already have.
 */

// 15 minutes — matches FoundationLoginTokens.gs's own token TTL window,
// so "how often can this email request a link" and "how long is a link
// valid" reason about the same window.
var FOUNDATION_RATE_LIMIT_WINDOW_SECONDS_ = 900;

// A deliberately small budget — "basic" rate limiting per docs/29 §10,
// not a tuned production value. Revisit once real traffic exists.
var FOUNDATION_RATE_LIMIT_MAX_REQUESTS_ = 3;

/**
 * Returns a cache key namespaced to this feature, keyed by a hash of the
 * normalized email rather than the raw address — cheap defense-in-depth
 * consistent with docs/30 §3's "minimal data collection," and keeps the
 * key well under CacheService's key-length limit regardless of address
 * length.
 */
function foundationRateLimitCacheKey_(email) {
  var normalized = String(email).trim().toLowerCase();
  var digestBytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, normalized);
  var hex = digestBytes.map(function (b) {
    var unsigned = b < 0 ? b + 256 : b;
    var hexStr = unsigned.toString(16);
    return hexStr.length === 1 ? '0' + hexStr : hexStr;
  }).join('');
  return 'foundation_login_link_rl_' + hex;
}

/**
 * Returns true and increments the counter if `email` is still within its
 * request budget for the current window; returns false (without
 * incrementing further) once the budget is spent. See this file's header
 * for the fail-open behavior on a CacheService error.
 */
function foundationCheckAndIncrementRateLimit_(email) {
  try {
    var cache = CacheService.getScriptCache();
    var key = foundationRateLimitCacheKey_(email);
    var current = parseInt(cache.get(key), 10);
    if (isNaN(current)) current = 0;
    if (current >= FOUNDATION_RATE_LIMIT_MAX_REQUESTS_) {
      return false;
    }
    cache.put(key, String(current + 1), FOUNDATION_RATE_LIMIT_WINDOW_SECONDS_);
    return true;
  } catch (err) {
    Logger.log('FoundationRateLimit: CacheService error, failing open: ' + (err && err.message ? err.message : err));
    return true;
  }
}
