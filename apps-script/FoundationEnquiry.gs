/**
 * Public Consultation Enquiry — the GitLab-compatible replacement for the
 * Netlify Forms handler that previously backed contact.html.
 *
 * WHY THIS EXISTS
 * The public enquiry form carried the site's consent evidence (privacy
 * consent, the under-18 declaration, the guardian declaration and the
 * marketing opt-in) through Netlify Forms. Netlify is being removed as a
 * production dependency, and GitLab Pages is static with no forms service,
 * so that evidence needed a real backend. Rather than introduce a new one,
 * this reuses the existing Apps Script + Sheets architecture.
 *
 * SCOPE — deliberately narrow
 * This is NOT a general-purpose unauthenticated write API. It exposes
 * exactly one action, accepts exactly the fields contact.html submits,
 * and writes exactly one fixed sheet with a fixed column list. It accepts
 * no sheet name, no range, no column list, no entity name and no function
 * name from the request. It touches no patient record: an enquiry is from
 * a member of the public who may never become a patient, and is kept in
 * its own sheet, never in Patients or PatientProfile (ADR-002 — an enquiry
 * is not a patient identity).
 *
 * SECURITY POSTURE — what is actually implemented here
 *   - Strict allow-list validation of every field, with maximum lengths.
 *   - A honeypot field that silently succeeds rather than revealing itself.
 *   - Per-email rate limiting in its own cache namespace, using the same
 *     hashed-key discipline as FoundationRateLimit.gs.
 *   - Spreadsheet formula-injection neutralisation on every free-text value
 *     before it is written (a leading = + - @ is prefixed with a quote), so
 *     a submission can never become a live formula in the clinic's sheet.
 *   - Server-side timestamping; submitted_at is never taken from the client.
 *   - Generic outward error messages; details go to the audit log only.
 *   - No secret of any kind is involved, so none can leak to the frontend:
 *     the Web App URL is a public endpoint by design, exactly as it already
 *     is for request_login_link.
 *
 * WHAT IS *NOT* IMPLEMENTED, and is not claimed
 *   - There is no CAPTCHA/hCaptcha/reCAPTCHA. None is configured anywhere in
 *     this repository and no key exists, so no bot-protection claim is made
 *     beyond the honeypot and the rate limit above.
 *   - Apps Script Web Apps cannot set custom response headers, so CORS
 *     cannot be restricted to a specific origin at this layer. This is a
 *     platform limitation, identical to the one request_login_link already
 *     lives with, and it is the reason the endpoint is write-only, returns
 *     no personal data, and accepts nothing that could mutate a patient
 *     record. Documented rather than papered over.
 *
 * Depends on: FoundationDataStore.gs, FoundationContracts.gs,
 * FoundationErrorHandling.gs, FoundationUtils.gs, FoundationAuditLog.gs.
 */

var FOUNDATION_ENQUIRY_SHEET_ = 'ConsultationEnquiries';
var FOUNDATION_ENQUIRY_COLUMNS_ = [
  'enquiry_id', 'submitted_at', 'name', 'email', 'phone', 'country',
  'consultation_type', 'condition', 'message',
  'enquiry_for_minor', 'guardian_declared', 'privacy_consent', 'marketing_consent'
];

// Field bounds. Chosen to match what contact.html's own inputs allow, so a
// legitimate submission is never rejected for length.
var FOUNDATION_ENQUIRY_MAX_ = {
  name: 120,
  email: 200,
  phone: 20,
  country: 60,
  consultation_type: 60,
  condition: 200,
  message: 2000
};

// Its own rate-limit namespace and budget — deliberately separate from
// FoundationRateLimit.gs's login-link budget, so enquiry traffic and
// login-link traffic can never exhaust each other.
var FOUNDATION_ENQUIRY_RATE_LIMIT_WINDOW_SECONDS_ = 900;
var FOUNDATION_ENQUIRY_RATE_LIMIT_MAX_REQUESTS_ = 5;

// ---- Pure helpers — no Apps Script dependency beyond Utilities ----

