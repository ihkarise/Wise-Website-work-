(function () {
  var greeting = document.getElementById('greeting');
  var draftSection = document.getElementById('draftSection');
  var historySection = document.getElementById('historySection');
  var formStatus = document.getElementById('formStatus');

  WiseSessionGuard.wireSignOut('signOutBtn');

  function escapeHtmlForDisplay(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // Mirrors FoundationTimeline.gs's foundationBuildSymptomLogTimelineSummary_()
  // — a read-time re-formatting of the same raw fields get_symptom_logs
  // returns, never a second source of truth for what those fields mean.
  function symptomSummaryText(row) {
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

  function showStatus(type, message) {
    formStatus.className = 'status ' + type;
    formStatus.textContent = message;
  }

  function clearStatus() {
    formStatus.className = 'status';
    formStatus.textContent = '';
  }

  // A friendly, specific offline message — per the approved decision, no
  // local persistence and no background sync: the form's current values
  // are simply left exactly as typed (never cleared), so the patient can
  // press the same button again once reconnected. Distinct from a
  // rejected-session message (session-guard.js's own concern) and from a
  // validation error (the backend's own specific message, shown verbatim).
  function showOfflineMessage() {
    showStatus('err', 'You appear to be offline. Check your connection and try again — your entry has not been lost.');
  }

  function scaleFieldHtml(id, label, value) {
    return '<div class="st-scale-field field">' +
      '<label for="' + id + '">' + label + '</label>' +
      '<input type="number" id="' + id + '" min="1" max="10" step="1" inputmode="numeric" value="' + escapeHtmlForDisplay(value) + '">' +
      '</div>';
  }

  function draftFormHtml(draft) {
    return '<div class="card">' +
      '<p class="sub" style="text-align:left;margin-bottom:18px">Private until you submit it — only you can see this draft.</p>' +
      '<form id="symptomForm">' +
      '<div class="st-scale-grid">' +
      scaleFieldHtml('fieldSeverity', 'Severity (1–10)', draft.severity) +
      scaleFieldHtml('fieldSleep', 'Sleep (1–10)', draft.sleep) +
      scaleFieldHtml('fieldEnergy', 'Energy (1–10)', draft.energy) +
      scaleFieldHtml('fieldStress', 'Stress (1–10)', draft.stress) +
      '</div>' +
      '<p class="st-scale-hint" style="margin-top:-8px;margin-bottom:18px">Leave any field blank if you\'d rather not log it.</p>' +
      '<div class="field st-notes">' +
      '<label for="fieldNotes">Notes (optional)</label>' +
      '<textarea id="fieldNotes" maxlength="2000">' + escapeHtmlForDisplay(draft.notes) + '</textarea>' +
      '</div>' +
      '<div class="st-actions">' +
      '<button type="button" class="st-save" id="saveDraftBtn">Save draft</button>' +
      '<button type="submit" class="submit" id="submitBtn">Submit entry</button>' +
      '</div>' +
      '</form>' +
      '</div>';
  }

  function startEntryHtml() {
    return '<div class="card">' +
      '<p class="sub" style="text-align:left;margin-bottom:18px">Log how you\'re feeling right now. You can save a draft and finish it later — only you can see it until you submit.</p>' +
      '<button type="button" class="submit" id="startEntryBtn" style="width:auto">Log a new entry</button>' +
      '</div>';
  }

  function historyItemHtml(entry) {
    return '<li class="tl-item">' +
      '<span class="tl-dot" aria-hidden="true"></span>' +
      '<div class="tl-body">' +
      '<span class="tl-date">' + escapeHtmlForDisplay(entry.submitted_at) + '</span>' +
      '<h3>Symptom check-in</h3>' +
      '<p class="tl-summary">' + escapeHtmlForDisplay(symptomSummaryText(entry)) + '</p>' +
      '</div>' +
      '</li>';
  }

  function historyEmptyStateHtml() {
    return '<div class="card" style="max-width:680px">' +
      '<p class="empty-badge badge-nodata" style="display:inline-block;font-size:11.5px;font-weight:600;letter-spacing:.02em;text-transform:uppercase;padding:4px 10px;border-radius:999px;margin-bottom:10px;background:var(--color-surface);color:var(--color-text-secondary);border:1px solid var(--color-line)">No entries yet</p>' +
      '<p style="font-size:14px;color:var(--color-text-secondary);line-height:1.55;margin:0">Entries you submit will appear here.</p>' +
      '</div>';
  }

  function historyListHtml(submitted) {
    if (!submitted.length) return historyEmptyStateHtml();
    return '<ol class="tl-track" aria-label="Symptom log history">' + submitted.map(historyItemHtml).join('') + '</ol>';
  }

  function renderNetworkErrorSections() {
    var message = '<div class="card"><p style="font-size:14px;color:var(--color-text-secondary);margin:0">Could not reach the server. Check your connection and reload the page.</p></div>';
    draftSection.setAttribute('aria-busy', 'false');
    historySection.setAttribute('aria-busy', 'false');
    draftSection.innerHTML = message;
    historySection.innerHTML = message;
  }

  function wireStartEntryButton() {
    var btn = document.getElementById('startEntryBtn');
    if (!btn) return;
    btn.addEventListener('click', function () {
      btn.disabled = true;
      WiseSessionGuard.callFoundation('create_symptom_draft')
        .then(function (data) {
          if (data.status === 'ok') {
            clearStatus();
            renderDraft(data.data);
          } else {
            btn.disabled = false;
            showStatus('err', (data.error && data.error.message) || 'Could not start a new entry.');
          }
        })
        .catch(function () {
          btn.disabled = false;
          showOfflineMessage();
        });
    });
  }

  function currentFormValues() {
    return {
      severity: document.getElementById('fieldSeverity').value,
      sleep: document.getElementById('fieldSleep').value,
      energy: document.getElementById('fieldEnergy').value,
      stress: document.getElementById('fieldStress').value,
      notes: document.getElementById('fieldNotes').value
    };
  }

  function reloadHistory() {
    WiseSessionGuard.callFoundation('get_symptom_logs')
      .then(function (data) {
        if (data.status === 'ok') {
          historySection.setAttribute('aria-busy', 'false');
          historySection.innerHTML = historyListHtml(data.data.submitted);
        }
      })
      .catch(function () { /* history refresh failing silently is acceptable — the draft/status feedback already told the patient what happened */ });
  }

  function wireDraftForm(draft) {
    var form = document.getElementById('symptomForm');
    var saveBtn = document.getElementById('saveDraftBtn');
    var submitBtn = document.getElementById('submitBtn');

    saveBtn.addEventListener('click', function () {
      saveBtn.disabled = true;
      submitBtn.disabled = true;
      WiseSessionGuard.callFoundation('update_symptom_draft', Object.assign({ record_id: draft.record_id }, currentFormValues()))
        .then(function (data) {
          saveBtn.disabled = false;
          submitBtn.disabled = false;
          if (data.status === 'ok') {
            showStatus('ok', 'Draft saved.');
          } else {
            showStatus('err', (data.error && data.error.message) || 'Could not save your draft.');
          }
        })
        .catch(function () {
          saveBtn.disabled = false;
          submitBtn.disabled = false;
          showOfflineMessage();
        });
    });

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      saveBtn.disabled = true;
      submitBtn.disabled = true;
      var values = currentFormValues();
      WiseSessionGuard.callFoundation('update_symptom_draft', Object.assign({ record_id: draft.record_id }, values))
        .then(function (saveResult) {
          if (saveResult.status !== 'ok') {
            saveBtn.disabled = false;
            submitBtn.disabled = false;
            showStatus('err', (saveResult.error && saveResult.error.message) || 'Could not save your entry before submitting.');
            return;
          }
          return WiseSessionGuard.callFoundation('submit_symptom_log', { record_id: draft.record_id })
            .then(function (submitResult) {
              saveBtn.disabled = false;
              submitBtn.disabled = false;
              if (submitResult.status === 'ok') {
                showStatus('ok', 'Entry submitted. Thank you for logging how you\'re feeling.');
                draftSection.innerHTML = startEntryHtml();
                wireStartEntryButton();
                reloadHistory();
              } else {
                showStatus('err', (submitResult.error && submitResult.error.message) || 'Could not submit your entry.');
              }
            });
        })
        .catch(function () {
          saveBtn.disabled = false;
          submitBtn.disabled = false;
          showOfflineMessage();
        });
    });
  }

  function renderDraft(draft) {
    draftSection.setAttribute('aria-busy', 'false');
    if (draft) {
      draftSection.innerHTML = draftFormHtml(draft);
      wireDraftForm(draft);
    } else {
      draftSection.innerHTML = startEntryHtml();
      wireStartEntryButton();
    }
  }

  WiseSessionGuard.requireSession({
    onReady: function (profile) {
      greeting.textContent = 'Hi, ' + profile.full_name;
      WiseSessionGuard.callFoundation('get_symptom_logs')
        .then(function (data) {
          if (data.status === 'ok') {
            renderDraft(data.data.draft);
            historySection.setAttribute('aria-busy', 'false');
            historySection.innerHTML = historyListHtml(data.data.submitted);
          } else {
            renderNetworkErrorSections();
          }
        })
        .catch(function () {
          renderNetworkErrorSections();
        });
    },
    onNetworkError: function () {
      renderNetworkErrorSections();
    }
  });

  // Explicit, minimal test-support surface — same convention as
  // dashboard.js's window.WiseDashboard / timeline.js's window.WiseTimeline.
  window.WiseSymptomTracker = {
    symptomSummaryText: symptomSummaryText,
    historyListHtml: historyListHtml,
    draftFormHtml: draftFormHtml,
    startEntryHtml: startEntryHtml
  };
})();
