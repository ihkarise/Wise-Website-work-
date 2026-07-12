(function () {
  // Batch WPI-11 (docs/56-WPI-11-HOLOSCAN-ARCHITECTURE-FREEZE.md §19.1) — the patient's
  // own full Medication History page, reached only from the Holoscan dashboard card's
  // own link (no separate registry entry gates it, mirroring Report's/Check-In's own
  // full-history pages exactly). Read-only: no Continue/Stop/Replace/Unknown control
  // appears here — those remain doctor-only, exercised from the Doctor Dashboard's own
  // Medication History card.
  var greeting = document.getElementById('greeting');
  var content = document.getElementById('mhContent');

  WiseSessionGuard.wireSignOut('signOutBtn');

  function escapeHtmlForDisplay(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function emptyStateHtml() {
    return '<div class="card" style="max-width:720px">' +
      '<p class="empty-badge badge-nodata" style="display:inline-block;font-size:11.5px;font-weight:600;letter-spacing:.02em;text-transform:uppercase;padding:4px 10px;border-radius:999px;margin-bottom:10px;background:var(--color-surface);color:var(--color-text-secondary);border:1px solid var(--color-line)">No medications yet</p>' +
      '<p style="font-size:14px;color:var(--color-text-secondary);line-height:1.55;margin:0">Medicines your doctor confirms from a Medication Photo Scan will appear here.</p>' +
      '</div>';
  }

  var STATUS_LABELS = { active: 'Active', stopped: 'Stopped', replaced: 'Replaced', unknown: 'Unknown' };
  var DECISION_LABELS = { continue: 'Continued', stop: 'Stopped', replace: 'Replaced', unknown: 'Marked unknown' };

  function ledgerHtml(decisions) {
    if (!decisions || !decisions.length) return '';
    var items = decisions.slice().sort(function (a, b) {
      return a.decided_at < b.decided_at ? 1 : (a.decided_at > b.decided_at ? -1 : 0);
    }).map(function (d) {
      return '<li>' + escapeHtmlForDisplay(String(d.decided_at).slice(0, 10)) + ' — ' +
        escapeHtmlForDisplay(DECISION_LABELS[d.decision_type] || d.decision_type) +
        (d.notes ? ' — ' + escapeHtmlForDisplay(d.notes) : '') + '</li>';
    }).join('');
    return '<ul class="mh-ledger">' + items + '</ul>';
  }

  // No edit affordance — every field here is doctor-authored/derived, patient-viewable
  // read-only (docs/56 §11.3's own ownership rule).
  function entryHtml(entry) {
    var dateOnly = String(entry.created_at).slice(0, 10);
    var strengthLine = entry.strength ? (' ' + escapeHtmlForDisplay(entry.strength)) : '';
    return '<li class="tl-item">' +
      '<span class="tl-dot" aria-hidden="true"></span>' +
      '<div class="tl-body">' +
      '<span class="tl-date">Since ' + escapeHtmlForDisplay(dateOnly) + '</span>' +
      '<h3>' + escapeHtmlForDisplay(entry.medicine_name) + strengthLine + '</h3>' +
      '<p class="mh-status">' + escapeHtmlForDisplay(STATUS_LABELS[entry.current_status] || entry.current_status) + '</p>' +
      '<p class="mh-meta">' + escapeHtmlForDisplay(entry.dosage_form || '') +
      (entry.manufacturer ? (' &middot; ' + escapeHtmlForDisplay(entry.manufacturer)) : '') + '</p>' +
      ledgerHtml(entry.decisions) +
      '</div>' +
      '</li>';
  }

  function listHtml(entries) {
    if (!entries.length) {
      return emptyStateHtml();
    }
    var sorted = entries.slice().sort(function (a, b) {
      return a.created_at < b.created_at ? 1 : (a.created_at > b.created_at ? -1 : 0);
    });
    return '<ol class="tl-track" aria-label="Medication History">' +
      sorted.map(entryHtml).join('') +
      '</ol>';
  }

  function renderError() {
    content.innerHTML = '<div class="card" style="max-width:720px"><p style="font-size:14px;color:var(--color-text-secondary);margin:0">Could not load your medication history. Check your connection and reload the page.</p></div>';
  }

  WiseSessionGuard.requireSession({
    onReady: function (profile) {
      greeting.textContent = 'Hi, ' + profile.full_name;
      // Own record only — patient_id is always session-derived server-side
      // (MedicationHistory.gs's own dual-guard resolution); no patient_id is
      // ever sent from this page.
      WiseSessionGuard.callFoundation('get_medication_history')
        .then(function (data) {
          content.setAttribute('aria-busy', 'false');
          if (data.status === 'ok' && Array.isArray(data.data)) {
            content.innerHTML = listHtml(data.data);
          } else {
            renderError();
          }
        })
        .catch(function () {
          content.setAttribute('aria-busy', 'false');
          renderError();
        });
    },
    onNetworkError: function () {
      content.setAttribute('aria-busy', 'false');
      renderError();
    }
  });

  // Explicit, minimal test-support surface — mirrors reports.js's own
  // window.WiseReports convention.
  window.WiseMedications = {
    entryHtml: entryHtml,
    listHtml: listHtml,
    ledgerHtml: ledgerHtml
  };
})();