/**
 * Neutralises a value that a spreadsheet would otherwise evaluate as a
 * formula. A leading =, +, - or @ is prefixed with a single quote, which
 * Sheets treats as "this is text". Applied to every free-text field on the
 * way in, because this is the one place on the platform where completely
 * untrusted public input reaches a sheet the clinic reads.
 */
function foundationEnquiryNeutralizeFormula_(value) {
  var text = String(value == null ? '' : value);
  return /^[=+\-@]/.test(text) ? "'" + text : text;
}

/**
 * Returns an array of human-readable error strings (empty if valid).
 * Allow-list validation: anything not named here is ignored entirely and
 * never reaches the sheet.
 */
function foundationValidateEnquiryInput_(input) {
  var errors = [];
  if (!input || typeof input !== 'object') {
    return ['No enquiry was submitted.'];
  }

  if (typeof input.name !== 'string' || input.name.trim() === '') {
    errors.push('Please tell us your name.');
  } else if (input.name.trim().length > FOUNDATION_ENQUIRY_MAX_.name) {
    errors.push('Name must be ' + FOUNDATION_ENQUIRY_MAX_.name + ' characters or fewer.');
  }

  if (typeof input.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())) {
    errors.push('Please enter a valid email address.');
  } else if (input.email.trim().length > FOUNDATION_ENQUIRY_MAX_.email) {
    errors.push('Email must be ' + FOUNDATION_ENQUIRY_MAX_.email + ' characters or fewer.');
  }

  if (input.phone !== undefined && input.phone !== null && input.phone !== '') {
    if (typeof input.phone !== 'string' || !/^[0-9+\-()\s]{7,20}$/.test(input.phone.trim())) {
      errors.push('Phone must be 7-20 characters using only digits, spaces, and + - ( ) when provided.');
    }
  }

  ['country', 'consultation_type', 'condition', 'message'].forEach(function (field) {
    var value = input[field];
    if (value === undefined || value === null || value === '') { return; }
    if (typeof value !== 'string') {
      errors.push(field + ' must be text.');
    } else if (value.trim().length > FOUNDATION_ENQUIRY_MAX_[field]) {
      errors.push(field + ' must be ' + FOUNDATION_ENQUIRY_MAX_[field] + ' characters or fewer.');
    }
  });

  // Consent evidence. privacy_consent is the one substantive gate: without
  // it there is no lawful basis recorded for handling what was submitted,
  // so the submission is refused rather than stored.
  if (input.privacy_consent !== true) {
    errors.push('Please confirm you have read the Privacy Policy before sending.');
  }
  if (input.enquiry_for_minor !== 'yes' && input.enquiry_for_minor !== 'no') {
    errors.push('Please tell us whether this enquiry is about someone under 18.');
  }
  if (input.enquiry_for_minor === 'yes' && input.guardian_declared !== true) {
    errors.push('An enquiry about someone under 18 must be sent by their parent or legal guardian.');
  }
  return errors;
}

/**
 * Builds the row. enquiry_id and submitted_at are server-set; every
 * free-text value is formula-neutralised and trimmed to its bound.
 */
function foundationBuildEnquiryRecord_(input, enquiryId, nowIso) {
  function text(field) {
    var raw = String(input[field] == null ? '' : input[field]).trim().slice(0, FOUNDATION_ENQUIRY_MAX_[field]);
    return foundationEnquiryNeutralizeFormula_(raw);
  }
  return {
    enquiry_id: enquiryId,
    submitted_at: nowIso,
    name: text('name'),
    email: text('email'),
    phone: text('phone'),
    country: text('country'),
    consultation_type: text('consultation_type'),
    condition: text('condition'),
    message: text('message'),
    enquiry_for_minor: input.enquiry_for_minor === 'yes' ? 'yes' : 'no',
    guardian_declared: input.guardian_declared === true ? 'yes' : 'no',
    privacy_consent: 'yes',
    marketing_consent: input.marketing_consent === true ? 'yes' : 'no'
  };
}

