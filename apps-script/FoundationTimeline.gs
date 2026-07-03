/**
 * Timeline merge layer — Batch PA-4 (docs/29 §13 Batch 5E). Implements the
 * read side of shared/schemas/timeline-entry.schema.json version 1.0.0:
 * merges ConsultationHistory (via FoundationConsultationHistory.gs's own,
 * completely unmodified foundationGetPatientTimeline_()) with the
 * patient's *submitted* Symptom Log entries (FoundationSymptomLog.gs's
 * foundationGetSubmittedSymptomLogsForTimeline_()) into one
 * reverse-chronological feed — per docs/41-SYMPTOM-TRACKER-READINESS-REVIEW.md's
 * approved decision that submitted Symptom Log entries appear in Timeline,
 * while drafts never do.
 *
 * A new file, not a modification to FoundationConsultationHistory.gs
 * (frozen since PA-3, docs/38 §9) — this file depends on it and on
 * FoundationSymptomLog.gs, calling only their existing, already-exported
 * functions. FoundationRouter.gs's get_timeline case is repointed at this
 * file's foundationGetPatientTimelineMerged_() instead of
 * FoundationConsultationHistory.gs's foundationGetPatientTimeline_()
 * directly — a disclosed, additive exception to FoundationRouter.gs (see
 * that file's own header comment, already an established extension
 * point), not a change to FoundationConsultationHistory.gs itself, which
 * remains untouched and still independently callable exactly as PA-3 left
 * it (e.g. by a future feature that wants ConsultationHistory alone).
 *
 * get_timeline_entry is unaffected — no detail-view lookup exists for a
 * symptom_log-sourced Timeline entry (docs/41 §2, timeline-entry.md);
 * FoundationConsultationHistory.gs's foundationGetConsultationEntryById_()
 * continues to serve only ConsultationHistory detail fetches, unchanged.
 *
 * Depends on FoundationConsultationHistory.gs, FoundationSymptomLog.gs,
 * FoundationErrorHandling.gs, FoundationUtils.gs.
 */

var FOUNDATION_TIMELINE_MAX_ENTRIES_ = 50;

// ---- Pure helpers — no Apps Script dependency, covered by Conformance Tests ----

/**
 * Builds a human-readable summary for a submitted Symptom Log entry, read
 * at Timeline-render time — never persisted (shared/schemas/timeline-entry.md).
 * Only mentions fields that were actually set; a note is appended, never
 * shown alone without indicating which scale values (if any) were logged.
 */
function foundationBuildSymptomLogTimelineSummary_(row) {
  var parts = [];
  if (row.severity !== '') parts.push('Severity ' + row.severity);
  if (row.sleep !== '') parts.push('Sleep ' + row.sleep);
  if (row.energy !== '') parts.push('Energy ' + row.energy);
  if (row.stress !== '') parts.push('Stress ' + row.stress);
  var summary = parts.length > 0 ? parts.join(', ') : 'Symptom check-in logged.';
  if (row.notes && row.notes.trim() !== '') {
    summary += parts.length > 0 ? ' — ' + row.notes.trim() : row.notes.trim();
  }
  return summary;
}

/**
 * Maps a submitted SymptomLogs row to the shared timeline-entry shape
 * (shared/schemas/timeline-entry.schema.json). entry_date is submitted_at
 * — the moment this entry became real and Timeline-visible.
 */
function foundationSymptomLogToTimelineEntry_(row) {
  return {
    record_id: row.record_id,
    entry_date: row.submitted_at,
    entry_type: 'symptom_log',
    title: 'Symptom check-in',
    summary_text: foundationBuildSymptomLogTimelineSummary_(row)
  };
}

/**
 * Maps a ConsultationHistory row (already shaped by
 * FoundationConsultationHistory.gs) to the shared timeline-entry shape —
 * a straight field carry-over, entry_type fixed to "consultation".
 */
function foundationConsultationEntryToTimelineEntry_(row) {
  return {
    record_id: row.record_id,
    entry_date: row.entry_date,
    entry_type: 'consultation',
    title: row.title,
    summary_text: row.summary_text
  };
}

/**
 * Sorts two timeline-entry-shaped items newest-first by entry_date — both
 * are ISO-formatted strings, so a plain string comparison sorts correctly
 * (same convention as foundationCompareConsultationEntriesDesc_() and
 * foundationCompareSymptomLogsDesc_()). No secondary tiebreaker is applied
 * across sources deliberately — entry_date already carries a full
 * timestamp (not just a date) for both sources, so a tie is exceedingly
 * unlikely and, if it occurs, either ordering is equally defensible.
 */
function foundationCompareTimelineEntriesDesc_(a, b) {
  if (a.entry_date !== b.entry_date) {
    return a.entry_date < b.entry_date ? 1 : -1;
  }
  return 0;
}

// ---- Merge operation ----

/**
 * Returns patientId's merged Timeline: ConsultationHistory entries plus
 * submitted (never draft) Symptom Log entries, sorted newest-first and
 * capped at FOUNDATION_TIMELINE_MAX_ENTRIES_ — applied once, to the merged
 * list, not once per source. patientId must already be session-verified
 * by the caller (ADR-002), same contract as
 * FoundationConsultationHistory.gs's own foundationGetPatientTimeline_().
 */
function foundationGetPatientTimelineMerged_(patientId) {
  return withFoundationErrorHandling_(function () {
    var consultationResult = foundationGetPatientTimeline_(patientId);
    if (consultationResult.status === 'error') {
      throw new Error('Timeline merge: ConsultationHistory read failed.');
    }
    // Explicit named invocation, not a bare function reference passed to
    // .map() — the same fix PA-3 already applied to
    // foundationCompareConsultationEntriesDesc_() for the identical
    // static-analysis scan gap (validation/static-analysis/analyze.js's
    // call-site scan only recognizes name(...) syntax, not a function
    // passed by reference). A one-off code-level fix, not a tool change,
    // per that batch's own precedent.
    var consultationEntries = consultationResult.data.map(function (row) {
      return foundationConsultationEntryToTimelineEntry_(row);
    });

    var submittedSymptomLogs = foundationGetSubmittedSymptomLogsForTimeline_(patientId);
    var symptomEntries = submittedSymptomLogs.map(function (row) {
      return foundationSymptomLogToTimelineEntry_(row);
    });

    var merged = consultationEntries.concat(symptomEntries);
    merged.sort(function (a, b) { return foundationCompareTimelineEntriesDesc_(a, b); });
    return merged.slice(0, FOUNDATION_TIMELINE_MAX_ENTRIES_);
  });
}
