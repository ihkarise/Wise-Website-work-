/**
 * Application-level access gate for the Web App endpoint.
 *
 * Google Workspace's "Anyone within [domain]" Web App access mode
 * (the original appsscript.json access: DOMAIN) does not exist for Web
 * Apps deployed from a personal Google account — it is a Workspace-only
 * infrastructure control. Deploying from a personal account instead uses
 * access: ANYONE_ANONYMOUS (a public URL), so this module is the
 * replacement control: every request must carry a shared secret before
 * doPost does anything else. This is the free-tier equivalent of the
 * domain restriction, not a lesser stand-in for it — see
 * apps-script/README.md's "Access control" section for the tradeoffs and
 * the migration path back to a Workspace domain restriction later.
 *
 * STAFF_ACCESS_CODE lives only in Script Properties (Project Settings ->
 * Script Properties), same as OPENROUTER_API_KEY — never committed to
 * this repo, never logged, never echoed back in a response.
 */
function verifyAccessCode_(providedCode) {
  var expected = PropertiesService.getScriptProperties().getProperty('STAFF_ACCESS_CODE');
  // Fails closed: an unset access code must never be treated as "open to
  // anyone" — that would silently turn the public URL into an
  // unauthenticated write endpoint.
  if (!expected) {
    return false;
  }
  return typeof providedCode === 'string' && providedCode.length > 0 && providedCode === expected;
}