/**
 * Per-email enquiry rate-limit key, hashed, in this feature's own
 * namespace. Mirrors foundationRateLimitCacheKey_'s reasoning.
 */
function foundationEnquiryRateLimitCacheKey_(email) {
  var normalized = String(email).trim().toLowerCase();
  var digestBytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, normalized);
  var hex = digestBytes.map(function (b) {
    var unsigned = b < 0 ? b + 256 : b;
    var hexStr = unsigned.toString(16);
    return hexStr.length === 1 ? '0' + hexStr : hexStr;
  }).join('');
  return 'foundation_enquiry_rl_' + hex;
}

/**
 * Returns true and increments if `email` is within budget. Fails OPEN on a
 * CacheService error, the same deliberate trade-off FoundationRateLimit.gs
 * documents: a cache outage must not block a patient from reaching a clinic.
 */
function foundationEnquiryCheckAndIncrementRateLimit_(email) {
  try {
    var cache = CacheService.getScriptCache();
    var key = foundationEnquiryRateLimitCacheKey_(email);
    var current = parseInt(cache.get(key), 10);
    if (isNaN(current)) current = 0;
    if (current >= FOUNDATION_ENQUIRY_RATE_LIMIT_MAX_REQUESTS_) {
      return false;
    }
    cache.put(key, String(current + 1), FOUNDATION_ENQUIRY_RATE_LIMIT_WINDOW_SECONDS_);
    return true;
  } catch (err) {
    Logger.log('FoundationEnquiry: CacheService error, failing open: ' + (err && err.message ? err.message : err));
    return true;
  }
}

// ---- Public, unauthenticated route handler ----

/**
 * Handles `request_consultation`. Public and unauthenticated by design —
 * the same category as request_login_link. Never reads or writes any
 * patient record, and returns no personal data in its response.
 *
 * The caller may only treat the enquiry as received when the returned
 * envelope is status 'ok' AND carries an enquiry_id: that id exists only
 * after the row was actually appended.
 */
function foundationHandleRequestConsultation_(input) {
  // Honeypot: a real visitor never fills this. Return the ordinary success
  // shape so a bot learns nothing, but write nothing and log it.
  if (input && typeof input.bot_field === 'string' && input.bot_field.trim() !== '') {
    foundationLogAuditEvent_('enquiry_honeypot_rejected', '', '', '');
    return buildFoundationOkEnvelope_({ enquiry_id: '', message: 'Your enquiry has been received.' });
  }

  var errors = foundationValidateEnquiryInput_(input);
  if (errors.length > 0) {
    // Direct envelope, never from inside withFoundationErrorHandling_ —
    // that wrapper wraps its return value in an ok-envelope.
    return buildFoundationErrorEnvelope_('FOUNDATION_INVALID_INPUT', errors.join(' '));
  }

  if (!foundationEnquiryCheckAndIncrementRateLimit_(input.email)) {
    foundationLogAuditEvent_('enquiry_rate_limited', '', '', '');
    return buildFoundationErrorEnvelope_(
      'FOUNDATION_ENQUIRY_RATE_LIMITED',
      'You have sent several enquiries recently. Please wait a few minutes, or contact the clinic directly on WhatsApp.'
    );
  }

  return withFoundationErrorHandling_(function () {
    var enquiryId = generateFoundationId_();
    var record = foundationBuildEnquiryRecord_(input, enquiryId, foundationNowIso_());
    foundationDsInsert_(FOUNDATION_ENQUIRY_SHEET_, FOUNDATION_ENQUIRY_COLUMNS_, record);
    foundationLogAuditEvent_('consultation_enquiry_received', '', '',
      'enquiry_id=' + enquiryId +
      ';for_minor=' + record.enquiry_for_minor +
      ';guardian_declared=' + record.guardian_declared +
      ';marketing_consent=' + record.marketing_consent);
    // Deliberately echoes back no submitted content — only the receipt id.
    return { enquiry_id: enquiryId, message: 'Your enquiry has been received.' };
  });
}
