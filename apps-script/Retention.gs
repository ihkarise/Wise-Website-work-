/**
 * Automated retention purge (docs/25 §9.3, Batch 4F). Time-driven, not
 * manual — installed once via installRetentionTrigger_() (see below),
 * then runs on its own schedule.
 *
 * This module is deliberately independent of Review.gs, Send.gs, and
 * Email.gs: it never calls any of them, and they never call it. Its
 * only job is:
 *
 *   locate eligible rows -> clear recipient_email -> stamp purged_at -> log
 *
 * It must never modify staff_submitted_note, ai_summary_draft,
 * review_status, reviewed_by, reviewed_at, email_status, email_sent_at,
 * or error_log — only recipient_email and purged_at, and only on rows
 * that are actually eligible. Every write goes through Sheets.gs's
 * updateRowByRecordId_(), the same choke point every other module uses,
 * with an explicit field list so it is structurally impossible for this
 * module to touch a column outside that list.
 */

/**
 * Entry point for the time-driven trigger. Scans every row once, purges
 * whatever is eligible, and never lets one row's failure stop the rest.
 * Safe to run twice in a row, or twice on the same row: a row that was
 * already purged (or was never sent, or isn't old enough yet) is simply
 * skipped, not re-processed or errored on.
 */
function purgeExpiredRecipientEmails_() {
  var rows;
  try {
    rows = getAllRowObjects_();
  } catch (err) {
    logEvent_('failed', null, 'Retention purge could not read the Sheet: ' + err.message);
    return { purged: 0, skipped: 0, failed: 0 };
  }

  var purged = 0;
  var skipped = 0;
  var failed = 0;

  rows.forEach(function (row) {
    var eligibility = isEligibleForPurge_(row);
    if (!eligibility.eligible) {
      skipped++;
      return;
    }

    try {
      updateRowByRecordId_(row.record_id, {
        recipient_email: '',
        purged_at: new Date().toISOString()
      });
      purged++;
      logEvent_('purged', row.record_id, 'recipient_email cleared — retention window elapsed.');
    } catch (err) {
      // A single row's failure must never stop the batch — log it and
      // continue to the next row (docs/25 §8.3, and this batch's
      // explicit "continue processing remaining records" requirement).
      failed++;
      logEvent_('failed', row.record_id, 'Retention purge failed for this row: ' + err.message);
    }
  });

  logEvent_('purge_run_complete', null,
    'purged=' + purged + ' skipped=' + skipped + ' failed=' + failed);
  return { purged: purged, skipped: skipped, failed: failed };
}

/**
 * Pure eligibility check — no Sheet or network calls, safe to unit test
 * directly. Idempotent by construction: once purged_at is set or
 * recipient_email is already empty, a row can never become eligible
 * again, so re-running the purge (or running it concurrently) is safe.
 *
 * nowMs is an explicit parameter (defaulting to the real clock) so tests
 * don't depend on system time.
 */
function isEligibleForPurge_(row, nowMs) {
  nowMs = nowMs === undefined ? Date.now() : nowMs;

  if (!row.recipient_email) {
    return { eligible: false, reason: 'recipient_email is already empty.' };
  }
  if (row.purged_at) {
    return { eligible: false, reason: 'purged_at is already set.' };
  }
  if (!row.email_sent_at) {
    return { eligible: false, reason: 'email_sent_at is not set — no email was ever sent.' };
  }

  var sentMs = new Date(row.email_sent_at).getTime();
  if (isNaN(sentMs)) {
    return { eligible: false, reason: 'email_sent_at is not a valid date.' };
  }

  var ageMs = nowMs - sentMs;
  var retentionMs = CONFIG.RETENTION.EMAIL_RETENTION_DAYS * 24 * 60 * 60 * 1000;
  if (ageMs < retentionMs) {
    return { eligible: false, reason: 'retention window has not elapsed yet.' };
  }

  return { eligible: true, reason: null };
}

/**
 * One-time setup, run manually from the Apps Script editor (Select
 * function -> installRetentionTrigger_ -> Run). Idempotent: if the
 * trigger already exists, this does nothing rather than creating a
 * duplicate that would purge the same eligible rows twice per day.
 */
function installRetentionTrigger_() {
  var alreadyInstalled = ScriptApp.getProjectTriggers().some(function (trigger) {
    return trigger.getHandlerFunction() === 'purgeExpiredRecipientEmails_';
  });

  if (alreadyInstalled) {
    Logger.log('Retention trigger already installed — nothing to do.');
    return;
  }

  ScriptApp.newTrigger('purgeExpiredRecipientEmails_')
    .timeBased()
    .everyDays(1)
    .atHour(3)
    .create();

  Logger.log('Retention trigger installed: runs once daily, around 03:00 script time zone.');
}
