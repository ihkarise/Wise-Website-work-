/**
 * Server-side input validation and sanitization for doPost payloads.
 * Nothing reaches Sheets.gs without passing through here first
 * (docs/15-SECURITY-STANDARDS.md: "Input validation" — all fields
 * validated/sanitized server-side, no raw HTML into templates).
 */

function validateSubmission_(input) {
  var errors = [];

  if (!input || typeof input !== 'object') {
    return { valid: false, errors: ['Payload must be a JSON object.'] };
  }

  if (typeof input.condition_slug !== 'string' ||
      CONFIG.ALLOWED_CONDITION_SLUGS.indexOf(input.condition_slug) === -1) {
    errors.push('condition_slug must be one of the canonical condition slugs.');
  }

  if (typeof input.staff_submitted_note !== 'string' ||
      input.staff_submitted_note.trim().length === 0) {
    errors.push('staff_submitted_note is required.');
  } else if (input.staff_submitted_note.length > CONFIG.LIMITS.STAFF_NOTE_MAX_LENGTH) {
    errors.push('staff_submitted_note exceeds ' + CONFIG.LIMITS.STAFF_NOTE_MAX_LENGTH + ' characters.');
  }

  // Hard gate per docs/25 §9.2: consent must be explicitly true, never assumed.
  if (input.patient_consent_confirmed !== true) {
    errors.push('patient_consent_confirmed must be true; consent is a hard gate (docs/25 §9.2).');
  }

  if (typeof input.consent_confirmed_by !== 'string' ||
      input.consent_confirmed_by.trim().length === 0) {
    errors.push('consent_confirmed_by is required.');
  } else if (input.consent_confirmed_by.length > CONFIG.LIMITS.STAFF_ID_MAX_LENGTH) {
    errors.push('consent_confirmed_by exceeds ' + CONFIG.LIMITS.STAFF_ID_MAX_LENGTH + ' characters.');
  }

  if (typeof input.recipient_email !== 'string' || !isValidEmail_(input.recipient_email)) {
    errors.push('recipient_email must be a valid email address.');
  } else if (input.recipient_email.length > CONFIG.LIMITS.EMAIL_MAX_LENGTH) {
    errors.push('recipient_email exceeds ' + CONFIG.LIMITS.EMAIL_MAX_LENGTH + ' characters.');
  }

  return { valid: errors.length === 0, errors: errors };
}

function isValidEmail_(value) {
  // Deliberately simple format check; real deliverability is proven at
  // send time in a later batch (4E), not here.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function sanitizeText_(value) {
  // Strips characters that would let free text break out of the HTML
  // email template built in a later batch (4E).
  return String(value).replace(/[<>]/g, '');
}
